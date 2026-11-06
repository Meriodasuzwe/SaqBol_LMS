"""Real exam lifecycle races in disposable PostgreSQL 15.

Use run_exam_lifecycle_concurrency.ps1: dedicated --internal Docker network,
fixed test database/host, tmpfs, no ports/volumes and no inherited environment.
Only named app modules/migrations and explicit fixture/command paths are copied.
Validation, grading and ORM calls are real; a single rollback case injects a
failure after the actual answer INSERT, never replacing validation or scoring.
"""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import patch

sys.dont_write_bytecode = True
source = Path('/source')
if sys.platform != 'linux' or not source.is_dir():
    raise SystemExit('Use the disposable PostgreSQL Docker launcher.')
os.environ.clear()
os.environ.update({'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8',
                   'DJANGO_SETTINGS_MODULE': 'exam_lifecycle_pg_settings',
                   'PYTHONDONTWRITEBYTECODE': '1', 'AI_ENABLED': 'False'})

with tempfile.TemporaryDirectory(prefix='saqbol-exam-lifecycle-pg-') as temporary:
    work = Path(temporary)
    paths = []
    for package in ('core', 'users', 'courses', 'quizzes', 'analytics', 'notifications', 'bug_reports'):
        paths += list((source/package).glob('*.py'))
        paths += list((source/package/'migrations').glob('*.py'))
    paths += [source/relative for relative in (
        'tests/fixtures/kt_profile.py',
        'quizzes/management/__init__.py',
        'quizzes/management/commands/__init__.py',
        'quizzes/management/commands/finalize_exam_attempts.py',
    )]
    for path in paths:
        if path.is_symlink() or source not in path.resolve().parents:
            raise RuntimeError('Refusing path outside the explicit source allowlist.')
        target = work/path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    (work/'exam_lifecycle_pg_settings.py').write_text("""from core.test_settings import *
DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': 'saqbol_exam_lifecycle_test', 'USER': 'postgres', 'HOST': 'exam-lifecycle-db', 'PORT': '5432', 'CONN_MAX_AGE': 0, 'OPTIONS': {'options': '-c statement_timeout=20000 -c lock_timeout=15000'}}}
""", encoding='utf-8')
    os.chdir(work)
    sys.path.insert(0, str(work))
    sys.path.insert(0, str(work/'tests/fixtures'))
    import django
    django.setup()
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from django.db import DatabaseError, close_old_connections, connection, connections, transaction
    from django.db.models.query import QuerySet
    from django.utils import timezone
    from rest_framework.test import APIClient
    from analytics.models import QuestionAnswer, QuizAttemptDetail
    from courses.models import Category, Course, Lesson
    from quizzes.models import ExamAttempt, Quiz, Result
    from kt_profile import create_profile_quiz

    assert connection.vendor == 'postgresql'
    assert connection.settings_dict['HOST'] == 'exam-lifecycle-db'
    assert connection.settings_dict['NAME'] == 'saqbol_exam_lifecycle_test'
    call_command('migrate', interactive=False, verbosity=0)
    call_command('makemigrations', 'quizzes', check=True, dry_run=True, verbosity=0)
    User = get_user_model()
    teacher = User.objects.create_user(username='synthetic_exam_pg_author', role='teacher')
    student = User.objects.create_user(username='synthetic_exam_pg_learner', role='student')
    category = Category.objects.create(title='Synthetic lifecycle checks')
    course = Course.objects.create(teacher=teacher, category=category,
                                  title='Synthetic lifecycle container', status='published')
    lesson = Lesson.objects.create(course=course, title='Synthetic two-subject block')
    quiz, items = create_profile_quiz(lesson)
    quiz.exam_configuration_key = 'm094_profile_ru_v1'
    quiz.save(update_fields=['exam_configuration_key'])
    full_answers = [{'question_id': item['question'].pk, 'choice_ids': item['correct_ids']} for item in items]
    first = items[0]
    first_id = first['question'].pk
    observations = []
    context = threading.local()

    def call(method, url, data=None, *, gate=None, role=None, query_event=None,
             locked_event=None, release_lock_event=None):
        close_old_connections()
        context.role = role
        entered = False
        def observe(execute, sql, params, many, execution_context):
            nonlocal entered
            if not entered and 'quizzes_examattempt' in sql and sql.lstrip().upper().startswith('SELECT'):
                entered = True
                if query_event is not None:
                    query_event.set()
                if gate is not None:
                    gate.wait(timeout=10)
                result = execute(sql, params, many, execution_context)
                if locked_event is not None:
                    assert 'FOR UPDATE' in sql.upper(), 'Expected actual PostgreSQL row lock.'
                    locked_event.set()
                    assert release_lock_event.wait(timeout=10), 'Concurrent deletion did not reach the attempt FK update.'
                return result
            return execute(sql, params, many, execution_context)
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_backend_pid()')
                pid = cursor.fetchone()[0]
            client = APIClient(raise_request_exception=False)
            client.force_authenticate(User.objects.get(pk=student.pk))
            with connection.execute_wrapper(observe):
                response = getattr(client, method.lower())(url, data=data, format='json')
            return {'status': response.status_code, 'data': response.json() if response.status_code != 500 else None,
                    'database_pid': pid, 'exam_query_observed': entered}
        finally:
            connections.close_all()

    def concurrent(first_request, second_request):
        gate = threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            first_future = pool.submit(call, *first_request, gate=gate)
            second_future = pool.submit(call, *second_request, gate=gate)
            pair = [first_future.result(timeout=35), second_future.result(timeout=35)]
        assert all(item['exam_query_observed'] for item in pair), pair
        assert len({item['database_pid'] for item in pair}) == 2, pair
        return pair

    def start_payload():
        return {'configuration_id': 'm094_profile_ru_v1', 'request_id': str(uuid.uuid4())}

    def start():
        response = call('post', '/exams/attempts/', start_payload())
        assert response['status'] == 201, response
        return response['data']['id']

    def mutation(revision, answers, **extra):
        return {'request_id': str(uuid.uuid4()), 'revision': revision, 'answers': answers, **extra}

    def counts(attempt_id):
        attempt = ExamAttempt.objects.get(pk=attempt_id)
        results = Result.objects.filter(pk=attempt.result_id) if attempt.result_id else Result.objects.none()
        details = QuizAttemptDetail.objects.filter(result__in=results)
        return [results.count(), details.count(), QuestionAnswer.objects.filter(attempt__in=details).count()]

    same_start = start_payload()
    pair = concurrent(('post', '/exams/attempts/', same_start), ('post', '/exams/attempts/', same_start))
    assert sorted(item['status'] for item in pair) == [200, 201], pair
    assert pair[0]['data']['id'] == pair[1]['data']['id'], pair
    attempt_id = pair[0]['data']['id']
    assert ExamAttempt.objects.filter(student=student, start_id=same_start['request_id']).count() == 1
    attempt = ExamAttempt.objects.get(pk=attempt_id)
    assert attempt.revision == 0 and attempt.status == 'active'
    assert attempt.deadline - attempt.started_at == timedelta(minutes=100)
    assert counts(attempt_id) == [0, 0, 0]
    observations.append({'case': 'same_start_request', 'statuses': [200, 201], 'attempts': 1, 'finished_records': [0, 0, 0]})

    save_url = f'/exams/attempts/{attempt_id}/answers/'
    save = mutation(0, [full_answers[0]], flagged_question_ids=[first_id], last_question_by_section={'first_subject': first_id})
    pair = concurrent(('patch', save_url, save), ('patch', save_url, save))
    assert [item['status'] for item in pair] == [200, 200], pair
    attempt.refresh_from_db()
    assert attempt.revision == 1 and attempt.answers[str(first_id)] == first['correct_ids']
    assert counts(attempt_id) == [0, 0, 0]
    observations.append({'case': 'same_save_request', 'statuses': [200, 200], 'revision': 1})

    one = mutation(1, [full_answers[0]])
    two = mutation(1, [{'question_id': first_id, 'choice_ids': [first['choices'][1].pk]}])
    pair = concurrent(('patch', save_url, one), ('patch', save_url, two))
    assert sorted(item['status'] for item in pair) == [200, 409], pair
    attempt.refresh_from_db()
    winner_input = one if pair[0]['status'] == 200 else two
    assert attempt.revision == 2
    assert attempt.answers[str(first_id)] == winner_input['answers'][0]['choice_ids']
    observations.append({'case': 'competing_saves_same_revision', 'statuses': [200, 409], 'revision': 2, 'winner_preserved': True})

    finish_url = f'/exams/attempts/{attempt_id}/finish/'
    finish = mutation(2, full_answers)
    pair = concurrent(('post', finish_url, finish), ('post', finish_url, finish))
    assert [item['status'] for item in pair] == [200, 200], pair
    assert pair[0]['data']['result'] == pair[1]['data']['result'], pair
    attempt.refresh_from_db()
    assert attempt.status == 'completed' and attempt.revision == 3
    assert attempt.result.scoring_details['earned_points'] == 70
    assert counts(attempt_id) == [1, 1, 50]
    observations.append({'case': 'same_finish_request', 'statuses': [200, 200], 'points': '70/70', 'counts': [1, 1, 50]})

    conflict_id = start()
    url = f'/exams/attempts/{conflict_id}/finish/'
    pair = concurrent(('post', url, mutation(0, full_answers)), ('post', url, mutation(0, [])))
    assert sorted(item['status'] for item in pair) == [200, 409], pair
    attempt = ExamAttempt.objects.get(pk=conflict_id)
    expected_points = 70 if pair[0]['status'] == 200 else 0
    assert attempt.result.scoring_details['earned_points'] == expected_points
    assert counts(conflict_id) == [1, 1, 50]
    observations.append({'case': 'conflicting_finishes', 'statuses': [200, 409], 'winner_preserved': True, 'counts': [1, 1, 50]})

    cross_id = start()
    save = mutation(0, [full_answers[0]])
    finish = mutation(0, full_answers)
    pair = concurrent(('patch', f'/exams/attempts/{cross_id}/answers/', save),
                      ('post', f'/exams/attempts/{cross_id}/finish/', finish))
    assert sorted(item['status'] for item in pair) == [200, 409], pair
    attempt = ExamAttempt.objects.get(pk=cross_id)
    assert attempt.revision == 1
    if pair[0]['status'] == 200:
        assert attempt.status == 'active' and counts(cross_id) == [0, 0, 0]
        assert attempt.answers[str(first_id)] == first['correct_ids']
        retry = call('post', f'/exams/attempts/{cross_id}/finish/', mutation(1, full_answers))
        assert retry['status'] == 200, retry
    else:
        assert attempt.status == 'completed'
    assert counts(cross_id) == [1, 1, 50]
    observations.append({'case': 'save_against_finish_same_revision', 'statuses': [200, 409], 'no_stale_overwrite': True})

    rollback_id = start()
    url = f'/exams/attempts/{rollback_id}/finish/'
    finish = mutation(0, full_answers)
    inserted = threading.Event()
    retry_entered = threading.Event()
    real_bulk_create = QuerySet.bulk_create
    def fail_after_insert(queryset, objs, *args, **kwargs):
        created = real_bulk_create(queryset, objs, *args, **kwargs)
        if queryset.model is QuestionAnswer and getattr(context, 'role', None) == 'failing':
            inserted.set()
            assert retry_entered.wait(timeout=10), 'Retry did not reach the real attempt query.'
            raise DatabaseError('Synthetic failure after actual answer insertion')
        return created
    before_results = Result.objects.count()
    before_details = QuizAttemptDetail.objects.count()
    before_answers = QuestionAnswer.objects.count()
    with patch.object(QuerySet, 'bulk_create', fail_after_insert):
        with ThreadPoolExecutor(max_workers=2) as pool:
            first_future = pool.submit(call, 'post', url, finish, role='failing')
            assert inserted.wait(timeout=10), 'Failing transaction did not insert answers.'
            retry_future = pool.submit(call, 'post', url, finish, role='retry', query_event=retry_entered)
            failed, recovered = first_future.result(timeout=35), retry_future.result(timeout=35)
    assert failed['status'] == 500 and recovered['status'] == 200, (failed, recovered)
    attempt = ExamAttempt.objects.get(pk=rollback_id)
    assert attempt.status == 'completed' and attempt.revision == 1
    assert Result.objects.count() == before_results + 1
    assert QuizAttemptDetail.objects.count() == before_details + 1
    assert QuestionAnswer.objects.count() == before_answers + 50
    assert counts(rollback_id) == [1, 1, 50]
    observations.append({'case': 'finish_retry_after_transaction_rollback', 'statuses': [500, 200], 'counts': [1, 1, 50]})

    expired_id = start()
    saved = call('patch', f'/exams/attempts/{expired_id}/answers/', mutation(0, [full_answers[0]]))
    assert saved['status'] == 200, saved
    ExamAttempt.objects.filter(pk=expired_id).update(deadline=timezone.now() - timedelta(seconds=1))
    pair = concurrent(('post', f'/exams/attempts/{expired_id}/finish/', mutation(1, full_answers)),
                      ('get', f'/exams/attempts/{expired_id}/', None))
    assert [item['status'] for item in pair] == [409, 200], pair
    attempt = ExamAttempt.objects.get(pk=expired_id)
    assert attempt.status == 'completed' and attempt.completion_reason == 'deadline'
    assert attempt.result.scoring_details['earned_points'] == 1
    assert counts(expired_id) == [1, 1, 50]
    observations.append({'case': 'expired_finish_against_resume', 'statuses': [409, 200], 'points': '1/70', 'late_answers_ignored': True, 'counts': [1, 1, 50]})

    deleted_id = start()
    deleting_id = start()
    source_locked = threading.Event()
    finish_locked = threading.Event()
    deletion_reached_attempt = threading.Event()

    def delete_source_while_finishing():
        close_old_connections()
        def observe_delete(execute, sql, params, many, execution_context):
            if sql.lstrip().upper().startswith('UPDATE "QUIZZES_EXAMATTEMPT"'):
                deletion_reached_attempt.set()
            return execute(sql, params, many, execution_context)
        try:
            with transaction.atomic(), connection.execute_wrapper(observe_delete):
                source_quiz = Quiz.objects.select_for_update().get(pk=quiz.pk)
                source_locked.set()
                assert finish_locked.wait(timeout=10), 'Finish did not acquire the attempt row lock.'
                source_quiz.delete()
            return True
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        delete_future = pool.submit(delete_source_while_finishing)
        assert source_locked.wait(timeout=10), 'Deletion did not acquire the source row lock.'
        finish_future = pool.submit(call, 'post', f'/exams/attempts/{deleting_id}/finish/', mutation(0, full_answers),
                                    locked_event=finish_locked, release_lock_event=deletion_reached_attempt)
        response = finish_future.result(timeout=35)
        assert delete_future.result(timeout=35)
    assert response['status'] == 200, response
    attempt = ExamAttempt.objects.get(pk=deleting_id)
    assert attempt.status == 'completed' and attempt.source_quiz_id is None
    assert attempt.result.scoring_details['earned_points'] == 70
    assert counts(deleting_id) == [1, 1, 50]
    assert all(answer.question_id is None and answer.selected_choice_id is None
               for answer in attempt.result.detail.answers.all())
    observations.append({'case': 'source_deletion_against_finish', 'status': 200, 'points': '70/70',
                         'counts': [1, 1, 50], 'crossed_row_locks_without_deadlock': True})

    response = call('post', f'/exams/attempts/{deleted_id}/finish/', mutation(0, full_answers))
    assert response['status'] == 200, response
    attempt = ExamAttempt.objects.get(pk=deleted_id)
    assert attempt.source_quiz_id is None
    assert attempt.result.scoring_details['earned_points'] == 70
    assert counts(deleted_id) == [1, 1, 50]
    assert all(answer.question_id is None and answer.selected_choice_id is None
               for answer in attempt.result.detail.answers.all())
    observations.append({'case': 'finish_after_source_deletion', 'points': '70/70', 'counts': [1, 1, 50], 'frozen_content_preserved': True})

    # The normal Django Collector does not prelock Quiz. Its earlier SET_NULL
    # queries can finish before it waits for the active attempt row. A finish
    # must not introduce new optional source FKs after those queries ran.
    collector_quiz, collector_items = create_profile_quiz(lesson)
    collector_quiz.exam_configuration_key = 'm094_profile_ru_v1'
    collector_quiz.save(update_fields=['exam_configuration_key'])
    collector_answers = [{'question_id': item['question'].pk, 'choice_ids': item['correct_ids']}
                         for item in collector_items]
    collector_id = start()
    collector_finish_locked = threading.Event()
    collector_reached_attempt = threading.Event()
    collector_updates = []

    def delete_source_with_normal_collector():
        close_old_connections()
        def observe_collector(execute, sql, params, many, execution_context):
            normalized = sql.lstrip().upper()
            if normalized.startswith('UPDATE '):
                collector_updates.append(normalized.split()[1].strip('"'))
            if normalized.startswith('UPDATE "QUIZZES_EXAMATTEMPT"'):
                collector_reached_attempt.set()
            return execute(sql, params, many, execution_context)
        try:
            assert collector_finish_locked.wait(timeout=10), 'Finish did not lock the attempt.'
            with connection.execute_wrapper(observe_collector):
                Quiz.objects.filter(pk=collector_quiz.pk).delete()
            return {'success': True}
        except Exception as error:
            return {'success': False, 'type': type(error).__name__, 'detail': str(error)}
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        delete_future = pool.submit(delete_source_with_normal_collector)
        finish_future = pool.submit(call, 'post', f'/exams/attempts/{collector_id}/finish/', mutation(0, collector_answers),
                                    locked_event=collector_finish_locked, release_lock_event=collector_reached_attempt)
        response = finish_future.result(timeout=35)
        deleted = delete_future.result(timeout=35)
    assert response['status'] == 200, response
    assert deleted['success'], {'case': 'ordinary_collector_against_finish', 'finish_status': response['status'],
                                'updates_before_attempt': collector_updates, 'deletion': deleted}
    attempt = ExamAttempt.objects.get(pk=collector_id)
    assert attempt.status == 'completed' and attempt.source_quiz_id is None
    assert attempt.result.scoring_details['earned_points'] == 70
    assert counts(collector_id) == [1, 1, 50]
    assert not Quiz.objects.filter(pk=collector_quiz.pk).exists()
    assert all(answer.question_id is None and answer.selected_choice_id is None
               for answer in attempt.result.detail.answers.all())
    observations.append({'case': 'ordinary_collector_against_finish', 'finish_status': 200, 'deletion_success': True,
                         'points': '70/70', 'counts': [1, 1, 50], 'source_prelocked': False})

    connections.close_all()
    print(json.dumps({'isolation': 'disposable PostgreSQL15, tmpfs, internal network, no working database',
                      'checks': observations}, ensure_ascii=False), flush=True)
