from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from .models import Category, Course
from .serializers import CategorySerializer, CourseSerializer
from rest_framework.exceptions import PermissionDenied

# Список всех категорий
class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# Список курсов: видеть могут все (ReadOnly), но менять ничего нельзя
class CourseListView(generics.ListAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# Детали курса (уроки): только для авторизованных пользователей
class CourseDetailView(generics.RetrieveAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        course = super().get_object()
        # Проверяем: записан ли текущий пользователь на этот курс?
        # Если это не преподаватель этого курса и не записанный студент — от ворот поворот
        user = self.request.user
        is_enrolled = Enrollment.objects.filter(student=user, course=course).exists()
        is_teacher = (course.teacher == user)

        if not (is_enrolled or is_teacher):
            raise PermissionDenied("Вы не записаны на этот курс!")
        
        return course