from django.urls import path  # <--- ВОТ ЭТОГО НЕ ХВАТАЛО
from .views import QuizDetailView, QuizSubmitView

urlpatterns = [
    # Позволит получить тест по ID урока
    path('lesson/<int:lesson_id>/', QuizDetailView.as_view(), name='quiz-detail'),
    
    # Позволит отправить ответы на тест
    path('<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
]