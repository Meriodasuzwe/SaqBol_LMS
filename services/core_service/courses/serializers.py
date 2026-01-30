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
        
        extra_kwargs = {
            'video_url': {'required': False, 'allow_blank': True}, # Разрешаем пустую ссылку
            'content': {'required': False, 'allow_blank': True},   # Разрешаем пустой текст
        }

class CourseSerializer(serializers.ModelSerializer):
    category_title = serializers.ReadOnlyField(source='category.title')
    teacher_name = serializers.ReadOnlyField(source='teacher.username')
    lessons = LessonSerializer(many=True, read_only=True)
    
    # Добавляем это поле, чтобы можно было ПРИНИМАТЬ ID категории при создании
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        write_only=True
    )

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'price', 'category', 'category_title', 'teacher_name', 'lessons']

    # Автоматически назначаем текущего юзера учителем при создании
    def create(self, validated_data):
        return Course.objects.create(**validated_data)