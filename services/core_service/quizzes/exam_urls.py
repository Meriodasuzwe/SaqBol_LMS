from django.urls import path
from .exam_views import (
    ExamConfigurationsView, ExamAttemptsView, ExamAttemptView, ExamAnswersView,
    ExamFinishView, ExamResultView, ExamReviewView,
)

urlpatterns = [
    path('configurations/', ExamConfigurationsView.as_view(), name='exam-configurations'),
    path('attempts/', ExamAttemptsView.as_view(), name='exam-attempts'),
    path('attempts/<uuid:attempt_id>/', ExamAttemptView.as_view(), name='exam-attempt'),
    path('attempts/<uuid:attempt_id>/answers/', ExamAnswersView.as_view(), name='exam-answers'),
    path('attempts/<uuid:attempt_id>/finish/', ExamFinishView.as_view(), name='exam-finish'),
    path('attempts/<uuid:attempt_id>/result/', ExamResultView.as_view(), name='exam-result'),
    path('attempts/<uuid:attempt_id>/review/', ExamReviewView.as_view(), name='exam-review'),
]
