"""Migration safety for retained quiz history; synthetic in-memory database only."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.exceptions import IrreversibleError


pytestmark = pytest.mark.django_db(transaction=True)

OLD_TARGETS = [
    ('quizzes', '0004_result_submission_idempotency'),
    ('analytics', '0003_preserve_question_snapshots'),
]
NEW_TARGETS = [
    ('quizzes', '0005_preserve_results_on_quiz_deletion'),
    ('analytics', '0004_preserve_attempts_on_quiz_deletion'),
]
HISTORY_MODELS = [
    ('quizzes', 'Result'), ('analytics', 'QuizAttemptDetail'), ('analytics', 'QuestionAnswer'),
]


@pytest.fixture
def migration_targets():
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    executor = MigrationExecutor(connection)
    original_targets = executor.loader.graph.leaf_nodes()
    assert all(target in executor.loader.graph.nodes for target in NEW_TARGETS)
    try:
        yield original_targets
    finally:
        MigrationExecutor(connection).migrate(original_targets)


def state_at(targets):
    executor = MigrationExecutor(connection)
    executor.migrate(targets)
    return MigrationExecutor(connection).loader.project_state(targets).apps


def history_rows(apps):
    return {
        name: list(apps.get_model(app, name).objects.order_by('pk').values())
        for app, name in HISTORY_MODELS
    }


def create_history(apps, *, snapshots):
    # User schema is not migrated by these targets; use the runner's current model.
    users = get_user_model()
    teacher = users.objects.create(username='deletion_migration_teacher', role='teacher')
    student = users.objects.create(username='deletion_migration_student', role='student')
    category = apps.get_model('courses', 'Category').objects.create(title='Synthetic migration category')
    course = apps.get_model('courses', 'Course').objects.create(
        teacher_id=teacher.pk, category_id=category.pk, title='Synthetic migration course',
    )
    lesson = apps.get_model('courses', 'Lesson').objects.create(
        course_id=course.pk, title='Synthetic migration lesson',
    )
    quiz = apps.get_model('quizzes', 'Quiz').objects.create(
        lesson_id=lesson.pk, title='Synthetic migration quiz',
    )
    question = apps.get_model('quizzes', 'Question').objects.create(
        quiz_id=quiz.pk, text='Synthetic migration question', explanation='Synthetic explanation',
    )
    choice_model = apps.get_model('quizzes', 'Choice')
    choices = [choice_model.objects.create(question_id=question.pk,
        text=f'Synthetic option {index}', is_correct=index != 1) for index in range(3)]
    selected = [choices[2].pk, choices[0].pk]
    result = apps.get_model('quizzes', 'Result').objects.create(
        student_id=student.pk, quiz_id=quiz.pk, score=100,
        submission_id=uuid4(), submission_fingerprint='a' * 64,
        submission_response={'score': 100, 'correct_count': 1, 'total_questions': 1},
    )
    detail = apps.get_model('analytics', 'QuizAttemptDetail').objects.create(
        student_id=student.pk, quiz_id=quiz.pk, result_id=result.pk,
        score=100, correct_answers=1, total_questions=1, time_spent_seconds=17,
        quiz_snapshot={'id': quiz.pk, 'title': quiz.title} if snapshots else None,
    )
    answer = apps.get_model('analytics', 'QuestionAnswer').objects.create(
        attempt_id=detail.pk, question_id=question.pk, selected_choice_id=selected[0],
        selected_choice_ids=selected, is_correct=True,
        question_snapshot={
            'id': question.pk, 'position': 0, 'text': question.text,
            'explanation': question.explanation,
            'choices': [{'id': choice.pk, 'text': choice.text} for choice in choices],
            'correct_choice_ids': [choices[0].pk, choices[2].pk],
        } if snapshots else None,
    )
    return SimpleNamespace(quiz_id=quiz.pk, result_id=result.pk,
        detail_id=detail.pk, answer_id=answer.pk)


@pytest.mark.parametrize('snapshots', [False, True], ids=['legacy', 'snapshot'])
def test_deleted_quiz_migration_preserves_rows_and_retains_them_after_deletion(migration_targets, snapshots):
    old_apps = state_at(OLD_TARGETS)
    graph = create_history(old_apps, snapshots=snapshots)
    before = history_rows(old_apps)

    new_apps = state_at(NEW_TARGETS)
    assert history_rows(new_apps) == before
    new_apps.get_model('quizzes', 'Quiz').objects.filter(pk=graph.quiz_id).delete()

    expected = before
    expected['Result'][0]['quiz_id'] = None
    expected['QuizAttemptDetail'][0]['quiz_id'] = None
    expected['QuestionAnswer'][0]['question_id'] = None
    expected['QuestionAnswer'][0]['selected_choice_id'] = None
    assert history_rows(new_apps) == expected
    assert not new_apps.get_model('quizzes', 'Quiz').objects.filter(pk=graph.quiz_id).exists()
    assert not new_apps.get_model('quizzes', 'Question').objects.exists()
    assert not new_apps.get_model('quizzes', 'Choice').objects.exists()


@pytest.mark.parametrize('detached_model', ['Result', 'QuizAttemptDetail'])
def test_deleted_quiz_migration_refuses_reverse_with_detached_history(migration_targets, detached_model):
    apps = state_at(NEW_TARGETS)
    graph = create_history(apps, snapshots=False)
    app_label = 'quizzes' if detached_model == 'Result' else 'analytics'
    record_id = graph.result_id if detached_model == 'Result' else graph.detail_id
    apps.get_model(app_label, detached_model).objects.filter(pk=record_id).update(quiz_id=None)
    before = history_rows(apps)

    with pytest.raises(IrreversibleError):
        MigrationExecutor(connection).migrate(OLD_TARGETS)

    # One other migration may have reversed before its sibling refuses. Restore
    # the latest schema before reading and leave all stored values unchanged.
    restored_apps = state_at(NEW_TARGETS)
    assert history_rows(restored_apps) == before


def test_deleted_quiz_migration_can_reverse_when_every_quiz_link_exists(migration_targets):
    new_apps = state_at(NEW_TARGETS)
    create_history(new_apps, snapshots=True)
    before = history_rows(new_apps)

    old_apps = state_at(OLD_TARGETS)
    assert history_rows(old_apps) == before
    assert old_apps.get_model('quizzes', 'Result')._meta.get_field('quiz').null is False
    assert old_apps.get_model('analytics', 'QuizAttemptDetail')._meta.get_field('quiz').null is False

    new_apps = state_at(NEW_TARGETS)
    assert history_rows(new_apps) == before
    assert new_apps.get_model('quizzes', 'Result')._meta.get_field('quiz').null is True
    assert new_apps.get_model('analytics', 'QuizAttemptDetail')._meta.get_field('quiz').null is True
