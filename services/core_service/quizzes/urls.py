from django.urls import path 
from .views import QuizDetailView, QuizSubmitView, MyResultsView, GenerateQuizView # Добавили сюда

urlpatterns = [
    # Позволит получить тест по ID урока
    path('lesson/<int:lesson_id>/', QuizDetailView.as_view(), name='quiz-detail'),
    
    # Позволит отправить ответы на тест
    path('<int:quiz_id>/submit/', QuizSubmitView.as_view(), name='quiz-submit'),
    
    # Список результатов
    path('my-results/', MyResultsView.as_view(), name='my-results'),
    
    # Генерация теста (убрали приставку views.)
    path('generate/<int:lesson_id>/', GenerateQuizView.as_view(), name='generate-quiz'),
]