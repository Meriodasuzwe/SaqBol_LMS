import random
from datetime import timedelta
from django.utils import timezone
from django.db import models
from django.contrib.auth.models import AbstractUser

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


class EmailVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        # Код действителен только 10 минут
        return timezone.now() < self.created_at + timedelta(minutes=10)

    @classmethod
    def generate_code(cls, user):
        # Генерируем случайные 6 цифр
        code = str(random.randint(100000, 999999))
        # Удаляем старые коды пользователя, чтобы не засорять базу
        cls.objects.filter(user=user).delete()
        # Создаем новый код
        return cls.objects.create(user=user, code=code)