from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404
# ОБНОВЛЕНЫ ИМПОРТЫ
from .models import Category, Course, Enrollment, Lesson, LessonStep, StepProgress
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer, LessonStepSerializer
from quizzes.models import Quiz, Result

class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class CourseListView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Course.objects.all()
        search_query = self.request.query_params.get('search', None)
        category_id = self.request.query_params.get('category', None)

        if search_query:
            queryset = queryset.filter(title__icontains=search_query)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_object(self):
        course = super().get_object()
        if self.request.method in permissions.SAFE_METHODS:
            return course

        if course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Только преподаватель может редактировать этот курс.")
        return course

class EnrollCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        enrollment, created = Enrollment.objects.get_or_create(student=request.user, course=course)
        
        if created:
            return Response({"message": "Вы успешно записались!"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "Вы уже записаны на этот курс"}, status=status.HTTP_200_OK)


class LessonListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        course = get_object_or_404(Course, id=course_id)
        user = self.request.user

        if course.teacher == user or user.is_staff:
            return Lesson.objects.filter(course_id=course_id).order_by('order')

        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        if not is_enrolled:
            raise PermissionDenied("Вы не записаны на этот курс. Сначала запишитесь.")

        return Lesson.objects.filter(course_id=course_id).order_by('order')

    def perform_create(self, serializer):
        course = get_object_or_404(Course, id=self.kwargs.get('course_id'))
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
            if not (is_enrolled or is_teacher or user.is_staff):
                raise PermissionDenied("Доступ к уроку запрещен. Запишитесь на курс.")
        else:
            if not is_teacher and not user.is_staff:
                raise PermissionDenied("Редактировать урок может только автор.")
        return lesson

# ДОБАВЛЕНО: View для создания шагов
class LessonStepCreateView(generics.CreateAPIView):
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        lesson = get_object_or_404(Lesson, id=self.kwargs['lesson_id'])
        if lesson.course.teacher != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("Только преподаватель может добавлять шаги.")
        serializer.save(lesson=lesson)


class MyCoursesView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'teacher' or user.role == 'admin' or user.is_staff:
            return Course.objects.filter(teacher=user)
        
        enrolled_course_ids = Enrollment.objects.filter(student=user).values_list('course_id', flat=True)
        return Course.objects.filter(id__in=enrolled_course_ids)


# ОБНОВЛЕНО: Отмечаем пройденным ШАГ, а не урок. Логика Quiz сохранена!
class MarkStepCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        step = get_object_or_404(LessonStep, pk=pk)
        user = request.user
        score = request.data.get('score', 10)

        # Проверяем квизы, привязанные к родителю-уроку
        if not (step.lesson.course.teacher == user or user.is_staff):
            quizzes = Quiz.objects.filter(lesson=step.lesson)
            if quizzes.exists():
                passed = Result.objects.filter(student=user, quiz__in=quizzes, score__gte=70).exists()
                if not passed:
                    return Response({"error": "Сначала нужно успешно пройти тесты для этого урока (минимум 70%)."}, status=status.HTTP_400_BAD_REQUEST)

        progress, created = StepProgress.objects.update_or_create(
            student=user,
            step=step,
            defaults={'score_earned': score, 'is_completed': True}
        )

        return Response({"message": "Шаг пройден!", "score_earned": score}, status=status.HTTP_200_OK)


# ОБНОВЛЕНО: Чтобы AI генератор не сломался
class BulkCreateCourseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        title = data.get('course_title')
        description = data.get('course_description', '')
        lessons_data = data.get('lessons', [])

        if not title:
            return Response({'error': 'Название курса обязательно'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category = Category.objects.first()
            if not category:
                category = Category.objects.create(title="Сгенерированные AI")

            course = Course.objects.create(
                title=title, 
                description=description,
                teacher=request.user,
                category=category 
            )

            # Создаем уроки, а внутрь каждого сразу кидаем текстовый шаг
            for i, lesson_data in enumerate(lessons_data):
                lesson = Lesson.objects.create(
                    course=course,
                    title=lesson_data.get('title', 'Без названия'),
                    order=i + 1
                )
                
                # Создаем шаг с контентом
                LessonStep.objects.create(
                    lesson=lesson,
                    step_type='text',
                    content=lesson_data.get('content', ''),
                    order=1
                )

            return Response({
                'message': 'Курс успешно создан!', 
                'course_id': course.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"🔥 ОШИБКА СОХРАНЕНИЯ В БД: {str(e)}") 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LessonStepDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LessonStep.objects.all()
    serializer_class = LessonStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Разрешаем учителю удалять и изменять только свои шаги
        if self.request.user.is_staff:
            return LessonStep.objects.all()
        return LessonStep.objects.filter(lesson__course__teacher=self.request.user)