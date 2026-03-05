from django.urls import path
from .views import (
    QuizListView, # Общий список тестов, может использоваться для админки или общих целей
    QuizDetailView, # Детальный View для получения информации о конкретном тесте по его ID
    QuizByLessonView, # View для получения тестов по конкретному уроку
    QuizSubmitView, # View для сдачи теста и получения результатов
    MyQuizResultsView, # View для получения результатов тестов текущего пользователя
    GeneratePreviewView, # View для генерации превью теста
    SaveGeneratedView # View для сохранения сгенерированного теста
)
# Здесь будут определены все URL для тестов
urlpatterns = [
    # Общий путь для получения всех тестов, может использоваться для админки или общих целей. Этот путь будет обрабатывать URL вида: quizzes/
    path('', QuizListView.as_view(), name='quiz-list'),
    
    # Новый путь для получения тестов по конкретному уроку. Этот путь будет обрабатывать URL вида: quizzes/lesson/<lesson_id>/
    path('lesson/<int:lesson_id>/', QuizByLessonView.as_view(), name='quiz-by-lesson'),
    
    # Путь для получения детальной информации о конкретном тесте по его ID. Этот путь будет обрабатывать URL вида: quizzes/<quiz_id>/
    path('<int:pk>/', QuizDetailView.as_view(), name='quiz-detail'),
    path('<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
    path('my-results/', MyQuizResultsView.as_view(), name='my-results'),
    
    # Путь для генерации превью теста. Этот путь будет обрабатывать URL вида: quizzes/generate-preview/
    path('generate-preview/', GeneratePreviewView.as_view(), name='generate-preview'),
    path('save-generated/', SaveGeneratedView.as_view(), name='save-generated'),
]