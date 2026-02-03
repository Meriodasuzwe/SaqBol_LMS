from django.db import models
from django.conf import settings

# 1. Категории курсов (Программирование, Дизайн и т.д.)
class Category(models.Model):
    title = models.CharField(max_length=200, verbose_name="Название категории")
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    def __str__(self):
        return self.title

# 2. Сам Курс
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='courses', verbose_name="Категория")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taught_courses', verbose_name="Преподаватель")
    title = models.CharField(max_length=255, verbose_name="Название курса")
    
    # --- НОВЫЕ ПОЛЯ ---
    short_description = models.TextField(blank=True, null=True, verbose_name="Краткое описание (визитка)")
    cover_image = models.URLField(blank=True, null=True, verbose_name="Ссылка на обложку")
    # ------------------

    description = models.TextField(verbose_name="Описание курса")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Цена")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Курс"
        verbose_name_plural = "Курсы"

    def __str__(self):
        return self.title

# 3. Уроки (Главы) курса + ИНТЕРАКТИВ
class Lesson(models.Model):
    # Типы уроков: обычный текст или симуляции
    LESSON_TYPES = (
        ('text', 'Текст/Видео'),
        ('simulation_chat', 'Симуляция: Чат (WhatsApp/Telegram)'),
        ('simulation_email', 'Симуляция: Email (Фишинг)'),
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons', verbose_name="Курс")
    title = models.CharField(max_length=255, verbose_name="Название урока")
    
    # Тип урока. По умолчанию - обычный текст.
    lesson_type = models.CharField(
        max_length=20, 
        choices=LESSON_TYPES, 
        default='text', 
        verbose_name="Тип урока"
    )

    content = models.TextField(verbose_name="Текст урока", blank=True)
    video_url = models.URLField(blank=True, null=True, verbose_name="Ссылка на видео")
    
    # JSON поле для хранения сценария симуляции.
    # Здесь будет лежать структура диалога: { "messages": [...], "correct_choice": ... }
    scenario_data = models.JSONField(
        blank=True, 
        null=True, 
        verbose_name="Сценарий симуляции (JSON)",
        help_text="Заполняется только для типов simulation_*"
    )

    order = models.PositiveIntegerField(default=0, verbose_name="Порядок урока")

    class Meta:
        verbose_name = "Урок"
        verbose_name_plural = "Уроки"
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} - {self.title} ({self.get_lesson_type_display()})"
    
# 4. Запись на курс
class Enrollment(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrolled_students')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'course')
        verbose_name = "Зачисление"
        verbose_name_plural = "Зачисления"

    def __str__(self):
        return f"{self.student.username} -> {self.course.title}"

# 5. Прогресс прохождения (Геймификация)
class LessonProgress(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False, verbose_name="Пройден")
    completed_at = models.DateTimeField(auto_now_add=True)
    
    # Добавляем очки за прохождение
    score_earned = models.IntegerField(default=0, verbose_name="Полученные очки (XP)")

    class Meta:
        unique_together = ('student', 'lesson')
        verbose_name = "Прогресс урока"
        verbose_name_plural = "Прогресс уроков"