"""Isolated real exam API for the browser preview; no production data or services.

Run through node tests/runExamPreview.mjs. The reused harness copies an explicit
application allowlist into tmpfs and runs real JWT/URL/ORM handling in SQLite memory.
"""
import importlib.util
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
path = Path(__file__).with_name('run_builder_roundtrip.py')
spec = importlib.util.spec_from_file_location('isolated_exam_harness', path)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
harness.LOGIN['username'] = 'synthetic_exam_learner'
harness.MAX_MESSAGE_BYTES = 36 * 1024 * 1024
harness.ALLOWED_REQUESTS.clear()
harness.ALLOWED_REQUESTS.update({
    '/users/login/': {'POST'}, '/users/token/refresh/': {'POST'},
    '/users/me/': {'GET'}, '/exams/configurations/': {'GET'},
    '/exams/attempts/': {'GET', 'POST'}, '/bugs/': {'POST'},
    '/notifications/unread-count/': {'GET'}, '/notifications/': {'GET'},
    '/notifications/mark-read/': {'PATCH'},
})
original_copy = harness.copy_application


def copy_application(source, work):
    original_copy(source, work)
    for name in (
        'tests/fixtures/kt_profile.py',
        'quizzes/management/__init__.py',
        'quizzes/management/commands/__init__.py',
        'quizzes/management/commands/finalize_exam_attempts.py',
    ):
        file = source / name
        if file.is_symlink() or source not in file.resolve().parents:
            raise RuntimeError('Refusing a file outside the preview allowlist')
        destination = work / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, destination)


def assert_isolated():
    from django.db import connection
    if connection.vendor != 'sqlite' or connection.settings_dict['NAME'] != ':memory:':
        raise RuntimeError('Exam preview requires temporary SQLite :memory:')


def seed_synthetic_content():
    from django.conf import settings
    from django.contrib.auth import get_user_model
    from courses.models import Category, Course, Lesson
    assert_isolated()
    settings.EXAM_DEMO_ENABLED = True
    fixture_path = Path.cwd() / 'tests/fixtures/kt_profile.py'
    spec = importlib.util.spec_from_file_location('synthetic_exam_fixture', fixture_path)
    fixture = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fixture)
    teacher = get_user_model().objects.create_user(username='synthetic_exam_author', role='teacher')
    get_user_model().objects.create_user(
        username=harness.LOGIN['username'], password=harness.LOGIN['password'],
        email='exam_learner@example.invalid', first_name='Демонстрационный пользователь',
        role='student', is_active=True,
    )
    category = Category.objects.create(pk=900, title='Искусственные материалы для проверки')
    course = Course.objects.create(
        pk=901, category=category, teacher=teacher, status='published', price=0,
        title='Изолированная демонстрация двух профильных предметов',
        description='Искусственные вопросы. Не официальный и не проверенный учебный материал.',
    )
    lesson = Lesson.objects.create(pk=902, course=course, title='Демонстрационные задания', order=1)
    quiz, items = fixture.create_profile_quiz(lesson, quiz_id=904)
    quiz.title = 'Демонстрация двух профильных предметов'
    quiz.exam_configuration_key = 'm094_profile_ru_demo_v1'
    quiz.save(update_fields=['title', 'exam_configuration_key'])
    first = items[0]['question']
    first.text = (
        'Демонстрационное задание. Последовательность целых чисел упорядочена по возрастанию. '
        'Алгоритм на каждом шаге сравнивает искомое значение с элементом в середине текущего '
        'диапазона и продолжает работу только в одной из двух половин. Как называется этот подход?'
    )
    first.explanation = 'Искусственный пример: последовательное сокращение диапазона вдвое иллюстрирует двоичный поиск. Материал предназначен для проверки интерфейса.'
    first.save(update_fields=['text', 'explanation'])
    for choice, text in zip(items[0]['choices'], [
        'Двоичный поиск', 'Последовательный просмотр каждого элемента',
        'Сортировка выбором', 'Обход графа в ширину', 'Поиск минимального элемента',
    ]):
        choice.text = text
        choice.save(update_fields=['text'])
    database = items[30]['question']
    database.text = (
        'Демонстрационное задание. В таблице demo_materials хранятся названия материалов, '
        'их статус публикации и категория. Рассмотрите SQL-запрос и выберите верное описание результата.\n\n'
        '```sql\nSELECT id, title\nFROM demo_materials\nWHERE published = TRUE\n  AND category = \'databases\'\nORDER BY title;\n```'
    )
    database.explanation = 'Демонстрационное объяснение: WHERE оставляет опубликованные материалы указанной категории; ORDER BY упорядочивает их по названию.'
    database.save(update_fields=['text', 'explanation'])
    labels = [
        'Опубликованные материалы категории databases, отсортированные по названию',
        'Все материалы независимо от публикации',
        'Только число подходящих материалов',
        'Неопубликованные материалы всех категорий',
        'Все категории без повторений',
        'Материалы в порядке убывания идентификатора',
    ]
    for choice, text in zip(items[30]['choices'], labels):
        choice.text = text
        choice.save(update_fields=['text'])
    # Multi-choice questions 2 and 3 have two and three correct keys respectively.
    # The fixture's active API still redacts all keys; these exercise checkbox mode.
    items[32]['question'].explanation = ''
    items[32]['question'].save(update_fields=['explanation'])


def read_state(requests):
    from django.contrib.auth import get_user_model
    from analytics.models import QuestionAnswer, QuizAttemptDetail
    from bug_reports.models import BugReport
    from quizzes.models import ExamAttempt, Result
    assert_isolated()
    student = get_user_model().objects.get(username=harness.LOGIN['username'])
    attempts = ExamAttempt.objects.filter(student=student).order_by('-started_at')
    return {
        'isolated': True, 'database': 'SQLite :memory:',
        'counts': {
            'attempts': attempts.count(), 'results': Result.objects.filter(student=student).count(),
            'details': QuizAttemptDetail.objects.filter(student=student).count(),
            'answers': QuestionAnswer.objects.filter(attempt__student=student).count(),
            'reports': BugReport.objects.count(),
        },
        'attempts': [
            {'id': str(item.pk), 'status': item.status, 'revision': item.revision,
             'answers': item.answers, 'flagged_question_ids': item.flagged_question_ids,
             'last_question_by_section': item.last_question_by_section,
             'deadline': item.deadline.isoformat() if item.deadline else None,
             'result_id': item.result_id}
            for item in attempts
        ],
        'requests': list(requests[-100:]),
    }


original_dispatch = harness.dispatch


def dispatch(client, message, requests, faults):
    if not isinstance(message, dict):
        raise ValueError('Expected a JSON object')
    control = message.get('control')
    if control == 'state':
        return 200, read_state(requests)
    if control == 'deadline_in_five_seconds':
        from datetime import timedelta
        from uuid import UUID
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from quizzes.models import ExamAttempt
        assert_isolated()
        try:
            attempt_id = UUID(message.get('attempt_id', ''))
        except (ValueError, TypeError, AttributeError):
            raise ValueError('A synthetic attempt UUID is required')
        student = get_user_model().objects.get(username=harness.LOGIN['username'])
        changed = ExamAttempt.objects.filter(pk=attempt_id, student=student, status='active').update(
            deadline=timezone.now() + timedelta(seconds=5))
        return (200 if changed else 404), {'isolated': True, 'changed': changed}
    if control is not None:
        raise ValueError('Unknown exam preview control')
    request_path = urlsplit(message.get('path', '')).path
    match = re.fullmatch(r'/exams/attempts/[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/(answers/|finish/|result/|review/)?', request_path)
    if match:
        suffix = match.group(1)
        harness.ALLOWED_REQUESTS[request_path] = {'PATCH'} if suffix == 'answers/' else {'POST'} if suffix == 'finish/' else {'GET'}
    if 'multipart' in message:
        import base64
        import json
        from django.core.files.uploadedfile import SimpleUploadedFile
        if request_path != '/bugs/' or message.get('method') != 'POST':
            return 403, {'detail': 'Multipart is allowed only for the isolated bug-report route.'}
        form = message['multipart']
        if not isinstance(form, dict) or not isinstance(form.get('fields'), dict) or not isinstance(form.get('files'), list):
            raise ValueError('Malformed preview multipart envelope')
        data = dict(form['fields'])
        if any(not isinstance(key, str) or not isinstance(value, str) for key, value in data.items()) or len(form['files']) > 5:
            raise ValueError('Malformed preview multipart fields')
        for file in form['files']:
            if file.get('field') != 'screenshots':
                raise ValueError('Unexpected preview upload field')
            content = base64.b64decode(file['base64'], validate=True)
            if len(content) > 5 * 1024 * 1024:
                raise ValueError('Preview upload is too large')
            data.setdefault('screenshots', []).append(SimpleUploadedFile(file['name'], content, content_type=file['type']))
        headers = message.get('headers', {})
        response = client.post(request_path, data=data, HTTP_HOST='testserver', HTTP_AUTHORIZATION=headers.get('authorization', ''))
        requests.append({'method': 'POST', 'path': request_path, 'status': response.status_code})
        return response.status_code, json.loads(response.content)
    return original_dispatch(client, message, requests, faults)


harness.copy_application = copy_application
harness.seed_synthetic_content = seed_synthetic_content
harness.dispatch = dispatch

if __name__ == '__main__':
    raise SystemExit(harness.main())
