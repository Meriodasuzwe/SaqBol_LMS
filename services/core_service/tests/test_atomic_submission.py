"""Single-submit persistence regressions against real handlers and synthetic ORM data.

Run only through run_training_audit.py in the disposable offline SQLite DB.
Only persistence-failure injection is mocked; validation and grading are real.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def atomic_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(username='atomic_fixture_teacher', role='teacher')
    student = users.objects.create_user(username='atomic_fixture_student', role='student')
    category = Category.objects.create(title='Synthetic atomic submission')
    course = Course.objects.create(title='Synthetic atomic course', teacher=teacher, category=category)
    lesson = Lesson.objects.create(title='Synthetic atomic lesson', course=course)
    quiz = Quiz.objects.create(title='Synthetic atomic quiz', lesson=lesson)
    questions = []
    choices = []
    correct_ids = []
    for number in (1, 2, 3):
        question = Question.objects.create(quiz=quiz, text=f'Synthetic question {number}')
        options = [
            Choice.objects.create(question=question, text=f'Synthetic choice {index}', is_correct=index < number)
            for index in range(4)
        ]
        questions.append(question)
        choices.append(options)
        correct_ids.append([option.pk for option in options[:number]])
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    return SimpleNamespace(
        student=student, quiz=quiz, questions=questions, choices=choices,
        correct_ids=correct_ids, client=client, url=f'/quizzes/{quiz.pk}/submit/',
    )


def payload(graph):
    return {'answers': [
        {'question_id': question.pk, 'choice_ids': list(selected)}
        for question, selected in zip(graph.questions, graph.correct_ids)
    ]}


def record_state():
    return {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)
    }


def saved_submission(graph, response):
    assert response.status_code == 200
    result = Result.objects.get(pk=response.data['id'])
    detail = QuizAttemptDetail.objects.get(result=result)
    assert result.student_id == detail.student_id == graph.student.pk
    assert result.quiz_id == detail.quiz_id == graph.quiz.pk
    assert result.score == detail.score == response.data['score']
    assert detail.total_questions == response.data['total_questions'] == 3
    assert detail.correct_answers == response.data['correct_count']
    answers = {answer.question_id: answer for answer in detail.answers.all()}
    assert set(answers) == {question.pk for question in graph.questions}
    return result, detail, answers


def test_atomic_submission_saves_result_and_all_selections_in_one_request(atomic_graph):
    graph = atomic_graph
    data = payload(graph)
    data['time_spent_seconds'] = 23
    response = graph.client.post(graph.url, data, format='json')
    result, detail, answers = saved_submission(graph, response)
    assert result.score == 100
    assert detail.correct_answers == 3
    assert detail.time_spent_seconds == 23
    for question, selected in zip(graph.questions, graph.correct_ids):
        answer = answers[question.pk]
        assert answer.selected_choice_ids == selected
        assert answer.selected_choice_id == selected[0]
        assert answer.is_correct is True
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 1
    assert QuestionAnswer.objects.count() == 3


@pytest.mark.parametrize('case', ['one', 'two', 'three', 'reversed', 'incomplete', 'excess', 'empty', 'omitted'])
def test_atomic_submission_persists_server_verdict_and_skipped_questions(atomic_graph, case):
    graph = atomic_graph
    index = {'one': 0, 'two': 1}.get(case, 2)
    selected = list(graph.correct_ids[index])
    if case == 'reversed':
        selected.reverse()
    elif case == 'incomplete':
        selected.pop()
    elif case == 'excess':
        selected.append(graph.choices[index][-1].pk)
    elif case in ('empty', 'omitted'):
        selected = []
    submitted = [] if case == 'omitted' else [{'question_id': graph.questions[index].pk, 'choice_ids': selected}]
    response = graph.client.post(graph.url, {'answers': submitted}, format='json')
    result, detail, answers = saved_submission(graph, response)
    expected_correct = case in ('one', 'two', 'three', 'reversed')
    assert result.score == (33 if expected_correct else 0)
    assert detail.correct_answers == int(expected_correct)
    assert detail.time_spent_seconds == 0
    for question_index, question in enumerate(graph.questions):
        answer = answers[question.pk]
        expected_selection = selected if question_index == index else []
        assert answer.selected_choice_ids == expected_selection
        assert answer.selected_choice_id == (expected_selection[0] if expected_selection else None)
        assert answer.is_correct is (expected_correct and question_index == index)


def test_atomic_submission_ignores_client_grading_for_saved_details(atomic_graph):
    graph = atomic_graph
    data = {
        'answers': [{
            'question_id': graph.questions[0].pk,
            'choice_ids': [graph.choices[0][-1].pk],
            'is_correct': True,
        }],
        'score': 100, 'correct_count': 3, 'correct_answers': 3,
        'total_questions': 1, 'correct_answers_ids': {str(graph.questions[0].pk): [graph.choices[0][-1].pk]},
    }
    response = graph.client.post(graph.url, data, format='json')
    result, detail, answers = saved_submission(graph, response)
    assert result.score == detail.score == 0
    assert detail.correct_answers == 0
    assert all(answer.is_correct is False for answer in answers.values())


@pytest.mark.parametrize('invalid', [None, True, -1, 1.5, '5', [], {}])
def test_atomic_submission_rejects_invalid_duration_without_any_writes(atomic_graph, invalid):
    graph = atomic_graph
    data = payload(graph)
    data['time_spent_seconds'] = invalid
    before = record_state()
    response = graph.client.post(graph.url, data, format='json')
    assert response.status_code == 400
    assert 'time_spent_seconds' in response.data
    assert record_state() == before


@pytest.mark.parametrize('failure_stage', ['detail', 'answers'])
def test_atomic_submission_late_write_failure_rolls_back_every_record(atomic_graph, failure_stage):
    graph = atomic_graph
    before = record_state()
    manager = QuizAttemptDetail.objects if failure_stage == 'detail' else QuestionAnswer.objects
    method = 'create' if failure_stage == 'detail' else 'bulk_create'
    real_write = getattr(manager, method)
    observed = []

    def fail_after_actual_write(*args, **kwargs):
        real_write(*args, **kwargs)
        # Prove the failure occurs after real INSERTs, not before validation.
        observed.append((Result.objects.count(), QuizAttemptDetail.objects.count(), QuestionAnswer.objects.count()))
        raise RuntimeError(f'Synthetic persistence failure after {failure_stage} insert')

    with patch.object(manager, method, side_effect=fail_after_actual_write):
        response = graph.client.post(graph.url, payload(graph), format='json')
    assert response.status_code == 500
    assert observed == [(1, 1, 0 if failure_stage == 'detail' else 3)]
    assert record_state() == before


def test_atomic_submission_distinct_explicit_submissions_have_distinct_complete_details(atomic_graph):
    graph = atomic_graph
    first = graph.client.post(graph.url, payload(graph), format='json')
    second = graph.client.post(graph.url, payload(graph), format='json')
    first_result, first_detail, _ = saved_submission(graph, first)
    second_result, second_detail, _ = saved_submission(graph, second)
    assert first_result.pk != second_result.pk
    assert first_detail.pk != second_detail.pk
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2
    assert QuestionAnswer.objects.count() == 6
