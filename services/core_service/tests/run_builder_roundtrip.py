"""Offline JSON-lines bridge for CourseBuilder -> real Django -> SQLite checks.

Only run in the existing core-service Docker image, with /source read-only,
--network none, --read-only and a writable /tmp tmpfs. The frontend preview owns
this process and relays HTTP requests over stdin/stdout; Django's test Client is
only the transport. Real URLs, JWT authentication, serializers and ORM run here.
No application behavior is mocked. Closing stdin discards the entire database.
"""

import io
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import sys
import tempfile
from urllib.parse import urlsplit
from unittest.mock import patch


PACKAGES = ("core", "users", "courses", "quizzes", "analytics", "notifications", "bug_reports")
LOGIN = {
    "path": "/users/login/",
    "username": "cnt03_author",
    "password": secrets.token_urlsafe(32),
}
IDS = {"course_id": 901, "lesson_id": 902, "step_id": 903, "quiz_id": 904}
MAX_MESSAGE_BYTES = 512 * 1024

# These are harness boundaries, not replacements for application permissions.
# Every allowed API call still passes through the real URL/auth/view stack.
ALLOWED_REQUESTS = {
    "/users/login/": {"POST"},
    "/users/token/refresh/": {"POST"},
    "/users/me/": {"GET"},
    "/courses/901/": {"GET"},
    "/courses/901/lessons/": {"GET"},
    "/courses/steps/903/": {"GET", "PATCH"},
    "/courses/steps/905/": {"GET", "PATCH"},
    "/courses/steps/906/": {"GET"},
    "/quizzes/lesson/902/": {"GET"},
    "/quizzes/904/": {"GET"},
    "/quizzes/save-generated/": {"POST"},
}


class OfflineSocket(socket.socket):
    def connect(self, *args, **kwargs):
        raise RuntimeError("Network connections are forbidden in builder roundtrip checks")

    def connect_ex(self, *args, **kwargs):
        raise RuntimeError("Network connections are forbidden in builder roundtrip checks")

    def sendto(self, *args, **kwargs):
        raise RuntimeError("Network traffic is forbidden in builder roundtrip checks")


def copy_application(source, work):
    """Copy only app Python modules/migrations, never settings from the image."""
    for package in PACKAGES:
        package_dir = source / package
        if package_dir.is_symlink() or (package_dir / "migrations").is_symlink():
            raise RuntimeError("Refusing a symlink in application allowlist")
        files = list(package_dir.glob("*.py"))
        files += list((package_dir / "migrations").glob("*.py"))
        for path in files:
            if path.is_symlink() or source not in path.resolve().parents:
                raise RuntimeError("Refusing source outside the application allowlist")
            destination = work / path.relative_to(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)


def seed_synthetic_content():
    from django.contrib.auth import get_user_model
    from courses.models import Category, Course, Lesson, LessonStep
    from quizzes.models import Choice, Question, Quiz

    author = get_user_model().objects.create_user(
        username=LOGIN["username"], password=LOGIN["password"],
        email="cnt03_author@example.invalid", first_name="Искусственный автор",
        role="teacher", is_active=True, is_staff=False, is_superuser=False,
    )
    category = Category.objects.create(pk=900, title="Искусственные материалы CNT-03")
    course = Course.objects.create(
        pk=IDS["course_id"], category=category, teacher=author,
        title="Искусственный курс для проверки конструктора",
        description="Тестовые данные CNT-03. Не официальный и не проверенный учебный материал.",
        short_description="Изолированная проверка конструктора", status="draft", price=0,
    )
    lesson = Lesson.objects.create(
        pk=IDS["lesson_id"], course=course, title="SQL: искусственные вопросы", order=1,
    )
    quiz = Quiz.objects.create(
        pk=IDS["quiz_id"], lesson=lesson, title="Демонстрационный SQL-тест",
        description="Искусственные вопросы только для проверки сохранения.",
    )
    LessonStep.objects.create(
        pk=IDS["step_id"], lesson=lesson, title=quiz.title, step_type="quiz",
        scenario_data={"quiz_id": quiz.pk}, order=1,
    )
    LessonStep.objects.create(
        pk=905, lesson=lesson, title="Искусственный текстовый шаг", step_type="text",
        content="<p>Искусственные данные для перехода между шагами.</p>", order=2,
    )
    LessonStep.objects.create(
        pk=906, lesson=lesson, title="Новый искусственный тест", step_type="quiz",
        scenario_data={"note": "Synthetic unlinked quiz step"}, order=3,
    )
    questions = (
        (910, "Какое условие выбирает строки, у которых price больше 100?",
         ["WHERE price < 100", "WHERE price > 100", "ORDER BY price"], [1],
         "В демонстрационном примере условие WHERE price > 100 оставляет только строки с ценой больше 100."),
        (920, "Выберите оба условия, которым удовлетворяет значение price = 150.",
         ["price > 100", "price = 100", "price < 200", "price < 0"], [0, 2],
         "Число 150 больше 100 и меньше 200. Поэтому правильный набор содержит два варианта."),
        (930, "Какое условие проверяет отсутствие значения в столбце city?",
         ["city = NULL", "city IS NULL", "city = ''"], [1],
         "IS NULL проверяет отсутствие значения. Обычное сравнение с NULL не заменяет эту проверку."),
    )
    for pk, text, options, correct_indices, explanation in questions:
        question = Question.objects.create(pk=pk, quiz=quiz, text=text, explanation=explanation)
        for index, option in enumerate(options):
            Choice.objects.create(question=question, text=option, is_correct=index in correct_indices)


def read_database_state(requests, faults):
    """Harness-only observation; the browser cannot mutate data through it."""
    from django.contrib.auth import get_user_model
    from django.db import connection
    from courses.models import Category, Course, Lesson, LessonStep
    from quizzes.models import Choice, Question, Quiz, Result

    models = {
        "users": get_user_model(), "categories": Category, "courses": Course,
        "lessons": Lesson, "steps": LessonStep, "quizzes": Quiz,
        "questions": Question, "choices": Choice, "results": Result,
    }
    author = get_user_model().objects.get(username=LOGIN["username"])
    return {
        "isolated": True,
        "database": {"vendor": connection.vendor, "name": connection.settings_dict["NAME"]},
        "author": {"username": author.username, "role": author.role,
                   "is_staff": author.is_staff, "is_superuser": author.is_superuser},
        "counts": {name: model.objects.count() for name, model in models.items()},
        "quiz": Quiz.objects.filter(pk=IDS["quiz_id"]).values("id", "title", "lesson_id").first(),
        "step": LessonStep.objects.filter(pk=IDS["step_id"]).values(
            "id", "title", "content", "step_type", "scenario_data", "lesson_id").first(),
        "all_steps": list(LessonStep.objects.order_by("id").values(
            "id", "title", "content", "step_type", "scenario_data", "lesson_id")),
        "all_quizzes": list(Quiz.objects.order_by("id").values("id", "title", "lesson_id")),
        "questions": [
            {"id": question.pk, "text": question.text, "explanation": question.explanation,
             "choices": list(question.choices.order_by("id").values("id", "text", "is_correct"))}
            for question in Question.objects.filter(quiz_id=IDS["quiz_id"]).order_by("id")
        ],
        "write_requests": sum(item["method"] not in {"GET", "HEAD", "OPTIONS"}
                              and not item["path"].startswith("/users/") for item in requests),
        "requests": list(requests),
        "fault_injection": dict(faults),
    }


def dispatch(client, message, requests, faults):
    if not isinstance(message, dict):
        raise ValueError("Expected a JSON object")
    if message.get("control") == "state":
        return 200, read_database_state(requests, faults)
    if message.get("control") == "fail_next_step_save":
        faults["armed"] = True
        return 200, {"isolated": True, "fault_injection": dict(faults)}
    if "control" in message:
        raise ValueError("Unknown isolated test control")
    method = message.get("method")
    path = message.get("path")
    headers = message.get("headers", {})
    if not isinstance(method, str) or not isinstance(path, str) or not isinstance(headers, dict):
        raise ValueError("Expected method/path strings and a headers object")
    method = method.upper()
    parsed = urlsplit(path)
    if parsed.scheme or parsed.netloc or parsed.fragment or not path.startswith("/"):
        raise ValueError("Only local Django paths are allowed")
    if method not in ALLOWED_REQUESTS.get(parsed.path, set()):
        return 403, {"detail": "Request is outside the isolated fixture allowlist."}
    extra = {"HTTP_HOST": "testserver"}
    for name, value in headers.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise ValueError("Header names and values must be strings")
        if name.lower() == "authorization":
            extra["HTTP_AUTHORIZATION"] = value
    body = message.get("body")
    payload = b"" if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    if faults["armed"] and method == "POST" and parsed.path == "/quizzes/save-generated/":
        # Test-only late failure: execute the real ORM save, then raise inside
        # the real view transaction. No success response/validation is mocked.
        from courses.models import LessonStep
        real_save = LessonStep.save

        def fail_after_step_save(instance, *args, **kwargs):
            result = real_save(instance, *args, **kwargs)
            if instance.pk in {903, 906}:
                faults["armed"] = False
                faults["triggered"] += 1
                raise RuntimeError("Synthetic late step write failure (isolated test only)")
            return result

        with patch.object(LessonStep, "save", fail_after_step_save):
            response = client.generic(method, path, data=payload, content_type="application/json", **extra)
    else:
        response = client.generic(method, path, data=payload, content_type="application/json", **extra)
    requests.append({"method": method, "path": parsed.path, "status": response.status_code})
    try:
        data = json.loads(response.content.decode("utf-8")) if response.content else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        data = {"detail": "Django returned a non-JSON response.",
                "content_type": response.get("Content-Type", "")}
    return response.status_code, data


def main():
    source = Path("/source")
    if sys.platform != "linux" or not source.is_dir():
        raise SystemExit("Use the isolated Docker command; do not run against a working environment.")
    # All incidental application prints go to stderr; stdout is protocol only.
    protocol_out = sys.stdout
    protocol_out.reconfigure(encoding="utf-8")
    sys.stdout = sys.stderr

    def emit(value):
        protocol_out.write(json.dumps(value, ensure_ascii=False) + "\n")
        protocol_out.flush()

    os.environ.clear()
    os.environ.update({
        "PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8",
        "DJANGO_SETTINGS_MODULE": "core.test_settings", "PYTHONDONTWRITEBYTECODE": "1",
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1", "AI_ENABLED": "False",
    })
    sys.dont_write_bytecode = True
    socket.socket = OfflineSocket
    with tempfile.TemporaryDirectory(prefix="saqbol-builder-roundtrip-") as temporary:
        work = Path(temporary)
        os.environ["HOME"] = str(work)
        copy_application(source, work)
        os.chdir(work)
        sys.path.insert(0, str(work))
        from core import test_settings

        if test_settings.DATABASES != {
            "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"},
        } or test_settings.AI_ENABLED:
            raise RuntimeError("Builder roundtrip requires only SQLite :memory: and disabled AI")
        import django
        django.setup()
        from django.core.management import call_command
        from django.db import connections
        from django.test import Client

        # Capture only migration chatter, not a test result; there is no durable DB.
        call_command("migrate", interactive=False, verbosity=0, stdout=io.StringIO())
        seed_synthetic_content()
        client = Client(enforce_csrf_checks=True, raise_request_exception=False)
        requests = []
        faults = {"armed": False, "triggered": 0}
        emit({"ready": True, "isolated": True, **IDS, "login": LOGIN})
        try:
            for raw in sys.stdin.buffer:
                message = None
                try:
                    if len(raw) > MAX_MESSAGE_BYTES:
                        raise ValueError("JSON-lines message exceeds the harness limit")
                    message = json.loads(raw)
                    status, data = dispatch(client, message, requests, faults)
                except (ValueError, TypeError) as error:
                    status, data = 400, {"detail": str(error)}
                emit({"id": message.get("id") if isinstance(message, dict) else None,
                      "status": status, "data": data})
        finally:
            connections.close_all()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
