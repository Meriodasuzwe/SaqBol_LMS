"""
analytics/models.py

Модели для сбора данных аналитики.

Архитектурное решение:
- НЕ трогаем существующие модели Result/QuizAttempt
- Создаём новые модели рядом с детализацией
- QuizAttemptDetail  → детальные ответы по каждому вопросу
- ScenarioAttempt    → попытки сценариев кибербеза
- ScenarioStepResult → какой шаг сценария провалили
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


# ---------------------------------------------------------------------------
# КВИЗЫ — детализация по вопросам
# ---------------------------------------------------------------------------

class QuizAttemptDetail(models.Model):
    """
    Детальная попытка прохождения квиза.
    Расширяет существующий Result — не ломает старый код.
    """
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='quiz_attempt_details',
        verbose_name="Студент"
    )
    quiz = models.ForeignKey(
        'quizzes.Quiz',
        on_delete=models.CASCADE,
        related_name='attempt_details',
        verbose_name="Квиз"
    )
    # Ссылка на старый Result (необязательно — для совместимости)
    result = models.OneToOneField(
        'quizzes.Result',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='detail',
        verbose_name="Результат (legacy)"
    )

    score = models.FloatField(verbose_name="Итоговый балл (%)")
    total_questions = models.PositiveIntegerField(verbose_name="Всего вопросов")
    correct_answers = models.PositiveIntegerField(verbose_name="Правильных ответов")
    time_spent_seconds = models.PositiveIntegerField(
        default=0,
        verbose_name="Время прохождения (сек)"
    )
    started_at = models.DateTimeField(default=timezone.now, verbose_name="Начало")
    completed_at = models.DateTimeField(auto_now_add=True, verbose_name="Завершение")

    class Meta:
        verbose_name = "Детальная попытка квиза"
        verbose_name_plural = "Детальные попытки квизов"
        ordering = ['-completed_at']

    def __str__(self):
        return f"{self.student.username} — {self.quiz.title} ({self.score:.0f}%)"


class QuestionAnswer(models.Model):
    """
    Ответ студента на конкретный вопрос.
    Это ключевая модель для анализа слабых тем.
    """
    attempt = models.ForeignKey(
        QuizAttemptDetail,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name="Попытка"
    )
    question = models.ForeignKey(
        'quizzes.Question',
        on_delete=models.CASCADE,
        related_name='student_answers',
        verbose_name="Вопрос"
    )
    selected_choice = models.ForeignKey(
        'quizzes.Choice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name="Выбранный ответ"
    )
    is_correct = models.BooleanField(verbose_name="Правильно?")
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Ответ на вопрос"
        verbose_name_plural = "Ответы на вопросы"
        # Один ответ на вопрос в рамках попытки
        unique_together = ('attempt', 'question')

    def __str__(self):
        status = "✅" if self.is_correct else "❌"
        return f"{status} {self.attempt.student.username} — {self.question.text[:50]}"


# ---------------------------------------------------------------------------
# СЦЕНАРИИ КИБЕРБЕЗА — какие шаги проваливают
# ---------------------------------------------------------------------------

class ScenarioAttempt(models.Model):
    """
    Попытка прохождения сценария (chat или email).
    Привязана к LessonStep с типом simulation_chat/simulation_email.
    """
    SCENARIO_TYPES = (
        ('chat', 'Чат-симуляция'),
        ('email', 'Фишинговое письмо'),
    )
    RESULT_CHOICES = (
        ('passed', 'Пройден'),
        ('failed', 'Провален'),
        ('incomplete', 'Не завершён'),
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scenario_attempts',
        verbose_name="Студент"
    )
    lesson_step = models.ForeignKey(
        'courses.LessonStep',
        on_delete=models.CASCADE,
        related_name='scenario_attempts',
        verbose_name="Шаг урока"
    )
    scenario_type = models.CharField(
        max_length=10,
        choices=SCENARIO_TYPES,
        verbose_name="Тип сценария"
    )
    # Тема сценария для AI анализа (например "Звонок из банка")
    scenario_topic = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Тема сценария"
    )
    result = models.CharField(
        max_length=15,
        choices=RESULT_CHOICES,
        default='incomplete',
        verbose_name="Результат"
    )
    total_steps = models.PositiveIntegerField(default=0, verbose_name="Всего шагов")
    correct_steps = models.PositiveIntegerField(default=0, verbose_name="Правильных шагов")
    time_spent_seconds = models.PositiveIntegerField(default=0, verbose_name="Время (сек)")
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Попытка сценария"
        verbose_name_plural = "Попытки сценариев"
        ordering = ['-started_at']

    @property
    def success_rate(self):
        if self.total_steps == 0:
            return 0
        return round(self.correct_steps / self.total_steps * 100, 1)

    def __str__(self):
        return f"{self.student.username} — {self.scenario_topic} ({self.result})"


class ScenarioStepResult(models.Model):
    """
    Результат конкретного шага сценария.
    Позволяет понять КАКОЙ именно шаг студенты проваливают чаще всего.
    """
    attempt = models.ForeignKey(
        ScenarioAttempt,
        on_delete=models.CASCADE,
        related_name='step_results',
        verbose_name="Попытка"
    )
    # Порядковый номер шага (0, 2, 4... — только choice шаги)
    step_index = models.PositiveIntegerField(verbose_name="Индекс шага")
    # Текст сообщения от "злоумышленника" перед этим шагом
    message_text = models.TextField(blank=True, verbose_name="Сообщение сценария")
    # Что выбрал студент
    chosen_option_text = models.TextField(verbose_name="Выбранный вариант")
    is_correct = models.BooleanField(verbose_name="Правильный выбор?")
    # Фидбек который получил студент
    feedback_shown = models.TextField(blank=True, verbose_name="Показанный фидбек")
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Результат шага сценария"
        verbose_name_plural = "Результаты шагов сценариев"
        ordering = ['step_index']

    def __str__(self):
        status = "✅" if self.is_correct else "❌"
        return f"{status} Шаг {self.step_index} — {self.attempt}"