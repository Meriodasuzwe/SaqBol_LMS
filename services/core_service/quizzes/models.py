from django.db import models
# Импортируем настройки Django для получения модели пользователя, так как нам нужно связать результаты тестов с пользователями
from django.conf import settings
# Импортируем модель Lesson для связи с тестами, так как каждый тест будет привязан к конкретному уроку
from courses.models import Lesson
# Модель для тестов, связанных с уроками. Каждый тест может быть связан с одним уроком, но урок может иметь несколько тестов (поэтому используем ForeignKey вместо OneToOneField). Поля включают название теста и описание для дополнительной информации.
class Quiz(models.Model):
    # Связь с уроком через внешний ключ с каскадным удалением и related name для получения всех тестов урока verbose_name для админки
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='quizzes')  # Allow multiple quizzes per lesson (ForeignKey instead of OneToOne)
    # Название теста с ограничением длины 255 символов
    title = models.CharField(max_length=255)
    # Описание теста (необязательно)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"Тест к уроку: {self.lesson.title}"
# Модель для вопросов теста. Каждый вопрос связан с конкретным тестом через внешний ключ. Поля включают текст вопроса и необязательное объяснение для студентов, которое может помочь им понять правильный ответ после сдачи теста.
class Question(models.Model):
    # Связь с тестом через внешний ключ с каскадным удалением и related name для получения всех вопросов теста verbose_name для админки
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    text = models.TextField()
    # Объяснение для студентов (необязательно)
    explanation = models.TextField(blank=True, null=True, help_text="Объяснение для студента")
    # Dunder str для удобного отображения объектов вопроса в админке и при отладке возвращает текст вопроса для контекста
    def __str__(self):
        return self.text
# Модель для вариантов ответов на вопросы теста. Каждый вариант связан с конкретным вопросом через внешний ключ. Поля включают текст варианта и булево поле is_correct для указания правильного ответа.
class Choice(models.Model):
    # Связь с вопросом через внешний ключ с каскадным удалением и related name для получения всех вариантов вопроса verbose_name для админки
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    text = models.CharField(max_length=255)
    # Булево поле для указания правильного ответа
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text
# Модель для хранения результатов прохождения тестов студентами. Каждый результат связан с конкретным студентом и тестом через внешние ключи. Поля включают набранные баллы в процентах и дату завершения теста.
class Result(models.Model):
    # Связь с пользователем через внешний ключ с каскадным удалением и related name для получения всех результатов студента verbose_name для админки
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # Связь с тестом через внешний ключ с каскадным удалением и related name для получения всех результатов теста verbose_name для админки
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    # Набранные баллы в процентах
    score = models.FloatField()
    # Дата и время завершения теста с автоматической установкой при создании записи verbose_name для админки
    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} - {self.quiz.title}: {self.score}%"
