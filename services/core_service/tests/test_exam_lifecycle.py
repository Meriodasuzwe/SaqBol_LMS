"""Real exam lifecycle API/ORM checks. Synthetic offline database only.

No grader or validation mocks: only clock control and an intentional late ORM
failure are injected. The existing KT matrix remains covered separately.
"""
from copy import deepcopy
from datetime import timedelta
from io import StringIO
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import override_settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result

_fixture_spec = importlib.util.spec_from_file_location(
    'exam_synthetic_profile', Path(__file__).parent / 'fixtures' / 'kt_profile.py',
)
_fixture = importlib.util.module_from_spec(_fixture_spec)
_fixture_spec.loader.exec_module(_fixture)

pytestmark = pytest.mark.django_db
CONFIG = 'm094_profile_ru_v1'
DEMO = 'm094_profile_ru_demo_v1'
SCIENTIFIC = 'm094_scientific_ru_v1'


def attempt_model():
    return apps.get_model('quizzes', 'ExamAttempt')


def assert_isolation():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)


@pytest.fixture
def graph():
    assert_isolation()
    users = get_user_model()
    teacher = users.objects.create_user(username='exam_synthetic_teacher', role='teacher')
    student = users.objects.create_user(username='exam_synthetic_student', role='student')
    other = users.objects.create_user(username='exam_synthetic_other', role='student')
    category = Category.objects.create(title='Искусственный lifecycle')
    course = Course.objects.create(title='Искусственный контейнер экзамена',
                                   teacher=teacher, category=category, status='published')
    lesson = Lesson.objects.create(course=course, title='Синтетический профильный блок')
    quiz, items = _fixture.create_profile_quiz(lesson)
    Quiz.objects.filter(pk=quiz.pk).update(exam_configuration_key=CONFIG)
    quiz.refresh_from_db()
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    other_client = APIClient(raise_request_exception=False)
    other_client.force_authenticate(other)
    return SimpleNamespace(teacher=teacher, student=student, other=other, course=course,
                           lesson=lesson, quiz=quiz, items=items, client=client, other_client=other_client)


def start(graph, request_id=None, configuration_id=CONFIG):
    data = {'configuration_id': configuration_id, 'request_id': str(request_id or uuid4())}
    return graph.client.post('/exams/attempts/', data, format='json')


def opened(graph):
    response = start(graph)
    assert response.status_code == 201, response.data
    value = response.json()
    UUID(value['id'])
    return value, f"/exams/attempts/{value['id']}/"


def all_answers(graph):
    return [{'question_id': item['question'].pk, 'choice_ids': list(item['correct_ids'])}
            for item in graph.items]


def mutation(answers=None, revision=0, request_id=None, **extra):
    return {'request_id': str(request_id or uuid4()), 'revision': revision,
            'answers': [] if answers is None else answers, **extra}


def history_counts():
    return Result.objects.count(), QuizAttemptDetail.objects.count(), QuestionAnswer.objects.count()


def state():
    return {model.__name__: list(model.objects.order_by('pk').values())
            for model in (attempt_model(), Result, QuizAttemptDetail, QuestionAnswer)}


def assert_no_solutions(value):
    if isinstance(value, dict):
        assert not ({'correct_choice_ids', 'correct_answers_ids', 'explanation',
                     'is_correct', 'earned_points'} & value.keys()), value.keys()
        for item in value.values():
            assert_no_solutions(item)
    elif isinstance(value, list):
        for item in value:
            assert_no_solutions(item)


def questions(data):
    return [question for section in data['sections'] for question in section['questions']]


def selections(data):
    return {item['question_id']: item['choice_ids'] for item in data['answers']}


def test_exam_catalog_route_exists_and_reading_it_creates_nothing():
    assert_isolation()
    user = get_user_model().objects.create_user(username='exam_catalog_only')
    client = APIClient()
    client.force_authenticate(user)
    response = client.get('/exams/configurations/')
    assert response.status_code == 200, getattr(response, 'data', response.status_code)
    assert isinstance(response.json(), list)
    assert attempt_model().objects.count() == 0
    assert history_counts() == (0, 0, 0)


def test_exam_start_creates_only_active_attempt_and_hides_solution(graph):
    data, _ = opened(graph)
    stored = attempt_model().objects.get(pk=data['id'])
    assert data['status'] == stored.status == 'active'
    assert data['revision'] == stored.revision == 0
    assert stored.student_id == graph.student.pk
    assert stored.source_quiz_id == graph.quiz.pk
    assert data['result'] is None and stored.result_id is None
    assert data['completed_at'] is None
    assert parse_datetime(data['deadline']) - parse_datetime(data['started_at']) == timedelta(minutes=100)
    assert parse_datetime(data['server_time']) is not None
    assert data['configuration']['id'] == CONFIG
    assert data['configuration']['program']['code'] == 'M094'
    assert data['configuration']['language'] == 'ru'
    assert data['configuration']['total_questions'] == 50
    assert data['configuration']['max_points'] == 70
    assert history_counts() == (0, 0, 0)
    assert len(questions(data)) == len(data['answers']) == 50
    assert all(not ids for ids in selections(data).values())
    assert_no_solutions(data)


def test_exam_sections_have_local_numbers_and_response_mode_not_key_count(graph):
    data, _ = opened(graph)
    first, second = data['sections']
    assert first['id'] == 'first_subject' and second['id'] == 'second_subject'
    assert [q['number'] for q in first['questions']] == list(range(1, 31))
    assert [q['number'] for q in second['questions']] == list(range(1, 21))
    assert first['response_type'] == 'single'
    assert second['response_type'] == 'multiple'
    assert first['max_points'] == 30 and second['max_points'] == 40
    assert first['questions'][0]['id'] != second['questions'][0]['id']
    assert len({q['id'] for q in questions(data)}) == 50
    assert_no_solutions(data)


def test_exam_start_retry_reuses_attempt_and_rejects_changed_configuration(graph):
    request_id = uuid4()
    first = start(graph, request_id)
    assert first.status_code == 201
    second = start(graph, request_id)
    assert second.status_code == 200
    assert second.json()['id'] == first.json()['id']
    assert attempt_model().objects.count() == 1
    conflict = start(graph, request_id, SCIENTIFIC)
    assert conflict.status_code == 409
    assert attempt_model().objects.count() == 1
    assert history_counts() == (0, 0, 0)


def test_exam_start_retry_survives_source_deletion(graph):
    request_id = uuid4()
    first = start(graph, request_id)
    assert first.status_code == 201
    frozen = first.json()['sections']
    graph.quiz.delete()
    replay = start(graph, request_id)
    assert replay.status_code == 200
    assert replay.json()['id'] == first.json()['id']
    assert replay.json()['sections'] == frozen
    assert attempt_model().objects.count() == 1


def test_exam_explicit_new_start_uses_new_attempt_without_erasing_old(graph):
    first, url = opened(graph)
    completed = graph.client.post(url + 'finish/', mutation(), format='json')
    assert completed.status_code == 200
    before = state()
    second = start(graph)
    assert second.status_code == 201
    assert second.json()['id'] != first['id']
    assert attempt_model().objects.count() == 2
    assert history_counts() == (1, 1, 50)
    assert state()['Result'] == before['Result']
    assert state()['QuestionAnswer'] == before['QuestionAnswer']


@pytest.mark.parametrize('case', ['no_binding', 'draft', 'wrong_mode', 'ambiguous', 'wrong_count', 'unassigned_section', 'invalid_key'])
def test_exam_unavailable_or_invalid_source_cannot_create_attempt(graph, case):
    if case == 'no_binding':
        Quiz.objects.filter(pk=graph.quiz.pk).update(exam_configuration_key='')
    elif case == 'draft':
        Course.objects.filter(pk=graph.course.pk).update(status='draft')
    elif case == 'wrong_mode':
        Quiz.objects.filter(pk=graph.quiz.pk).update(mode='training')
    elif case == 'ambiguous':
        duplicate, _ = _fixture.create_profile_quiz(graph.lesson)
        Quiz.objects.filter(pk=duplicate.pk).update(exam_configuration_key=CONFIG)
    elif case == 'wrong_count':
        graph.items[-1]['question'].delete()
    elif case == 'unassigned_section':
        Question.objects.filter(pk=graph.items[0]['question'].pk).update(kt_subject='')
    else:
        Choice.objects.filter(question=graph.items[0]['question']).update(is_correct=False)
    response = start(graph)
    assert response.status_code in (400, 409), response.data
    assert attempt_model().objects.count() == 0
    assert history_counts() == (0, 0, 0)


def test_exam_scientific_mode_never_starts_from_fifty_profile_questions(graph):
    response = start(graph, configuration_id=SCIENTIFIC)
    assert response.status_code in (400, 409)
    assert attempt_model().objects.count() == 0
    assert history_counts() == (0, 0, 0)


def test_exam_demo_is_disabled_by_default(graph):
    Quiz.objects.filter(pk=graph.quiz.pk).update(exam_configuration_key=DEMO)
    with override_settings(EXAM_DEMO_ENABLED=False):
        response = start(graph, configuration_id=DEMO)
    assert response.status_code in (400, 404, 409)
    assert attempt_model().objects.count() == 0


def test_exam_explicit_demo_is_artificial_and_has_no_exam_deadline(graph):
    Quiz.objects.filter(pk=graph.quiz.pk).update(exam_configuration_key=DEMO)
    with override_settings(EXAM_DEMO_ENABLED=True):
        response = start(graph, configuration_id=DEMO)
    assert response.status_code == 201, response.data
    data = response.json()
    assert data['configuration']['is_demo'] is True
    assert data['configuration']['title'] == 'Демонстрация двух профильных предметов'
    assert data['deadline'] is None
    assert_no_solutions(data)


def test_exam_save_and_resume_preserve_answers_flags_positions_by_stable_id(graph):
    data, url = opened(graph)
    first, db = graph.items[0], graph.items[30]
    payload = mutation([
        {'question_id': first['question'].pk, 'choice_ids': first['correct_ids']},
        {'question_id': db['question'].pk, 'choice_ids': [db['choices'][0].pk, db['choices'][2].pk]},
    ], flagged_question_ids=[db['question'].pk], last_question_by_section={
        'first_subject': first['question'].pk, 'second_subject': db['question'].pk,
    })
    saved = graph.client.patch(url + 'answers/', payload, format='json')
    assert saved.status_code == 200, saved.data
    assert saved.json()['revision'] == 1
    fresh_client = APIClient()
    fresh_client.force_authenticate(graph.student)
    restored = fresh_client.get(url)
    assert restored.status_code == 200
    value = restored.json()
    assert value['id'] == data['id']
    assert value['deadline'] == data['deadline']
    assert selections(value)[first['question'].pk] == first['correct_ids']
    assert selections(value)[db['question'].pk] == [db['choices'][0].pk, db['choices'][2].pk]
    assert value['flagged_question_ids'] == [db['question'].pk]
    assert value['last_question_by_section'] == payload['last_question_by_section']
    assert history_counts() == (0, 0, 0)
    assert_no_solutions(value)


def test_exam_save_is_full_replacement_can_clear_answers_and_preserve_omitted_ui_state(graph):
    _, url = opened(graph)
    question = graph.items[0]['question'].pk
    first = graph.client.patch(url + 'answers/', mutation(all_answers(graph), flagged_question_ids=[question],
                              last_question_by_section={'first_subject': question}), format='json')
    assert first.status_code == 200
    cleared = graph.client.patch(url + 'answers/', mutation([], revision=1), format='json')
    assert cleared.status_code == 200
    assert cleared.json()['revision'] == 2
    assert all(not choice_ids for choice_ids in selections(cleared.json()).values())
    assert cleared.json()['flagged_question_ids'] == [question]
    assert cleared.json()['last_question_by_section'] == first.json()['last_question_by_section']
    unflagged = graph.client.patch(url + 'answers/', mutation([], revision=2, flagged_question_ids=[]), format='json')
    assert unflagged.status_code == 200
    assert unflagged.json()['flagged_question_ids'] == []


def test_exam_save_retry_is_idempotent_but_old_version_never_overwrites_newer_answers(graph):
    _, url = opened(graph)
    first = mutation(all_answers(graph))
    saved = graph.client.patch(url + 'answers/', first, format='json')
    assert saved.status_code == 200
    replay = graph.client.patch(url + 'answers/', first, format='json')
    assert replay.status_code == 200 and replay.json()['revision'] == 1
    changed_same_id = deepcopy(first)
    changed_same_id['answers'] = []
    assert graph.client.patch(url + 'answers/', changed_same_id, format='json').status_code == 409
    newest = mutation([], revision=1)
    assert graph.client.patch(url + 'answers/', newest, format='json').status_code == 200
    before = state()
    stale = graph.client.patch(url + 'answers/', first, format='json')
    assert stale.status_code == 409
    assert state() == before
    assert all(not ids for ids in selections(graph.client.get(url).json()).values())


@pytest.mark.parametrize('operation', ['save', 'finish'])
@pytest.mark.parametrize('case', [
    'duplicate_question', 'foreign_question', 'foreign_choice', 'duplicate_choice',
    'single_multiple_choices', 'bad_question_type', 'bad_choice_type', 'bad_answers_type',
    'bad_revision_type', 'negative_revision', 'missing_request_id', 'bad_request_id',
    'foreign_flag', 'duplicate_flag', 'bad_flag_type', 'foreign_section', 'wrong_section_question',
    'bad_position_type', 'client_score', 'client_deadline', 'client_correctness',
])
def test_exam_invalid_write_rejects_entire_request_without_partial_writes(graph, case, operation):
    _, url = opened(graph)
    q = graph.items[0]
    payload = mutation([{'question_id': q['question'].pk, 'choice_ids': q['correct_ids']}])
    if case == 'duplicate_question': payload['answers'] *= 2
    elif case == 'foreign_question': payload['answers'][0]['question_id'] = 999999
    elif case == 'foreign_choice': payload['answers'][0]['choice_ids'] = [graph.items[1]['choices'][0].pk]
    elif case == 'duplicate_choice': payload['answers'][0]['choice_ids'] *= 2
    elif case == 'single_multiple_choices': payload['answers'][0]['choice_ids'] = [c.pk for c in q['choices'][:2]]
    elif case == 'bad_question_type': payload['answers'][0]['question_id'] = str(q['question'].pk)
    elif case == 'bad_choice_type': payload['answers'][0]['choice_ids'] = [True]
    elif case == 'bad_answers_type': payload['answers'] = {}
    elif case == 'bad_revision_type': payload['revision'] = True
    elif case == 'negative_revision': payload['revision'] = -1
    elif case == 'missing_request_id': del payload['request_id']
    elif case == 'bad_request_id': payload['request_id'] = 'not-a-uuid'
    elif case == 'foreign_flag': payload['flagged_question_ids'] = [999999]
    elif case == 'duplicate_flag': payload['flagged_question_ids'] = [q['question'].pk] * 2
    elif case == 'bad_flag_type': payload['flagged_question_ids'] = [True]
    elif case == 'foreign_section': payload['last_question_by_section'] = {'invented_subject': q['question'].pk}
    elif case == 'wrong_section_question': payload['last_question_by_section'] = {'first_subject': graph.items[30]['question'].pk}
    elif case == 'bad_position_type': payload['last_question_by_section'] = {'first_subject': str(q['question'].pk)}
    elif case == 'client_score': payload['score'] = 100
    elif case == 'client_deadline': payload['deadline'] = '2099-01-01T00:00:00Z'
    elif case == 'client_correctness': payload['answers'][0]['is_correct'] = True
    before = state()
    response = (graph.client.patch(url + 'answers/', payload, format='json') if operation == 'save' else
                graph.client.post(url + 'finish/', payload, format='json'))
    assert response.status_code == 400, response.data
    assert state() == before


def test_exam_multiple_choices_are_not_artificially_capped_at_three(graph):
    _, url = opened(graph)
    item = graph.items[32]
    selected = [choice.pk for choice in item['choices'][:4]]
    response = graph.client.post(url + 'finish/', mutation([
        {'question_id': item['question'].pk, 'choice_ids': selected},
    ]), format='json')
    assert response.status_code == 200, response.data
    result = Result.objects.get()
    assert result.scoring_details['earned_points'] == 1
    assert result.detail.answers.get(question_snapshot__id=item['question'].pk).selected_choice_ids == selected


def test_exam_finish_atomically_uses_current_payload_and_persists_every_answer(graph):
    data, url = opened(graph)
    saved = graph.client.patch(url + 'answers/', mutation([]), format='json')
    assert saved.status_code == 200
    response = graph.client.post(url + 'finish/', mutation(all_answers(graph), revision=1), format='json')
    assert response.status_code == 200, response.data
    stored = attempt_model().objects.get(pk=data['id'])
    result = Result.objects.get(pk=stored.result_id)
    assert stored.status == 'completed' and stored.completion_reason == 'manual'
    assert result.scoring_mode == 'kt_profile'
    assert result.scoring_details['earned_points'] == result.scoring_details['max_points'] == 70
    assert result.score == 100
    assert history_counts() == (1, 1, 50)
    assert result.detail.started_at == stored.started_at
    assert result.detail.total_questions == 50
    assert stored.source_quiz_id == graph.quiz.pk
    assert result.quiz_id is None and result.detail.quiz_id is None
    assert result.detail.quiz_snapshot['id'] == graph.quiz.pk
    assert result.detail.quiz_snapshot['title'] == graph.quiz.title
    assert sum(a.question_snapshot['earned_points'] for a in result.detail.answers.all()) == 70
    for item in graph.items:
        answer = result.detail.answers.get(question_snapshot__id=item['question'].pk)
        assert answer.question_id is None and answer.selected_choice_id is None
        assert answer.selected_choice_ids == item['correct_ids']
        assert answer.question_snapshot['correct_choice_ids'] == item['correct_ids']
        assert answer.question_snapshot['text'] == item['question'].text
        assert answer.question_snapshot['explanation'] == item['question'].explanation
        assert answer.question_snapshot['choices'] == [
            {'id': choice.pk, 'text': choice.text} for choice in item['choices']
        ]


def test_exam_finish_partial_wrong_and_skipped_scores_are_from_existing_grader(graph):
    _, url = opened(graph)
    single, partial, full, wrong = [graph.items[index] for index in (0, 31, 32, 49)]
    payload = mutation([
        {'question_id': single['question'].pk, 'choice_ids': single['correct_ids']},
        {'question_id': partial['question'].pk, 'choice_ids': partial['correct_ids'][:1]},
        {'question_id': full['question'].pk, 'choice_ids': list(reversed(full['correct_ids']))},
        {'question_id': wrong['question'].pk, 'choice_ids': [wrong['choices'][-1].pk]},
    ])
    response = graph.client.post(url + 'finish/', payload, format='json')
    assert response.status_code == 200
    grade = Result.objects.get().scoring_details
    assert grade['earned_points'] == 4 and grade['max_points'] == 70
    assert grade['sections']['first_subject']['earned_points'] == 1
    assert grade['sections']['second_subject']['earned_points'] == 3
    assert [grade['questions'][str(item['question'].pk)]['earned_points']
            for item in (single, partial, full, wrong)] == [1, 1, 2, 0]
    assert history_counts() == (1, 1, 50)


def test_exam_empty_finish_is_zero_and_keeps_fifty_skipped_answers(graph):
    _, url = opened(graph)
    response = graph.client.post(url + 'finish/', mutation(), format='json')
    assert response.status_code == 200
    assert Result.objects.get().scoring_details['earned_points'] == 0
    assert Result.objects.get().score == 0
    assert history_counts() == (1, 1, 50)
    assert all(answer.selected_choice_ids == [] for answer in QuestionAnswer.objects.all())


def test_exam_finish_retry_does_not_create_result_twice_and_conflict_cannot_replace_it(graph):
    _, url = opened(graph)
    payload = mutation(all_answers(graph))
    first = graph.client.post(url + 'finish/', payload, format='json')
    assert first.status_code == 200
    before = state()
    retry = graph.client.post(url + 'finish/', payload, format='json')
    assert retry.status_code == 200
    assert retry.json()['result']['id'] == first.json()['result']['id']
    assert state() == before
    payload['answers'] = []
    assert graph.client.post(url + 'finish/', payload, format='json').status_code == 409
    assert state() == before
    assert graph.client.patch(url + 'answers/', mutation([], revision=1), format='json').status_code == 409
    assert state() == before


def test_exam_finish_stale_revision_cannot_complete_using_old_answers(graph):
    _, url = opened(graph)
    assert graph.client.patch(url + 'answers/', mutation(all_answers(graph)), format='json').status_code == 200
    before = state()
    response = graph.client.post(url + 'finish/', mutation([], revision=0), format='json')
    assert response.status_code == 409
    assert state() == before and history_counts() == (0, 0, 0)


@pytest.mark.parametrize('change', ['edit', 'unpublish', 'delete', 'delete_course'])
def test_exam_frozen_start_content_grades_and_reviews_original_after_source_changes(graph, change):
    data, url = opened(graph)
    original_questions = deepcopy(questions(data))
    original_explanations = {item['question'].pk: item['question'].explanation for item in graph.items}
    answers = all_answers(graph)
    if change == 'edit':
        Quiz.objects.filter(pk=graph.quiz.pk).update(title='Changed title', mode='training')
        Question.objects.filter(quiz_id=graph.quiz.pk).update(text='Changed text', explanation='Changed explanation', kt_subject='')
        Choice.objects.filter(question__quiz_id=graph.quiz.pk).update(text='Changed choice', is_correct=False)
    elif change == 'unpublish':
        Course.objects.filter(pk=graph.course.pk).update(status='draft')
    elif change == 'delete_course':
        graph.course.delete()
    else:
        graph.quiz.delete()
    resumed = graph.client.get(url)
    assert resumed.status_code == 200
    assert questions(resumed.json()) == original_questions
    assert_no_solutions(resumed.json())
    finished = graph.client.post(url + 'finish/', mutation(answers), format='json')
    assert finished.status_code == 200, finished.data
    result = Result.objects.get()
    assert result.scoring_details['earned_points'] == 70
    review = graph.client.get(url + 'review/')
    assert review.status_code == 200
    reviewed = questions(review.json())
    for original, item in zip(original_questions, reviewed):
        assert item['id'] == original['id']
        assert item['text'] == original['text'] and item['choices'] == original['choices']
        assert item['explanation'] == original_explanations[item['id']]
        assert item['selected_choice_ids'] == item['correct_choice_ids']
        assert item['earned_points'] == item['max_points']
    assert history_counts() == (1, 1, 50)
    assert result.quiz_id is None and result.detail.quiz_id is None
    assert all(answer.question_id is None and answer.selected_choice_id is None
               for answer in QuestionAnswer.objects.all())
    assert {answer.question_snapshot['id'] for answer in QuestionAnswer.objects.all()} == {
        question['id'] for question in original_questions
    }


def test_exam_result_and_review_are_closed_before_finish(graph):
    _, url = opened(graph)
    for suffix in ('result/', 'review/'):
        response = graph.client.get(url + suffix)
        assert response.status_code == 409
        assert_no_solutions(response.json())
    assert history_counts() == (0, 0, 0)


@pytest.mark.parametrize('staff', [False, True])
@pytest.mark.parametrize('suffix,method', [('', 'get'), ('answers/', 'patch'), ('finish/', 'post'), ('result/', 'get'), ('review/', 'get')])
def test_exam_attempt_endpoints_are_owner_only(graph, suffix, method, staff):
    _, url = opened(graph)
    before = state()
    graph.other.is_staff = staff
    graph.other.is_superuser = staff
    graph.other.save(update_fields=['is_staff', 'is_superuser'])
    operation = getattr(graph.other_client, method)
    response = operation(url + suffix) if method == 'get' else operation(url + suffix, mutation(), format='json')
    assert response.status_code == 404
    assert state() == before


@pytest.mark.parametrize('path,method', [('/exams/configurations/', 'get'), ('/exams/attempts/', 'post')])
def test_exam_authentication_required_before_creating_or_reading(path, method):
    assert_isolation()
    client = APIClient()
    operation = getattr(client, method)
    response = operation(path) if method == 'get' else operation(path, {'configuration_id': CONFIG, 'request_id': str(uuid4())}, format='json')
    assert response.status_code == 401


@pytest.mark.parametrize('operation', ['save', 'finish', 'read'])
def test_exam_deadline_finalizes_only_acknowledged_answers_and_rejects_late_changes(graph, operation):
    data, url = opened(graph)
    assert graph.client.patch(url + 'answers/', mutation(all_answers(graph)), format='json').status_code == 200
    deadline = attempt_model().objects.get(pk=data['id']).deadline
    with patch('quizzes.exam_services.timezone.now', return_value=deadline):
        if operation == 'save':
            response = graph.client.patch(url + 'answers/', mutation([], revision=1), format='json')
        elif operation == 'finish':
            response = graph.client.post(url + 'finish/', mutation([], revision=1), format='json')
        else:
            response = graph.client.get(url)
    assert response.status_code == (200 if operation == 'read' else 409), response.data
    if operation != 'read':
        assert response.json()['code'] == 'deadline_expired'
    stored = attempt_model().objects.get(pk=data['id'])
    assert stored.status == 'completed' and stored.completion_reason == 'deadline'
    assert stored.completed_at == deadline
    assert Result.objects.get().scoring_details['earned_points'] == 70
    assert history_counts() == (1, 1, 50)
    assert graph.client.get(url + 'result/').status_code == 200


def test_exam_deadline_command_finishes_closed_tab_once_and_leaves_unexpired_attempt(graph):
    first, first_url = opened(graph)
    assert graph.client.patch(first_url + 'answers/', mutation(all_answers(graph)), format='json').status_code == 200
    second, _ = opened(graph)
    now = timezone.now()
    attempt_model().objects.filter(pk=first['id']).update(deadline=now - timedelta(seconds=1))
    output = StringIO()
    call_command('finalize_exam_attempts', limit=10, stdout=output)
    call_command('finalize_exam_attempts', limit=10, stdout=StringIO())
    expired = attempt_model().objects.get(pk=first['id'])
    assert expired.status == 'completed' and expired.completion_reason == 'deadline'
    assert attempt_model().objects.get(pk=second['id']).status == 'active'
    assert history_counts() == (1, 1, 50)


@pytest.mark.django_db(transaction=True)
def test_exam_finish_late_persistence_failure_rolls_back_entire_attempt(graph):
    _, url = opened(graph)
    before = state()
    real_write = QuestionAnswer.objects.bulk_create
    seen = []
    def fail_after_insert(*args, **kwargs):
        value = real_write(*args, **kwargs)
        seen.append(history_counts())
        raise RuntimeError('Synthetic failure after exam answers INSERT')
    with patch.object(QuestionAnswer.objects, 'bulk_create', side_effect=fail_after_insert):
        response = graph.client.post(url + 'finish/', mutation(all_answers(graph)), format='json')
    assert response.status_code == 500
    assert seen == [(1, 1, 50)]
    assert state() == before


@pytest.mark.django_db(transaction=True)
def test_exam_migration_preserves_existing_history_without_creating_attempts():
    assert_isolation()
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    old_target = [('quizzes', '0006_kt_profile_integration')]
    new_target = [('quizzes', '0007_exam_attempt')]
    try:
        executor.migrate(old_target)
        old = MigrationExecutor(connection).loader.project_state(old_target).apps
        user = get_user_model().objects.create_user(username='exam_migration_existing')
        category = old.get_model('courses', 'Category').objects.create(title='Synthetic existing category')
        course = old.get_model('courses', 'Course').objects.create(title='Synthetic existing course', teacher_id=user.pk, category_id=category.pk)
        lesson = old.get_model('courses', 'Lesson').objects.create(title='Synthetic existing lesson', course_id=course.pk)
        quiz = old.get_model('quizzes', 'Quiz').objects.create(title='Synthetic existing quiz', lesson_id=lesson.pk)
        result = old.get_model('quizzes', 'Result').objects.create(student_id=user.pk, quiz_id=quiz.pk, score=42.5)
        before = old.get_model('quizzes', 'Result').objects.values().get(pk=result.pk)
        executor = MigrationExecutor(connection)
        executor.migrate(new_target)
        new = MigrationExecutor(connection).loader.project_state(new_target).apps
        assert new.get_model('quizzes', 'Result').objects.values().get(pk=result.pk) == before
        assert new.get_model('quizzes', 'Quiz').objects.get(pk=quiz.pk).exam_configuration_key == ''
        assert new.get_model('quizzes', 'ExamAttempt').objects.count() == 0
    finally:
        MigrationExecutor(connection).migrate(latest)


@pytest.mark.parametrize('suffix,method', [('', 'get'), ('answers/', 'patch'), ('finish/', 'post'), ('result/', 'get'), ('review/', 'get')])
def test_exam_anonymous_attempt_endpoints_reject_without_changing_state(graph, suffix, method):
    _, url = opened(graph)
    before = state()
    client = APIClient()
    operation = getattr(client, method)
    response = operation(url + suffix) if method == 'get' else operation(url + suffix, mutation(), format='json')
    assert response.status_code == 401
    assert state() == before


@pytest.mark.parametrize('case', ['foreign_empty', 'duplicate_empty'])
def test_exam_completed_replay_still_validates_question_membership_and_duplicates(graph, case):
    _, url = opened(graph)
    payload = mutation([])
    assert graph.client.post(url + 'finish/', payload, format='json').status_code == 200
    before = state()
    replay = deepcopy(payload)
    if case == 'foreign_empty':
        replay['answers'] = [{'question_id': 999999, 'choice_ids': []}]
    else:
        replay['answers'] = [{'question_id': graph.items[0]['question'].pk, 'choice_ids': []}] * 2
    response = graph.client.post(url + 'finish/', replay, format='json')
    assert response.status_code == 400, response.data
    assert state() == before


@pytest.mark.parametrize('operation', ['manual', 'deadline'])
def test_exam_unknown_frozen_scoring_version_never_falls_back_to_another_algorithm(graph, operation):
    data, url = opened(graph)
    attempt = attempt_model().objects.get(pk=data['id'])
    snapshot = deepcopy(attempt.configuration_snapshot)
    snapshot['scoring_version'] = 'synthetic_future_version_that_is_not_implemented'
    attempt.configuration_snapshot = snapshot
    attempt.save(update_fields=['configuration_snapshot'])
    before = state()
    if operation == 'manual':
        response = graph.client.post(url + 'finish/', mutation(all_answers(graph)), format='json')
    else:
        with patch('quizzes.exam_services.timezone.now', return_value=attempt.deadline):
            response = graph.client.get(url)
    assert response.status_code == 400, response.data
    assert state() == before
    assert history_counts() == (0, 0, 0)


def test_exam_list_contains_only_owner_summary_without_questions_or_answer_keys(graph):
    first, _ = opened(graph)
    other = graph.other_client.post('/exams/attempts/', {
        'configuration_id': CONFIG, 'request_id': str(uuid4()),
    }, format='json')
    assert other.status_code == 201
    before = state()
    response = graph.client.get('/exams/attempts/?status=active&configuration_id=' + CONFIG)
    assert response.status_code == 200, response.data
    rows = response.json()['results']
    assert response.json()['next_offset'] is None
    assert [row['id'] for row in rows] == [first['id']]
    assert 'sections' not in rows[0] and 'content_snapshot' not in rows[0]
    assert_no_solutions(rows)
    assert state() == before
    assert graph.client.get('/exams/attempts/?status=invalid').status_code == 400
    assert graph.client.get('/exams/attempts/?configuration_id=unavailable').json() == {'results': [], 'next_offset': None}


def test_exam_lists_hide_expired_active_and_complete_it_for_completed_results(graph):
    first, url = opened(graph)
    assert graph.client.patch(url + 'answers/', mutation(all_answers(graph)), format='json').status_code == 200
    attempt_model().objects.filter(pk=first['id']).update(deadline=timezone.now() - timedelta(seconds=1))
    response = graph.client.get('/exams/attempts/?status=active')
    assert response.status_code == 200 and response.json() == {'results': [], 'next_offset': None}
    completed = graph.client.get('/exams/attempts/?status=completed')
    assert completed.status_code == 200
    assert [row['id'] for row in completed.json()['results']] == [first['id']]
    assert completed.json()['results'][0]['result']['grading']['earned_points'] == 70
    assert history_counts() == (1, 1, 50)



def test_exam_list_filters_before_limit_and_exposes_pagination_for_remaining_attempts(graph):
    oldest, _ = opened(graph)
    finished, finished_url = opened(graph)
    assert graph.client.post(finished_url + 'finish/', mutation([]), format='json').status_code == 200
    template = attempt_model().objects.get(pk=finished['id'])
    result = Result.objects.get(pk=template.result_id)
    # Synthetic completed metadata for testing pagination, not 50 extra HTTP finishes.
    results = Result.objects.bulk_create([
        Result(student=graph.student, quiz=graph.quiz, score=0, scoring_mode='kt_profile',
               scoring_details=deepcopy(result.scoring_details)) for _ in range(50)
    ])
    attempt_model().objects.bulk_create([
        attempt_model()(student=graph.student, source_quiz=graph.quiz, start_id=uuid4(),
            configuration_key=CONFIG, configuration_snapshot=deepcopy(template.configuration_snapshot),
            content_snapshot=deepcopy(template.content_snapshot), status='completed',
            started_at=template.started_at + timedelta(seconds=index + 1), deadline=template.deadline,
            completed_at=template.completed_at, completion_reason='manual', result=item)
        for index, item in enumerate(results)
    ])
    before = state()
    active = graph.client.get('/exams/attempts/?status=active')
    assert active.status_code == 200
    assert [row['id'] for row in active.json()['results']] == [oldest['id']]
    assert active.json()['next_offset'] is None
    first = graph.client.get('/exams/attempts/?status=completed').json()
    assert len(first['results']) == 50 and first['next_offset'] == 50
    second = graph.client.get('/exams/attempts/?status=completed&offset=50').json()
    assert len(second['results']) == 1 and second['next_offset'] is None
    ids = [row['id'] for row in first['results'] + second['results']]
    assert len(set(ids)) == 51 and oldest['id'] not in ids
    assert set(ids) == {str(pk) for pk in attempt_model().objects.filter(status='completed').values_list('pk', flat=True)}
    assert state() == before
    for offset in ('-1', 'bad', '1.1'):
        assert graph.client.get('/exams/attempts/?offset=' + offset).status_code == 400
