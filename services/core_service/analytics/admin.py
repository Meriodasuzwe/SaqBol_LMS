from django.contrib import admin
from .models import QuizAttemptDetail, QuestionAnswer, ScenarioAttempt, ScenarioStepResult


@admin.register(QuizAttemptDetail)
class QuizAttemptDetailAdmin(admin.ModelAdmin):
    list_display = ('student', 'quiz', 'score', 'correct_answers', 'total_questions', 'completed_at')
    list_filter = ('quiz__lesson__course', 'completed_at')
    search_fields = ('student__username', 'quiz__title')
    readonly_fields = ('completed_at',)


@admin.register(QuestionAnswer)
class QuestionAnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question', 'is_correct', 'answered_at')
    list_filter = ('is_correct',)
    search_fields = ('attempt__student__username', 'question__text')


@admin.register(ScenarioAttempt)
class ScenarioAttemptAdmin(admin.ModelAdmin):
    list_display = ('student', 'scenario_topic', 'scenario_type', 'result', 'success_rate', 'started_at')
    list_filter = ('scenario_type', 'result', 'started_at')
    search_fields = ('student__username', 'scenario_topic')


@admin.register(ScenarioStepResult)
class ScenarioStepResultAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'step_index', 'is_correct', 'answered_at')
    list_filter = ('is_correct',)