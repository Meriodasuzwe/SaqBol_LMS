from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseListView, 
    CourseDetailView, 
    CategoryListView,
    EnrollCourseView, 
    LessonListCreateView,
    MyCoursesView, 
    LessonDetailView
)

urlpatterns = [
    # Курсы
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('my_courses/', MyCoursesView.as_view(), name='my-courses'),
    
    # Категории
    path('categories/', CategoryListView.as_view(), name='category-list'),
    
    path('<int:pk>/enroll/', EnrollCourseView.as_view(), name='course-enroll'),

    # Уроки 
    path('<int:course_id>/lessons/', LessonListCreateView.as_view(), name='course-lessons'),
    
    # Детали урока
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
    
    
]