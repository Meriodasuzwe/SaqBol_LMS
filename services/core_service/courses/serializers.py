from rest_framework import serializers
from .models import Category, Course, Lesson

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ('id', 'title', 'content', 'video_url', 'order')

class CourseSerializer(serializers.ModelSerializer):
    # Добавляем вложенные данные, чтобы сразу видеть уроки и категорию
    category = CategorySerializer(read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)
    teacher_name = serializers.CharField(source='teacher.username', read_only=True)

    class Meta:
        model = Course
        fields = ('id', 'title', 'description', 'price', 'teacher_name', 'category', 'lessons', 'created_at')