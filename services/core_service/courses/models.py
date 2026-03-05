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
    #  Категория связана через внешний ключ удаление через каскад что бы при удалении все курсы удалялись related имя для удобного доступа к курсам категории verbose_name для отображения в админке
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='courses', verbose_name="Категория")
    # Преподаватель так же связан через внешний ключ вход через auth_user_model удаление аналогично категории и related имя для доступа к курсам преподавателя verbose_name для админки
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taught_courses', verbose_name="Преподаватель")
    # Название курса органичение на 255 символов и verbose_name для админки
    title = models.CharField(max_length=255, verbose_name="Название курса")
    # Краткое описание визитки курса можно оставить пустым Null=true так как это не обязательно verbose_name для админки
    short_description = models.TextField(blank=True, null=True, verbose_name="Краткое описание (визитка)")
    # Поле для ссылки на обложку курса так же не обязательное blank=true null=true verbose_name для админки
    cover_image = models.URLField(blank=True, null=True, verbose_name="Ссылка на обложку")
    # Поле для полного описания курса
    description = models.TextField(verbose_name="Описание курса")
    # Поле для цены курса
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name="Цена")

    # Даты создания и обновления auto_now_add для автоматической установки при создании и auto_now для обновления при каждом сохранении verbose_name для админки
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    

    class Meta:
        # Класс мета для указания дополнительных параметров модели
        verbose_name = "Курс"
        verbose_name_plural = "Курсы"
        
    # Метод dunder str для удобного отображения объектов курса в админке и при отладке возвращает название курса
    def __str__(self):
        return self.title


# 3. Урок (Теперь это просто контейнер для шагов)
class Lesson(models.Model):
    # Урок связан с курсом через внешний ключ и если курс удаляется удаляется все уроки а так же related name для получения всех уроков
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lessons', verbose_name="Курс")
    # Название урока ограничение на 255 символов
    title = models.CharField(max_length=255, verbose_name="Название урока")
    # Порядок урока для сортировки внутри курса
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок урока")

    class Meta:
        # Класс мета для указания дополнительных параметров модели
        verbose_name = "Урок"
        verbose_name_plural = "Уроки"
        # Упорядочение по порядку урока для отображения в правильной последовательности в админке и при выводе уроков курса
        ordering = ['order']
    # Метод dunder str для удобного отображения объектов урока в админке и при отладке возвращает название урока и название курса для контекста
    def __str__(self):
        return f"{self.course.title} - {self.title}"


# 4. Шаг урока  (Теперь объединяет все форматы: текст, видео, симуляции и тесты)
class LessonStep(models.Model):
    # step types для разных форматов контента в уроке текст видео симуляция тест и тд для удобства админки и логики отображения
    STEP_TYPES = (
        ('text', 'Теория (Текст)'),
        ('video_url', 'Видео (YouTube/Ссылка)'),
        ('video_file', 'Локальное видео (Загрузка файла)'), # Важно для ИБ (храним у себя)
        ('simulation_chat', 'Симуляция: Чат (WhatsApp/Telegram)'),
        ('simulation_email', 'Симуляция: Email (Фишинг)'),
        ('quiz', 'Тест/Опрос'),
    )
    # урок связан с шагом через внешний ключ и если урок удаляется удаляются все шаги а так же related name для получения всех шагов урока verbose_name для админки
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='steps', verbose_name="Урок")
    # Заголовок шага (необязательно)
    title = models.CharField(max_length=255, blank=True, verbose_name="Заголовок шага (необязательно)")
    # Тип шага для определения формата контента и логики отображения
    step_type = models.CharField(max_length=20, choices=STEP_TYPES, default='text', verbose_name="Тип шага")
    
    # Текст теории или URL ссылка
    content = models.TextField(verbose_name="Текст/Ссылка", blank=True)

    # Файл для локальной загрузки (видео, PDF) blank разрешение для django admin и форм, null для базы данных verbose_name для админки
    file = models.FileField(upload_to='lesson_files/', blank=True, null=True, verbose_name="Файл (Видео/Документ)")
    
    # Данные для симуляций в формате JSON для хранения сценариев и логики взаимодействия
    scenario_data = models.JSONField(
        blank=True, 
        null=True, 
        verbose_name="Сценарий симуляции (JSON)",
        help_text="Заполняется только для симуляций"
    )
    # Порядок шага для сортировки внутри урока
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок шага")

    class Meta:
        # Класс мета для указания дополнительных параметров модели
        verbose_name = "Шаг урока"
        verbose_name_plural = "Шаги уроков"
        ordering = ['order']
    # Метод dunder str для удобного отображения объектов шага в админке и при отладке возвращает тип шага и название урока для контекста
    def __str__(self):
        return f"Шаг {self.order} ({self.get_step_type_display()}) - {self.lesson.title}"


# 5. Запись на курс (Без изменений)
class Enrollment(models.Model):
    # Студент связан через внешний ключ с моделью пользователя с каскадным удалением и создает часть связи Многие-ко-Многим через таблицу-посредник
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments')
    # Курс который связан через внешний ключ и при удалении курса удаляются все записи на него related name для получения всех записей курса verbose_name для админки
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrolled_students')
    # Дата и время зачисления на курс с автоматической установкой при создании записи verbose_name для админки
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # unique_together для обеспечения уникальности записи на курс для каждого студента (один студент не может записаться на один и тот же курс несколько раз) verbose_name для админки
        unique_together = ('student', 'course')
        verbose_name = "Зачисление"
        verbose_name_plural = "Зачисления"

    def __str__(self):
        return f"{self.student.username} -> {self.course.title}"


# 6. Прогресс по шагам урока для каждого студента (Новая модель для отслеживания прогресса и начисления очков за каждый шаг)
class StepProgress(models.Model):
    # Студент связанный через внешний ключ с моделью пользователя с каскадным удалением и related name для получения всех прогрессов студента verbose_name для админки
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    # Шаг урока связанный через внешний ключ с моделью шага урока с каскадным удалением и related name для получения всех прогрессов по шагу verbose_name для админки
    step = models.ForeignKey(LessonStep, on_delete=models.CASCADE)
    # Флаг для отслеживания завершенности шага по умолчанию False verbose_name для админки
    is_completed = models.BooleanField(default=False, verbose_name="Пройден")
    # Дата и время завершения шага с автоматической установкой при создании записи verbose_name для админки
    completed_at = models.DateTimeField(auto_now_add=True)
    
    # Очки за конкретный квадратик
    score_earned = models.IntegerField(default=0, verbose_name="Полученные очки (XP)")

    class Meta:
        unique_together = ('student', 'step')
        verbose_name = "Прогресс шага"
        verbose_name_plural = "Прогресс шагов"

    def __str__(self):
        return f"{self.student.username} - {self.step}"