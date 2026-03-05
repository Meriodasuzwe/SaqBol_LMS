from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User
from .models import TeacherApplication

# Регистрируем нашу модель User, чтобы она появилась в админке
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # Указываем, какие поля показывать в списке пользователей
    list_display = ('username', 'email', 'role', 'is_staff')
    
    # Добавляем возможность редактирования Роли прямо в админке
    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительная информация (CyberSec)', {'fields': ('role',)}),
    )


from .models import TeacherApplication

# Кастомное действие для админки
@admin.action(description="Одобрить выбранные заявки и выдать права Автора")
def approve_applications(modeladmin, request, queryset):
    # Берем только те заявки, которые еще "На рассмотрении"
    pending_apps = queryset.filter(status='pending')
    
    for app in pending_apps:
        # 1. Меняем статус заявки
        app.status = 'approved'
        app.save()
        # 2. Автоматически меняем роль юзера!
        app.user.role = 'teacher'
        app.user.save()

@admin.action(description="Отклонить заявки")
def reject_applications(modeladmin, request, queryset):
    queryset.update(status='rejected')

@admin.register(TeacherApplication)
class TeacherApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__username', 'user__email')
    actions = [approve_applications, reject_applications]
    readonly_fields = ('created_at',)

    # === НОВОЕ: Группируем поля для красоты в самой заявке ===
    fieldsets = (
        ('Статус и пользователь', {
            'fields': ('user', 'status', 'created_at')
        }),
        ('Анкета кандидата (Заполнено на сайте)', {
            'fields': ('cv_text', 'portfolio_url')
        }),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        if obj.status == 'approved' and obj.user.role != 'teacher':
            obj.user.role = 'teacher'
            obj.user.save()