"""Real KT package import races in disposable PostgreSQL 15.

Use run_kt_import_concurrency.ps1. The fixed database is on a new Docker
--internal network, with tmpfs storage, no ports and no working DB credentials.
Only app-root Python modules, migrations and explicit helper/command paths are
copied. Package validation and persistence are real. SQL wrappers only coordinate
the races and inject one failure after an actual INSERT inside the transaction.
"""
import copy
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor

sys.dont_write_bytecode = True
source = Path('/source')
if sys.platform != 'linux' or not source.is_dir():
    raise SystemExit('Use the disposable PostgreSQL Docker launcher.')
os.environ.clear()
os.environ.update({
    'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8',
    'DJANGO_SETTINGS_MODULE': 'kt_import_pg_settings',
    'PYTHONDONTWRITEBYTECODE': '1', 'AI_ENABLED': 'False',
})

with tempfile.TemporaryDirectory(prefix='saqbol-kt-import-pg-') as temporary:
    work = Path(temporary)
    paths = []
    for package in ('core', 'users', 'courses', 'quizzes', 'analytics', 'notifications', 'bug_reports'):
        paths += list((source / package).glob('*.py'))
        paths += list((source / package / 'migrations').glob('*.py'))
    paths += [source / relative for relative in (
        'tests/fixtures/kt_variant_package.py',
        'quizzes/management/__init__.py',
        'quizzes/management/commands/__init__.py',
        'quizzes/management/commands/import_kt_variant.py',
    )]
    for path in paths:
        if path.is_symlink() or source not in path.resolve().parents:
            raise RuntimeError('Refusing path outside the explicit source allowlist.')
        target = work / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    (work / 'kt_import_pg_settings.py').write_text("""from core.test_settings import *
DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': 'saqbol_kt_import_test', 'USER': 'postgres', 'HOST': 'kt-import-db', 'PORT': '5432', 'CONN_MAX_AGE': 0, 'OPTIONS': {'options': '-c statement_timeout=20000 -c lock_timeout=15000'}}}
""", encoding='utf-8')
    os.chdir(work)
    # Import application code only from the allowlisted copy, not the image's
    # working directory, host source tree or an inherited PYTHONPATH.
    sys.path[:] = [str(work), str(work / 'tests/fixtures')] + [
        entry for entry in sys.path
        if entry and Path(entry).resolve().is_relative_to(Path(sys.base_prefix))
    ]
    import django
    django.setup()
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from django.db import IntegrityError, close_old_connections, connection, connections, transaction
    from django.db.models import CASCADE
    from courses.models import Category, Course, Lesson
    from quizzes.kt_variant_import import ImportConflict, import_variant
    from quizzes.models import Choice, Question, Quiz, QuizImportReceipt
    from kt_variant_package import make_package

    assert connection.vendor == 'postgresql'
    assert connection.settings_dict['HOST'] == 'kt-import-db'
    assert connection.settings_dict['NAME'] == 'saqbol_kt_import_test'
    assert not connection.settings_dict.get('PASSWORD')
    call_command('migrate', interactive=False, verbosity=0)
    call_command('makemigrations', 'quizzes', check=True, dry_run=True, verbosity=0)

    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, QuizImportReceipt._meta.db_table)
    unique_columns = {tuple(item['columns']) for item in constraints.values() if item['unique']}
    assert ('quiz_id',) in unique_columns, constraints
    assert ('package_id',) in unique_columns, constraints
    quiz_field = QuizImportReceipt._meta.get_field('quiz')
    assert quiz_field.one_to_one and quiz_field.remote_field.on_delete is CASCADE

    teacher = get_user_model().objects.create_user(username='synthetic_kt_import_pg_author', role='teacher')
    category = Category.objects.create(title='Synthetic package concurrency checks')
    observations = []

    class SyntheticWriteFailure(RuntimeError):
        """Only raised after real persistence, never in validation."""

    def new_quiz(title):
        # First import locks its lesson and course as well. Distinct destinations
        # need distinct parents so the cross-Quiz receipt race can overlap.
        course = Course.objects.create(teacher=teacher, category=category, title=title, status='draft')
        lesson = Lesson.objects.create(course=course, title='Synthetic import destination')
        return Quiz.objects.create(lesson=lesson, title=title, mode='kt_profile',
                                   description='Original empty destination')

    def apply_package(package_id):
        package = make_package(package_id)
        # Only this guarded, disposable test DB may write the artificial fixture.
        # The helper retains example_only=True for every caller by default.
        package['example_only'] = False
        return package

    def snapshot(quiz_id):
        quiz = Quiz.objects.get(pk=quiz_id)
        return {
            'quiz': {field: getattr(quiz, field) for field in (
                'id', 'lesson_id', 'title', 'description', 'mode', 'exam_configuration_key',
            )},
            'questions': list(Question.objects.filter(quiz_id=quiz_id).order_by('id').values()),
            'choices': list(Choice.objects.filter(question__quiz_id=quiz_id).order_by('id').values()),
            'receipts': list(QuizImportReceipt.objects.filter(quiz_id=quiz_id).order_by('id').values()),
        }

    def assert_loaded(quiz_id, package):
        state = snapshot(quiz_id)
        assert len(state['questions']) == 50, state
        assert len(state['choices']) == sum(len(question['choices']) for question in package['questions'])
        assert len(state['receipts']) == 1, state['receipts']
        assert state['receipts'][0]['package_id'] == package['package_id']
        for persisted, original in zip(state['questions'], package['questions']):
            assert persisted['text'] == original['text']
            assert persisted['kt_subject'] == original['kt_subject']
            assert persisted['explanation'] == original['explanation']
        return state

    def worker(package, quiz_id, *, lock_gate=None, receipt_gate=None,
               lock_query_event=None, inserted_event=None, retry_query_event=None):
        close_old_connections()
        lock_query_seen = False
        receipt_insert_seen = False
        failure_insert_seen = False

        def observe(execute, sql, params, many, execution_context):
            nonlocal lock_query_seen, receipt_insert_seen, failure_insert_seen
            normalized = sql.lstrip().upper()
            is_quiz_lock = (normalized.startswith('SELECT')
                            and 'FROM "QUIZZES_QUIZ"' in normalized
                            and 'FOR UPDATE' in normalized)
            if is_quiz_lock and not lock_query_seen:
                lock_query_seen = True
                if lock_query_event is not None:
                    lock_query_event.set()
                if lock_gate is not None:
                    lock_gate.wait(timeout=10)
            if normalized.startswith('INSERT INTO "QUIZZES_QUIZIMPORTRECEIPT"'):
                assert connection.in_atomic_block, 'Receipt must be created atomically with content.'
                receipt_insert_seen = True
                if receipt_gate is not None:
                    receipt_gate.wait(timeout=10)
            result = execute(sql, params, many, execution_context)
            if (inserted_event is not None and not failure_insert_seen
                    and normalized.startswith('INSERT INTO "QUIZZES_CHOICE"')):
                assert connection.in_atomic_block, 'Injected failure must be inside the import transaction.'
                failure_insert_seen = True
                inserted_event.set()
                assert retry_query_event.wait(timeout=10), 'Retry did not reach its real Quiz row lock.'
                raise SyntheticWriteFailure('Synthetic failure after a real choice INSERT')
            return result

        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_backend_pid()')
                backend_pid = cursor.fetchone()[0]
            try:
                with connection.execute_wrapper(observe):
                    report = import_variant(copy.deepcopy(package), quiz_id, apply=True)
                status = report['status']
            except ImportConflict:
                status = 'conflict'
            except SyntheticWriteFailure:
                status = 'injected_failure'
            return {
                'status': status, 'database_pid': backend_pid,
                'lock_query_seen': lock_query_seen, 'receipt_insert_seen': receipt_insert_seen,
                'failure_insert_seen': failure_insert_seen,
            }
        finally:
            connections.close_all()

    def assert_distinct_connections(pair):
        assert len({item['database_pid'] for item in pair}) == 2, pair
        assert all(item['lock_query_seen'] for item in pair), pair

    def race(first, second, *, collide_receipts=False):
        # Both workers reach their own real row-lock query before either runs it.
        # A receipt barrier is only valid for different Quiz rows: holding one
        # shared Quiz row lock while awaiting another holder would deadlock.
        if collide_receipts:
            assert first[1] != second[1]
        lock_gate = threading.Barrier(2)
        receipt_gate = threading.Barrier(2) if collide_receipts else None
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(worker, *request, lock_gate=lock_gate, receipt_gate=receipt_gate)
                       for request in (first, second)]
            pair = [future.result(timeout=35) for future in futures]
        assert_distinct_connections(pair)
        if collide_receipts:
            assert all(item['receipt_insert_seen'] for item in pair), pair
        return pair

    same_quiz = new_quiz('Concurrent identical package')
    same_package = apply_package('synthetic-pg-identical')
    pair = race((same_package, same_quiz.pk), (same_package, same_quiz.pk))
    assert sorted(item['status'] for item in pair) == ['already_loaded', 'imported'], pair
    loaded = assert_loaded(same_quiz.pk, same_package)
    retry = worker(same_package, same_quiz.pk)
    assert retry['status'] == 'already_loaded', retry
    assert snapshot(same_quiz.pk) == loaded, 'An identical retry rewrote content or the receipt.'
    observations.append({'case': 'same_package_same_quiz', 'statuses': ['imported', 'already_loaded'],
                         'questions': 50, 'receipts': 1, 'retry_preserved_ids': True})

    changed = copy.deepcopy(same_package)
    changed['questions'][0]['text'] += ' Synthetic changed wording.'
    conflict = worker(changed, same_quiz.pk)
    assert conflict['status'] == 'conflict', conflict
    assert snapshot(same_quiz.pk) == loaded, 'Changed package replaced loaded content.'
    observations.append({'case': 'changed_package_same_quiz', 'status': 'conflict', 'unchanged': True})

    destinations = [new_quiz('Same package destination A'), new_quiz('Same package destination B')]
    before = [snapshot(quiz.pk) for quiz in destinations]
    shared_package = apply_package('synthetic-pg-global-package-id')
    pair = race((shared_package, destinations[0].pk), (shared_package, destinations[1].pk),
                collide_receipts=True)
    assert sorted(item['status'] for item in pair) == ['conflict', 'imported'], pair
    winner = next(index for index, item in enumerate(pair) if item['status'] == 'imported')
    assert_loaded(destinations[winner].pk, shared_package)
    assert snapshot(destinations[1 - winner].pk) == before[1 - winner], 'Losing transaction left partial writes.'
    assert QuizImportReceipt.objects.filter(package_id=shared_package['package_id']).count() == 1
    observations.append({'case': 'same_package_id_different_quizzes', 'statuses': ['imported', 'conflict'],
                         'both_receipt_inserts_reached': True, 'loser_fully_rolled_back': True})

    competing_quiz = new_quiz('Concurrent distinct packages')
    competing = [apply_package('synthetic-pg-competing-a'), apply_package('synthetic-pg-competing-b')]
    competing[1]['questions'][0]['text'] += ' Distinct package content.'
    pair = race((competing[0], competing_quiz.pk), (competing[1], competing_quiz.pk))
    assert sorted(item['status'] for item in pair) == ['conflict', 'imported'], pair
    winner = next(index for index, item in enumerate(pair) if item['status'] == 'imported')
    assert_loaded(competing_quiz.pk, competing[winner])
    assert not QuizImportReceipt.objects.filter(package_id=competing[1 - winner]['package_id']).exists()
    observations.append({'case': 'conflicting_packages_same_quiz', 'statuses': ['imported', 'conflict'],
                         'winner_preserved': True, 'receipts': 1})

    rollback_quiz = new_quiz('Retry during failed import')
    rollback_package = apply_package('synthetic-pg-rollback')
    inserted = threading.Event()
    retry_entered = threading.Event()
    before_counts = [Question.objects.count(), Choice.objects.count(), QuizImportReceipt.objects.count()]
    with ThreadPoolExecutor(max_workers=2) as pool:
        failed_future = pool.submit(worker, rollback_package, rollback_quiz.pk,
                                    inserted_event=inserted, retry_query_event=retry_entered)
        assert inserted.wait(timeout=10), 'Failing import did not execute a real choice INSERT.'
        retry_future = pool.submit(worker, rollback_package, rollback_quiz.pk, lock_query_event=retry_entered)
        pair = [failed_future.result(timeout=35), retry_future.result(timeout=35)]
    assert_distinct_connections(pair)
    assert [item['status'] for item in pair] == ['injected_failure', 'imported'], pair
    assert pair[0]['failure_insert_seen'], pair
    assert_loaded(rollback_quiz.pk, rollback_package)
    assert Question.objects.count() == before_counts[0] + 50
    assert Choice.objects.count() == before_counts[1] + 200
    assert QuizImportReceipt.objects.count() == before_counts[2] + 1
    observations.append({'case': 'retry_after_transaction_rollback', 'statuses': ['injected_failure', 'imported'],
                         'questions': 50, 'choices': 200, 'receipts': 1, 'partial_writes_absent': True})

    # Exercise the other unique constraint directly as well as introspecting it.
    # The package-id constraint was already exercised by the cross-Quiz race.
    receipt = QuizImportReceipt.objects.get(quiz=rollback_quiz)
    try:
        with transaction.atomic():
            QuizImportReceipt.objects.create(
                quiz=rollback_quiz, package_id='synthetic-pg-duplicate-quiz-receipt',
                package_checksum=receipt.package_checksum, content_checksum=receipt.content_checksum,
                manifest=receipt.manifest,
            )
    except IntegrityError:
        pass
    else:
        raise AssertionError('PostgreSQL allowed two import receipts for one Quiz.')
    assert QuizImportReceipt.objects.filter(quiz=rollback_quiz).count() == 1
    deleted_quiz_id = rollback_quiz.pk
    rollback_quiz.delete()
    assert not QuizImportReceipt.objects.filter(quiz_id=deleted_quiz_id).exists()
    assert not Question.objects.filter(quiz_id=deleted_quiz_id).exists()
    observations.append({'case': 'receipt_database_constraints', 'unique_quiz': True,
                         'unique_package_id': True, 'quiz_delete_cascades': True})

    connections.close_all()
    print(json.dumps({'database': 'disposable PostgreSQL 15', 'migrations': 'applied; no model drift',
                      'cases': observations}, ensure_ascii=False, indent=2))
