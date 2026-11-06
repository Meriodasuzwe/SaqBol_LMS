"""Real KT submission through QuizPage, using synthetic content and SQLite :memory:.

Run only via node tests/runAnalyticsPreview.mjs --kt. No scoring/auth/persistence
mocks. Explicit source/fixture allowlists; no working DB, settings or services.
"""
import importlib.util
from pathlib import Path
import shutil
import sys

sys.dont_write_bytecode = True
harness_path = Path(__file__).with_name("run_builder_roundtrip.py")
spec = importlib.util.spec_from_file_location("isolated_kt_harness", harness_path)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
harness.LOGIN["username"] = "synthetic_kt_learner"
harness.ALLOWED_REQUESTS.clear()
harness.ALLOWED_REQUESTS.update({
    "/users/login/": {"POST"}, "/users/token/refresh/": {"POST"},
    "/users/me/": {"GET"}, "/quizzes/lesson/902/": {"GET"},
    "/quizzes/904/": {"GET"}, "/quizzes/904/submit/": {"POST"},
    "/quizzes/my-results/": {"GET"},
})
original_copy = harness.copy_application

def copy_application(source, work):
    original_copy(source, work)
    # Only this named artificial fixture, never arbitrary nested packages.
    relative = Path("tests/fixtures/kt_profile.py")
    fixture = source / relative
    if fixture.is_symlink() or source not in fixture.resolve().parents:
        raise RuntimeError("Refusing fixture outside the allowlist")
    destination = work / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(fixture, destination)

def seed_synthetic_content():
    from django.contrib.auth import get_user_model
    from django.db import connection
    from courses.models import Category, Course, Lesson, LessonStep
    if connection.vendor != "sqlite" or connection.settings_dict["NAME"] != ":memory:":
        raise RuntimeError("KT preview requires temporary SQLite :memory:")
    fixture_path = Path.cwd() / "tests/fixtures/kt_profile.py"
    fixture_spec = importlib.util.spec_from_file_location("synthetic_kt_fixture", fixture_path)
    fixture = importlib.util.module_from_spec(fixture_spec)
    fixture_spec.loader.exec_module(fixture)
    teacher = get_user_model().objects.create_user(username="synthetic_kt_author", role="teacher")
    get_user_model().objects.create_user(
        username=harness.LOGIN["username"], password=harness.LOGIN["password"],
        email="kt_learner@example.invalid", role="student", is_active=True,
    )
    category = Category.objects.create(pk=900, title="Искусственные материалы для проверки")
    course = Course.objects.create(
        pk=901, category=category, teacher=teacher, status="published", price=0,
        title="Изолированная демонстрация профильного блока",
        description="Искусственные данные. Не официальный и не проверенный учебный материал.",
    )
    lesson = Lesson.objects.create(pk=902, course=course, title="Демонстрационный профильный блок", order=1)
    quiz, _ = fixture.create_profile_quiz(lesson, quiz_id=904)
    LessonStep.objects.create(pk=903, lesson=lesson, title=quiz.title, step_type="quiz",
                              scenario_data={"quiz_id": quiz.pk}, order=1)

def read_selection_state(requests):
    from django.contrib.auth import get_user_model
    from django.db import connection
    from analytics.models import QuestionAnswer, QuizAttemptDetail
    from quizzes.models import Result
    if connection.vendor != "sqlite" or connection.settings_dict["NAME"] != ":memory:":
        raise RuntimeError("KT preview requires temporary SQLite :memory:")
    student = get_user_model().objects.get(username=harness.LOGIN["username"])
    scope = {"student_id": student.pk, "quiz_id": harness.IDS["quiz_id"]}
    attempts = QuizAttemptDetail.objects.filter(**scope).order_by("-pk")
    results = Result.objects.filter(**scope).order_by("-pk")
    answers = QuestionAnswer.objects.filter(attempt__in=attempts)
    stored = []
    for attempt in attempts.prefetch_related("answers"):
        stored.append({
            "id": attempt.pk, "result_id": attempt.result_id,
            "answers": [{
                "id": answer.pk, "question_id": answer.question_id,
                "question_text": answer.recorded_question_text,
                "position": answer.question_snapshot["position"],
                "earned_points": answer.question_snapshot["earned_points"],
                "max_points": answer.question_snapshot["max_points"],
                "selected_choice_ids": answer.selected_choice_ids,
            } for answer in sorted(attempt.answers.all(), key=lambda item: item.question_snapshot["position"])],
        })
    return {
        "isolated": True, "database": {"vendor": "sqlite", "name": ":memory:"},
        "counts": {"results": results.count(), "attempts": attempts.count(), "answers": answers.count()},
        "results": list(results.values("id", "score", "scoring_mode", "scoring_details")),
        "attempts": stored, "requests": list(requests[-100:]),
    }
original_dispatch = harness.dispatch

def dispatch(client, message, requests, faults):
    if isinstance(message, dict) and message.get("control") == "selection_state":
        return 200, read_selection_state(requests)
    if isinstance(message, dict) and "control" in message:
        raise ValueError("Unknown KT preview control")
    return original_dispatch(client, message, requests, faults)

harness.copy_application = copy_application
harness.seed_synthetic_content = seed_synthetic_content
harness.dispatch = dispatch

if __name__ == "__main__":
    raise SystemExit(harness.main())
