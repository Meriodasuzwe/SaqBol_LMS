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
    
    age = models.PositiveIntegerField(null=True, blank=True, verbose_name="Возраст")
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="Аватарка")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class QuizAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attempts')
    quiz_title = models.CharField(max_length=255)
    score = models.FloatField()
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.quiz_title} ({self.score}%)"