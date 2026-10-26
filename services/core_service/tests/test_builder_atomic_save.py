"""Real HTTP/ORM regressions for one-request CourseBuilder quiz + step saves."""

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from courses.models import Category, Course, Lesson, LessonStep
from quizzes.models import Choice, Question, Quiz


pytestmark = pytest.mark.django_db(transaction=True)
ENDPOINT = '/quizzes/save-generated/'
PASSWORD = 'Synthetic-atomic-builder-test-only'


def authenticated_client(user):
    client = APIClient(raise_request_exception=False)
    response = client.post('/users/login/', {
        'username': user.username, 'password': PASSWORD,
    }, format='json')
    assert response.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return client


@pytest.fixture
def graph():
    user = get_user_model().objects.create_user(
        username='synthetic_atomic_author', password=PASSWORD, role='teacher',
    )
    category = Category.objects.create(title='Synthetic atomic tests')
    course = Course.objects.create(title='Synthetic course', category=category, teacher=user)
    lesson = Lesson.objects.create(title='Synthetic lesson', course=course)
    step = LessonStep.objects.create(
        lesson=lesson, title='Original step', step_type='quiz', content='Original content',
        scenario_data={'retained_metadata': 'keep'},
    )
    return SimpleNamespace(user=user, course=course, lesson=lesson, step=step)


@pytest.fixture
def client(graph):
    return authenticated_client(graph.user)


def seed_linked_quiz(graph):
    quiz = Quiz.objects.create(lesson=graph.lesson, title='Original quiz')
    question = Question.objects.create(quiz=quiz, text='Original question', explanation='Original explanation')
    Choice.objects.create(question=question, text='Original correct', is_correct=True)
    Choice.objects.create(question=question, text='Original incorrect', is_correct=False)
    graph.step.scenario_data = {**graph.step.scenario_data, 'quiz_id': quiz.pk}
    graph.step.save()
    return quiz


def payload(graph, quiz=None):
    data = {
        'lesson_id': graph.lesson.pk, 'quiz_title': 'Changed quiz',
        'step_id': graph.step.pk,
        'step': {
            'title': 'Changed step', 'content': 'Changed content', 'step_type': 'quiz',
            'scenario_data': {'client_metadata': 'added'},
        },
        'questions': [
            {'question': 'Synthetic single?', 'options': ['A', 'B', 'C'],
             'correct_index': [1], 'explanation': 'Synthetic single explanation'},
            {'question': 'Synthetic multiple?', 'options': ['A', 'B', 'C', 'D'],
             'correct_index': [0, 2], 'explanation': 'Synthetic multiple explanation'},
        ],
    }
    if quiz is not None:
        data['quiz_id'] = quiz.pk
    return data


def database_snapshot():
    # Include old IDs and every stored field to detect partial replacement/deletion.
    return {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Quiz, Question, Choice, LessonStep)
    }


def assert_saved(graph, response, expected_id=None):
    assert response.status_code == 201
    graph.step.refresh_from_db()
    quiz_id = response.data['quiz_id']
    if expected_id is not None:
        assert quiz_id == expected_id
    assert response.data['step']['id'] == graph.step.pk
    assert response.data['step']['scenario_data']['quiz_id'] == quiz_id
    assert graph.step.title == 'Changed step'
    assert graph.step.content == 'Changed content'
    assert graph.step.scenario_data == {
        'retained_metadata': 'keep', 'client_metadata': 'added', 'quiz_id': quiz_id,
    }
    quiz = Quiz.objects.get(pk=quiz_id)
    assert quiz.title == 'Changed quiz'
    questions = list(quiz.questions.order_by('pk'))
    assert [q.text for q in questions] == ['Synthetic single?', 'Synthetic multiple?']
    assert [q.explanation for q in questions] == [
        'Synthetic single explanation', 'Synthetic multiple explanation',
    ]
    assert [list(q.choices.order_by('pk').values_list('is_correct', flat=True)) for q in questions] == [
        [False, True, False], [True, False, True, False],
    ]


def test_new_quiz_and_step_are_saved_together(client, graph):
    assert_saved(graph, client.post(ENDPOINT, payload(graph), format='json'))
    assert Quiz.objects.count() == 1


@pytest.mark.parametrize('include_quiz_id', [True, False])
def test_existing_link_is_used_and_updated(client, graph, include_quiz_id):
    quiz = seed_linked_quiz(graph)
    data = payload(graph, quiz if include_quiz_id else None)
    data['step']['scenario_data']['quiz_id'] = quiz.pk
    assert_saved(graph, client.post(ENDPOINT, data, format='json'), quiz.pk)
    assert Quiz.objects.count() == 1
    assert Question.objects.count() == 2
    assert Choice.objects.count() == 7


def test_retry_original_create_request_reuses_saved_link(client, graph):
    data = payload(graph)
    first = client.post(ENDPOINT, data, format='json')
    assert first.status_code == 201
    second = client.post(ENDPOINT, deepcopy(data), format='json')
    assert_saved(graph, second, first.data['quiz_id'])
    assert Quiz.objects.count() == 1
    assert Question.objects.count() == 2
    assert Choice.objects.count() == 7


@pytest.mark.parametrize('field,value', [
    ('title', 'x' * 256), ('title', None), ('content', {}),
    ('step_type', 'text'), ('scenario_data', []), ('scenario_data', None),
    ('scenario_data', {'quiz_id': '1'}), ('scenario_data', {'quiz_id': True}),
])
def test_invalid_step_changes_nothing(client, graph, field, value):
    quiz = seed_linked_quiz(graph)
    data = payload(graph, quiz)
    data['step'][field] = value
    before = database_snapshot()
    response = client.post(ENDPOINT, data, format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


@pytest.mark.parametrize('missing_field', ['step_id', 'step'])
def test_builder_fields_are_required_as_a_pair(client, graph, missing_field):
    data = payload(graph)
    del data[missing_field]
    before = database_snapshot()
    response = client.post(ENDPOINT, data, format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


@pytest.mark.parametrize('linked', [False, True])
def test_failure_after_actual_step_write_rolls_back_everything(client, graph, linked):
    quiz = seed_linked_quiz(graph) if linked else None
    before = database_snapshot()
    actual_save = LessonStep.save
    observed = []

    def fail_after_save(instance, *args, **kwargs):
        result = actual_save(instance, *args, **kwargs)
        if instance.pk == graph.step.pk:
            stored = LessonStep.objects.get(pk=instance.pk)
            observed.append((stored.title, Question.objects.filter(text='Synthetic multiple?').count()))
            raise RuntimeError('Synthetic failure after actual step write')
        return result

    with patch.object(LessonStep, 'save', fail_after_save):
        response = client.post(ENDPOINT, payload(graph, quiz), format='json')
    assert response.status_code == 500
    assert observed == [('Changed step', 1)]
    assert database_snapshot() == before


@pytest.mark.parametrize('role', ['student', 'teacher'])
def test_other_user_cannot_save_course(client, graph, role):
    quiz = seed_linked_quiz(graph)
    outsider = get_user_model().objects.create_user(username=f'outsider_{role}', password=PASSWORD, role=role)
    outsider_client = authenticated_client(outsider)
    before = database_snapshot()
    response = outsider_client.post(ENDPOINT, payload(graph, quiz), format='json')
    assert response.status_code == 403
    assert database_snapshot() == before


@pytest.mark.parametrize('privilege', ['admin', 'superuser'])
def test_existing_admin_and_superuser_permissions_are_preserved(client, graph, privilege):
    actor = get_user_model().objects.create_user(
        username=f'privileged_{privilege}', password=PASSWORD,
        role='admin' if privilege == 'admin' else 'student', is_superuser=privilege == 'superuser',
    )
    assert_saved(graph, authenticated_client(actor).post(ENDPOINT, payload(graph), format='json'))


def test_anonymous_request_cannot_save(graph):
    before = database_snapshot()
    response = APIClient().post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 401
    assert database_snapshot() == before


def test_step_from_other_lesson_is_rejected(client, graph):
    other_lesson = Lesson.objects.create(course=graph.course, title='Other lesson')
    other_step = LessonStep.objects.create(lesson=other_lesson, step_type='quiz')
    data = payload(graph)
    data['step_id'] = other_step.pk
    before = database_snapshot()
    response = client.post(ENDPOINT, data, format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


def test_non_quiz_step_is_rejected(client, graph):
    graph.step.step_type = 'text'
    graph.step.save()
    before = database_snapshot()
    response = client.post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


@pytest.mark.parametrize('linked', [False, True])
@pytest.mark.parametrize('location', ['quiz_id', 'scenario_data'])
def test_request_cannot_reassociate_another_quiz(client, graph, linked, location):
    if linked:
        seed_linked_quiz(graph)
    other = Quiz.objects.create(lesson=graph.lesson, title='Other quiz in same lesson')
    data = payload(graph)
    if location == 'quiz_id':
        data['quiz_id'] = other.pk
    else:
        data['step']['scenario_data']['quiz_id'] = other.pk
    before = database_snapshot()
    response = client.post(ENDPOINT, data, format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


@pytest.mark.parametrize('scenario', [
    'not an object', [], {'quiz_id': None}, {'quiz_id': True},
    {'quiz_id': '1'}, {'quiz_id': 999999},
])
def test_corrupt_saved_link_is_rejected_without_changes(client, graph, scenario):
    graph.step.scenario_data = scenario
    graph.step.save()
    before = database_snapshot()
    response = client.post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


def test_saved_link_to_quiz_of_other_lesson_is_rejected(client, graph):
    other_lesson = Lesson.objects.create(course=graph.course, title='Other lesson')
    other_quiz = Quiz.objects.create(lesson=other_lesson, title='Other quiz')
    graph.step.scenario_data = {'quiz_id': other_quiz.pk}
    graph.step.save()
    before = database_snapshot()
    response = client.post(ENDPOINT, payload(graph), format='json')
    assert response.status_code == 400
    assert database_snapshot() == before


def test_legacy_save_without_builder_fields_keeps_its_contract(client, graph):
    quiz = seed_linked_quiz(graph)
    original_step = LessonStep.objects.values().get(pk=graph.step.pk)
    data = payload(graph, quiz)
    del data['step_id']
    del data['step']
    data['questions'][0]['correct_index'] = '1'
    response = client.post(ENDPOINT, data, format='json')
    assert response.status_code == 201
    assert response.data['quiz_id'] == quiz.pk
    assert 'step' not in response.data
    assert LessonStep.objects.values().get(pk=graph.step.pk) == original_step
    assert quiz.questions.count() == 2


def test_text_step_patch_remains_available(client, graph):
    graph.step.step_type = 'text'
    graph.step.save()
    response = client.patch(f'/courses/steps/{graph.step.pk}/', {
        'title': 'Changed text title', 'content': '<p>Synthetic text.</p>',
    }, format='json')
    assert response.status_code == 200
    graph.step.refresh_from_db()
    assert graph.step.title == 'Changed text title'
    assert graph.step.content == '<p>Synthetic text.</p>'
    assert Quiz.objects.count() == 0
