"""Historical submissions survive deleting live quiz content (synthetic/offline only)."""
from copy import deepcopy
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import Client
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def deletion_graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(username='deletion_fixture_teacher', role='teacher')
    student = users.objects.create_user(username='deletion_fixture_student', role='student')
    other = users.objects.create_user(username='deletion_fixture_other', role='student')
    category = Category.objects.create(title='Synthetic deletion category')
    course = Course.objects.create(teacher=teacher, category=category,
        title='Synthetic deletion course', status='draft')
    lesson = Lesson.objects.create(course=course, title='Synthetic deletion lesson')
    quiz = Quiz.objects.create(lesson=lesson, title='Synthetic historical quiz')
    questions, choices = [], []
    for index in range(2):
        question = Question.objects.create(quiz=quiz,
            text=f'Synthetic deletion question {index}', explanation=f'Synthetic explanation {index}')
        options = [Choice.objects.create(question=question,
            text=f'Synthetic option {index}-{option}', is_correct=option in (0, 2))
            for option in range(3)]
        questions.append(question)
        choices.append(options)
    student_client = APIClient(raise_request_exception=False)
    student_client.force_authenticate(student)
    teacher_client = APIClient(raise_request_exception=False)
    teacher_client.force_authenticate(teacher)
    return SimpleNamespace(student=student, other=other, teacher=teacher, course=course,
        lesson=lesson, quiz=quiz, questions=questions, choices=choices,
        client=student_client, teacher_client=teacher_client)


def submission_payload(graph, submission_id=None):
    return {
        'submission_id': submission_id or str(uuid4()), 'time_spent_seconds': 23,
        'answers': [{'question_id': graph.questions[0].pk,
            'choice_ids': [graph.choices[0][2].pk, graph.choices[0][0].pk]}],
    }


def submit(graph, client=None, data=None):
    response = (client or graph.client).post(f'/quizzes/{graph.quiz.pk}/submit/',
        data or submission_payload(graph), format='json')
    assert response.status_code == 200
    result = Result.objects.get(pk=response.data['id'])
    detail = QuizAttemptDetail.objects.get(result=result)
    return result, detail


def content_state(result, detail):
    # Mutable source FKs are intentionally excluded; all submitted content must stay exact.
    result.refresh_from_db()
    detail.refresh_from_db()
    return {
        'result': {key: deepcopy(value) for key, value in Result.objects.filter(pk=result.pk).values().get().items()
            if key != 'quiz_id'},
        'detail': {key: deepcopy(value) for key, value in QuizAttemptDetail.objects.filter(pk=detail.pk).values().get().items()
            if key != 'quiz_id'},
        'answers': [{key: deepcopy(value) for key, value in row.items()
            if key not in ('question_id', 'selected_choice_id')}
            for row in detail.answers.order_by('pk').values()],
    }


def delete_source(graph, source):
    if source == 'quiz':
        Quiz.objects.filter(pk=graph.quiz.pk).delete()
    elif source == 'lesson':
        response = graph.teacher_client.delete(f'/courses/lessons/{graph.lesson.pk}/')
        assert response.status_code == 204
    else:
        response = graph.teacher_client.delete(f'/courses/{graph.course.pk}/')
        assert response.status_code == 204
    assert not Quiz.objects.filter(pk=graph.quiz.pk).exists()


@pytest.mark.parametrize('source', ['quiz', 'lesson', 'course'])
def test_completed_attempt_survives_live_quiz_lesson_or_course_deletion(deletion_graph, source):
    graph = deletion_graph
    result, detail = submit(graph)
    before = content_state(result, detail)
    answer_ids = list(detail.answers.order_by('pk').values_list('pk', flat=True))
    delete_source(graph, source)
    assert Result.objects.filter(pk=result.pk).exists(), 'Deleting content must preserve the recorded Result.'
    assert QuizAttemptDetail.objects.filter(pk=detail.pk).exists(), 'Deleting content must preserve the linked attempt.'
    assert content_state(result, detail) == before
    assert result.quiz_id is None and detail.quiz_id is None
    assert detail.result_id == result.pk
    answers = list(detail.answers.order_by('pk'))
    assert [answer.pk for answer in answers] == answer_ids
    assert all(answer.question_id is None and answer.selected_choice_id is None for answer in answers)
    assert answers[0].selected_choice_ids == [graph.choices[0][2].pk, graph.choices[0][0].pk]
    assert answers[1].selected_choice_ids == []
    assert [answer.is_correct for answer in answers] == [True, False]
    assert result.score == detail.score == 50
    assert detail.recorded_quiz_title == graph.quiz.title


@pytest.mark.parametrize('endpoint', ['/quizzes/my-results/', '/analytics/student/dashboard/'])
def test_deleted_quiz_history_remains_visible_only_to_attempt_owner(deletion_graph, endpoint):
    graph = deletion_graph
    own_result, own_detail = submit(graph)
    other_client = APIClient(raise_request_exception=False)
    other_client.force_authenticate(graph.other)
    other_result, other_detail = submit(graph, other_client)
    delete_source(graph, 'quiz')
    for client, result, detail in ((graph.client, own_result, own_detail), (other_client, other_result, other_detail)):
        response = client.get(endpoint)
        assert response.status_code == 200
        entries = response.data if endpoint.startswith('/quizzes/') else response.data['quiz_history']
        assert len(entries) == 1, 'Own deleted-course history must remain visible without revealing another student.'
        entry = entries[0]
        assert entry['quiz_title'] == graph.quiz.title
        assert entry['score'] == 50
        if endpoint.startswith('/quizzes/'):
            assert entry['id'] == result.pk
            assert 'quiz_id' in entry and entry['quiz_id'] is None
            assert entry['lesson_title'] is None and entry['course_title'] is None
        else:
            assert entry['attempt_id'] == detail.pk
            assert response.data['total_quizzes_taken'] == 1
            assert response.data['avg_quiz_score'] == 50
            assert response.data['weak_topics'] == []
    anonymous = APIClient(raise_request_exception=False).get(endpoint)
    assert anonymous.status_code in (401, 403)


@pytest.mark.parametrize('with_detail', [False, True])
def test_legacy_result_without_snapshot_survives_quiz_deletion(deletion_graph, with_detail):
    graph = deletion_graph
    result = Result.objects.create(student=graph.student, quiz=graph.quiz, score=50)
    detail = None
    if with_detail:
        detail = QuizAttemptDetail.objects.create(student=graph.student, quiz=graph.quiz,
            result=result, score=50, total_questions=2, correct_answers=1)
        answer = QuestionAnswer.objects.create(attempt=detail, question=graph.questions[0],
            selected_choice_ids=[graph.choices[0][0].pk], selected_choice=graph.choices[0][0], is_correct=True)
    delete_source(graph, 'quiz')
    assert Result.objects.filter(pk=result.pk).exists(), 'Legacy results must not disappear with live content.'
    result.refresh_from_db()
    assert result.quiz_id is None and result.score == 50
    assert str(result)
    if detail is not None:
        detail.refresh_from_db()
        answer.refresh_from_db()
        assert detail.quiz_id is None and detail.quiz_snapshot is None
        assert answer.question_id is None and answer.question_snapshot is None
        assert answer.selected_choice_ids == [graph.choices[0][0].pk]
        assert str(detail) and str(answer)
    response = graph.client.get('/quizzes/my-results/')
    assert response.status_code == 200 and len(response.data) == 1
    assert response.data[0]['id'] == result.pk
    assert 'quiz_id' in response.data[0] and response.data[0]['quiz_id'] is None
    assert response.data[0]['quiz_title'], 'Unavailable legacy title needs an explicit fallback, not fabricated content.'
    dashboard = graph.client.get('/analytics/student/dashboard/')
    assert dashboard.status_code == 200
    assert dashboard.data['total_quizzes_taken'] == int(with_detail)


def test_deleted_quiz_admin_and_model_labels_remain_readable(deletion_graph):
    graph = deletion_graph
    result, detail = submit(graph)
    answer_ids = list(detail.answers.values_list('pk', flat=True))
    delete_source(graph, 'quiz')
    assert Result.objects.filter(pk=result.pk).exists(), 'The admin must retain completed submissions.'
    result.refresh_from_db()
    detail.refresh_from_db()
    assert graph.quiz.title in str(result)
    assert graph.quiz.title in str(detail)
    assert all(str(answer) for answer in QuestionAnswer.objects.filter(pk__in=answer_ids))
    admin_user = get_user_model().objects.create_user(username='deletion_fixture_admin',
        role='admin', is_staff=True, is_superuser=True)
    client = Client(raise_request_exception=False)
    client.force_login(admin_user)
    for model_path, pk in (('quizzes/result', result.pk), ('analytics/quizattemptdetail', detail.pk),
            ('analytics/questionanswer', answer_ids[0])):
        assert client.get(f'/admin/{model_path}/').status_code == 200
        assert client.get(f'/admin/{model_path}/{pk}/change/').status_code == 200


@pytest.mark.parametrize('source', ['lesson', 'course'])
def test_content_deletion_access_is_not_relaxed(deletion_graph, source):
    graph = deletion_graph
    result, detail = submit(graph)
    before = content_state(result, detail)
    url = f'/courses/lessons/{graph.lesson.pk}/' if source == 'lesson' else f'/courses/{graph.course.pk}/'
    response = graph.client.delete(url)
    assert response.status_code == 403
    assert Quiz.objects.filter(pk=graph.quiz.pk).exists()
    assert content_state(result, detail) == before


@pytest.mark.parametrize('source', ['quiz', 'lesson', 'course'])
def test_deleted_quiz_submission_retry_keeps_original_response_and_single_attempt(deletion_graph, source):
    graph = deletion_graph
    data = submission_payload(graph)
    result, detail = submit(graph, data=data)
    original_response = deepcopy(result.submission_response)
    before = content_state(result, detail)
    delete_source(graph, source)
    url = f'/quizzes/{graph.quiz.pk}/submit/'
    repeated = graph.client.post(url, data, format='json')
    assert repeated.status_code == 200, 'A retry must find the completed original submission after content deletion.'
    assert repeated.json() == original_response
    assert content_state(result, detail) == before
    assert [model.objects.count() for model in (Result, QuizAttemptDetail, QuestionAnswer)] == [1, 1, 2]
    changed = deepcopy(data)
    changed['answers'][0]['choice_ids'] = [graph.choices[0][0].pk]
    assert graph.client.post(url, changed, format='json').status_code == 409
    fresh = deepcopy(data)
    fresh['submission_id'] = str(uuid4())
    assert graph.client.post(url, fresh, format='json').status_code == 400
    assert content_state(result, detail) == before
    assert [model.objects.count() for model in (Result, QuizAttemptDetail, QuestionAnswer)] == [1, 1, 2]


def test_deleted_quiz_retry_does_not_find_another_student_or_original_quiz(deletion_graph):
    graph = deletion_graph
    data = submission_payload(graph)
    result, detail = submit(graph, data=data)
    original_response = deepcopy(result.submission_response)
    before = content_state(result, detail)
    quiz_id = graph.quiz.pk
    delete_source(graph, 'quiz')
    other_client = APIClient(raise_request_exception=False)
    other_client.force_authenticate(graph.other)
    assert other_client.post(f'/quizzes/{quiz_id}/submit/', data, format='json').status_code == 400
    assert graph.client.post(f'/quizzes/{quiz_id + 10000}/submit/', data, format='json').status_code == 400
    forged = deepcopy(data)
    forged['answers'].append({'question_id': graph.questions[1].pk + 10000, 'choice_ids': []})
    assert graph.client.post(f'/quizzes/{quiz_id}/submit/', forged, format='json').status_code == 400
    replay = graph.client.post(f'/quizzes/{quiz_id}/submit/', data, format='json')
    assert replay.status_code == 200 and replay.json() == original_response
    assert content_state(result, detail) == before
    assert [model.objects.count() for model in (Result, QuizAttemptDetail, QuestionAnswer)] == [1, 1, 2]


def test_deleted_quiz_retry_disambiguates_same_submission_uuid_for_two_original_quizzes(deletion_graph):
    graph = deletion_graph
    first_id = graph.quiz.pk
    data_one = submission_payload(graph)
    first_result, first_detail = submit(graph, data=data_one)
    second_quiz = Quiz.objects.create(lesson=graph.lesson, title='Synthetic second original quiz')
    second_question = Question.objects.create(quiz=second_quiz, text='Synthetic separate question')
    second_choice = Choice.objects.create(question=second_question, text='Synthetic separate option', is_correct=True)
    data_two = {'submission_id': data_one['submission_id'], 'answers': [
        {'question_id': second_question.pk, 'choice_ids': [second_choice.pk]}]}
    second_id = second_quiz.pk
    second_response = graph.client.post(f'/quizzes/{second_id}/submit/', data_two, format='json')
    assert second_response.status_code == 200
    second_result = Result.objects.get(pk=second_response.data['id'])
    second_detail = QuizAttemptDetail.objects.get(result=second_result)
    before = (content_state(first_result, first_detail), content_state(second_result, second_detail))
    graph.lesson.delete()
    for quiz_id, data, result in ((first_id, data_one, first_result), (second_id, data_two, second_result)):
        response = graph.client.post(f'/quizzes/{quiz_id}/submit/', data, format='json')
        assert response.status_code == 200
        assert response.json() == result.submission_response
    assert (content_state(first_result, first_detail), content_state(second_result, second_detail)) == before
    assert [model.objects.count() for model in (Result, QuizAttemptDetail, QuestionAnswer)] == [2, 2, 3]
