from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from .models import Category, Course, Enrollment, Lesson
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer

# 1. Категории (Только чтение)
class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny] # Категории видят все

# 2. Список курсов (Чтение + Создание)
class CourseListView(generics.ListCreateAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        # При создании курса автором автоматически ставится текущий пользователь
        serializer.save(teacher=self.request.user)

# 3. Детали курса (Чтение + Обновление + Удаление)
class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        course = super().get_object()
        user = self.request.user
        
        # Проверки прав доступа
        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)
        is_staff = user.is_staff

        # Если метод безопасный (GET - просто посмотреть)
        if self.request.method in permissions.SAFE_METHODS:
            # Разрешаем, если это учитель курса, админ или записанный студент
            if not (is_enrolled or is_teacher or is_staff):
                raise PermissionDenied("Вы не записаны на этот курс!")
        else:
            # Если метод опасный (PUT, DELETE - редактирование), разрешаем только автору
            if not is_teacher and not is_staff:
                raise PermissionDenied("Только преподаватель может редактировать этот курс.")
        
        return course

# 4. Список уроков КОНКРЕТНОГО курса (Чтение + Создание)
# Этот View нужен для твоего CourseBuilder (список слева + кнопка "Новый урок")
class LessonListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Фильтруем уроки только для того курса, чей ID пришел в URL
        # URL будет выглядеть так: /api/courses/<course_id>/lessons/
        course_id = self.kwargs.get('course_id')
        return Lesson.objects.filter(course_id=course_id)

    def perform_create(self, serializer):
        # При создании урока привязываем его к курсу из URL
        course_id = self.kwargs.get('course_id')
        course = Course.objects.get(id=course_id)
        
        # Проверка: создавать урок может только владелец курса
        if course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Вы не являетесь автором этого курса.")
            
        serializer.save(course=course)

# 5. Детали урока (Чтение + Редактирование)
class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        lesson = super().get_object()
        course = lesson.course
        user = self.request.user

        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)

        # Читать могут студенты и учитель
        if self.request.method in permissions.SAFE_METHODS:
            if not (is_enrolled or is_teacher or user.is_staff):
                raise PermissionDenied("Доступ к уроку запрещен.")
        # Редактировать может только учитель
        else:
            if not is_teacher and not user.is_staff:
                raise PermissionDenied("Редактировать урок может только автор.")

        return lesson