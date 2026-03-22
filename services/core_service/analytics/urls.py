from django.urls import path
from .views import (
    SubmitQuizAttemptView,
    SubmitScenarioAttemptView,
    TeacherDashboardView,
    StudentDashboardView,
)

urlpatterns = [
    # Запись результатов (фронт → Django)
    path('quiz-attempt/', SubmitQuizAttemptView.as_view(), name='submit-quiz-attempt'),
    path('scenario-attempt/', SubmitScenarioAttemptView.as_view(), name='submit-scenario-attempt'),

    # Дашборды
    path('teacher/dashboard/', TeacherDashboardView.as_view(), name='teacher-dashboard'),
    path('student/dashboard/', StudentDashboardView.as_view(), name='student-dashboard'),
]