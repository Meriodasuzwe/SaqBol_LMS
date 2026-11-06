from django.contrib import admin
from .models import Quiz, Question, Choice, Result

# Позволяет добавлять варианты ответов прямо внутри вопроса
class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4 # По умолчанию 4 поля для ответов

# Позволяет добавлять вопросы прямо внутри теста
class QuestionInline(admin.StackedInline):
    model = Question
    extra = 1

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'lesson')
    inlines = [QuestionInline]

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [ChoiceInline]

@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ('student', 'recorded_quiz_title', 'score', 'completed_at')
    readonly_fields = ('completed_at',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('student', 'quiz', 'detail', 'detail__quiz')

    @admin.display(description='Тест')
    def recorded_quiz_title(self, obj):
        return obj.recorded_quiz_title
