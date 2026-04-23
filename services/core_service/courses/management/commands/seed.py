import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from courses.models import Category, Course, Lesson, LessonStep, Enrollment, StepProgress, Review

User = get_user_model()

class Command(BaseCommand):
    help = 'Заполняет базу данных тестовыми курсами, пользователями и прогрессом (Seed)'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Начинаю генерацию данных...'))

        # 1. Создаем пользователей
        teacher, _ = User.objects.get_or_create(username='teacher_pro', defaults={
            'email': 'teacher@saqbol.kz', 'first_name': 'Иван', 'last_name': 'Преподавателев'
        })
        if not teacher.check_password('password123'):
            teacher.set_password('password123')
            teacher.save()

        students = []
        for i in range(1, 16):
            student, _ = User.objects.get_or_create(username=f'student_{i}', defaults={
                'email': f'student{i}@saqbol.kz', 'first_name': f'Студент', 'last_name': f'Тестовый {i}'
            })
            if not student.check_password('password123'):
                student.set_password('password123')
                student.save()
            students.append(student)
        
        self.stdout.write(self.style.SUCCESS(f'✅ Создано: 1 препод, 15 студентов.'))

        # 2. Создаем категории
        cat_ib, _ = Category.objects.get_or_create(title="Информационная безопасность", description="Основы защиты данных")
        cat_dev, _ = Category.objects.get_or_create(title="Программирование", description="Разработка и код")
        cat_law, _ = Category.objects.get_or_create(title="Законодательство РК", description="Нормативы и законы")

        # 3. Создаем курсы
        courses_data = [
            {
                'title': 'Защита от фишинга в корпоративной среде',
                'cat': cat_ib,
                'desc': 'Научитесь распознавать фишинговые письма и защищать корпоративные данные.',
                'price': 0.00
            },
            {
                'title': 'Основы Python для безопасников',
                'cat': cat_dev,
                'desc': 'Базовый синтаксис, скрипты для автоматизации рутины ИБ-специалиста.',
                'price': 15000.00
            },
            {
                'title': 'Закон о персональных данных РК (ПП №832)',
                'cat': cat_law,
                'desc': 'Разбор жизненного цикла ИС и стандартов безопасности для работы в GovTech.',
                'price': 5000.00
            }
        ]

        created_courses = []
        for data in courses_data:
            course, _ = Course.objects.get_or_create(
                title=data['title'],
                defaults={
                    'category': data['cat'],
                    'teacher': teacher,
                    'short_description': data['desc'],
                    'description': f'<p>{data["desc"]}</p><p>Этот курс сгенерирован автоматически.</p>',
                    'price': data['price'],
                    'status': 'published'
                }
            )
            created_courses.append(course)
            
            # Если у курса еще нет уроков, создаем их
            if not course.lessons.exists():
                for lesson_idx in range(1, 4):
                    lesson = Lesson.objects.create(
                        course=course,
                        title=f'Модуль {lesson_idx}: Введение и теория',
                        order=lesson_idx
                    )
                    
                    # Шаг 1: Текст
                    LessonStep.objects.create(
                        lesson=lesson, title='Теоретическая база', step_type='text',
                        content='Здесь очень важный текст. **Markdown** поддерживается.', order=1
                    )
                    # Шаг 2: Видео
                    LessonStep.objects.create(
                        lesson=lesson, title='Видео-лекция', step_type='video_url',
                        content='https://www.youtube.com/watch?v=dQw4w9WgXcQ', order=2
                    )
                    # Шаг 3: Тест или Симуляция
                    step_type = random.choice(['quiz', 'simulation_email', 'interactive_code'])
                    LessonStep.objects.create(
                        lesson=lesson, title='Практика', step_type=step_type,
                        content='Выполните задание ниже.', order=3,
                        scenario_data={"question": "Что делать при фишинге?", "options": ["Удалить", "Кликнуть"]}
                    )

        self.stdout.write(self.style.SUCCESS(f'✅ Создано: 3 курса, уроки и шаги.'))

        # 4. Зачисляем студентов и генерируем прогресс
        for course in created_courses:
            steps = list(LessonStep.objects.filter(lesson__course=course))
            
            # Берем случайных 10 студентов на каждый курс
            enrolled_students = random.sample(students, 10)
            
            for student in enrolled_students:
                # Зачисляем
                Enrollment.objects.get_or_create(student=student, course=course)
                
                # Генерируем случайный прогресс (кто-то прошел 1 шаг, кто-то все)
                steps_to_complete = random.randint(0, len(steps))
                for step in steps[:steps_to_complete]:
                    StepProgress.objects.get_or_create(
                        student=student, 
                        step=step, 
                        defaults={'is_completed': True, 'score_earned': random.randint(10, 50)}
                    )
                
                # Если прошел больше половины, возможно оставил отзыв
                if steps_to_complete > len(steps) // 2 and random.choice([True, False]):
                    Review.objects.get_or_create(
                        course=course,
                        user=student,
                        defaults={
                            'rating': random.randint(4, 5),
                            'text': random.choice(['Отличный курс!', 'Очень полезно, спасибо.', 'Узнал много нового про ИБ.'])
                        }
                    )

        self.stdout.write(self.style.SUCCESS('✅ Сгенерированы зачисления, прогресс и отзывы.'))
        self.stdout.write(self.style.SUCCESS('🎉 База успешно заполнена (Seed completed)!'))