"""Selection persistence through the real analytics API and migrated test DB.

Run only with tests/run_training_audit.py in its offline, disposable SQLite DB.
These checks do not introduce a new scoring algorithm or an attempt-history API.
"""

from copy import deepcopy
import secrets
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.exceptions import IrreversibleError
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db(transaction=True)
ENDPOINT = '/analytics/quiz-attempt/'
SELECTION_MIGRATION = ('analytics', '0002_questionanswer_selected_choice_ids')


@pytest.fixture
def selection_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    teacher = get_user_model().objects.create_user(
        username='selection_fixture_teacher', password=secrets.token_urlsafe(32), role='teacher',
    )
    student = get_user_model().objects.create_user(
        username='selection_fixture_student', password=secrets.token_urlsafe(32), role='student',
    )
    category = Category.objects.create(title='Synthetic selection fixtures')
    course = Course.objects.create(title='Synthetic selection course', category=category, teacher=teacher)
    lesson = Lesson.objects.create(title='Synthetic selection lesson', course=course)
    quiz = Quiz.objects.create(title='Synthetic selection quiz', lesson=lesson)
    questions = [Question.objects.create(quiz=quiz, text=f'Synthetic question {number}') for number in (1, 2)]
    choices = [
        [Choice.objects.create(question=question, text=f'Synthetic option {number}', is_correct=number < 3)
         for number in range(4)]
        for question in questions
    ]
    other_quiz = Quiz.objects.create(title='Synthetic other quiz', lesson=lesson)
    other_question = Question.objects.create(quiz=other_quiz, text='Synthetic foreign question')
    other_choice = Choice.objects.create(question=other_question, text='Synthetic foreign option', is_correct=True)
    result = Result.objects.create(student=student, quiz=quiz, score=50)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    return SimpleNamespace(
        student=student, quiz=quiz, questions=questions, choices=choices,
        other_question=other_question, other_choice=other_choice, result=result, client=client,
    )


def payload(graph, selections=None):
    if selections is None:
        selections = [[choice.pk for choice in graph.choices[0][:2]]]
    return {
        'quiz_id': graph.quiz.pk, 'result_id': graph.result.pk, 'score': 50, 'total_questions': 2,
        'correct_answers': 1, 'time_spent_seconds': 12,
        'answers': [
            {'question_id': graph.questions[index].pk, 'selected_choice_ids': list(selected), 'is_correct': True}
            for index, selected in enumerate(selections)
        ],
    }


def record_state():
    return {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)
    }


def assert_rejected_without_writes(graph, data):
    before = record_state()
    response = graph.client.post(ENDPOINT, data, format='json')
    assert response.status_code == 400
    assert record_state() == before
    return response


@pytest.mark.parametrize('indices', [[0], [0, 2], [0, 1, 2], [], [2, 0]])
def test_analytics_persists_complete_selection(selection_graph, indices):
    graph = selection_graph
    selected = [graph.choices[0][index].pk for index in indices]
    data = payload(graph, [selected])
    original_result = list(Result.objects.values())
    response = graph.client.post(ENDPOINT, data, format='json')
    assert response.status_code == 201
    saved = QuestionAnswer.objects.get(attempt_id=response.data['attempt_id'])
    assert saved.question_id == graph.questions[0].pk
    assert saved.selected_choice_ids == selected
    assert saved.selected_choice_id == (selected[0] if selected else None)
    assert saved.attempt.student_id == graph.student.pk
    assert saved.attempt.score == data['score']
    assert list(Result.objects.values()) == original_result


@pytest.mark.parametrize('empty', [False, True])
def test_analytics_legacy_scalar_is_preserved_as_complete_selection(selection_graph, empty):
    graph = selection_graph
    scalar = None if empty else graph.choices[0][1].pk
    data = payload(graph)
    data['answers'][0].pop('selected_choice_ids')
    data['answers'][0]['selected_choice_id'] = scalar
    response = graph.client.post(ENDPOINT, data, format='json')
    assert response.status_code == 201
    saved = QuestionAnswer.objects.get(attempt_id=response.data['attempt_id'])
    assert saved.selected_choice_id == scalar
    assert saved.selected_choice_ids == ([] if scalar is None else [scalar])


def test_analytics_rejects_ambiguous_scalar_and_plural_fields(selection_graph):
    graph = selection_graph
    data = payload(graph)
    data['answers'][0]['selected_choice_id'] = graph.choices[0][0].pk
    assert_rejected_without_writes(graph, data)


def test_analytics_requires_an_explicit_selection_field(selection_graph):
    graph = selection_graph
    data = payload(graph)
    data['answers'][0].pop('selected_choice_ids')
    assert_rejected_without_writes(graph, data)


def test_analytics_rejects_misspelled_plural_field_in_legacy_request(selection_graph):
    graph = selection_graph
    data = payload(graph)
    selected = data['answers'][0].pop('selected_choice_ids')
    data['answers'][0]['selected_choice_id'] = selected[0]
    data['answers'][0]['selected_choices_ids'] = selected
    assert_rejected_without_writes(graph, data)


@pytest.mark.parametrize('value', [None, True, 1, 1.0, '1', {}, [True], [1.0], ['1'], [None], [0], [-1], [[1]], [{}]])
def test_analytics_rejects_malformed_selected_ids_without_writes(selection_graph, value):
    graph = selection_graph
    data = payload(graph, [[graph.choices[0][0].pk], [graph.choices[1][0].pk]])
    data['answers'][1]['selected_choice_ids'] = value
    assert_rejected_without_writes(graph, data)


@pytest.mark.parametrize('value', [True, 1.0, '1', None, 0, -1, [], {}])
def test_analytics_rejects_malformed_question_id_without_writes(selection_graph, value):
    graph = selection_graph
    data = payload(graph)
    data['answers'][0]['question_id'] = value
    assert_rejected_without_writes(graph, data)


@pytest.mark.parametrize('value', [True, 1.0, '1', [], {}, 0, -1])
def test_analytics_rejects_malformed_legacy_scalar_without_writes(selection_graph, value):
    graph = selection_graph
    data = payload(graph)
    data['answers'][0].pop('selected_choice_ids')
    data['answers'][0]['selected_choice_id'] = value
    assert_rejected_without_writes(graph, data)


def test_analytics_rejects_repeated_option_without_writes(selection_graph):
    graph = selection_graph
    selected = graph.choices[0][0].pk
    assert_rejected_without_writes(graph, payload(graph, [[selected, selected]]))


def test_analytics_rejects_repeated_question_without_writes(selection_graph):
    graph = selection_graph
    data = payload(graph)
    data['answers'].append(deepcopy(data['answers'][0]))
    assert_rejected_without_writes(graph, data)


@pytest.mark.parametrize('foreign', ['other_question', 'other_quiz', 'missing'])
def test_analytics_rejects_foreign_or_missing_choice_without_writes(selection_graph, foreign):
    graph = selection_graph
    invalid_choice = {
        'other_question': graph.choices[0][0].pk,
        'other_quiz': graph.other_choice.pk,
        'missing': graph.other_choice.pk + 10000,
    }[foreign]
    data = payload(graph, [[graph.choices[0][0].pk], [invalid_choice]])
    assert_rejected_without_writes(graph, data)


@pytest.mark.parametrize('missing', [False, True])
def test_analytics_rejects_foreign_or_missing_question_without_writes(selection_graph, missing):
    graph = selection_graph
    data = payload(graph, [[graph.choices[0][0].pk], [graph.choices[1][0].pk]])
    data['answers'][1]['question_id'] = graph.other_question.pk + (10000 if missing else 0)
    assert_rejected_without_writes(graph, data)


def test_analytics_rejects_foreign_choice_in_legacy_request(selection_graph):
    graph = selection_graph
    data = payload(graph)
    data['answers'][0].pop('selected_choice_ids')
    data['answers'][0]['selected_choice_id'] = graph.other_choice.pk
    assert_rejected_without_writes(graph, data)


def test_analytics_still_requires_authentication(selection_graph):
    graph = selection_graph
    before = record_state()
    response = APIClient().post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 401
    assert record_state() == before


def test_analytics_late_answer_write_failure_rolls_back_attempt_and_answers(selection_graph):
    graph = selection_graph
    before = record_state()
    real_bulk_create = QuestionAnswer.objects.bulk_create

    def fail_after_real_write(*args, **kwargs):
        real_bulk_create(*args, **kwargs)
        assert QuestionAnswer.objects.exists()
        raise RuntimeError('Synthetic failure after actual analytics answer insert')

    with patch.object(QuestionAnswer.objects, 'bulk_create', side_effect=fail_after_real_write):
        response = graph.client.post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 500
    assert record_state() == before


def test_selection_migration_copies_existing_single_and_empty_answers(selection_graph):
    graph = selection_graph
    executor = MigrationExecutor(connection)
    original_targets = executor.loader.graph.leaf_nodes()
    assert SELECTION_MIGRATION in executor.loader.graph.nodes, 'The additive selection migration must exist.'
    old_target = [('analytics', '0001_initial')]
    try:
        executor.migrate(old_target)
        old_apps = executor.loader.project_state(old_target).apps
        OldAttempt = old_apps.get_model('analytics', 'QuizAttemptDetail')
        OldAnswer = old_apps.get_model('analytics', 'QuestionAnswer')
        attempt = OldAttempt.objects.create(
            student_id=graph.student.pk, quiz_id=graph.quiz.pk, result_id=graph.result.pk,
            score=50, total_questions=2, correct_answers=1, time_spent_seconds=12,
        )
        first = OldAnswer.objects.create(
            attempt_id=attempt.pk, question_id=graph.questions[0].pk,
            selected_choice_id=graph.choices[0][1].pk, is_correct=True,
        )
        second = OldAnswer.objects.create(
            attempt_id=attempt.pk, question_id=graph.questions[1].pk,
            selected_choice_id=None, is_correct=False,
        )
        before = list(OldAnswer.objects.order_by('pk').values())
        attempt_before = list(OldAttempt.objects.values())
        executor = MigrationExecutor(connection)
        executor.migrate([SELECTION_MIGRATION])
        new_apps = executor.loader.project_state([SELECTION_MIGRATION]).apps
        NewAttempt = new_apps.get_model('analytics', 'QuizAttemptDetail')
        NewAnswer = new_apps.get_model('analytics', 'QuestionAnswer')
        assert NewAnswer.objects.get(pk=first.pk).selected_choice_ids == [graph.choices[0][1].pk]
        assert NewAnswer.objects.get(pk=second.pk).selected_choice_ids == []
        after = list(NewAnswer.objects.order_by('pk').values())
        assert [{key: value for key, value in row.items() if key != 'selected_choice_ids'} for row in after] == before
        assert list(NewAttempt.objects.values()) == attempt_before
        assert Result.objects.get(pk=graph.result.pk).score == 50
        # A rollback is safe while every stored list is exactly the legacy value.
        MigrationExecutor(connection).migrate(old_target)
        old_apps = MigrationExecutor(connection).loader.project_state(old_target).apps
        assert list(old_apps.get_model('analytics', 'QuestionAnswer').objects.order_by('pk').values()) == before
    finally:
        MigrationExecutor(connection).migrate(original_targets)


def test_selection_migration_refuses_lossy_rollback(selection_graph):
    graph = selection_graph
    executor = MigrationExecutor(connection)
    assert SELECTION_MIGRATION in executor.loader.graph.nodes, 'The additive selection migration must exist.'
    response = graph.client.post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 201
    before = record_state()
    with pytest.raises(IrreversibleError):
        executor.migrate([('analytics', '0001_initial')])
    assert record_state() == before
    columns = connection.introspection.get_table_description(connection.cursor(), QuestionAnswer._meta.db_table)
    assert 'selected_choice_ids' in {column.name for column in columns}
