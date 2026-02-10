from django.urls import path 
from .views import (
    QuizListView,
    QuizDetailView, 
    QuizSubmitView, 
    MyQuizResultsView, 
    GenerateQuizView,
    GeneratePreviewView,
    SaveGeneratedView
)

urlpatterns = [
    # Список тестов (поддерживает фильтр ?lesson_id=)
    path('', QuizListView.as_view(), name='quiz-list'),

    # Просмотр конкретного теста по ID
    path('<int:pk>/', QuizDetailView.as_view(), name='quiz-detail'),

    # Отправка ответов на тест
    path('<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),

    # Список результатов
    path('my-results/', MyQuizResultsView.as_view(), name='my-results'),

    # Генерация теста (быстрая), предпросмотр и сохранение
    path('generate/<int:lesson_id>/', GenerateQuizView.as_view(), name='generate-quiz'),
    path('generate-preview/', GeneratePreviewView.as_view(), name='quiz-generate-preview'),
    path('save-generated/', SaveGeneratedView.as_view(), name='quiz-save-generated'),
]