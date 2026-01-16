from django.urls import path
# Импортируем именно те имена, которые создали в views.py
from .views import CategoryListView, CourseListView, CourseDetailView

urlpatterns = [
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
]