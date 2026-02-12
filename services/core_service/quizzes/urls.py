from django.urls import path
from .views import (
    QuizListView, 
    QuizDetailView, 
    QuizByLessonView, # <--- Импортируй это
    QuizSubmitView, 
    MyQuizResultsView,
    GeneratePreviewView,
    SaveGeneratedView
)

urlpatterns = [
    path('', QuizListView.as_view(), name='quiz-list'),
    
    # 🔥 Вот этот путь важен для QuizPage
    path('lesson/<int:lesson_id>/', QuizByLessonView.as_view(), name='quiz-by-lesson'),
    
    path('<int:pk>/', QuizDetailView.as_view(), name='quiz-detail'),
    path('<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
    path('my-results/', MyQuizResultsView.as_view(), name='my-results'),
    
    # AI Routes
    path('generate-preview/', GeneratePreviewView.as_view(), name='generate-preview'),
    path('save-generated/', SaveGeneratedView.as_view(), name='save-generated'),
]