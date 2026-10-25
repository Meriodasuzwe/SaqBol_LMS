from unittest.mock import Mock, patch

import pytest
import requests
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from courses.models import Category, Course, Lesson, LessonStep
from quizzes.models import Choice, Question, Quiz

pytestmark = pytest.mark.django_db


@pytest.fixture
def lesson():
    teacher = get_user_model().objects.create_user(username='teacher', role='teacher')
    category = Category.objects.create(title='Security')
    course = Course.objects.create(title='Course', category=category, teacher=teacher)
    return Lesson.objects.create(title='Lesson', course=course)


@pytest.fixture
def client(lesson, settings):
    settings.AI_ENABLED = True
    client = APIClient()
    client.force_authenticate(lesson.course.teacher)
    client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
    return client


def test_preview_reads_ordered_text_steps_and_forwards_auth(client, lesson, settings):
    settings.AI_SERVICE_URL = 'http://ai.internal:8000/'
    LessonStep.objects.create(lesson=lesson, order=2, content='Second theory paragraph.')
    LessonStep.objects.create(lesson=lesson, order=1, content='First theory paragraph.')
    LessonStep.objects.create(lesson=lesson, step_type='video_url', content='https://video.invalid')
    upstream = Mock(status_code=200)
    upstream.json.return_value = {'questions': []}
    with patch('quizzes.views.requests.post', return_value=upstream) as post:
        response = client.post('/quizzes/generate-preview/', {'lesson_id': lesson.id}, format='json')
    assert response.status_code == 200
    assert post.call_args.args[0] == 'http://ai.internal:8000/generate-quiz'
    assert post.call_args.kwargs['json']['text'] == 'First theory paragraph.\n\nSecond theory paragraph.'
    assert post.call_args.kwargs['headers']['Authorization'] == 'Bearer test-token'


def test_preview_unavailable_returns_503(client):
    with patch('quizzes.views.requests.post', side_effect=requests.ConnectionError):
        response = client.post('/quizzes/generate-preview/', {'custom_text': 'A sufficiently long lesson.'}, format='json')
    assert response.status_code == 503


def test_preview_invalid_count_is_400_without_ai_call(client):
    with patch('quizzes.views.requests.post') as post:
        response = client.post('/quizzes/generate-preview/', {'custom_text': 'A sufficiently long lesson.', 'count': 'invalid'}, format='json')
    assert response.status_code == 400
    post.assert_not_called()


@pytest.fixture
def quiz(lesson):
    quiz = Quiz.objects.create(lesson=lesson, title='Original quiz')
    question = Question.objects.create(quiz=quiz, text='Original question')
    Choice.objects.create(question=question, text='Correct', is_correct=True)
    return quiz


def test_invalid_quiz_update_preserves_existing_questions(client, quiz):
    original_id = quiz.questions.get().id
    response = client.post('/quizzes/save-generated/', {
        'lesson_id': quiz.lesson_id, 'quiz_id': quiz.id, 'quiz_title': 'Changed',
        'questions': [{'question': 'Invalid update', 'options': ['One', 'Two'], 'correct_index': 'invalid'}],
    }, format='json')
    assert response.status_code == 400
    quiz.refresh_from_db()
    assert quiz.title == 'Original quiz'
    assert quiz.questions.get().id == original_id
    assert quiz.questions.get().choices.count() == 1


def test_student_cannot_replace_quiz(client, quiz):
    client.force_authenticate(get_user_model().objects.create_user(username='student'))
    response = client.post('/quizzes/save-generated/', {
        'lesson_id': quiz.lesson_id, 'quiz_id': quiz.id,
        'questions': [{'question': 'Replacement', 'options': ['One', 'Two'], 'correct_index': [0]}],
    }, format='json')
    assert response.status_code == 403
    assert quiz.questions.get().text == 'Original question'


def test_quiz_from_another_lesson_cannot_be_replaced(client, quiz, lesson):
    other_lesson = Lesson.objects.create(course=lesson.course, title='Other lesson')
    response = client.post('/quizzes/save-generated/', {
        'lesson_id': other_lesson.id, 'quiz_id': quiz.id,
        'questions': [{'question': 'Replacement', 'options': ['One', 'Two'], 'correct_index': [0]}],
    }, format='json')
    assert response.status_code == 404
    assert quiz.questions.get().text == 'Original question'


@pytest.mark.parametrize('correct_index', [0, '0', [0, 1]])
def test_valid_quiz_update_accepts_legacy_and_multiple_answers(client, quiz, correct_index):
    response = client.post('/quizzes/save-generated/', {
        'lesson_id': quiz.lesson_id, 'quiz_id': quiz.id,
        'questions': [{'question': 'Replacement', 'options': ['One', 'Two'], 'correct_index': correct_index}],
    }, format='json')
    assert response.status_code == 201
    assert response.data['quiz_id'] == quiz.id
    question = quiz.questions.get()
    assert question.text == 'Replacement'
    assert list(question.choices.filter(is_correct=True).values_list('text', flat=True)) == (
        ['One', 'Two'] if isinstance(correct_index, list) else ['One']
    )


def test_chat_proxy_forwards_auth(client, lesson, settings):
    settings.AI_SERVICE_URL = 'http://ai.internal:8000/'
    step = LessonStep.objects.create(lesson=lesson, step_type='simulation_chat', scenario_data={})
    upstream = Mock(ok=True)
    upstream.json.return_value = {'reply': 'Hello', 'isSuccess': None}
    with patch('courses.views.requests.post', return_value=upstream) as post:
        response = client.post(f'/courses/steps/{step.id}/chat-reply/', {'message': 'Hello'}, format='json')
    assert response.status_code == 200
    assert post.call_args.args[0] == 'http://ai.internal:8000/generate-scenario/chat-reply'
    assert post.call_args.kwargs['headers']['Authorization'] == 'Bearer test-token'


def test_chat_unavailable_returns_503(client, lesson):
    step = LessonStep.objects.create(lesson=lesson, step_type='simulation_chat')
    with patch('courses.views.requests.post', side_effect=requests.ConnectionError):
        response = client.post(f'/courses/steps/{step.id}/chat-reply/', {'message': 'Hello'}, format='json')
    assert response.status_code == 503


@pytest.mark.parametrize('endpoint', ['/quizzes/generate-preview/', '/courses/steps/999/chat-reply/'])
def test_disabled_ai_returns_503_without_upstream_call(client, settings, endpoint):
    settings.AI_ENABLED = False
    with patch('requests.post') as post:
        response = client.post(endpoint, {}, format='json')
    assert response.status_code == 503
    assert 'отключены' in response.data['error']
    post.assert_not_called()


def test_saving_manual_quiz_does_not_require_ai(client, lesson, settings):
    settings.AI_ENABLED = False
    response = client.post('/quizzes/save-generated/', {
        'lesson_id': lesson.id,
        'questions': [{'question': 'Manual question', 'options': ['One', 'Two'], 'correct_index': [0]}],
    }, format='json')
    assert response.status_code == 201


def test_failed_database_write_rolls_back_quiz_replacement(client, quiz):
    original_id = quiz.questions.get().id
    with patch('quizzes.views.Choice.objects.bulk_create', side_effect=RuntimeError('Simulated write failure')):
        with pytest.raises(RuntimeError, match='Simulated write failure'):
            client.post('/quizzes/save-generated/', {
                'lesson_id': quiz.lesson_id, 'quiz_id': quiz.id, 'quiz_title': 'Changed',
                'questions': [{'question': 'Replacement', 'options': ['One', 'Two'], 'correct_index': [0]}],
            }, format='json')
    quiz.refresh_from_db()
    assert quiz.title == 'Original quiz'
    assert quiz.questions.get().id == original_id
    assert quiz.questions.get().choices.count() == 1
