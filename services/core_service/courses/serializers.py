from rest_framework import serializers
from .models import Course, Lesson, Category, LessonProgress

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        # ДОБАВИЛИ: lesson_type и scenario_data
        fields = ['id', 'title', 'content', 'video_url', 'order', 'course', 'lesson_type', 'scenario_data']
        
        extra_kwargs = {
            'video_url': {'required': False, 'allow_blank': True},
            'content': {'required': False, 'allow_blank': True},
            'scenario_data': {'required': False}, # JSON может быть пустым
        }

class CourseSerializer(serializers.ModelSerializer):
    category_title = serializers.ReadOnlyField(source='category.title')
    teacher_name = serializers.ReadOnlyField(source='teacher.username')
    lessons = LessonSerializer(many=True, read_only=True)
    
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        write_only=True
    )

    progress = serializers.SerializerMethodField()

    class Meta:
        model = Course
        # --- ДОБАВИЛ short_description И cover_image В СПИСОК ПОЛЕЙ ---
        fields = [
            'id', 'title', 'description', 
            'short_description', 'cover_image', 
            'price', 'category', 'category_title', 
            'teacher_name', 'lessons', 'progress'
        ]

    def create(self, validated_data):
        return Course.objects.create(**validated_data)

    def get_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        
        total_lessons = obj.lessons.count()
        if total_lessons == 0:
            return 0
            
        completed_lessons = LessonProgress.objects.filter(
            student=request.user, 
            lesson__course=obj,
            is_completed=True
        ).count()
        
        return int((completed_lessons / total_lessons) * 100)