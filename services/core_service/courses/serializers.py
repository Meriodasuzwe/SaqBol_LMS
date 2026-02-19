from rest_framework import serializers
from .models import Course, Lesson, Category, LessonStep, StepProgress

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

# ДОБАВЛЕНО: Сериализатор для шагов
class LessonStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonStep
        fields = ['id', 'title', 'step_type', 'content', 'file', 'scenario_data', 'order']
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
            'scenario_data': {'required': False}, 
        }

class LessonSerializer(serializers.ModelSerializer):
    # ДОБАВЛЕНО: Вкладываем шаги внутрь урока (матрешка)
    steps = LessonStepSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        # Убрали content и video_url (они теперь в шагах), добавили steps
        fields = ['id', 'title', 'order', 'course', 'steps']

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
        
        # ОБНОВЛЕНО: Считаем прогресс по шагам, а не урокам
        total_steps = LessonStep.objects.filter(lesson__course=obj).count()
        if total_steps == 0:
            return 0
            
        completed_steps = StepProgress.objects.filter(
            student=request.user, 
            step__lesson__course=obj,
            is_completed=True
        ).count()
        
        return int((completed_steps / total_steps) * 100)