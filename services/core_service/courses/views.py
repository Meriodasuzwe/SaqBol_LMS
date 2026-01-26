from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from .models import Category, Course, Enrollment, Lesson  
from .serializers import CategorySerializer, CourseSerializer, LessonSerializer
from rest_framework.exceptions import PermissionDenied

# Список всех категорий
class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# Список курсов: видеть могут все
class CourseListView(generics.ListAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# Детали курса (уроки): только для авторизованных
class CourseDetailView(generics.RetrieveAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        course = super().get_object()
        user = self.request.user
        
        # Проверяем: записан ли текущий пользователь на этот курс?
        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)

        # Логика защиты: если не препод и не записан — доступа к урокам нет
        if not (is_enrolled or is_teacher):
            raise PermissionDenied("Вы не записаны на этот курс!")
        
        return course

class LessonDetailView(generics.RetrieveAPIView):
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [IsAuthenticated]