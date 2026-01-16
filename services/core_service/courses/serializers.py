from rest_framework import serializers
from .models import Course, Lesson, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'video_url', 'order']

class CourseSerializer(serializers.ModelSerializer):
    # Показываем название категории вместо ID
    category_title = serializers.ReadOnlyField(source='category.title')
    # Показываем имя преподавателя
    teacher_name = serializers.ReadOnlyField(source='teacher.username')
    # Вкладываем уроки (используем тот самый related_name='lessons')
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'price', 'category_title', 'teacher_name', 'lessons']