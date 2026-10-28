"""Training regressions and remaining audit characterizations through Django API.

Tests named ``reproduces`` intentionally pass while the documented defect is
present; they are evidence, not an assertion that this behavior is desirable.
Run only with isolated in-memory SQLite settings. No live accounts or services
are involved, and no browser executes the HTML marker.
"""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Enrollment, Lesson
from quizzes.models import Choice, Question, Quiz, Result


pytestmark = pytest.mark.django_db


FIXTURE_PATH = Path(__file__).parent / 'fixtures' / 'sql_selection_training.json'
HTML_MARKER = (
    '<img src="data:," onerror="/* synthetic audit marker */" '
    'data-training-audit="synthetic">'
)


def assert_memory_database(config):
    assert config.get('ENGINE') == 'django.db.backends.sqlite3', 'Only SQLite is allowed.'
    names = [config.get('NAME', '')]
    if config.get('TEST', {}).get('NAME'):
        names.append(config['TEST']['NAME'])
    for value in names:
        name = str(value)
        assert name == ':memory:' or (
            name.startswith('file:memorydb_') and 'mode=memory' in name
        ), 'Only an in-memory database is allowed.'


@pytest.fixture(scope='session')
def django_db_modify_db_settings():
    # pytest-django invokes this hook before database setup. It deliberately only
    # validates settings: neither production configuration nor migrations change.
    for config in django_settings.DATABASES.values():
        assert_memory_database(config)
    assert django_settings.AI_ENABLED is False
    assert django_settings.EMAIL_BACKEND == 'django.core.mail.backends.locmem.EmailBackend'


@pytest.fixture(autouse=True)
def isolated_database_only(db):
    assert_memory_database(connection.settings_dict)
    assert 'users_user' in connection.introspection.table_names(), (
        'pytest-django did not initialize the migrated in-memory test database.'
    )


@pytest.fixture
def source_data():
    return json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))


@pytest.fixture
def training(source_data, isolated_database_only):
    metadata = source_data['metadata']
    user_model = get_user_model()
    teacher = user_model.objects.create_user(username='synthetic_teacher', role='teacher')
    student = user_model.objects.create_user(username='synthetic_student', role='student')
    category = Category.objects.create(title=metadata['subject'])
    course = Course.objects.create(
        title=metadata['subject'], description=metadata['notice'],
        category=category, teacher=teacher, status='published',
    )
    lesson = Lesson.objects.create(course=course, title=metadata['topic'])
    quiz = Quiz.objects.create(lesson=lesson, title=metadata['topic'])
    Enrollment.objects.create(student=student, course=course)
    items = []
    for source in source_data['questions']:
        question = Question.objects.create(
            quiz=quiz, text=source['question'], explanation=source['explanation'],
        )
        choices = [
            Choice.objects.create(
                question=question, text=text, is_correct=index in source['correct_index'],
            )
            for index, text in enumerate(source['options'])
        ]
        items.append(SimpleNamespace(
            source=source, question=question, choices=choices,
            correct_ids=[choices[index].id for index in source['correct_index']],
        ))
    client = APIClient()
    client.force_authenticate(student)
    teacher_client = APIClient()
    teacher_client.force_authenticate(teacher)
    return SimpleNamespace(
        source=source_data, student=student, course=course, lesson=lesson,
        quiz=quiz, items=items, client=client, teacher_client=teacher_client,
    )


@pytest.fixture
def foreign_item(training):
    lesson = Lesson.objects.create(course=training.course, title='Synthetic other topic')
    quiz = Quiz.objects.create(lesson=lesson, title='Synthetic other quiz')
    question = Question.objects.create(quiz=quiz, text='Synthetic foreign question')
    choice = Choice.objects.create(question=question, text='Synthetic correct answer', is_correct=True)
    return SimpleNamespace(quiz=quiz, question=question, choice=choice)


def fixture_answers(training):
    # Translate the fixture's known answer key to synthetic database identifiers;
    # grading itself always runs through the application endpoint.
    return [
        {'question_id': item.question.id, 'choice_ids': list(item.correct_ids)}
        for item in training.items
    ]


def submit(training, answers):
    return training.client.post(
        f'/quizzes/{training.quiz.id}/submit/', {'answers': answers}, format='json',
    )


def assert_no_attempt_records():
    assert not Result.objects.exists()
    assert not QuizAttemptDetail.objects.exists()
    assert not QuestionAnswer.objects.exists()


def assert_rejected_without_attempt_records(response):
    assert response.status_code == 400
    assert response.data
    assert_no_attempt_records()


def analytics_payload(training, result, answers=None):
    if answers is None:
        answers = [
            {
                'question_id': item.question.id,
                'selected_choice_id': item.correct_ids[0],
                'is_correct': True,
            }
            for item in training.items
        ]
    return {
        'quiz_id': training.quiz.id, 'result_id': result.id, 'score': result.score,
        'total_questions': 10, 'correct_answers': 10, 'time_spent_seconds': 30,
        'answers': answers,
    }


def test_control_fixture_is_ordered_synthetic_training(source_data):
    metadata = source_data['metadata']
    assert metadata['synthetic'] is True
    assert metadata['development_only'] is True
    assert metadata['publish'] is False
    questions = source_data['questions']
    assert len(questions) == 10
    assert [item['key'] for item in questions] == [f'sql-{index:02d}' for index in range(1, 11)]
    assert len({item['key'] for item in questions}) == 10
    for item in questions:
        assert item['question'].strip()
        assert item['explanation'].strip()
        assert all(isinstance(option, str) and option.strip() for option in item['options'])
        assert item['correct_index']
        assert len(set(item['correct_index'])) == len(item['correct_index'])
        assert all(type(index) is int and 0 <= index < len(item['options']) for index in item['correct_index'])
    assert sum(len(item['correct_index']) > 1 for item in questions) == 4


def test_control_all_ten_answers_score_100(training):
    response = submit(training, fixture_answers(training))
    assert response.status_code == 200
    assert response.data['score'] == 100
    assert response.data['correct_count'] == response.data['total_questions'] == 10
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == 100


def test_control_omitted_question_keeps_full_quiz_denominator(training):
    response = submit(training, fixture_answers(training)[:-1])
    assert response.status_code == 200
    assert response.data['total_questions'] == 10
    assert response.data['correct_count'] == 9
    assert response.data['score'] == 90


@pytest.mark.parametrize('selection, expected_score, expected_count', [
    ('exact', 10, 1), ('reversed', 10, 1), ('missing', 0, 0), ('extra', 0, 0),
])
def test_control_multiple_answers_require_exact_set(training, selection, expected_score, expected_count):
    item = next(item for item in training.items if len(item.correct_ids) > 1)
    ids = list(item.correct_ids)
    if selection == 'reversed':
        ids.reverse()
    elif selection == 'missing':
        ids = ids[:-1]
    elif selection == 'extra':
        ids.append(next(choice.id for choice in item.choices if choice.id not in ids))
    response = submit(training, [{'question_id': item.question.id, 'choice_ids': ids}])
    assert response.status_code == 200
    assert response.data['score'] == expected_score
    assert response.data['correct_count'] == expected_count
    assert response.data['total_questions'] == 10
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == expected_score
    assert set(response.data['correct_answers_ids'][item.question.id]) == set(item.correct_ids)


def test_control_submission_rejects_more_than_fifty_answers(training):
    response = submit(training, [fixture_answers(training)[0]] * 51)
    assert_rejected_without_attempt_records(response)
    assert 'answers' in response.data


def test_submit_rejects_duplicate_question_ids_without_writing_attempts(training):
    answers = fixture_answers(training)
    response = submit(training, answers + [answers[0]])
    assert_rejected_without_attempt_records(response)


def test_submit_rejects_foreign_quiz_question_without_writing_attempts(training, foreign_item):
    answers = fixture_answers(training) + [{
        'question_id': foreign_item.question.id, 'choice_ids': [foreign_item.choice.id],
    }]
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


@pytest.mark.parametrize('origin', ['another_question_in_same_quiz', 'another_quiz'])
def test_submit_rejects_foreign_choices_without_writing_attempts(training, foreign_item, origin):
    answers = fixture_answers(training)
    answers[-1]['choice_ids'] = [
        training.items[0].correct_ids[0]
        if origin == 'another_question_in_same_quiz' else foreign_item.choice.id
    ]
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


@pytest.mark.parametrize('field', ['question_id', 'choice_id'])
def test_submit_rejects_nonexistent_ids_without_writing_attempts(training, field):
    nonexistent_id = 1_000_000
    assert not Question.objects.filter(pk=nonexistent_id).exists()
    assert not Choice.objects.filter(pk=nonexistent_id).exists()
    answers = fixture_answers(training)
    if field == 'question_id':
        answers[-1]['question_id'] = nonexistent_id
    else:
        answers[-1]['choice_ids'] = [nonexistent_id]
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


def test_submit_rejects_duplicate_choice_ids_without_writing_attempts(training):
    answers = fixture_answers(training)
    answers[-1]['choice_ids'].append(answers[-1]['choice_ids'][0])
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


@pytest.mark.parametrize('field', ['question_id', 'choice_id'])
@pytest.mark.parametrize('invalid_kind', [
    'numeric_string', 'whole_float', 'fractional_float', 'true', 'false',
    'null', 'zero', 'negative', 'text', 'object', 'list',
])
def test_submit_requires_strict_positive_integer_ids(training, field, invalid_kind):
    answers = fixture_answers(training)
    valid_id = answers[-1]['question_id'] if field == 'question_id' else answers[-1]['choice_ids'][0]
    invalid_values = {
        'numeric_string': str(valid_id), 'whole_float': float(valid_id),
        'fractional_float': valid_id + 0.5, 'true': True, 'false': False,
        'null': None, 'zero': 0, 'negative': -valid_id, 'text': 'not-an-id',
        'object': {'id': valid_id}, 'list': [valid_id],
    }
    if field == 'question_id':
        answers[-1]['question_id'] = invalid_values[invalid_kind]
    else:
        answers[-1]['choice_ids'] = [invalid_values[invalid_kind]]
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


@pytest.mark.parametrize('invalid_shape', [
    'body_list', 'body_text', 'body_number', 'body_null', 'missing_answers',
    'answers_object', 'answers_text', 'answers_number', 'answers_null', 'answers_bool',
    'item_list', 'item_text', 'item_number', 'item_null', 'item_bool',
    'missing_question_id', 'missing_choice_ids',
    'choices_object', 'choices_text', 'choices_number', 'choices_null', 'choices_bool',
])
def test_submit_rejects_malformed_payload_without_writing_attempts(training, invalid_shape):
    item = training.items[0]
    shapes = {
        'body_list': [], 'body_text': 'not-an-object', 'body_number': 1, 'body_null': None,
        'missing_answers': {}, 'answers_object': {'answers': {}},
        'answers_text': {'answers': 'not-a-list'}, 'answers_number': {'answers': 1},
        'answers_null': {'answers': None}, 'answers_bool': {'answers': True},
        'item_list': {'answers': [[]]}, 'item_text': {'answers': ['not-an-object']},
        'item_number': {'answers': [1]}, 'item_null': {'answers': [None]},
        'item_bool': {'answers': [True]},
        'missing_question_id': {'answers': [{'choice_ids': item.correct_ids}]},
        'missing_choice_ids': {'answers': [{'question_id': item.question.id}]},
    }
    for name, value in [
        ('choices_object', {}), ('choices_text', str(item.correct_ids[0])),
        ('choices_number', item.correct_ids[0]), ('choices_null', None), ('choices_bool', True),
    ]:
        shapes[name] = {'answers': [{'question_id': item.question.id, 'choice_ids': value}]}
    # generic() preserves an explicit JSON null body rather than APIClient.post's
    # data=None convenience conversion to an empty object.
    response = training.client.generic(
        'POST', f'/quizzes/{training.quiz.id}/submit/',
        data=json.dumps(shapes[invalid_shape]), content_type='application/json',
    )
    assert_rejected_without_attempt_records(response)


def test_submit_empty_answers_is_zero_with_full_quiz_maximum(training):
    response = submit(training, [])
    assert response.status_code == 200
    assert response.data['score'] == 0
    assert response.data['correct_count'] == 0
    assert response.data['total_questions'] == 10
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == 0


def test_submit_explicit_empty_selection_is_skipped_with_zero_points(training):
    response = submit(training, [{'question_id': training.items[0].question.id, 'choice_ids': []}])
    assert response.status_code == 200
    assert response.data['score'] == 0
    assert response.data['correct_count'] == 0
    assert response.data['total_questions'] == 10
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == 0


def test_submit_does_not_invent_pass_fail_status(training):
    response = submit(training, [fixture_answers(training)[0]])
    assert response.status_code == 200
    assert response.data['score'] == 10
    assert response.data['correct_count'] == 1
    assert response.data['total_questions'] == 10
    assert 'status' not in response.data
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == 10


@pytest.mark.parametrize('correct_answers', [False, True])
def test_submit_ignores_client_supplied_grading_fields(training, correct_answers):
    if correct_answers:
        answers = fixture_answers(training)
        expected_score, expected_count = 100, 10
    else:
        item = training.items[0]
        wrong_choice = next(choice.id for choice in item.choices if choice.id not in item.correct_ids)
        answers = [{'question_id': item.question.id, 'choice_ids': [wrong_choice]}]
        expected_score, expected_count = 0, 0
    for answer in answers:
        answer['is_correct'] = not correct_answers
        answer['score'] = 999
    response = training.client.post(f'/quizzes/{training.quiz.id}/submit/', {
        'answers': answers, 'score': -100 if correct_answers else 999,
        'correct_count': -10 if correct_answers else 999, 'percent': 999,
        'is_correct': not correct_answers, 'total_questions': 1,
    }, format='json')
    assert response.status_code == 200
    assert response.data['score'] == expected_score
    assert response.data['correct_count'] == expected_count
    assert response.data['total_questions'] == 10
    assert Result.objects.get(student=training.student, quiz=training.quiz).score == expected_score


def test_submit_empty_quiz_returns_explanation_without_writing_attempts(training):
    empty_quiz = Quiz.objects.create(lesson=training.lesson, title='Synthetic empty quiz')
    response = training.client.post(
        f'/quizzes/{empty_quiz.id}/submit/', {'answers': []}, format='json',
    )
    assert_rejected_without_attempt_records(response)
    error = response.data.get('error') or response.data.get('detail')
    assert isinstance(error, str) and error.strip()
    assert 'вопрос' in error.lower() or 'question' in error.lower()


def test_submit_still_requires_authentication(training):
    response = APIClient().post(
        f'/quizzes/{training.quiz.id}/submit/', {'answers': fixture_answers(training)}, format='json',
    )
    assert response.status_code in (401, 403)
    assert_no_attempt_records()


def test_submit_last_invalid_answer_does_not_save_previous_valid_answers(training):
    answers = fixture_answers(training)
    nonexistent_id = 1_000_000
    assert not Choice.objects.filter(pk=nonexistent_id).exists()
    answers[-1]['choice_ids'].append(nonexistent_id)
    response = submit(training, answers)
    assert_rejected_without_attempt_records(response)


def test_reproduces_result_without_detail_when_second_post_fails(training):
    first = submit(training, fixture_answers(training))
    assert first.status_code == 200
    assert 'id' not in first.data and 'result_id' not in first.data
    # The current submit API omits the ID; locate only this synthetic result via ORM.
    result = Result.objects.get(student=training.student, quiz=training.quiz)
    assert not QuizAttemptDetail.objects.exists()
    training.client.raise_request_exception = False
    with patch('analytics.views.QuizAttemptDetail.objects.create', side_effect=RuntimeError('Synthetic second POST failure')):
        second = training.client.post('/analytics/quiz-attempt/', analytics_payload(training, result), format='json')
    assert second.status_code == 500
    assert Result.objects.filter(pk=result.id, score=100).exists()
    assert not QuizAttemptDetail.objects.exists()
    assert not QuestionAnswer.objects.exists()
    history = training.client.get('/quizzes/my-results/')
    assert history.status_code == 200
    assert [entry['id'] for entry in history.data] == [result.id]
    print('REPRODUCES interrupted two-POST save: actual 1 Result, 0 detailed attempts, 0 answers.')


def test_analytics_preserves_every_selected_choice(training):
    assert submit(training, fixture_answers(training)).status_code == 200
    result = Result.objects.get(student=training.student, quiz=training.quiz)
    item = next(item for item in training.items if len(item.correct_ids) > 1)
    answer = {'question_id': item.question.id, 'selected_choice_ids': item.correct_ids, 'is_correct': True}
    accepted = training.client.post('/analytics/quiz-attempt/', analytics_payload(training, result, [answer]), format='json')
    assert accepted.status_code == 201
    saved = QuestionAnswer.objects.get(attempt_id=accepted.data['attempt_id'])
    assert saved.question_id == item.question.id
    assert saved.selected_choice_id == item.correct_ids[0]
    assert saved.selected_choice_ids == item.correct_ids
    assert saved.is_correct is True
    assert list(QuestionAnswer.objects.filter(attempt_id=accepted.data['attempt_id']).values_list('selected_choice_id', flat=True)) == [item.correct_ids[0]]
    assert len(item.correct_ids) == 2


def test_reproduces_quiz_edit_deleting_historical_answers_but_keeping_result(training):
    assert submit(training, fixture_answers(training)).status_code == 200
    result = Result.objects.get(student=training.student, quiz=training.quiz)
    detail = training.client.post('/analytics/quiz-attempt/', analytics_payload(training, result), format='json')
    assert detail.status_code == 201
    attempt_id = detail.data['attempt_id']
    assert QuestionAnswer.objects.filter(attempt_id=attempt_id).count() == 10
    original_question_ids = set(training.quiz.questions.values_list('id', flat=True))
    edited = training.teacher_client.post('/quizzes/save-generated/', {
        'lesson_id': training.lesson.id, 'quiz_id': training.quiz.id,
        'questions': training.source['questions'],
    }, format='json')
    assert edited.status_code == 201
    assert edited.data['quiz_id'] == training.quiz.id
    assert training.quiz.questions.count() == 10
    assert original_question_ids.isdisjoint(training.quiz.questions.values_list('id', flat=True))
    assert not QuestionAnswer.objects.filter(attempt_id=attempt_id).exists()
    assert QuizAttemptDetail.objects.filter(pk=attempt_id, result_id=result.id, score=100).exists()
    assert Result.objects.filter(pk=result.id, score=100).exists()
    print('REPRODUCES editing attempted quiz: historical answers 10 -> 0; result and detailed attempt remain.')


def test_control_backend_save_and_read_preserve_nonblank_explanations(training):
    saved = training.teacher_client.post('/quizzes/save-generated/', {
        'lesson_id': training.lesson.id, 'quiz_id': training.quiz.id,
        'questions': training.source['questions'],
    }, format='json')
    assert saved.status_code == 201
    response = training.client.get(f'/quizzes/{training.quiz.id}/')
    assert response.status_code == 200
    expected = {item['question']: item['explanation'] for item in training.source['questions']}
    assert {item['text']: item['explanation'] for item in response.data['questions']} == expected
    assert dict(training.quiz.questions.values_list('text', 'explanation')) == expected


def test_reproduces_backend_preserving_html_marker_without_sanitizing(training):
    response = training.teacher_client.patch(
        f'/courses/{training.course.id}/', {'description': HTML_MARKER}, format='json',
    )
    assert response.status_code == 200
    training.course.refresh_from_db()
    assert training.course.description == HTML_MARKER
    assert response.data['description'] == HTML_MARKER
    read_back = training.client.get(f'/courses/{training.course.id}/')
    assert read_back.status_code == 200
    assert read_back.data['description'] == HTML_MARKER
    print('REPRODUCES HTML boundary: marker and handler attribute survive API save/read; no browser execution tested.')
