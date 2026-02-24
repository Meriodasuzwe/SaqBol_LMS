from django.contrib import admin
from .models import Category, Course, Lesson, Enrollment, LessonStep, StepProgress

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'title') 
    search_fields = ('title',)     

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'teacher', 'category', 'price', 'created_at') 
    list_filter = ('category', 'teacher') 
    search_fields = ('title', 'description') 

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order') 
    list_filter = ('course',) 
    ordering = ('course', 'order') 

# ДОБАВЛЕНО:
@admin.register(LessonStep)
class LessonStepAdmin(admin.ModelAdmin):
    list_display = ('lesson', 'step_type', 'order')
    list_filter = ('step_type', 'lesson__course')

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'enrolled_at')
    list_filter = ('course', 'student')

# ДОБАВЛЕНО:
@admin.register(StepProgress)
class StepProgressAdmin(admin.ModelAdmin):
    list_display = ('student', 'step', 'is_completed', 'score_earned')