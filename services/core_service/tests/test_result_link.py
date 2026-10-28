"""Result linkage through real submit/analytics handlers, isolated synthetic DB only.

These regressions exercise application validation and persistence without mocks.
They do not change scoring or implement history, retry replay, or cross-request
atomicity. Run through run_training_audit.py, never against a working database.
"""

from copy import deepcopy
import secrets
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db(transaction=True)
ANALYTICS_URL = '/analytics/quiz-attempt/'


@pytest.fixture
def link_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(
        username='link_fixture_teacher', password=secrets.token_urlsafe(32), role='teacher',
    )
    student = users.objects.create_user(
        username='link_fixture_student', password=secrets.token_urlsafe(32), role='student',
    )
    other_student = users.objects.create_user(
        username='link_fixture_other_student', password=secrets.token_urlsafe(32), role='student',
    )
    category = Category.objects.create(title='Synthetic result linkage')
    course = Course.objects.create(title='Synthetic link course', teacher=teacher, category=category)
    lesson = Lesson.objects.create(title='Synthetic link lesson', course=course)
    quiz = Quiz.objects.create(title='Synthetic link quiz', lesson=lesson)
    question = Question.objects.create(quiz=quiz, text='Synthetic multiple-choice question')
    choices = [
        Choice.objects.create(question=question, text=f'Synthetic choice {index}', is_correct=index in (0, 2))
        for index in range(4)
    ]
    other_quiz = Quiz.objects.create(title='Synthetic other link quiz', lesson=lesson)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    return SimpleNamespace(
        student=student, other_student=other_student, quiz=quiz, other_quiz=other_quiz,
        question=question, choices=choices, correct_ids=[choices[0].pk, choices[2].pk], client=client,
    )


def submit(graph):
    return graph.client.post(
        f'/quizzes/{graph.quiz.pk}/submit/',
        {'answers': [{'question_id': graph.question.pk, 'choice_ids': graph.correct_ids}]},
        format='json',
    )


def result_record(graph, **overrides):
    fields = {'student': graph.student, 'quiz': graph.quiz, 'score': 100}
    fields.update(overrides)
    return Result.objects.create(**fields)


def analytics_payload(graph, result_id):
    return {
        'quiz_id': graph.quiz.pk, 'result_id': result_id,
        'score': 100, 'total_questions': 1, 'correct_answers': 1, 'time_spent_seconds': 7,
        'answers': [{
            'question_id': graph.question.pk,
            'selected_choice_ids': list(graph.correct_ids),
            'is_correct': True,
        }],
    }


def record_state():
    return {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)
    }


def assert_rejected_without_writes(graph, payload):
    before = record_state()
    response = graph.client.post(ANALYTICS_URL, payload, format='json')
    assert response.status_code == 400
    assert 'result_id' in response.data
    assert record_state() == before
    return response


def test_result_link_submit_returns_created_result_id_without_changing_score(link_graph):
    graph = link_graph
    response = submit(graph)
    assert response.status_code == 200
    saved = Result.objects.get(student=graph.student, quiz=graph.quiz)
    assert response.data.get('id') == saved.pk, 'Submit must return the ID the existing frontend reads.'
    assert response.data['score'] == saved.score == 100
    assert response.data['correct_count'] == response.data['total_questions'] == 1
    assert set(response.data['correct_answers_ids'][graph.question.pk]) == set(graph.correct_ids)
    assert not QuizAttemptDetail.objects.exists()


def test_result_link_real_submit_then_analytics_preserves_link_and_full_selection(link_graph):
    graph = link_graph
    response = submit(graph)
    assert response.status_code == 200
    result = Result.objects.get(student=graph.student, quiz=graph.quiz)
    result_before = list(Result.objects.values())
    # The real frontend uses this exact fallback on the real submit response.
    accepted = graph.client.post(
        ANALYTICS_URL, analytics_payload(graph, response.data.get('id') or None), format='json',
    )
    assert accepted.status_code == 201
    detail = QuizAttemptDetail.objects.get(pk=accepted.data['attempt_id'])
    assert detail.result_id == result.pk, 'The detailed answers must point to this submission result.'
    assert detail.student_id == result.student_id
    assert detail.quiz_id == result.quiz_id
    answer = QuestionAnswer.objects.get(attempt=detail)
    assert answer.selected_choice_ids == graph.correct_ids
    assert answer.question_id == graph.question.pk
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == QuestionAnswer.objects.count() == 1
    assert list(Result.objects.values()) == result_before


def test_result_link_separate_submissions_return_distinct_result_ids(link_graph):
    first = submit(link_graph)
    second = submit(link_graph)
    assert first.status_code == second.status_code == 200
    first_id, second_id = first.data.get('id'), second.data.get('id')
    assert isinstance(first_id, int) and isinstance(second_id, int)
    assert first_id != second_id
    assert set(Result.objects.values_list('pk', flat=True)) == {first_id, second_id}


@pytest.mark.parametrize('case', ['missing', 'null'])
def test_result_link_requires_result_id_without_writes(link_graph, case):
    result = result_record(link_graph)
    data = analytics_payload(link_graph, result.pk)
    if case == 'missing':
        data.pop('result_id')
    else:
        data['result_id'] = None
    assert_rejected_without_writes(link_graph, data)


@pytest.mark.parametrize('case', ['bool', 'float', 'string', 'zero', 'negative', 'list', 'object'])
def test_result_link_rejects_malformed_result_id_without_writes(link_graph, case):
    result = result_record(link_graph)
    malformed = {
        'bool': True, 'float': float(result.pk), 'string': str(result.pk),
        'zero': 0, 'negative': -1, 'list': [result.pk], 'object': {'id': result.pk},
    }[case]
    assert_rejected_without_writes(link_graph, analytics_payload(link_graph, malformed))


@pytest.mark.parametrize('case', ['missing', 'other_student', 'other_quiz', 'other_student_and_quiz'])
def test_result_link_rejects_nonexistent_or_foreign_result_without_writes(link_graph, case):
    graph = link_graph
    own = result_record(graph)
    if case == 'missing':
        candidate_id = own.pk + 10000
    else:
        candidate = result_record(
            graph,
            student=graph.other_student if 'student' in case else graph.student,
            quiz=graph.other_quiz if 'quiz' in case else graph.quiz,
        )
        candidate_id = candidate.pk
    assert_rejected_without_writes(graph, analytics_payload(graph, candidate_id))


def test_result_link_reusing_linked_result_is_rejected_without_duplicates(link_graph):
    graph = link_graph
    result = result_record(graph)
    data = analytics_payload(graph, result.pk)
    first = graph.client.post(ANALYTICS_URL, data, format='json')
    assert first.status_code == 201
    assert_rejected_without_writes(graph, deepcopy(data))
    assert QuizAttemptDetail.objects.get().result_id == result.pk


def test_result_link_existing_unlinked_records_are_not_rewritten(link_graph):
    graph = link_graph
    legacy = QuizAttemptDetail.objects.create(
        student=graph.student, quiz=graph.quiz, result=None, score=0,
        total_questions=1, correct_answers=0, time_spent_seconds=3,
    )
    legacy_answer = QuestionAnswer.objects.create(
        attempt=legacy, question=graph.question, selected_choice_ids=[], is_correct=False,
    )
    before_detail = QuizAttemptDetail.objects.filter(pk=legacy.pk).values().get()
    before_answer = QuestionAnswer.objects.filter(pk=legacy_answer.pk).values().get()
    result = result_record(graph)
    response = graph.client.post(ANALYTICS_URL, analytics_payload(graph, result.pk), format='json')
    assert response.status_code == 201
    assert QuizAttemptDetail.objects.get(pk=response.data['attempt_id']).result_id == result.pk
    assert QuizAttemptDetail.objects.filter(pk=legacy.pk).values().get() == before_detail
    assert QuestionAnswer.objects.filter(pk=legacy_answer.pk).values().get() == before_answer


def test_result_link_still_requires_authentication(link_graph):
    graph = link_graph
    result = result_record(graph)
    before = record_state()
    response = APIClient().post(ANALYTICS_URL, analytics_payload(graph, result.pk), format='json')
    assert response.status_code == 401
    assert record_state() == before
