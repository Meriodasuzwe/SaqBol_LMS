# import random для генерации случайного кода для верификации email
import random
# datetime и timezone для проверки срока действия кода верификации email
from datetime import timedelta
# Импортируем необходимые модули из Django для создания модели пользователя и связанных моделей
from django.utils import timezone
# Импортируем базовую модель пользователя для расширения и создания своей модели с дополнительными полями и функционалом
from django.db import models
# Импортируем базовую модель пользователя для расширения и создания своей модели с дополнительными полями и функционалом
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # Роли для доступа (RBAC) - администратор, преподаватель, студент
    ROLE_CHOICES = (
        ('admin', 'Администратор'),
        ('teacher', 'Преподаватель'),
        ('student', 'Студент'),
    )
    # Роль пользователя с выбором из предопределенных ролей и значением по умолчанию "студент" verbose_name для админки
    role = models.CharField(
        max_length=10, 
        choices=ROLE_CHOICES, 
        default='student',
        verbose_name="Роль"
    )
    
    # Возраст пользователя (необязательно) null разрешение для базы данных и blank разрешение для Django админки verbose_name для админки
    age = models.PositiveIntegerField(null=True, blank=True, verbose_name="Возраст")
    # Аватар пользователя (необязательно) null разрешение для базы данных и blank разрешение для Django админки verbose_name для админки
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name="Аватарка")
    # dunder str для удобного отображения объектов пользователя в админке и при отладке возвращает имя пользователя и его роль для контекста
    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

# Модель для хранения попыток прохождения тестов пользователями с информацией о названии теста, набранных баллах и дате попытки
class QuizAttempt(models.Model):
    # Связь с пользователем через внешний ключ с каскадным удалением и related name для получения всех попыток пользователя verbose_name для админки
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attempts')
    # Название теста 
    quiz_title = models.CharField(max_length=255)
    # Набранные баллы в процентах
    score = models.FloatField()
    # Дата и время попытки с автоматической установкой при создании записи verbose_name для админки
    date = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.quiz_title} ({self.score}%)"

# Модель для хранения кодов верификации email пользователей
class EmailVerification(models.Model):
    # Связь с пользователем через внешний ключ с каскадным удалением и related name для получения всех кодов верификации
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    # Случайный 6-значный код для верификации email
    code = models.CharField(max_length=6)
    # Дата и время создания кода с автоматической установкой при создании записи verbose_name для админки
    created_at = models.DateTimeField(auto_now_add=True)
    # Метод для проверки действительности кода верификации (код действителен только 10 минут)
    def is_valid(self):
        # Код действителен только 10 минут
        return timezone.now() < self.created_at + timedelta(minutes=10)
    # Декоратор класса для создания нового кода верификации для пользователя с удалением старых кодов перед созданием нового чтобы не засорять базу данных
    @classmethod
    def generate_code(cls, user):
        # Генерируем случайные 6 цифр
        code = str(random.randint(100000, 999999))
        # Удаляем старые коды пользователя, чтобы не засорять базу
        cls.objects.filter(user=user).delete()
        # Создаем новый код
        return cls.objects.create(user=user, code=code)