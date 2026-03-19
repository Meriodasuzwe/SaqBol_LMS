"""
analytics/serializers.py — Сериализаторы для записи и чтения аналитики.
"""

from rest_framework import serializers
from .models import QuizAttemptDetail, QuestionAnswer, ScenarioAttempt, ScenarioStepResult


# ---------------------------------------------------------------------------
# ЗАПИСЬ ДАННЫХ (фронтенд → API)
# ---------------------------------------------------------------------------

class QuestionAnswerInputSerializer(serializers.Serializer):
    """Один ответ студента на вопрос при отправке результатов квиза."""
    question_id = serializers.IntegerField()
    selected_choice_id = serializers.IntegerField(allow_null=True)
    is_correct = serializers.BooleanField()


class SubmitQuizAttemptSerializer(serializers.Serializer):
    """Тело запроса при завершении квиза."""
    quiz_id = serializers.IntegerField()
    result_id = serializers.IntegerField(required=False, allow_null=True)
    score = serializers.FloatField(min_value=0, max_value=100)
    total_questions = serializers.IntegerField(min_value=1)
    correct_answers = serializers.IntegerField(min_value=0)
    time_spent_seconds = serializers.IntegerField(min_value=0, default=0)
    answers = QuestionAnswerInputSerializer(many=True)


class ScenarioStepResultInputSerializer(serializers.Serializer):
    """Один шаг сценария при отправке результатов."""
    step_index = serializers.IntegerField(min_value=0)
    message_text = serializers.CharField(allow_blank=True, default="")
    chosen_option_text = serializers.CharField()
    is_correct = serializers.BooleanField()
    feedback_shown = serializers.CharField(allow_blank=True, default="")


class SubmitScenarioAttemptSerializer(serializers.Serializer):
    """Тело запроса при завершении сценария."""
    lesson_step_id = serializers.IntegerField()
    scenario_type = serializers.ChoiceField(choices=['chat', 'email'])
    scenario_topic = serializers.CharField(max_length=255, default="")
    result = serializers.ChoiceField(choices=['passed', 'failed', 'incomplete'])
    total_steps = serializers.IntegerField(min_value=0)
    correct_steps = serializers.IntegerField(min_value=0)
    time_spent_seconds = serializers.IntegerField(min_value=0, default=0)
    step_results = ScenarioStepResultInputSerializer(many=True)


# ---------------------------------------------------------------------------
# ЧТЕНИЕ ДАННЫХ (API → фронтенд)
# ---------------------------------------------------------------------------

class WeakTopicSerializer(serializers.Serializer):
    """Слабая тема для дашборда учителя."""
    question_id = serializers.IntegerField()
    question_text = serializers.CharField()
    total_answers = serializers.IntegerField()
    wrong_answers = serializers.IntegerField()
    error_rate = serializers.FloatField()


class QuizStatsSerializer(serializers.Serializer):
    """Статистика по одному квизу для учителя."""
    quiz_id = serializers.IntegerField()
    quiz_title = serializers.CharField()
    total_attempts = serializers.IntegerField()
    avg_score = serializers.FloatField()
    avg_time_seconds = serializers.FloatField()
    pass_rate = serializers.FloatField()  # % студентов с score >= 70
    weak_topics = WeakTopicSerializer(many=True)


class ScenarioStepStatsSerializer(serializers.Serializer):
    """Статистика по шагу сценария."""
    step_index = serializers.IntegerField()
    message_text = serializers.CharField()
    total_answers = serializers.IntegerField()
    wrong_answers = serializers.IntegerField()
    error_rate = serializers.FloatField()


class ScenarioStatsSerializer(serializers.Serializer):
    """Статистика по сценарию для учителя."""
    lesson_step_id = serializers.IntegerField()
    scenario_topic = serializers.CharField()
    scenario_type = serializers.CharField()
    total_attempts = serializers.IntegerField()
    pass_rate = serializers.FloatField()
    avg_success_rate = serializers.FloatField()
    hardest_steps = ScenarioStepStatsSerializer(many=True)


class TeacherDashboardSerializer(serializers.Serializer):
    """Полный дашборд учителя."""
    total_students = serializers.IntegerField()
    total_quiz_attempts = serializers.IntegerField()
    total_scenario_attempts = serializers.IntegerField()
    avg_quiz_score = serializers.FloatField()
    quiz_stats = QuizStatsSerializer(many=True)
    scenario_stats = ScenarioStatsSerializer(many=True)
    # AI инсайты добавляются отдельным запросом к FastAPI


class StudentQuizHistorySerializer(serializers.Serializer):
    """История квизов студента."""
    attempt_id = serializers.IntegerField()
    quiz_title = serializers.CharField()
    score = serializers.FloatField()
    correct_answers = serializers.IntegerField()
    total_questions = serializers.IntegerField()
    time_spent_seconds = serializers.IntegerField()
    completed_at = serializers.DateTimeField()


class StudentScenarioHistorySerializer(serializers.Serializer):
    """История сценариев студента."""
    attempt_id = serializers.IntegerField()
    scenario_topic = serializers.CharField()
    scenario_type = serializers.CharField()
    result = serializers.CharField()
    success_rate = serializers.FloatField()
    completed_at = serializers.DateTimeField()


class StudentDashboardSerializer(serializers.Serializer):
    """Полный дашборд студента."""
    total_quizzes_taken = serializers.IntegerField()
    avg_quiz_score = serializers.FloatField()
    total_scenarios_taken = serializers.IntegerField()
    scenario_pass_rate = serializers.FloatField()
    quiz_history = StudentQuizHistorySerializer(many=True)
    scenario_history = StudentScenarioHistorySerializer(many=True)
    weak_topics = WeakTopicSerializer(many=True)
    # Рекомендации от AI
    ai_recommendations = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=[]
    )