from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseListView, 
    CourseDetailView, 
    CategoryListView,
    EnrollCourseView, 
    LessonListCreateView,
    MyCoursesView,
    MarkLessonCompleteView, 
    LessonDetailView,
    BulkCreateCourseView
)

urlpatterns = [
    # Категории
    path('categories/', CategoryListView.as_view(), name='category-list'),
    
    # Специфичные маршруты курсов (ДОЛЖНЫ БЫТЬ ВЫШЕ <int:pk>)
    path('bulk-create/', BulkCreateCourseView.as_view(), name='course-bulk-create'), # Убрал 'courses/', так как в главном urls.py уже есть префикс
    path('my_courses/', MyCoursesView.as_view(), name='my-courses'),
    
    # Общие маршруты курсов
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('<int:pk>/enroll/', EnrollCourseView.as_view(), name='course-enroll'),

    # Уроки 
    path('<int:course_id>/lessons/', LessonListCreateView.as_view(), name='course-lessons'),
    
    # Детали урока
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
    path('lessons/<int:pk>/complete/', MarkLessonCompleteView.as_view(), name='lesson-complete'),
]