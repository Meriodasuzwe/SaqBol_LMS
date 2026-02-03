from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import Category, Course, Enrollment, Lesson,LessonProgress
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer

# ==========================================
# 1. КАТЕГОРИИ
# ==========================================
# (Обновил до ListCreate, чтобы работала твоя админка категорий на фронте)
class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


# ==========================================
# 2. КУРСЫ
# ==========================================

class CourseListView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # Начинаем со всех курсов
        queryset = Course.objects.all()
        
        # Получаем параметры из URL (например: ?search=python&category=1)
        search_query = self.request.query_params.get('search', None)
        category_id = self.request.query_params.get('category', None)

        # 1. Фильтр по названию (поиск)
        if search_query:
            # icontains = ищет вхождение без учета регистра (Python, python, PYTHON)
            queryset = queryset.filter(title__icontains=search_query)
        
        # 2. Фильтр по категории
        if category_id:
            queryset = queryset.filter(category_id=category_id)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

# Детали курса (Лендинг пейдж)
class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        course = super().get_object()
        
        # ЛОГИКА STEPIK:
        # Если это GET запрос (просмотр) - разрешаем всем авторизованным.
        # Мы хотим, чтобы незаписанный студент увидел описание и кнопку "Записаться".
        if self.request.method in permissions.SAFE_METHODS:
            return course

        # Если это PUT/DELETE (редактирование) - проверяем права автора
        if course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Только преподаватель может редактировать этот курс.")
        
        return course


# ==========================================
# 3. ЗАПИСЬ НА КУРС (НОВОЕ)
# ==========================================
class EnrollCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        
        # Создаем запись. get_or_create защищает от дублей.
        enrollment, created = Enrollment.objects.get_or_create(
            student=request.user,
            course=course
        )
        
        if created:
            return Response({"message": "Вы успешно записались!"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "Вы уже записаны на этот курс"}, status=status.HTTP_200_OK)


# ==========================================
# 4. УРОКИ (Защищенный контент)
# ==========================================

class LessonListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        course = get_object_or_404(Course, id=course_id)
        user = self.request.user

        # 1. Если это Преподаватель или Админ - показываем всё
        if course.teacher == user or user.is_staff:
            return Lesson.objects.filter(course_id=course_id).order_by('order')

        # 2. Если это Студент - проверяем запись
        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        
        if not is_enrolled:
            # ВОТ ОНА, ЗАЩИТА КОНТЕНТА.
            # Если не записан — выкидываем 403 ошибку. 
            # Фронтенд увидит эту ошибку и поймет, что нужно показать Лендинг, а не Уроки.
            raise PermissionDenied("Вы не записаны на этот курс. Сначала запишитесь.")

        return Lesson.objects.filter(course_id=course_id).order_by('order')

    def perform_create(self, serializer):
        course_id = self.kwargs.get('course_id')
        course = Course.objects.get(id=course_id)
        
        # Создавать уроки может только автор
        if course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Вы не являетесь автором этого курса.")
            
        serializer.save(course=course)


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

        if self.request.method in permissions.SAFE_METHODS:
            # Читать урок может только записанный студент или автор
            if not (is_enrolled or is_teacher or user.is_staff):
                raise PermissionDenied("Доступ к уроку запрещен. Запишитесь на курс.")
        else:
            # Редактировать только автор
            if not is_teacher and not user.is_staff:
                raise PermissionDenied("Редактировать урок может только автор.")

        return lesson

class MyCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # 1. Если это ПРЕПОДАВАТЕЛЬ (или Админ) -> Показываем созданные им курсы
        if user.role == 'teacher' or user.role == 'admin' or user.is_staff:
            return Course.objects.filter(teacher=user)
        
        # 2. Если это СТУДЕНТ -> Показываем курсы, где он есть в Enrollment
        
        # Шаг А: Получаем список ID курсов, на которые записан студент
        enrolled_course_ids = Enrollment.objects.filter(student=user).values_list('course_id', flat=True)
        
        # Шаг Б: Достаем сами курсы по этим ID
        return Course.objects.filter(id__in=enrolled_course_ids)

class MarkLessonCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        lesson = get_object_or_404(Lesson, pk=pk)
        
        # 1. Получаем очки из запроса (если фронтенд их прислал)
        # Если очков нет (обычный урок), ставим 10 по умолчанию
        score = request.data.get('score', 10)

        # 2. Обновляем или создаем запись о прогрессе
        # update_or_create позволяет перезаписать лучший результат, если нужно
        progress, created = LessonProgress.objects.update_or_create(
            student=request.user, 
            lesson=lesson,
            defaults={'score_earned': score, 'is_completed': True} 
        )
        
        return Response({
            "message": "Урок пройден!", 
            "score_earned": score
        }, status=status.HTTP_200_OK)