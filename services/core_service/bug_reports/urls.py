from django.urls import path
from .views import BugReportCreateView, BugReportListView, BugReportDetailView

urlpatterns = [
    path('', BugReportCreateView.as_view(), name='bug-report-create'),
    path('list/', BugReportListView.as_view(), name='bug-report-list'),
    path('<uuid:pk>/', BugReportDetailView.as_view(), name='bug-report-detail'),
]