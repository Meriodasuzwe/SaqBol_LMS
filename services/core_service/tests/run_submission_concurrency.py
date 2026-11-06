"""Disposable PostgreSQL concurrency checks for actual quiz submit.

Run this file in the existing core image with /source mounted read-only and a
writable /tmp tmpfs, on a newly-created Docker --internal network. Its only peer
must be a disposable postgres:15 container, alias idempotency-db, database
saqbol_idempotency_test, POSTGRES_HOST_AUTH_METHOD=trust, tmpfs data/socket dirs,
and no published ports. Remove these two containers and the private network
when finished. Never attach this runner to the working application network.
The exact fixed host/database below intentionally reject runtime DB settings.
Source copying permits only the listed package-root modules and migrations.
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
from unittest.mock import patch

sys.dont_write_bytecode = True
source = Path('/source')
if sys.platform != 'linux' or not source.is_dir():
    raise SystemExit('Use the isolated Docker runner.')
os.environ.clear()
os.environ.update({'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8',
                   'DJANGO_SETTINGS_MODULE': 'idempotency_pg_settings', 'AI_ENABLED': 'False',
                   'PYTHONDONTWRITEBYTECODE': '1'})

with tempfile.TemporaryDirectory(prefix='saqbol-idempotency-pg-') as temporary:
    work = Path(temporary)
    for package in ('core', 'users', 'courses', 'quizzes', 'analytics', 'notifications', 'bug_reports'):
        paths = list((source/package).glob('*.py')) + list((source/package/'migrations').glob('*.py'))
        for path in paths:
            if path.is_symlink():
                raise RuntimeError('No symlinks in the source allowlist.')
            target = work/path.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    (work/'idempotency_pg_settings.py').write_text('''from core.test_settings import *
DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': 'saqbol_idempotency_test', 'USER': 'postgres', 'HOST': 'idempotency-db', 'PORT': '5432', 'CONN_MAX_AGE': 0, 'OPTIONS': {'options': '-c statement_timeout=15000 -c lock_timeout=12000'}}}
''', encoding='utf-8')
    os.chdir(work)
    sys.path.insert(0, str(work))
    import django
    django.setup()
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from django.db import DatabaseError, close_old_connections, connection, connections
    from django.db.models.query import QuerySet
    from rest_framework.test import APIClient
    from analytics.models import QuestionAnswer, QuizAttemptDetail
    from courses.models import Category, Course, Lesson
    from quizzes.models import Choice, Question, Quiz, Result

    assert connection.vendor == 'postgresql'
    assert connection.settings_dict['HOST'] == 'idempotency-db'
    assert connection.settings_dict['NAME'] == 'saqbol_idempotency_test'
    call_command('migrate', interactive=False, verbosity=0)
    call_command('makemigrations', 'quizzes', check=True, dry_run=True, verbosity=0)
    User = get_user_model()
    teacher = User.objects.create_user(username='synthetic_concurrent_teacher', role='teacher')
    student = User.objects.create_user(username='synthetic_concurrent_student', role='student')
    category = Category.objects.create(title='Synthetic concurrency')
    course = Course.objects.create(teacher=teacher, category=category, title='Synthetic course')
    lesson = Lesson.objects.create(course=course, title='Synthetic lesson')
    quiz = Quiz.objects.create(lesson=lesson, title='Synthetic concurrent quiz')
    question = Question.objects.create(quiz=quiz, text='Synthetic multiple choice')
    choices = [Choice.objects.create(question=question, text=f'Synthetic {index}', is_correct=index in (0, 2)) for index in range(4)]
    correct_ids = [choices[0].pk, choices[2].pk]
    url = f'/quizzes/{quiz.pk}/submit/'
    observed = []
    context = threading.local()

    def payload(submission_id, selected=None):
        return {'submission_id': str(submission_id), 'answers': [{'question_id': question.pk, 'choice_ids': correct_ids if selected is None else selected}], 'time_spent_seconds': 12}

    def worker(data, role=None):
        close_old_connections()
        context.role = role
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_backend_pid()')
                backend_pid = cursor.fetchone()[0]
            client = APIClient(raise_request_exception=False)
            client.force_authenticate(User.objects.get(pk=student.pk))
            response = client.post(url, data, format='json')
            return {'status': response.status_code, 'data': response.json() if response.status_code != 500 else None, 'backend_pid': backend_pid}
        finally:
            connections.close_all()

    def counts(submission_id):
        results = Result.objects.filter(student=student, quiz=quiz, submission_id=submission_id)
        details = QuizAttemptDetail.objects.filter(result__in=results)
        return [results.count(), details.count(), QuestionAnswer.objects.filter(attempt__in=details).count()]

    real_create = QuerySet.create

    def concurrent_pair(first, second):
        gate = threading.Barrier(2)
        entrants = []
        def gated_create(queryset, **kwargs):
            if queryset.model is Result:
                entrants.append(threading.get_ident())
                gate.wait(timeout=8)
            return real_create(queryset, **kwargs)
        with patch.object(QuerySet, 'create', gated_create):
            with ThreadPoolExecutor(max_workers=2) as pool:
                one = pool.submit(worker, first)
                two = pool.submit(worker, second)
                results = [one.result(timeout=25), two.result(timeout=25)]
        assert len(set(entrants)) == 2, 'Both real transactions must reach the Result INSERT race.'
        assert len({result['backend_pid'] for result in results}) == 2
        return results

    same_key = uuid.uuid4()
    same = concurrent_pair(payload(same_key), payload(same_key))
    assert [result['status'] for result in same] == [200, 200], same
    assert same[0]['data'] == same[1]['data'], same
    assert counts(same_key) == [1, 1, 1]
    observed.append({'case': 'concurrent_same_submission', 'statuses': [200, 200], 'distinct_database_connections': True, 'same_response': True, 'counts': counts(same_key)})

    conflicting_key = uuid.uuid4()
    conflicting = concurrent_pair(payload(conflicting_key), payload(conflicting_key, [choices[1].pk]))
    assert sorted(result['status'] for result in conflicting) == [200, 409], conflicting
    assert counts(conflicting_key) == [1, 1, 1]
    winner = next(result for result in conflicting if result['status'] == 200)
    assert Result.objects.get(submission_id=conflicting_key).pk == winner['data']['id']
    observed.append({'case': 'concurrent_conflicting_answers', 'statuses': sorted(result['status'] for result in conflicting), 'counts': counts(conflicting_key)})

    rollback_key = uuid.uuid4()
    inserted = threading.Event()
    retry_entered_create = threading.Event()
    real_bulk_create = QuerySet.bulk_create
    def mark_retry_create(queryset, **kwargs):
        if queryset.model is Result and getattr(context, 'role', None) == 'retry':
            retry_entered_create.set()
        return real_create(queryset, **kwargs)
    def fail_after_actual_insert(queryset, objs, *args, **kwargs):
        created = real_bulk_create(queryset, objs, *args, **kwargs)
        if queryset.model is QuestionAnswer and getattr(context, 'role', None) == 'failing':
            inserted.set()
            assert retry_entered_create.wait(timeout=8), 'Concurrent retry did not attempt Result insertion.'
            raise DatabaseError('Synthetic failure after answer insertion')
        return created
    with patch.object(QuerySet, 'create', mark_retry_create), patch.object(QuerySet, 'bulk_create', fail_after_actual_insert):
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(worker, payload(rollback_key), 'failing')
            assert inserted.wait(timeout=8), 'First request did not reach its actual answer insertion.'
            second = pool.submit(worker, payload(rollback_key), 'retry')
            failed, recovered = first.result(timeout=25), second.result(timeout=25)
    assert failed['status'] == 500, failed
    assert recovered['status'] == 200, recovered
    assert counts(rollback_key) == [1, 1, 1]
    assert Result.objects.get(submission_id=rollback_key).pk == recovered['data']['id']
    observed.append({'case': 'concurrent_retry_after_winner_rolls_back', 'statuses': [500, 200], 'counts': counts(rollback_key)})

    connections.close_all()
    print(json.dumps({'isolation': 'disposable PostgreSQL15 tmpfs, private internal network, no working DB', 'checks': observed}, ensure_ascii=False), flush=True)
