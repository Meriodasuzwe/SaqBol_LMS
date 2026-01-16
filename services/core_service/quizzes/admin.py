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
    list_display = ('student', 'quiz', 'score', 'completed_at')
    readonly_fields = ('completed_at',)