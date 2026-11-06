"""Idempotent submit regressions through the real handler and synthetic database.

Only intentional late persistence failures are injected. No validation/scoring
is mocked. Run via run_training_audit.py, never a working database.
"""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, IntegrityError, transaction
from django.db.migrations.executor import MigrationExecutor
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def submission_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(username='idempotency_fixture_teacher', role='teacher')
    student = users.objects.create_user(username='idempotency_fixture_student', role='student')
    other_student = users.objects.create_user(username='idempotency_fixture_other', role='student')
    category = Category.objects.create(title='Synthetic idempotency category')
    course = Course.objects.create(title='Synthetic idempotency course', teacher=teacher, category=category)
    lesson = Lesson.objects.create(title='Synthetic idempotency lesson', course=course)
    quiz = Quiz.objects.create(title='Synthetic idempotency quiz', lesson=lesson)
    questions, choices, correct_ids = [], [], []
    for number in (1, 2):
        question = Question.objects.create(quiz=quiz, text=f'Synthetic question {number}')
        options = [Choice.objects.create(question=question, text=f'Synthetic option {index}', is_correct=index < number) for index in range(3)]
        questions.append(question)
        choices.append(options)
        correct_ids.append([choice.pk for choice in options[:number]])
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    return SimpleNamespace(student=student, other_student=other_student, lesson=lesson, quiz=quiz,
        questions=questions, choices=choices, correct_ids=correct_ids,
        client=client, url=f'/quizzes/{quiz.pk}/submit/')


def payload(graph):
    return {'submission_id': str(uuid4()), 'time_spent_seconds': 7, 'answers': [
        {'question_id': question.pk, 'choice_ids': list(selected)}
        for question, selected in zip(graph.questions, graph.correct_ids)
    ]}


def post(graph, data):
    return graph.client.post(graph.url, data, format='json')


def state():
    return {model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)}


def assert_single_complete(graph):
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 1
    assert QuestionAnswer.objects.count() == 2
    result = Result.objects.get()
    detail = QuizAttemptDetail.objects.get()
    assert result.student_id == detail.student_id == graph.student.pk
    assert result.quiz_id == detail.quiz_id == graph.quiz.pk
    assert detail.result_id == result.pk
    assert result.score == detail.score == 100
    for question, selected in zip(graph.questions, graph.correct_ids):
        answer = detail.answers.get(question=question)
        assert answer.selected_choice_ids == selected
        assert answer.is_correct is True


def test_idempotency_same_submission_returns_same_result_without_more_writes(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    assert first.status_code == 200
    before = state()
    second = post(graph, deepcopy(data))
    assert second.status_code == 200
    assert second.json() == first.json(), 'A repeated submission must return its original result ID and response.'
    assert state() == before
    assert_single_complete(graph)


def test_idempotency_reordered_answers_and_options_ignore_elapsed_and_client_scores(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    assert first.status_code == 200
    before = state()
    repeated = deepcopy(data)
    repeated['answers'].reverse()
    for answer in repeated['answers']:
        answer['choice_ids'].reverse()
        answer['is_correct'] = False
    repeated.update(time_spent_seconds=999, score=0, correct_answers=0, correct_count=0)
    second = post(graph, repeated)
    assert second.status_code == 200
    assert second.json() == first.json()
    assert state() == before
    assert QuizAttemptDetail.objects.get().time_spent_seconds == 7


def test_idempotency_omitted_and_explicit_empty_answers_are_the_same_submission(submission_graph):
    graph = submission_graph
    data = payload(graph)
    data['answers'].pop()
    first = post(graph, data)
    assert first.status_code == 200
    assert first.data['score'] == 50
    before = state()
    data['answers'].append({'question_id': graph.questions[1].pk, 'choice_ids': []})
    second = post(graph, data)
    assert second.status_code == 200
    assert second.json() == first.json()
    assert state() == before


def test_idempotency_same_key_with_different_answers_is_conflict_without_overwrite(submission_graph):
    graph = submission_graph
    data = payload(graph)
    assert post(graph, data).status_code == 200
    before = state()
    data['answers'][0]['choice_ids'] = [graph.choices[0][-1].pk]
    conflict = post(graph, data)
    assert conflict.status_code == 409
    assert state() == before
    assert_single_complete(graph)


@pytest.mark.parametrize('change', ['answer_key_and_new_question', 'delete_questions'])
def test_idempotency_replays_original_response_after_content_changes(submission_graph, change):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    assert first.status_code == 200
    if change == 'answer_key_and_new_question':
        Choice.objects.filter(question__quiz=graph.quiz).update(is_correct=False)
        Question.objects.create(quiz=graph.quiz, text='Synthetic later-added question')
    else:
        graph.quiz.questions.all().delete()
    before = state()
    repeated = post(graph, data)
    assert repeated.status_code == 200
    assert repeated.json() == first.json(), 'Replay is a saved response, not regrading current quiz content.'
    assert state() == before
    # This does not claim full immutable answer history; only replay is protected.


def test_idempotency_new_key_creates_a_new_complete_attempt(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    data['submission_id'] = str(uuid4())
    second = post(graph, data)
    assert first.status_code == second.status_code == 200
    assert first.data['id'] != second.data['id']
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2
    assert QuestionAnswer.objects.count() == 4


def test_idempotency_key_is_scoped_to_the_authenticated_student(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    graph.client.force_authenticate(graph.other_student)
    second = post(graph, data)
    assert first.status_code == second.status_code == 200
    assert first.data['id'] != second.data['id']
    assert Result.objects.get(pk=first.data['id']).student_id == graph.student.pk
    assert Result.objects.get(pk=second.data['id']).student_id == graph.other_student.pk
    assert post(graph, data).json() == second.json()
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2


def test_idempotency_key_is_scoped_to_the_quiz(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    other_quiz = Quiz.objects.create(lesson=graph.lesson, title='Synthetic other quiz')
    question = Question.objects.create(quiz=other_quiz, text='Synthetic other question')
    choice = Choice.objects.create(question=question, text='Synthetic other choice', is_correct=True)
    data['answers'] = [{'question_id': question.pk, 'choice_ids': [choice.pk]}]
    response = graph.client.post(f'/quizzes/{other_quiz.pk}/submit/', data, format='json')
    assert first.status_code == response.status_code == 200
    assert response.data['id'] != first.data['id']
    assert Result.objects.get(pk=response.data['id']).quiz_id == other_quiz.pk
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2


@pytest.mark.parametrize('invalid', [None, True, 12, 1.5, '', 'not-a-uuid', [], {}])
def test_idempotency_invalid_submission_id_is_rejected_without_writes(submission_graph, invalid):
    graph = submission_graph
    data = payload(graph)
    data['submission_id'] = invalid
    before = state()
    response = post(graph, data)
    assert response.status_code == 400
    assert 'submission_id' in response.data
    assert state() == before


@pytest.mark.parametrize('invalid', ['duplicate_question', 'duplicate_choice', 'wrong_type'])
def test_idempotency_replay_does_not_bypass_structural_validation(submission_graph, invalid):
    graph = submission_graph
    data = payload(graph)
    assert post(graph, data).status_code == 200
    before = state()
    if invalid == 'duplicate_question':
        data['answers'].append(deepcopy(data['answers'][0]))
    elif invalid == 'duplicate_choice':
        data['answers'][0]['choice_ids'].append(data['answers'][0]['choice_ids'][0])
    else:
        data['answers'][0]['question_id'] = str(data['answers'][0]['question_id'])
    response = post(graph, data)
    assert response.status_code == 400
    assert state() == before


def test_idempotency_validation_failure_does_not_reserve_submission_id(submission_graph):
    graph = submission_graph
    data = payload(graph)
    invalid = deepcopy(data)
    invalid['answers'][0]['choice_ids'] = [graph.choices[1][0].pk]
    assert post(graph, invalid).status_code == 400
    assert not Result.objects.exists()
    accepted = post(graph, data)
    assert accepted.status_code == 200
    assert post(graph, data).json() == accepted.json()
    assert_single_complete(graph)


def test_idempotency_late_failure_rolls_back_key_and_retry_saves_once(submission_graph):
    graph = submission_graph
    data = payload(graph)
    real_write = QuestionAnswer.objects.bulk_create
    inserted = []
    def fail_after_insert(*args, **kwargs):
        saved = real_write(*args, **kwargs)
        inserted.append(len(saved))
        raise RuntimeError('Synthetic failure after answer INSERT')
    before = state()
    with patch.object(QuestionAnswer.objects, 'bulk_create', side_effect=fail_after_insert):
        failed = post(graph, data)
    assert failed.status_code == 500
    assert inserted == [2]
    assert state() == before
    success = post(graph, data)
    assert success.status_code == 200
    assert post(graph, data).json() == success.json()
    assert_single_complete(graph)


def test_idempotency_legacy_request_without_key_remains_compatible(submission_graph):
    graph = submission_graph
    data = payload(graph)
    data.pop('submission_id')
    first, second = post(graph, data), post(graph, data)
    assert first.status_code == second.status_code == 200
    assert first.data['id'] != second.data['id']
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2


def test_idempotency_replay_still_requires_authentication(submission_graph):
    graph = submission_graph
    data = payload(graph)
    assert post(graph, data).status_code == 200
    before = state()
    response = APIClient().post(graph.url, data, format='json')
    assert response.status_code == 401
    assert state() == before


def test_idempotency_replay_rejects_foreign_empty_question_without_writes(submission_graph):
    graph = submission_graph
    data = payload(graph)
    first = post(graph, data)
    assert first.status_code == 200
    other_quiz = Quiz.objects.create(lesson=graph.lesson, title='Synthetic foreign quiz')
    foreign = Question.objects.create(quiz=other_quiz, text='Synthetic foreign empty question')
    before = state()
    data['answers'].append({'question_id': foreign.pk, 'choice_ids': []})
    response = post(graph, data)
    assert response.status_code == 400
    assert state() == before


def test_idempotency_database_constraint_rejects_duplicate_key(submission_graph):
    graph = submission_graph
    data = payload(graph)
    assert post(graph, data).status_code == 200
    before = state()
    with pytest.raises(IntegrityError), transaction.atomic():
        Result.objects.create(student=graph.student, quiz=graph.quiz, score=0,
            submission_id=data['submission_id'])
    assert state() == before


def test_idempotency_migration_preserves_legacy_results(submission_graph):
    graph = submission_graph
    executor = MigrationExecutor(connection)
    original_targets = executor.loader.graph.leaf_nodes()
    old_target = [('quizzes', '0003_alter_quiz_lesson')]
    new_target = [('quizzes', '0004_result_submission_idempotency')]
    assert new_target[0] in executor.loader.graph.nodes
    try:
        executor.migrate(old_target)
        old_apps = executor.loader.project_state(old_target).apps
        OldResult = old_apps.get_model('quizzes', 'Result')
        first = OldResult.objects.create(student_id=graph.student.pk, quiz_id=graph.quiz.pk, score=50)
        second = OldResult.objects.create(student_id=graph.student.pk, quiz_id=graph.quiz.pk, score=100)
        before = list(OldResult.objects.order_by('pk').values())
        MigrationExecutor(connection).migrate(new_target)
        new_apps = MigrationExecutor(connection).loader.project_state(new_target).apps
        NewResult = new_apps.get_model('quizzes', 'Result')
        after = list(NewResult.objects.order_by('pk').values())
        replay_fields = {'submission_id', 'submission_fingerprint', 'submission_response'}
        assert [{key: value for key, value in row.items() if key not in replay_fields} for row in after] == before
        assert {row['id'] for row in after} == {first.pk, second.pk}
        assert all(row[field] is None for row in after for field in replay_fields)
        # Multiple old results with no submission key remain valid and distinct.
        assert NewResult.objects.filter(submission_id__isnull=True).count() == 2
    finally:
        MigrationExecutor(connection).migrate(original_targets)
