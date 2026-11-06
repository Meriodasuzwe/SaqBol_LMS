from django.db import models
from django.utils import timezone
import uuid
# Импортируем настройки Django для получения модели пользователя, так как нам нужно связать результаты тестов с пользователями
from django.conf import settings
# Импортируем модель Lesson для связи с тестами, так как каждый тест будет привязан к конкретному уроку
from courses.models import Lesson
# Модель для тестов, связанных с уроками. Каждый тест может быть связан с одним уроком, но урок может иметь несколько тестов (поэтому используем ForeignKey вместо OneToOneField). Поля включают название теста и описание для дополнительной информации.
class Quiz(models.Model):
    class Mode(models.TextChoices):
        TRAINING = 'training', 'Тренировка'
        KT_PROFILE = 'kt_profile', 'Пробник профильного блока КТ'

    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.TRAINING)
    # Explicit content binding; existing quizzes are never reclassified as M094.
    exam_configuration_key = models.CharField(max_length=64, blank=True, default='')
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
    class KTSubject(models.TextChoices):
        FIRST = 'first_subject', 'Первый профильный предмет'
        SECOND = 'second_subject', 'Второй профильный предмет'

    kt_subject = models.CharField(max_length=20, choices=KTSubject.choices, blank=True, default='')
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
    # При удалении исходного теста сохраняем результат, обнуляя только связь.
    quiz = models.ForeignKey(Quiz, on_delete=models.SET_NULL, null=True, blank=True)
    # Набранные баллы в процентах
    score = models.FloatField()
    # Preserve the policy and raw points even if live quiz content/mode changes.
    scoring_mode = models.CharField(max_length=20, choices=Quiz.Mode.choices,
                                   default=Quiz.Mode.TRAINING, editable=False)
    scoring_details = models.JSONField(null=True, blank=True, editable=False)
    # Дата и время завершения теста с автоматической установкой при создании записи verbose_name для админки
    completed_at = models.DateTimeField(auto_now_add=True)
    # NULL keeps legacy results valid; new clients identify one submission by UUID.
    submission_id = models.UUIDField(null=True, blank=True, editable=False)
    submission_fingerprint = models.CharField(max_length=64, null=True, blank=True, editable=False)
    # Original API response for retries, not a full historical content snapshot.
    submission_response = models.JSONField(null=True, blank=True, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'quiz', 'submission_id'],
                name='unique_student_quiz_submission',
            ),
        ]

    @property
    def recorded_quiz_title(self):
        detail = getattr(self, 'detail', None)
        if detail is not None:
            return detail.recorded_quiz_title
        return self.quiz.title if self.quiz_id else 'Тест удалён'

    def __str__(self):
        return f"{self.student.username} - {self.recorded_quiz_title}: {self.score}%"


class ExamAttempt(models.Model):
    """Server-owned active exam; completed legacy analytics remain final-only."""
    class Status(models.TextChoices):
        ACTIVE = 'active', 'В процессе'
        COMPLETED = 'completed', 'Завершена'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exam_attempts')
    source_quiz = models.ForeignKey(Quiz, on_delete=models.SET_NULL, null=True, blank=True, related_name='exam_attempts')
    start_id = models.UUIDField(editable=False)
    configuration_key = models.CharField(max_length=64, editable=False)
    configuration_snapshot = models.JSONField(editable=False)
    content_snapshot = models.JSONField(editable=False)
    answers = models.JSONField(default=dict, editable=False)
    flagged_question_ids = models.JSONField(default=list, editable=False)
    last_question_by_section = models.JSONField(default=dict, editable=False)
    revision = models.PositiveIntegerField(default=0, editable=False)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, editable=False)
    started_at = models.DateTimeField(default=timezone.now, editable=False)
    deadline = models.DateTimeField(null=True, blank=True, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True, editable=False)
    completion_reason = models.CharField(max_length=12, blank=True, default='', editable=False)
    result = models.OneToOneField(Result, on_delete=models.PROTECT, null=True, blank=True, related_name='exam_attempt', editable=False)
    last_write_id = models.UUIDField(null=True, blank=True, editable=False)
    last_write_fingerprint = models.CharField(max_length=64, blank=True, default='', editable=False)
    finish_id = models.UUIDField(null=True, blank=True, editable=False)
    finish_fingerprint = models.CharField(max_length=64, blank=True, default='', editable=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['student', 'start_id'], name='unique_student_exam_start')]
        indexes = [models.Index(fields=['status', 'deadline'], name='exam_status_deadline_idx')]
