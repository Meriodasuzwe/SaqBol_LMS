"""Completed-attempt content survives quiz edits; real handlers and synthetic DB.

Run only with the offline training runner. This protects question replacement
and in-place content edits, not deletion of an entire quiz, lesson or course.
"""
from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4

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


@pytest.fixture
def snapshot_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(username='snapshot_fixture_teacher', role='teacher')
    student = users.objects.create_user(username='snapshot_fixture_student', role='student')
    category = Category.objects.create(title='Synthetic snapshot category')
    course = Course.objects.create(teacher=teacher, category=category, title='Synthetic snapshot course')
    lesson = Lesson.objects.create(course=course, title='Synthetic snapshot lesson')
    quiz = Quiz.objects.create(lesson=lesson, title='Synthetic original quiz title')
    questions, choices = [], []
    for index in range(2):
        question = Question.objects.create(quiz=quiz,
            text=f'Synthetic SQL question {index}: SELECT id\nFROM sample_table;',
            explanation=f'Synthetic original explanation {index}')
        correct = (0, 2) if index == 0 else (1,)
        options = [Choice.objects.create(question=question, text=f'Synthetic option {index}-{option}',
            is_correct=option in correct) for option in range(3)]
        questions.append(question)
        choices.append(options)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    return SimpleNamespace(teacher=teacher, student=student, course=course, lesson=lesson,
        quiz=quiz, questions=questions, choices=choices, client=client,
        url=f'/quizzes/{quiz.pk}/submit/')


def payload(graph):
    return {'submission_id': str(uuid4()), 'answers': [{
        'question_id': graph.questions[0].pk,
        'choice_ids': [graph.choices[0][2].pk, graph.choices[0][0].pk],
    }]}


def submit(graph, data=None):
    response = graph.client.post(graph.url, data or payload(graph), format='json')
    assert response.status_code == 200
    detail = QuizAttemptDetail.objects.get(result_id=response.data['id'])
    return response, detail


def question_snapshot(graph, index):
    question = graph.questions[index]
    choices = graph.choices[index]
    return {
        'id': question.pk, 'position': index, 'text': question.text,
        'explanation': question.explanation,
        'choices': [{'id': choice.pk, 'text': choice.text} for choice in choices],
        'correct_choice_ids': [choice.pk for choice in choices if choice.is_correct],
    }


def snapshot_state(detail):
    detail.refresh_from_db()
    return {
        'quiz': deepcopy(getattr(detail, 'quiz_snapshot', None)),
        'answers': [{
            'id': answer.pk, 'selected_choice_ids': list(answer.selected_choice_ids),
            'is_correct': answer.is_correct,
            'question_snapshot': deepcopy(getattr(answer, 'question_snapshot', None)),
        } for answer in detail.answers.order_by('pk')],
    }


def assert_original_snapshots(graph, detail):
    assert getattr(detail, 'quiz_snapshot', None) == {'id': graph.quiz.pk, 'title': graph.quiz.title}
    answers = list(detail.answers.order_by('pk'))
    assert len(answers) == 2
    for index, answer in enumerate(answers):
        assert getattr(answer, 'question_snapshot', None) == question_snapshot(graph, index)
        assert answer.selected_choice_ids == ([graph.choices[0][2].pk, graph.choices[0][0].pk] if index == 0 else [])
        assert answer.is_correct is (index == 0)


def test_attempt_snapshot_captures_complete_server_content_and_skips(snapshot_graph):
    graph = snapshot_graph
    data = payload(graph)
    data.update(quiz_snapshot={'title': 'Forged'}, question_snapshot={'text': 'Forged'})
    data['answers'][0]['question_snapshot'] = {'text': 'Forged', 'correct_choice_ids': []}
    response, detail = submit(graph, data)
    assert response.data['score'] == detail.score == 50
    assert detail.correct_answers == 1 and detail.total_questions == 2
    assert_original_snapshots(graph, detail)


def test_attempt_snapshot_in_place_edits_do_not_change_completed_content(snapshot_graph):
    graph = snapshot_graph
    _, detail = submit(graph)
    assert_original_snapshots(graph, detail)
    before = snapshot_state(detail)
    Question.objects.filter(quiz=graph.quiz).update(text='Synthetic edited question', explanation='Synthetic edited explanation')
    Choice.objects.filter(question__quiz=graph.quiz).update(text='Synthetic edited option', is_correct=False)
    Quiz.objects.filter(pk=graph.quiz.pk).update(title='Synthetic edited title')
    assert snapshot_state(detail) == before
    assert Result.objects.get(pk=detail.result_id).score == 50


@pytest.mark.parametrize('deleted', ['one_choice', 'one_question', 'all_questions'])
def test_attempt_snapshot_content_survives_source_deletion(snapshot_graph, deleted):
    graph = snapshot_graph
    _, detail = submit(graph)
    before = snapshot_state(detail)
    first_answer_id = detail.answers.get(question=graph.questions[0]).pk
    if deleted == 'one_choice':
        graph.choices[0][2].delete()
    elif deleted == 'one_question':
        graph.questions[0].delete()
    else:
        graph.quiz.questions.all().delete()
    assert detail.answers.count() == 2, 'Deleting editable questions must not cascade into saved answers.'
    assert snapshot_state(detail) == before
    answer = QuestionAnswer.objects.get(pk=first_answer_id)
    assert answer.selected_choice_id is None
    if deleted != 'one_choice':
        assert answer.question_id is None
    assert answer.question_snapshot['text'].startswith('Synthetic SQL question 0')
    assert str(answer), 'Admin labels must support detached historical answers.'


def test_attempt_snapshot_replay_after_question_replacement_does_not_overwrite(snapshot_graph):
    graph = snapshot_graph
    data = payload(graph)
    first, detail = submit(graph, data)
    before = snapshot_state(detail)
    graph.quiz.questions.all().delete()
    replacement = Question.objects.create(quiz=graph.quiz, text='Synthetic replacement')
    Choice.objects.create(question=replacement, text='Synthetic replacement option', is_correct=True)
    repeated = graph.client.post(graph.url, deepcopy(data), format='json')
    assert repeated.status_code == 200
    assert repeated.json() == first.json()
    assert snapshot_state(detail) == before
    assert detail.answers.count() == 2


def test_attempt_snapshot_new_attempt_gets_new_content_without_rewriting_old(snapshot_graph):
    graph = snapshot_graph
    _, first_detail = submit(graph)
    assert_original_snapshots(graph, first_detail)
    before = snapshot_state(first_detail)
    Question.objects.filter(pk=graph.questions[0].pk).update(text='Synthetic newer question')
    Choice.objects.filter(question=graph.questions[0]).update(is_correct=False)
    Quiz.objects.filter(pk=graph.quiz.pk).update(title='Synthetic newer quiz')
    second, second_detail = submit(graph)
    assert snapshot_state(first_detail) == before
    assert second_detail.quiz_snapshot['title'] == 'Synthetic newer quiz'
    assert second_detail.answers.get(question=graph.questions[0]).question_snapshot['text'] == 'Synthetic newer question'
    assert second_detail.answers.get(question=graph.questions[0]).question_snapshot['correct_choice_ids'] == []
    assert second.data['score'] == 0


@pytest.mark.parametrize('endpoint', ['/quizzes/my-results/', '/analytics/student/dashboard/'])
def test_attempt_snapshot_existing_history_keeps_original_quiz_title(snapshot_graph, endpoint):
    graph = snapshot_graph
    _, detail = submit(graph)
    Quiz.objects.filter(pk=graph.quiz.pk).update(title='Synthetic later renamed quiz')
    response = graph.client.get(endpoint)
    assert response.status_code == 200
    entries = response.data if endpoint.startswith('/quizzes/') else response.data['quiz_history']
    assert entries[0]['quiz_title'] == graph.quiz.title


def test_attempt_snapshot_deleted_questions_do_not_form_null_weak_topic_bucket(snapshot_graph):
    graph = snapshot_graph
    submit(graph)
    submit(graph)
    active = graph.client.get('/analytics/student/dashboard/')
    assert active.status_code == 200
    topic = next(item for item in active.data['weak_topics'] if item['question_id'] == graph.questions[1].pk)
    assert topic['wrong_answers'] == topic['total_answers'] == 2
    graph.quiz.questions.all().delete()
    response = graph.client.get('/analytics/student/dashboard/')
    assert response.status_code == 200
    assert response.data['total_quizzes_taken'] == 2
    assert response.data['weak_topics'] == []
    assert QuestionAnswer.objects.count() == 4


def test_attempt_snapshot_legacy_analytics_rows_remain_explicitly_without_snapshot(snapshot_graph):
    graph = snapshot_graph
    result = Result.objects.create(student=graph.student, quiz=graph.quiz, score=0)
    response = graph.client.post('/analytics/quiz-attempt/', {
        'quiz_id': graph.quiz.pk, 'result_id': result.pk, 'score': 0,
        'total_questions': 2, 'correct_answers': 0,
        'answers': [{'question_id': graph.questions[0].pk, 'selected_choice_ids': [], 'is_correct': False}],
    }, format='json')
    assert response.status_code == 201
    detail = QuizAttemptDetail.objects.get(pk=response.data['attempt_id'])
    answer = detail.answers.get()
    assert getattr(detail, 'quiz_snapshot', None) is None
    assert getattr(answer, 'question_snapshot', None) is None
    graph.questions[0].delete()
    assert detail.answers.filter(pk=answer.pk).exists()
    answer.refresh_from_db()
    assert answer.question_id is None
    assert getattr(answer, 'question_snapshot', None) is None
    assert str(answer)
    assert graph.client.get('/analytics/student/dashboard/').status_code == 200


def test_attempt_snapshot_migration_preserves_legacy_rows_without_fabricated_content(snapshot_graph):
    graph = snapshot_graph
    executor = MigrationExecutor(connection)
    original_targets = executor.loader.graph.leaf_nodes()
    old_target = [('analytics', '0002_questionanswer_selected_choice_ids')]
    new_target = [('analytics', '0003_preserve_question_snapshots')]
    assert new_target[0] in executor.loader.graph.nodes
    try:
        executor.migrate(old_target)
        old_apps = MigrationExecutor(connection).loader.project_state(old_target).apps
        OldDetail = old_apps.get_model('analytics', 'QuizAttemptDetail')
        OldAnswer = old_apps.get_model('analytics', 'QuestionAnswer')
        OldResult = old_apps.get_model('quizzes', 'Result')
        result = OldResult.objects.create(student_id=graph.student.pk, quiz_id=graph.quiz.pk, score=50)
        detail = OldDetail.objects.create(student_id=graph.student.pk, quiz_id=graph.quiz.pk,
            result_id=result.pk, score=50, total_questions=2, correct_answers=1, time_spent_seconds=17)
        selected = [graph.choices[0][2].pk, graph.choices[0][0].pk]
        answer = OldAnswer.objects.create(attempt_id=detail.pk, question_id=graph.questions[0].pk,
            selected_choice_id=selected[0], selected_choice_ids=selected, is_correct=True)
        before_detail = OldDetail.objects.get(pk=detail.pk)
        before_detail = OldDetail.objects.filter(pk=before_detail.pk).values().get()
        before_answer = OldAnswer.objects.filter(pk=answer.pk).values().get()
        before_result = OldResult.objects.filter(pk=result.pk).values().get()
        MigrationExecutor(connection).migrate(new_target)
        new_apps = MigrationExecutor(connection).loader.project_state(new_target).apps
        NewDetail = new_apps.get_model('analytics', 'QuizAttemptDetail')
        NewAnswer = new_apps.get_model('analytics', 'QuestionAnswer')
        NewResult = new_apps.get_model('quizzes', 'Result')
        after_detail = NewDetail.objects.filter(pk=detail.pk).values().get()
        after_answer = NewAnswer.objects.filter(pk=answer.pk).values().get()
        assert after_detail.pop('quiz_snapshot') is None
        assert after_answer.pop('question_snapshot') is None
        assert after_detail == before_detail
        assert after_answer == before_answer
        after_result = NewResult.objects.filter(pk=result.pk).values().get()
        assert {key: after_result[key] for key in before_result} == before_result
        new_apps.get_model('quizzes', 'Question').objects.filter(pk=graph.questions[0].pk).delete()
        retained = NewAnswer.objects.get(pk=answer.pk)
        assert retained.question_id is None
        assert retained.question_snapshot is None
        assert retained.selected_choice_ids == selected
        assert retained.is_correct is True
    finally:
        MigrationExecutor(connection).migrate(original_targets)


@pytest.mark.parametrize('content', ['snapshots', 'detached_legacy'])
def test_attempt_snapshot_lossy_migration_rollback_is_refused(snapshot_graph, content):
    graph = snapshot_graph
    if content == 'snapshots':
        submit(graph)
    else:
        result = Result.objects.create(student=graph.student, quiz=graph.quiz, score=0)
        detail = QuizAttemptDetail.objects.create(student=graph.student, quiz=graph.quiz, result=result,
            score=0, total_questions=1, correct_answers=0)
        QuestionAnswer.objects.create(attempt=detail, question=None, selected_choice_ids=[], is_correct=False)
    before = {model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)}
    executor = MigrationExecutor(connection)
    original_targets = executor.loader.graph.leaf_nodes()
    try:
        with pytest.raises(IrreversibleError):
            executor.migrate([('analytics', '0002_questionanswer_selected_choice_ids')])
    finally:
        # Later reversible migrations may run before the snapshot guard refuses.
        # Restore the current schema before querying current model fields.
        MigrationExecutor(connection).migrate(original_targets)
    assert {model.__name__: list(model.objects.order_by('pk').values())
        for model in (Result, QuizAttemptDetail, QuestionAnswer)} == before
