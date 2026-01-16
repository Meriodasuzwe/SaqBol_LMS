from django.contrib.auth.models import AbstractUser #Я использую AbstractUser для гибкого расширения модели пользователя без ломки встроенной аутентификации Django
from django.db import models

class User(AbstractUser):
    # Роли для доступа (RBAC)
    ROLE_CHOICES = (
        ('admin', 'Администратор'),
        ('teacher', 'Преподаватель'),
        ('student', 'Студент'),
    )
    
    role = models.CharField(
        max_length=10, 
        choices=ROLE_CHOICES, 
        default='student',
        verbose_name="Роль"
    )
    
    # Специфика КЗ
    iin = models.CharField(
        max_length=12, 
        unique=True, 
        null=True, 
        blank=True, 
        verbose_name="ИИН"
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"