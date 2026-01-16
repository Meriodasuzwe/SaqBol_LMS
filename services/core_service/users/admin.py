from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

# Регистрируем нашу модель User, чтобы она появилась в админке
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    # Указываем, какие поля показывать в списке пользователей
    list_display = ('username', 'email', 'iin', 'role', 'is_staff')
    
    # Добавляем возможность редактирования ИИН и Роли прямо в админке
    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительная информация (CyberSec)', {'fields': ('iin', 'role')}),
    )