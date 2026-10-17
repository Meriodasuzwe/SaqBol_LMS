"""Read-only source audit; runs only in a disposable, networkless container.

The repository is mounted at /audit-source read-only. Only Python source is
copied to a temporary directory. No .env, media or existing database is used.
Observations deliberately report current defects rather than altering code.
"""

import importlib.metadata
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main():
    source = Path('/audit-source/services/core_service')
    if not source.is_dir():
        raise SystemExit('Run in the documented disposable container only.')

    with tempfile.TemporaryDirectory(prefix='saqbol-audit-') as temporary:
        work = Path(temporary)
        for path in source.rglob('*'):
            if path.is_file() and path.suffix in {'.py', '.ini'}:
                dest = work / path.relative_to(source)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, dest)

        (work / 'audit_settings.py').write_text(
            "from core.settings import *\n"
            "DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}\n"
            "SECRET_KEY = 'audit-only-not-for-deployment-0123456789abcdef'\n"
            "ALLOWED_HOSTS = ['testserver', 'localhost']\n"
            "EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'\n"
            "DEFAULT_FROM_EMAIL = 'audit@example.invalid'\n"
            "PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']\n"
            "LOGGING = {'version': 1, 'disable_existing_loggers': True}\n"
            "DEBUG = False\n",
            encoding='utf-8',
        )
        sys.path.insert(0, str(work))
        os.chdir(work)
        os.environ['DJANGO_SETTINGS_MODULE'] = 'audit_settings'
        import django
        django.setup()
        from django.core.management import call_command
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from courses.models import Category, Course, Lesson, LessonStep, Enrollment, StepProgress
        from quizzes.models import Quiz, Question, Choice, Result
        from users.models import EmailVerification
        from analytics.models import QuizAttemptDetail, QuestionAnswer

        report = {'database': 'temporary SQLite in memory; not production PostgreSQL',
                  'versions': {}, 'checks': {}, 'observations': []}
        for package in ['django', 'djangorestframework', 'djangorestframework-simplejwt', 'pytest']:
            report['versions'][package] = importlib.metadata.version(package)
        for name, kwargs in [('check', {}), ('makemigrations', {'check': True, 'dry_run': True})]:
            output = io.StringIO()
            try:
                call_command(name, stdout=output, stderr=output, **kwargs)
                code = 0
            except SystemExit as exc:
                code = exc.code
            report['checks'][name] = {'exit_code': code, 'output': output.getvalue().strip()}
        call_command('migrate', verbosity=0)

        def record(name, expected, actual):
            report['observations'].append({'case': name, 'expected': expected,
                                          'actual': actual, 'matches_expected': expected == actual})

        User = get_user_model()
        teacher = User.objects.create_user(username='audit_teacher', role='teacher', password='AuditPass123!')
        outsider = User.objects.create_user(username='audit_outsider', password='AuditPass123!')
        buyer = User.objects.create_user(username='audit_buyer', password='AuditPass123!')
        category = Category.objects.create(title='Audit only')
        course = Course.objects.create(category=category, teacher=teacher, title='Paid audit course',
                                       description='Audit course', price=1990, status='published')
        lesson = Lesson.objects.create(course=course, title='Paid lesson')
        step = LessonStep.objects.create(lesson=lesson, content='PRIVATE_AUDIT_CONTENT')
        LessonStep.objects.create(lesson=lesson, content='Second step')
        quiz = Quiz.objects.create(lesson=lesson, title='Audit quiz')
        question = Question.objects.create(quiz=quiz, text='Audit question', explanation='PRIVATE_EXPLANATION')
        correct = Choice.objects.create(question=question, text='Correct', is_correct=True)
        wrong = Choice.objects.create(question=question, text='Wrong')
        draft = Course.objects.create(category=category, teacher=teacher, title='Draft', description='Draft')
        draft_lesson = Lesson.objects.create(course=draft, title='Draft lesson')
        LessonStep.objects.create(lesson=draft_lesson, content='PRIVATE_DRAFT_CONTENT')
        other_quiz = Quiz.objects.create(lesson=draft_lesson, title='Other quiz')
        other_question = Question.objects.create(quiz=other_quiz, text='Other question')
        other_correct = Choice.objects.create(question=other_question, text='Other correct', is_correct=True)
        anonymous = APIClient(raise_request_exception=False)
        student = APIClient(raise_request_exception=False)
        student.force_authenticate(outsider)
        buyer_client = APIClient(raise_request_exception=False)
        buyer_client.force_authenticate(buyer)

        for path in ['/courses/', f'/courses/{course.id}/', f'/courses/{course.id}/lessons/']:
            response = anonymous.get(path)
            record('anonymous paid content: ' + path, False, 'PRIVATE_AUDIT_CONTENT' in response.content.decode())
        response = anonymous.get(f'/courses/{draft.id}/lessons/')
        record('anonymous draft lesson content', False, 'PRIVATE_DRAFT_CONTENT' in response.content.decode())
        record('non-buyer direct lesson denied', 403, student.get(f'/courses/lessons/{lesson.id}/').status_code)
        record('non-buyer quiz detail denied', 403, student.get(f'/quizzes/{quiz.id}/').status_code)
        record('paid self-enrollment denied', 402, student.post(f'/courses/{course.id}/enroll/').status_code)

        normal_answers = {'answers': [{'question_id': question.id, 'choice_ids': [correct.id]}]}
        response = student.post(f'/quizzes/{quiz.id}/submit/', normal_answers, format='json')
        record('non-buyer quiz submission denied', 403, response.status_code)
        duplicate_answers = {'answers': normal_answers['answers'] * 2}
        response = student.post(f'/quizzes/{quiz.id}/submit/', duplicate_answers, format='json')
        record('duplicate questions rejected', 400, response.status_code)
        record('score cannot exceed 100', True, response.data.get('score', 0) <= 100)
        report['checks']['duplicate_score_observed'] = response.data.get('score')
        response = student.post(f'/quizzes/{quiz.id}/submit/', {'answers': [
            {'question_id': other_question.id, 'choice_ids': [other_correct.id]}]}, format='json')
        record('question from other quiz rejected', 400, response.status_code)

        response = student.post(f'/courses/steps/{step.id}/complete/', {'score': 999999}, format='json')
        record('non-buyer progress denied', 403, response.status_code)
        report['checks']['untrusted_xp_saved'] = StepProgress.objects.filter(student=outsider, step=step).values_list('score_earned', flat=True).first()

        response = student.post('/courses/', {'category': category.id, 'title': 'Unauthorized publication',
            'description': '<img src=x onerror="window.auditOnly=true">', 'price': '1.00', 'status': 'published'}, format='json')
        record('student cannot publish course', 403, response.status_code)
        if response.status_code == 201:
            public_course = anonymous.get(f"/courses/{response.data['id']}/")
            record('untrusted HTML stripped from public description', False, 'onerror=' in public_course.content.decode())

        # Positive path: same persistence used by Enrollment admin, then JWT login.
        Enrollment.objects.get_or_create(student=buyer, course=course)
        Enrollment.objects.get_or_create(student=buyer, course=course)
        record('manual enrollment is unique', 1, Enrollment.objects.filter(student=buyer, course=course).count())
        login = anonymous.post('/users/login/', {'username': 'audit_buyer', 'password': 'AuditPass123!'}, format='json')
        record('active buyer login', 200, login.status_code)
        jwt_buyer = APIClient(raise_request_exception=False)
        jwt_buyer.credentials(HTTP_AUTHORIZATION='Bearer ' + login.data['access'])
        record('enrolled JWT buyer reads lesson', 200, jwt_buyer.get(f'/courses/lessons/{lesson.id}/').status_code)
        quiz_response = jwt_buyer.get(f'/quizzes/{quiz.id}/')
        record('correct flag hidden before submission', False, 'is_correct' in quiz_response.data['questions'][0]['choices'][0])
        response = jwt_buyer.post(f'/quizzes/{quiz.id}/submit/', normal_answers, format='json')
        record('normal correct submission scores 100', 100, response.data.get('score'))
        record('submission supplies persisted result id', True, 'id' in response.data)
        record('result saved to buyer history', 1, len(jwt_buyer.get('/quizzes/my-results/').data))
        jwt_buyer.post(f'/courses/steps/{step.id}/complete/', {'score': 10}, format='json')
        record('one of two theory steps gives 50% progress', 50, jwt_buyer.get(f'/courses/{course.id}/').data.get('progress'))
        record('quiz submit persists answer details', 1,
               QuizAttemptDetail.objects.filter(student=buyer, quiz=quiz).count())
        response = jwt_buyer.post('/analytics/quiz-attempt/', {'quiz_id': quiz.id, 'score': 100,
            'total_questions': 1, 'correct_answers': 1, 'answers': [
                {'question_id': question.id, 'selected_choice_id': wrong.id, 'is_correct': True}]}, format='json')
        record('analytics does not trust client correctness', False,
               QuestionAnswer.objects.filter(attempt__student=buyer, selected_choice=wrong, is_correct=True).exists())

        reg = anonymous.post('/users/register/', {'username': 'audit_registered',
            'email': 'audit_registration@example.invalid', 'password': 'StrongAuditPass123!'}, format='json')
        record('registration request', 201, reg.status_code)
        registered = User.objects.get(username='audit_registered')
        code = EmailVerification.objects.get(user=registered).code
        verify = anonymous.post('/users/verify-email/', {'email': registered.email, 'code': code}, format='json')
        record('email verification with local mail backend', 200, verify.status_code)
        response = anonymous.post('/users/register/', {'username': 'audit_duplicate',
            'email': registered.email, 'password': '1'}, format='json')
        record('duplicate email and weak password rejected', 400, response.status_code)
        response = anonymous.post('/users/verify-email/', {'email': registered.email, 'code': '000000'}, format='json')
        record('duplicate email does not crash verification', False, response.status_code >= 500)
        response = jwt_buyer.patch('/users/me/', {'email': 'unverified@example.invalid'}, format='json')
        buyer.refresh_from_db()
        record('profile update cannot bypass email verification', False, buyer.email == 'unverified@example.invalid')

        # Demonstrate destructive operations ONLY on this in-memory fixture.
        response = student.post('/quizzes/save-generated/', {'lesson_id': lesson.id, 'quiz_id': quiz.id,
            'questions': [{'question': 'Overwritten by student', 'options': ['A', 'B'], 'correct_index': [0]}]}, format='json')
        record('student cannot overwrite teacher quiz', 403, response.status_code)
        report['checks']['original_question_survives_student_write'] = Question.objects.filter(id=question.id).exists()
        response = student.post('/quizzes/save-generated/', {'lesson_id': lesson.id, 'quiz_id': quiz.id,
            'questions': [{'question': 'Malformed update', 'options': ['A', 'B'], 'correct_index': 'invalid'}]}, format='json')
        report['checks']['invalid_save'] = {'status': response.status_code,
            'questions_after_error': list(Question.objects.filter(quiz=quiz).values_list('text', flat=True)),
            'choices_after_error': Choice.objects.filter(question__quiz=quiz).count()}

        tests = subprocess.run([sys.executable, '-m', 'pytest', '-q', '-p', 'no:cacheprovider',
                                '--ds=audit_settings'], cwd=work, text=True, capture_output=True)
        report['checks']['existing_pytest'] = {'exit_code': tests.returncode,
                                             'stdout': tests.stdout.strip(), 'stderr': tests.stderr.strip()}
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
