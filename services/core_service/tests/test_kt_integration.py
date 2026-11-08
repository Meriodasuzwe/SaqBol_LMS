"""Real-handler integration for the profile KT block, isolated synthetic DB.

The official scoring matrix is tested separately in test_kt_scoring.py. Here we
assert that the real endpoint selects that scorer, stores its output atomically,
protects keys, and does not apply legacy training completion rules.
"""
from copy import deepcopy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from rest_framework.test import APIClient

from analytics.models import QuestionAnswer, QuizAttemptDetail
from courses.models import Category, Course, Enrollment, Lesson, LessonStep
from courses.serializers import CourseSerializer, LessonStepSerializer
from quizzes.grading import KT_PROFILE_SCORING_VERSION
from quizzes.models import Choice, Question, Quiz, Result


_fixture_spec = importlib.util.spec_from_file_location(
    'synthetic_kt_profile', Path(__file__).parent / 'fixtures' / 'kt_profile.py',
)
_fixture_module = importlib.util.module_from_spec(_fixture_spec)
_fixture_spec.loader.exec_module(_fixture_module)
create_profile_quiz = _fixture_module.create_profile_quiz

pytestmark = pytest.mark.django_db


@pytest.fixture
def graph():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    users = get_user_model()
    teacher = users.objects.create_user(username='kt_integration_teacher', role='teacher')
    student = users.objects.create_user(username='kt_integration_student', role='student')
    other = users.objects.create_user(username='kt_integration_other', role='student')
    category = Category.objects.create(title='Искусственные данные КТ')
    course = Course.objects.create(
        title='Демонстрационный контейнер', category=category,
        teacher=teacher, status='published',
    )
    lesson = Lesson.objects.create(course=course, title='Демонстрационный профильный блок')
    quiz, items = create_profile_quiz(lesson)
    client = APIClient(raise_request_exception=False)
    client.force_authenticate(student)
    owner_client = APIClient()
    owner_client.force_authenticate(teacher)
    return SimpleNamespace(
        teacher=teacher, student=student, other=other, course=course, lesson=lesson,
        quiz=quiz, items=items, client=client, owner_client=owner_client,
        url=f'/quizzes/{quiz.pk}/submit/',
    )


def full_answers(graph):
    return [
        {'question_id': item['question'].pk, 'choice_ids': list(item['correct_ids'])}
        for item in graph.items
    ]


def submit(graph, answers=None, **extra):
    data = {'answers': full_answers(graph) if answers is None else answers, **extra}
    return graph.client.post(graph.url, data, format='json')


def assert_empty_history():
    assert Result.objects.count() == 0
    assert QuizAttemptDetail.objects.count() == 0
    assert QuestionAnswer.objects.count() == 0


def question_grade(response, item):
    return response.json()['grading']['questions'][str(item['question'].pk)]


def test_kt_submit_70_of_70_is_saved_with_version_and_section_breakdown(graph):
    response = submit(graph, submission_id=str(uuid4()), time_spent_seconds=99)
    assert response.status_code == 200, response.data
    data = response.json()
    assert data['mode'] == 'kt_profile'
    assert data['score'] == 100
    assert data['correct_count'] == data['total_questions'] == 50
    grade = data['grading']
    assert grade['scoring_version'] == KT_PROFILE_SCORING_VERSION
    assert grade['earned_points'] == grade['max_points'] == 70
    assert grade['sections'] == {
        'first_subject': {'earned_points': 30, 'max_points': 30, 'total_questions': 30},
        'second_subject': {'earned_points': 40, 'max_points': 40, 'total_questions': 20},
    }
    result = Result.objects.get(pk=data['id'])
    assert result.scoring_mode == 'kt_profile'
    assert result.scoring_details == grade
    assert result.submission_response == data
    detail = result.detail
    assert detail.score == 100 and detail.total_questions == detail.correct_answers == 50
    assert detail.time_spent_seconds == 99
    assert detail.quiz_snapshot['mode'] == 'kt_profile'
    assert detail.quiz_snapshot['scoring_version'] == KT_PROFILE_SCORING_VERSION
    answers = list(detail.answers.order_by('pk'))
    assert len(answers) == 50
    for item, answer in zip(graph.items, answers):
        qid = str(item['question'].pk)
        assert answer.selected_choice_ids == item['correct_ids']
        assert answer.question_snapshot['kt_subject'] == item['question'].kt_subject
        assert answer.question_snapshot['earned_points'] == grade['questions'][qid]['earned_points']
        assert answer.question_snapshot['max_points'] == grade['questions'][qid]['max_points']
        assert data['explanations'][qid] == item['question'].explanation


@pytest.mark.parametrize('index,selection,expected', [
    (0, [0], 1), (0, [1], 0),
    (30, [0], 2), (30, [0, 1], 1), (30, [1], 0),
    (31, [0, 1], 2), (31, [0], 1), (31, [0, 2], 1),
    (31, [0, 1, 2], 1), (31, [2, 3], 0),
    (32, [0, 1, 2], 2), (32, [0, 1], 1), (32, [0], 0),
    (32, [0, 1, 2, 3], 1), (32, [0, 1, 3, 4], 0),
])
def test_kt_submit_uses_actual_scorer_for_partial_and_full_points(graph, index, selection, expected):
    item = graph.items[index]
    response = submit(graph, [{
        'question_id': item['question'].pk,
        'choice_ids': [item['choices'][i].pk for i in selection],
    }])
    assert response.status_code == 200, response.data
    assert response.json()['grading']['earned_points'] == expected
    assert question_grade(response, item)['earned_points'] == expected
    assert response.json()['grading']['max_points'] == 70
    assert response.data['score'] == expected * 100 // 70
    assert Result.objects.get().scoring_details == response.json()['grading']


def test_kt_empty_submission_saves_all_50_skips_and_zero_of_70(graph):
    response = submit(graph, [])
    assert response.status_code == 200
    assert response.json()['grading']['earned_points'] == 0
    assert response.json()['grading']['max_points'] == 70
    assert response.data['score'] == response.data['correct_count'] == 0
    answers = list(QuestionAnswer.objects.all())
    assert len(answers) == 50
    assert all(answer.selected_choice_ids == [] and not answer.is_correct for answer in answers)


def test_kt_first_section_rejects_multiple_selected_choices_without_any_writes(graph):
    item = graph.items[0]
    response = submit(graph, [{
        'question_id': item['question'].pk,
        'choice_ids': [choice.pk for choice in item['choices'][:2]],
    }])
    assert response.status_code == 400
    assert_empty_history()


@pytest.mark.parametrize('invalid', [
    'missing_first', 'missing_second', 'unassigned_section',
    'zero_key', 'first_multiple_keys', 'second_four_keys',
])
def test_kt_invalid_content_is_clear_400_and_never_creates_history(graph, invalid):
    if invalid == 'missing_first':
        graph.items[0]['question'].delete()
    elif invalid == 'missing_second':
        graph.items[-1]['question'].delete()
    elif invalid == 'unassigned_section':
        Question.objects.filter(pk=graph.items[0]['question'].pk).update(kt_subject='')
    elif invalid == 'zero_key':
        graph.items[30]['question'].choices.update(is_correct=False)
    elif invalid == 'first_multiple_keys':
        Choice.objects.filter(pk=graph.items[0]['choices'][1].pk).update(is_correct=True)
    elif invalid == 'second_four_keys':
        Choice.objects.filter(pk__in=[choice.pk for choice in graph.items[30]['choices'][:4]]).update(is_correct=True)
    response = submit(graph, [])
    assert response.status_code == 400, response.data
    assert response.data
    assert_empty_history()


@pytest.mark.parametrize('invalid', ['duplicate_question', 'foreign_question', 'foreign_choice', 'duplicate_choice', 'wrong_type'])
def test_kt_request_validation_precedes_every_result_write(graph, invalid):
    item = graph.items[0]
    answers = [{'question_id': item['question'].pk, 'choice_ids': item['correct_ids']}]
    if invalid == 'duplicate_question':
        answers.append(deepcopy(answers[0]))
    elif invalid == 'foreign_question':
        foreign = Question.objects.create(
            quiz=Quiz.objects.create(lesson=graph.lesson, title='Другой искусственный тест'),
            text='Другой вопрос',
        )
        answers[0]['question_id'] = foreign.pk
    elif invalid == 'foreign_choice':
        answers[0]['choice_ids'] = graph.items[1]['correct_ids']
    elif invalid == 'duplicate_choice':
        answers[0]['choice_ids'] = item['correct_ids'] * 2
    else:
        answers[0]['choice_ids'] = '1,2'
    response = submit(graph, answers)
    assert response.status_code == 400, response.data
    assert_empty_history()


def test_kt_client_scores_and_mode_never_control_the_result(graph):
    item = graph.items[31]
    response = submit(graph, [{
        'question_id': item['question'].pk, 'choice_ids': item['correct_ids'][:1],
        'earned_points': 70, 'is_correct': True,
    }], mode='training', score=100, grading={'earned_points': 70, 'max_points': 70})
    assert response.status_code == 200
    assert response.data['mode'] == 'kt_profile'
    assert response.json()['grading']['earned_points'] == 1
    assert response.data['score'] == 1


@pytest.mark.parametrize('actor', ['student', 'owner'])
def test_kt_get_hides_keys_and_explanations_in_all_quiz_endpoints(graph, actor):
    client = graph.client if actor == 'student' else graph.owner_client
    for url in [f'/quizzes/{graph.quiz.pk}/', f'/quizzes/lesson/{graph.lesson.pk}/', '/quizzes/']:
        response = client.get(url)
        assert response.status_code == 200
        data = response.json()
        if isinstance(data, dict) and 'results' in data:
            data = data['results']
        if isinstance(data, list):
            data = next(item for item in data if item['id'] == graph.quiz.pk)
        assert data['mode'] == 'kt_profile'
        assert len(data['questions']) == 50
        assert [q['kt_subject'] for q in data['questions']] == ['first_subject'] * 30 + ['second_subject'] * 20
        for question in data['questions']:
            assert 'explanation' not in question
            assert 'correct_choice_ids' not in question
            assert all('is_correct' not in choice for choice in question['choices'])


def test_kt_question_order_uses_sections_even_if_database_ids_are_interleaved(graph):
    first, second = graph.items[0]['question'], graph.items[30]['question']
    first.kt_subject, second.kt_subject = 'second_subject', 'first_subject'
    first.save(update_fields=['kt_subject'])
    second.save(update_fields=['kt_subject'])
    response = graph.client.get(f'/quizzes/{graph.quiz.pk}/')
    assert response.status_code == 200
    assert [q['kt_subject'] for q in response.json()['questions']] == ['first_subject'] * 30 + ['second_subject'] * 20


def test_kt_draft_is_closed_to_student_for_read_and_submit_but_owner_can_test(graph):
    graph.course.status = 'draft'
    graph.course.save(update_fields=['status'])
    assert graph.client.get(f'/quizzes/{graph.quiz.pk}/').status_code in (403, 404)
    response = graph.client.get(f'/quizzes/lesson/{graph.lesson.pk}/')
    assert response.status_code == 200
    data = response.json()
    assert not (data.get('results', []) if isinstance(data, dict) else data)
    assert submit(graph, []).status_code in (403, 404)
    assert_empty_history()
    assert graph.owner_client.get(f'/quizzes/{graph.quiz.pk}/').status_code == 200
    response = graph.owner_client.post(graph.url, {'answers': []}, format='json')
    assert response.status_code == 200


def test_kt_requires_login_and_allows_published_without_enrollment(graph):
    anonymous = APIClient()
    assert anonymous.get(f'/quizzes/{graph.quiz.pk}/').status_code in (401, 403)
    assert anonymous.post(graph.url, {'answers': []}, format='json').status_code in (401, 403)
    assert_empty_history()
    assert not Enrollment.objects.filter(student=graph.student, course=graph.course).exists()
    assert submit(graph, []).status_code == 200


@pytest.mark.parametrize('change', ['edit', 'delete'])
def test_kt_replay_keeps_original_points_sections_explanations_and_snapshots(graph, change):
    submission_id = str(uuid4())
    answers = full_answers(graph)
    first = submit(graph, answers, submission_id=submission_id)
    assert first.status_code == 200
    original = first.json()
    result = Result.objects.get()
    snapshot = deepcopy(result.detail.quiz_snapshot)
    question_snapshots = list(result.detail.answers.order_by('pk').values_list('question_snapshot', flat=True))
    if change == 'edit':
        Quiz.objects.filter(pk=graph.quiz.pk).update(mode='training', title='Изменённое название')
        Question.objects.filter(quiz=graph.quiz).update(text='Изменённый вопрос', explanation='Изменённое объяснение', kt_subject='')
        Choice.objects.filter(question__quiz=graph.quiz).update(is_correct=False)
    else:
        graph.quiz.delete()
    repeated = graph.client.post(graph.url, {'answers': answers, 'submission_id': submission_id}, format='json')
    assert repeated.status_code == 200, repeated.data
    assert repeated.json() == original
    result.refresh_from_db()
    assert result.scoring_mode == 'kt_profile'
    assert result.scoring_details == original['grading']
    assert result.detail.quiz_snapshot == snapshot
    assert list(result.detail.answers.order_by('pk').values_list('question_snapshot', flat=True)) == question_snapshots
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 1
    assert QuestionAnswer.objects.count() == 50


def test_kt_same_id_changed_answers_conflicts_and_explicit_new_id_creates_attempt(graph):
    submission_id = str(uuid4())
    first = submit(graph, [], submission_id=submission_id)
    assert first.status_code == 200
    assert submit(graph, full_answers(graph), submission_id=submission_id).status_code == 409
    assert Result.objects.count() == 1
    repeated = submit(graph, [], submission_id=submission_id)
    assert repeated.json() == first.json()
    assert submit(graph, [], submission_id=str(uuid4())).status_code == 200
    assert Result.objects.count() == QuizAttemptDetail.objects.count() == 2


def test_kt_failure_writing_answers_rolls_back_result_and_grade(graph, monkeypatch):
    def fail_write(*args, **kwargs):
        raise RuntimeError('Synthetic database write failure after authoritative grading')
    monkeypatch.setattr(QuestionAnswer.objects, 'bulk_create', fail_write)
    response = submit(graph, submission_id=str(uuid4()))
    assert response.status_code == 500
    assert_empty_history()


def test_kt_my_results_returns_only_owner_with_raw_points_after_source_deletion(graph):
    response = submit(graph)
    assert response.status_code == 200
    result_id = response.data['id']
    Result.objects.create(student=graph.other, quiz=graph.quiz, score=100)
    graph.quiz.delete()
    response = graph.client.get('/quizzes/my-results/')
    assert response.status_code == 200
    data = response.json()
    rows = data['results'] if isinstance(data, dict) else data
    assert len(rows) == 1 and rows[0]['id'] == result_id
    assert rows[0]['mode'] == 'kt_profile'
    assert rows[0]['grading']['earned_points'] == 70
    assert rows[0]['grading']['max_points'] == 70
    assert rows[0]['quiz_id'] is None
    dashboard = graph.client.get('/analytics/student/dashboard/')
    assert dashboard.status_code == 200
    history = dashboard.json()['quiz_history']
    assert len(history) == 1
    assert history[0]['mode'] == 'kt_profile'
    assert history[0]['grading'] == rows[0]['grading']


def test_kt_full_points_do_not_trigger_training_step_completion_or_course_progress(graph):
    Enrollment.objects.create(student=graph.student, course=graph.course)
    step = LessonStep.objects.create(
        lesson=graph.lesson, title='Профильный блок', step_type='quiz',
        scenario_data={'quiz_id': graph.quiz.pk},
    )
    assert submit(graph).status_code == 200
    context = {'request': SimpleNamespace(user=graph.student)}
    assert LessonStepSerializer(step, context=context).data['is_completed'] is False
    assert CourseSerializer(graph.course, context=context).data['progress'] == 0
    # Existing training results still use their existing completion threshold.
    training = Quiz.objects.create(lesson=graph.lesson, title='Обычная тренировка')
    Result.objects.create(student=graph.student, quiz=training, score=70)
    step.scenario_data = {'quiz_id': training.pk}
    step.save(update_fields=['scenario_data'])
    assert LessonStepSerializer(step, context=context).data['is_completed'] is True
    assert CourseSerializer(graph.course, context=context).data['progress'] == 100


def test_kt_builder_cannot_replace_questions_without_section_metadata(graph):
    before = list(graph.quiz.questions.order_by('pk').values())
    response = graph.owner_client.post('/quizzes/save-generated/', {
        'lesson_id': graph.lesson.pk, 'quiz_id': graph.quiz.pk,
        'questions': [{'question': 'Replacement', 'options': ['A', 'B'], 'correct_index': [0]}],
    }, format='json')
    assert response.status_code == 400, response.data
    assert list(graph.quiz.questions.order_by('pk').values()) == before


def test_legacy_quiz_read_exposes_explicit_training_mode_without_changing_grading():
    users = get_user_model()
    teacher = users.objects.create_user(username='legacy_mode_teacher', role='teacher')
    student = users.objects.create_user(username='legacy_mode_student', role='student')
    category = Category.objects.create(title='Synthetic legacy category')
    course = Course.objects.create(teacher=teacher, category=category, title='Synthetic legacy course')
    lesson = Lesson.objects.create(course=course, title='Synthetic legacy lesson')
    quiz = Quiz.objects.create(lesson=lesson, title='Synthetic legacy quiz')
    question = Question.objects.create(quiz=quiz, text='Synthetic question')
    choice = Choice.objects.create(question=question, text='Synthetic correct answer', is_correct=True)
    client = APIClient()
    client.force_authenticate(student)
    response = client.get(f'/quizzes/{quiz.pk}/')
    assert response.status_code == 200
    assert response.json()['mode'] == 'training'
    result = client.post(f'/quizzes/{quiz.pk}/submit/', {
        'mode': 'kt_profile', 'answers': [{'question_id': question.pk, 'choice_ids': [choice.pk]}],
    }, format='json')
    assert result.status_code == 200
    assert result.data['score'] == 100
    assert 'grading' not in result.data
    stored = Result.objects.get()
    assert stored.scoring_mode == 'training'
    assert stored.scoring_details is None



@pytest.mark.django_db(transaction=True)
def test_kt_migration_preserves_legacy_results_as_training_without_invented_points():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    old_target = [('quizzes', '0005_preserve_results_on_quiz_deletion')]
    new_target = [('quizzes', '0006_kt_profile_integration')]
    assert new_target[0] in executor.loader.graph.nodes
    try:
        executor.migrate(old_target)
        old_apps = MigrationExecutor(connection).loader.project_state(old_target).apps
        users = get_user_model()
        teacher = users.objects.create(username='kt_migration_teacher', role='teacher')
        student = users.objects.create(username='kt_migration_student', role='student')
        category = old_apps.get_model('courses', 'Category').objects.create(title='Synthetic migration')
        course = old_apps.get_model('courses', 'Course').objects.create(
            teacher_id=teacher.pk, category_id=category.pk, title='Synthetic migration course',
        )
        lesson = old_apps.get_model('courses', 'Lesson').objects.create(
            course_id=course.pk, title='Synthetic migration lesson',
        )
        quiz = old_apps.get_model('quizzes', 'Quiz').objects.create(
            lesson_id=lesson.pk, title='Synthetic existing quiz',
        )
        question = old_apps.get_model('quizzes', 'Question').objects.create(
            quiz_id=quiz.pk, text='Synthetic existing question',
        )
        result = old_apps.get_model('quizzes', 'Result').objects.create(
            student_id=student.pk, quiz_id=quiz.pk, score=37.5,
            submission_response={'score': 37.5, 'id': 77},
        )
        before = old_apps.get_model('quizzes', 'Result').objects.values().get(pk=result.pk)
        MigrationExecutor(connection).migrate(new_target)
        new_apps = MigrationExecutor(connection).loader.project_state(new_target).apps
        after = new_apps.get_model('quizzes', 'Result').objects.values().get(pk=result.pk)
        assert {key: after[key] for key in before} == before
        assert after['scoring_mode'] == 'training'
        assert after['scoring_details'] is None
        assert new_apps.get_model('quizzes', 'Quiz').objects.get(pk=quiz.pk).mode == 'training'
        assert new_apps.get_model('quizzes', 'Question').objects.get(pk=question.pk).kt_subject == ''
    finally:
        MigrationExecutor(connection).migrate(latest)



def test_kt_linked_step_rejects_completion_even_when_neighbor_training_passed(graph):
    from courses.models import Certificate, StepProgress
    step = LessonStep.objects.create(
        lesson=graph.lesson, title='Профильный блок', step_type='quiz',
        scenario_data={'quiz_id': graph.quiz.pk},
    )
    neighbor = Quiz.objects.create(lesson=graph.lesson, title='Другой тренировочный тест')
    Result.objects.create(student=graph.student, quiz=neighbor, score=100)
    response = graph.client.post(f'/courses/steps/{step.pk}/complete/', {'score': 100}, format='json')
    assert response.status_code == 400, response.data
    assert not StepProgress.objects.filter(step=step, student=graph.student).exists()
    assert not Certificate.objects.filter(course=graph.course, student=graph.student).exists()


def test_kt_linked_step_cannot_unlock_review_using_neighbor_training_result(graph):
    from courses.models import Review
    Enrollment.objects.create(student=graph.student, course=graph.course)
    LessonStep.objects.create(
        lesson=graph.lesson, title='Профильный блок', step_type='quiz',
        scenario_data={'quiz_id': graph.quiz.pk},
    )
    neighbor = Quiz.objects.create(lesson=graph.lesson, title='Соседняя тренировка')
    Result.objects.create(student=graph.student, quiz=neighbor, score=100)
    response = graph.client.post(f'/courses/{graph.course.pk}/reviews/', {
        'rating': 5, 'text': 'Synthetic review that should not be created',
    }, format='json')
    assert response.status_code == 400, response.data
    assert not Review.objects.filter(course=graph.course, user=graph.student).exists()


def test_quiz_converted_to_kt_does_not_pass_training_via_its_older_result(graph):
    Enrollment.objects.create(student=graph.student, course=graph.course)
    step = LessonStep.objects.create(
        lesson=graph.lesson, title='Профильный блок', step_type='quiz',
        scenario_data={'quiz_id': graph.quiz.pk},
    )
    # The result originated in training before the live quiz's mode was changed.
    Result.objects.create(student=graph.student, quiz=graph.quiz, score=100, scoring_mode='training')
    context = {'request': SimpleNamespace(user=graph.student)}
    assert LessonStepSerializer(step, context=context).data['is_completed'] is False
    assert CourseSerializer(graph.course, context=context).data['progress'] == 0


def test_kt_builder_linked_step_guard_preserves_step_and_every_question(graph):
    step = LessonStep.objects.create(
        lesson=graph.lesson, title='Original KT step', step_type='quiz',
        scenario_data={'quiz_id': graph.quiz.pk},
    )
    before_step = LessonStep.objects.values().get(pk=step.pk)
    before_questions = list(graph.quiz.questions.order_by('pk').values())
    response = graph.owner_client.post('/quizzes/save-generated/', {
        'lesson_id': graph.lesson.pk, 'step_id': step.pk,
        'step': {
            'title': 'Changed step', 'content': '', 'step_type': 'quiz',
            'scenario_data': {'quiz_id': graph.quiz.pk},
        },
        'questions': [{'question': 'Replacement', 'options': ['A', 'B'], 'correct_index': [0]}],
    }, format='json')
    assert response.status_code == 400, response.data
    assert LessonStep.objects.values().get(pk=step.pk) == before_step
    assert list(graph.quiz.questions.order_by('pk').values()) == before_questions


def test_kt_staff_read_does_not_leak_keys_or_explanations(graph):
    staff = get_user_model().objects.create_user(username='kt_staff_reader', is_staff=True)
    client = APIClient()
    client.force_authenticate(staff)
    response = client.get(f'/quizzes/{graph.quiz.pk}/')
    assert response.status_code == 200
    for question in response.json()['questions']:
        assert 'explanation' not in question
        assert all('is_correct' not in choice for choice in question['choices'])


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize('metadata', ['quiz', 'question', 'result_mode', 'result_details'])
def test_kt_migration_refuses_to_discard_configured_or_recorded_kt_metadata(graph, metadata):
    from django.db.migrations.exceptions import IrreversibleError
    if metadata != 'quiz':
        Quiz.objects.filter(pk=graph.quiz.pk).update(mode='training')
    Question.objects.filter(quiz=graph.quiz).update(kt_subject='')
    if metadata == 'question':
        Question.objects.filter(pk=graph.items[0]['question'].pk).update(kt_subject='first_subject')
    elif metadata in ('result_mode', 'result_details'):
        Result.objects.create(
            student=graph.student, quiz=graph.quiz, score=0,
            scoring_mode='kt_profile' if metadata == 'result_mode' else 'training',
            scoring_details={'earned_points': 0, 'max_points': 70} if metadata == 'result_details' else None,
        )
    before = {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Quiz, Question, Result)
    }
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    try:
        with pytest.raises(IrreversibleError):
            executor.migrate([('quizzes', '0005_preserve_results_on_quiz_deletion')])
    finally:
        MigrationExecutor(connection).migrate(latest)
    assert {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Quiz, Question, Result)
    } == before

