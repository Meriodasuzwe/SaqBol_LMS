"""Manual QuizPage -> real Django -> temporary SQLite preview.

This wrapper only narrows the existing isolated harness routes and adds read-only
observation of synthetic answers. Application authentication, grading, validation
and persistence run unchanged. Use the frontend preview runner, never a live DB.
"""

import importlib.util
from pathlib import Path
import sys


sys.dont_write_bytecode = True
harness_path = Path(__file__).with_name("run_builder_roundtrip.py")
spec = importlib.util.spec_from_file_location("isolated_analytics_harness", harness_path)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)

# Keep the transport restricted to this synthetic learner flow. Builder writes
# and fault-injection controls from the reused harness are unavailable here.
harness.ALLOWED_REQUESTS.clear()
harness.ALLOWED_REQUESTS.update({
    "/users/login/": {"POST"},
    "/users/token/refresh/": {"POST"},
    "/users/me/": {"GET"},
    "/quizzes/lesson/902/": {"GET"},
    "/quizzes/904/": {"GET"},
    "/quizzes/904/submit/": {"POST"},
    "/analytics/quiz-attempt/": {"POST"},
})


def read_selection_state(requests):
    """Observe only this process's synthetic records, without exposing answer keys."""
    from django.contrib.auth import get_user_model
    from django.db import connection
    from analytics.models import QuestionAnswer, QuizAttemptDetail
    from quizzes.models import Result

    if connection.vendor != "sqlite" or connection.settings_dict["NAME"] != ":memory:":
        raise RuntimeError("Analytics preview requires temporary SQLite :memory:")
    student = get_user_model().objects.get(username=harness.LOGIN["username"])
    scope = {"student_id": student.pk, "quiz_id": harness.IDS["quiz_id"]}
    attempts = QuizAttemptDetail.objects.filter(**scope).order_by("-pk")
    results = Result.objects.filter(**scope).order_by("-pk")
    stored_answers = QuestionAnswer.objects.filter(attempt__in=attempts)
    output = []
    for attempt in attempts.select_related("result").prefetch_related(
        "answers__question__choices",
    ):
        answers = []
        for answer in sorted(attempt.answers.all(), key=lambda item: item.question_id):
            labels = {choice.pk: choice.text for choice in answer.question.choices.all()}
            answers.append({
                "question_id": answer.question_id,
                "question_text": answer.question.text,
                "selected_choice_ids": answer.selected_choice_ids,
                "selected_choices": [
                    {"id": choice_id, "text": labels.get(choice_id)}
                    for choice_id in answer.selected_choice_ids
                ],
            })
        output.append({
            "id": attempt.pk,
            "score": attempt.score,
            "result_id": attempt.result_id,
            "result_score": attempt.result.score if attempt.result_id else None,
            "answers": answers,
        })
    return {
        "isolated": True,
        "database": {"vendor": connection.vendor, "name": connection.settings_dict["NAME"]},
        "counts": {"results": results.count(), "attempts": attempts.count(), "answers": stored_answers.count()},
        "attempts": output,
        "results": list(results.values("id", "score")),
        "requests": list(requests[-100:]),
    }


original_dispatch = harness.dispatch


def dispatch(client, message, requests, faults):
    if isinstance(message, dict) and message.get("control") == "selection_state":
        return 200, read_selection_state(requests)
    if isinstance(message, dict) and "control" in message:
        raise ValueError("Unknown analytics preview control")
    return original_dispatch(client, message, requests, faults)


harness.dispatch = dispatch


if __name__ == "__main__":
    raise SystemExit(harness.main())
