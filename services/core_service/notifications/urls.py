from django.urls import path
from .views import (
    NotificationListView,
    UnreadCountView,
    MarkAllReadView,
    MarkOneReadView,
)

urlpatterns = [
    path('',                    NotificationListView.as_view(), name='notification-list'),
    path('unread-count/',       UnreadCountView.as_view(),      name='notification-unread-count'),
    path('mark-read/',          MarkAllReadView.as_view(),      name='notification-mark-all-read'),
    path('<int:pk>/read/',      MarkOneReadView.as_view(),      name='notification-mark-one-read'),
]