"""Real QuizPage submit API in isolated SQLite, through the existing allowlisted harness."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
path = Path(__file__).with_name('run_builder_roundtrip.py')
spec = importlib.util.spec_from_file_location('quiz_recovery_harness', path)
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
harness.ALLOWED_REQUESTS.clear()
harness.ALLOWED_REQUESTS.update({
    '/users/login/': {'POST'}, '/users/token/refresh/': {'POST'}, '/users/me/': {'GET'},
    '/quizzes/lesson/902/': {'GET'}, '/quizzes/904/submit/': {'POST'},
})

def read_state(requests, faults):
    from django.db import connection
    from quizzes.models import Result
    from analytics.models import QuizAttemptDetail, QuestionAnswer
    if connection.vendor != 'sqlite' or connection.settings_dict['NAME'] != ':memory:':
        raise RuntimeError('Only temporary SQLite is allowed')
    return {
        'isolated': True, 'database': 'SQLite :memory:',
        'counts': {'results': Result.objects.count(), 'details': QuizAttemptDetail.objects.count(), 'answers': QuestionAnswer.objects.count()},
        'results': [{'id': result.pk, 'submission_id': str(result.submission_id), 'score': result.score,
                     'answers': list(result.detail.answers.order_by('question_id').values('question_id', 'selected_choice_ids'))}
                    for result in Result.objects.order_by('id')],
        'requests': list(requests),
    }

harness.read_database_state = read_state
if __name__ == '__main__':
    raise SystemExit(harness.main())
