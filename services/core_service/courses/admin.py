from django.contrib import admin
from .models import Category, Course, Lesson,Enrollment

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'title') # Показываем ID и Название
    search_fields = ('title',)     # Добавляем поиск по названию

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'category', 'price', 'created_at') # Колонки в списке
    list_filter = ('category', 'teacher') # Фильтры справа
    search_fields = ('title', 'description') # Поиск по описанию и названию

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order') # Показываем к какому курсу относится
    list_filter = ('course',) # Фильтр по курсам
    ordering = ('course', 'order') # Сортировка
    
@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'enrolled_at')
    list_filter = ('course', 'student')