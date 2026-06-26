from rest_framework import serializers
from django.db.models import Avg 

from .models import Course, Lesson, Category, LessonStep, StepProgress, Review, Certificate, Enrollment, B2BLead

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

        from quizzes.models import Quiz, Result 

        if obj.step_type == 'quiz':
            # Ищем конкретный ID теста, привязанный к этому квадратику
            quiz_id = obj.scenario_data.get('quiz_id') if obj.scenario_data else None
            if quiz_id:
                return Result.objects.filter(student=request.user, quiz_id=quiz_id, score__gte=70).exists()
            return False

        return StepProgress.objects.filter(
            student=request.user,
            step=obj,
            is_completed=True
        ).exists()
        
class LessonSerializer(serializers.ModelSerializer):
    steps = LessonStepSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
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
    average_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    # === НОВЫЕ ПОЛЯ ДЛЯ ЛЕНДИНГА ===
    modules_count = serializers.SerializerMethodField()
    # 🔥 ИЗМЕНЕНИЕ 1: Заменили students_count на enrolled_students_count
    enrolled_students_count = serializers.SerializerMethodField()
    
    # Создаем алиас, чтобы React сразу увидел картинку по ключу image_url
    image_url = serializers.ImageField(source='cover_image', read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 
            'short_description', 'cover_image', 'image_url',
            'price', 'category', 'category_title', 
            'teacher_name', 'lessons', 'progress', 'status',
            'average_rating', 'reviews_count', 
            'is_enrolled', 'modules_count', 'enrolled_students_count' # 🔥 ИЗМЕНЕНИЕ 2: Обновили в fields
        ]

    # Метод для подсчета модулей (уроков)
    def get_modules_count(self, obj):
        return obj.lessons.count() if hasattr(obj, 'lessons') else 0

    # 🔥 ИЗМЕНЕНИЕ 3: Новый метод для подсчета студентов
    def get_enrolled_students_count(self, obj):
        # На всякий случай проверяем оба варианта связи (с related_name и без него)
        if hasattr(obj, 'enrolled_students'):
            return obj.enrolled_students.count()
        elif hasattr(obj, 'enrollment_set'):
            return obj.enrollment_set.count()
        return 0
        
    def create(self, validated_data):
        return Course.objects.create(**validated_data)

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Enrollment.objects.filter(course=obj, student=request.user).exists()
        return False

    def get_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        
        if not Enrollment.objects.filter(course=obj, student=request.user).exists():
            return 0
        
        steps = LessonStep.objects.filter(lesson__course=obj)
        total_steps = steps.count()
        if total_steps == 0:
            return 0
            
        completed_count = 0
        from quizzes.models import Quiz, Result

        for step in steps:
            if step.step_type == 'quiz':
                quiz_id = step.scenario_data.get('quiz_id') if step.scenario_data else None
                if quiz_id and Result.objects.filter(student=request.user, quiz_id=quiz_id, score__gte=70).exists():
                    completed_count += 1
            else:
                if StepProgress.objects.filter(student=request.user, step=step, is_completed=True).exists():
                    completed_count += 1
                    
        return int((completed_count / total_steps) * 100)

    def get_average_rating(self, obj):
        avg = obj.reviews.aggregate(Avg('rating'))['rating__avg']
        return round(avg, 1) if avg else 0.0

    def get_reviews_count(self, obj):
        return obj.reviews.count()
    
class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Review
        fields = ['id', 'user_name', 'rating', 'text', 'created_at']
        
class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = ['id', 'course_title', 'student_name', 'issued_at', 'file', 'is_valid']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}".strip() or obj.student.username

class B2BLeadSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='target_course.title', read_only=True)
    class Meta:
        model = B2BLead
        fields = '__all__'