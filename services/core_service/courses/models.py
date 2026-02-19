from django.db import models
from django.conf import settings

# 1. Категории курсов (Без изменений)
class Category(models.Model):
    title = models.CharField(max_length=200, verbose_name="Название категории")
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    def __str__(self):
        return self.title


# 2. Сам Курс (Без изменений)
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='courses', verbose_name="Категория")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taught_courses', verbose_name="Преподаватель")
    title = models.CharField(max_length=255, verbose_name="Название курса")
    short_description = models.TextField(blank=True, null=True, verbose_name="Краткое описание (визитка)")
    cover_image = models.URLField(blank=True, null=True, verbose_name="Ссылка на обложку")
    description = models.TextField(verbose_name="Описание курса")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Цена")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Курс"
        verbose_name_plural = "Курсы"

    def __str__(self):
        return self.title


# 3. Урок (Теперь это просто контейнер для шагов)
class Lesson(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons', verbose_name="Курс")
    title = models.CharField(max_length=255, verbose_name="Название урока")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок урока")

    class Meta:
        verbose_name = "Урок"
        verbose_name_plural = "Уроки"
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} - {self.title}"


# 4. НОВОЕ: Шаг урока (Те самые квадратики)
class LessonStep(models.Model):
    # Объединили твои типы уроков и добавили новые форматы
    STEP_TYPES = (
        ('text', 'Теория (Текст)'),
        ('video_url', 'Видео (YouTube/Ссылка)'),
        ('video_file', 'Локальное видео (Загрузка файла)'), # Важно для ИБ (храним у себя)
        ('simulation_chat', 'Симуляция: Чат (WhatsApp/Telegram)'),
        ('simulation_email', 'Симуляция: Email (Фишинг)'),
        ('quiz', 'Тест/Опрос'),
    )

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='steps', verbose_name="Урок")
    title = models.CharField(max_length=255, blank=True, verbose_name="Заголовок шага (необязательно)")
    
    step_type = models.CharField(max_length=20, choices=STEP_TYPES, default='text', verbose_name="Тип шага")
    
    # Текст теории или URL ссылка
    content = models.TextField(verbose_name="Текст/Ссылка", blank=True)
    
    # НОВОЕ: Поле для локальной загрузки файлов (видео, PDF). Безопасный контур!
    file = models.FileField(upload_to='lesson_files/', blank=True, null=True, verbose_name="Файл (Видео/Документ)")
    
    # Твой крутой JSON сценарий для симуляций фишинга
    scenario_data = models.JSONField(
        blank=True, 
        null=True, 
        verbose_name="Сценарий симуляции (JSON)",
        help_text="Заполняется только для симуляций"
    )

    order = models.PositiveIntegerField(default=0, verbose_name="Порядок шага")

    class Meta:
        verbose_name = "Шаг урока"
        verbose_name_plural = "Шаги уроков"
        ordering = ['order']

    def __str__(self):
        return f"Шаг {self.order} ({self.get_step_type_display()}) - {self.lesson.title}"


# 5. Запись на курс (Без изменений)
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


# 6. ИЗМЕНЕНО: Прогресс теперь трекается по шагам
class StepProgress(models.Model):
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    step = models.ForeignKey(LessonStep, on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False, verbose_name="Пройден")
    completed_at = models.DateTimeField(auto_now_add=True)
    
    # Очки за конкретный квадратик
    score_earned = models.IntegerField(default=0, verbose_name="Полученные очки (XP)")

    class Meta:
        unique_together = ('student', 'step')
        verbose_name = "Прогресс шага"
        verbose_name_plural = "Прогресс шагов"

    def __str__(self):
        return f"{self.student.username} - {self.step}"