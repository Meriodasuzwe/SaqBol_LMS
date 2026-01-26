from django.urls import path
from .views import CategoryListView, CourseListView, CourseDetailView, LessonDetailView # Добавили импорт

urlpatterns = [
    path('', CourseListView.as_view(), name='course-list'),
    path('<int:pk>/', CourseDetailView.as_view(), name='course-detail'),
    path('categories/', CategoryListView.as_view(), name='category-list'),
    
    # ДОБАВЛЯЕМ ЭТУ СТРОКУ:
    path('lessons/<int:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
]