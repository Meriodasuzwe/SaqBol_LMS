from django.contrib import admin

from .models import Category, Course, Lesson, Enrollment, LessonStep, StepProgress, B2BLead, CorporateInvite

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'title') 
    search_fields = ('title',)     

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    # Добавили 'status', чтобы сразу видеть состояние курса
    list_display = ('title', 'teacher', 'category', 'status', 'price', 'created_at') 
    
    # Добавили 'status' в фильтры сбоку (удобно искать "На модерации")
    list_filter = ('status', 'category', 'teacher') 
    
    # Добавили поиск по имени учителя
    search_fields = ('title', 'description', 'teacher__username', 'teacher__email') 
    
    #  Позволяет менять статус (одобрять/отклонять) прямо в таблице списка курсов!
    list_editable = ('status',) 

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order') 
    list_filter = ('course',) 
    ordering = ('course', 'order') 

@admin.register(LessonStep)
class LessonStepAdmin(admin.ModelAdmin):
    list_display = ('lesson', 'step_type', 'order')
    list_filter = ('step_type', 'lesson__course')

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'enrolled_at')
    list_filter = ('course', 'student')
    search_fields = ('student__username', 'course__title')

@admin.register(StepProgress)
class StepProgressAdmin(admin.ModelAdmin):
    list_display = ('student', 'step', 'is_completed', 'score_earned')
    # Добавил удобный фильтр по пройденным шагам и курсам
    list_filter = ('is_completed', 'step__lesson__course')
    search_fields = ('student__username',)

@admin.register(B2BLead)
class B2BLeadAdmin(admin.ModelAdmin):
    # Эти поля будут отображаться в виде колонок в списке
    list_display = ('company', 'name', 'email', 'target_course', 'status', 'created_at')
    # Добавляем панель фильтрации справа
    list_filter = ('status', 'created_at')
    # Добавляем строку поиска
    search_fields = ('company', 'name', 'email')

@admin.register(CorporateInvite)
class CorporateInviteAdmin(admin.ModelAdmin):
    list_display = ('code', 'course', 'lead', 'used_count', 'max_uses', 'is_active', 'created_at')
    list_filter = ('is_active', 'course')
    search_fields = ('code', 'lead__company')