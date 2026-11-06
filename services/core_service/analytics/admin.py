from django.contrib import admin
from .models import QuizAttemptDetail, QuestionAnswer, ScenarioAttempt, ScenarioStepResult


@admin.register(QuizAttemptDetail)
class QuizAttemptDetailAdmin(admin.ModelAdmin):
    list_display = ('student', 'recorded_quiz_title', 'score', 'correct_answers', 'total_questions', 'completed_at')
    list_filter = ('quiz__lesson__course', 'completed_at')
    search_fields = ('student__username', 'quiz__title')
    readonly_fields = ('completed_at', 'quiz_snapshot', 'snapshot_status')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student', 'quiz')

    @admin.display(description='Тест')
    def recorded_quiz_title(self, obj):
        return obj.recorded_quiz_title

    @admin.display(description='Исторический снимок')
    def snapshot_status(self, obj):
        if obj.quiz_snapshot is not None:
            return 'Сохранён при сдаче.'
        return 'Снимок отсутствует; текущее название теста могло измениться.'


@admin.register(QuestionAnswer)
class QuestionAnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'recorded_question_text', 'is_correct', 'answered_at')
    list_filter = ('is_correct',)
    search_fields = ('attempt__student__username', 'question__text')
    readonly_fields = ('question_snapshot', 'snapshot_status')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('attempt__student', 'attempt__quiz', 'question')

    @admin.display(description='Вопрос')
    def recorded_question_text(self, obj):
        return obj.recorded_question_text

    @admin.display(description='Исторический снимок')
    def snapshot_status(self, obj):
        if obj.question_snapshot is not None:
            return 'Сохранён при сдаче.'
        return 'Снимок отсутствует; исходный текст и варианты ответа нельзя восстановить достоверно.'


@admin.register(ScenarioAttempt)
class ScenarioAttemptAdmin(admin.ModelAdmin):
    list_display = ('student', 'scenario_topic', 'scenario_type', 'result', 'success_rate', 'started_at')
    list_filter = ('scenario_type', 'result', 'started_at')
    search_fields = ('student__username', 'scenario_topic')


@admin.register(ScenarioStepResult)
class ScenarioStepResultAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'step_index', 'is_correct', 'answered_at')
    list_filter = ('is_correct',)