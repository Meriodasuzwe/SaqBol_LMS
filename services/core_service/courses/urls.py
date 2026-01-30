from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseListView, 
    CourseDetailView, 
    CategoryListView, 
    LessonListCreateView, # <-- Импортируем новый класс
    LessonDetailView
)

urlpatterns = [
    # Курсы
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    
    # Категории
    path('categories/', CategoryListView.as_view(), name='category-list'),

    # Уроки 
    path('<int:course_id>/lessons/', LessonListCreateView.as_view(), name='course-lessons'),
    
    # Детали урока
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
]