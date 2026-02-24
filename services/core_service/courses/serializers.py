from rest_framework import serializers
from .models import Course, Lesson, Category, LessonStep, StepProgress

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

class LessonStepSerializer(serializers.ModelSerializer):
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = LessonStep
        fields = ['id', 'title', 'step_type', 'content', 'file', 'scenario_data', 'order', 'is_completed']
        extra_kwargs = {
            'content': {'required': False, 'allow_blank': True},
            'scenario_data': {'required': False}, 
        }

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False

        # 🔥 Локальный импорт решает проблему 500 ошибки (NameError / Circular Import)
        from quizzes.models import Quiz, Result 

        if obj.step_type == 'quiz':
            quizzes = Quiz.objects.filter(lesson=obj.lesson)
            if quizzes.exists():
                # Просто возвращаем True, если тест сдан. Ничего не пишем в базу!
                return Result.objects.filter(student=request.user, quiz__in=quizzes, score__gte=70).exists()
            return False

        # Для обычных шагов
        return StepProgress.objects.filter(
            student=request.user,
            step=obj,
            is_completed=True
        ).exists()
        
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
        
        steps = LessonStep.objects.filter(lesson__course=obj)
        total_steps = steps.count()
        if total_steps == 0:
            return 0
            
        completed_count = 0
        
        # 🔥 Локальный импорт
        from quizzes.models import Quiz, Result

        # 🔥 УМНЫЙ ПОДСЧЕТ ПРОГРЕССА (Учитывает и обычные шаги, и тесты)
        for step in steps:
            if step.step_type == 'quiz':
                quizzes = Quiz.objects.filter(lesson=step.lesson)
                if quizzes.exists() and Result.objects.filter(student=request.user, quiz__in=quizzes, score__gte=70).exists():
                    completed_count += 1
            else:
                if StepProgress.objects.filter(student=request.user, step=step, is_completed=True).exists():
                    completed_count += 1
        
        return int((completed_count / total_steps) * 100)