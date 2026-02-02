from rest_framework import serializers
from .models import Course, Lesson, Category,LessonProgress

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title']

class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'content', 'video_url', 'order','course']
        
        extra_kwargs = {
            'video_url': {'required': False, 'allow_blank': True}, # Разрешаем пустую ссылку
            'content': {'required': False, 'allow_blank': True},   # Разрешаем пустой текст
        }

class CourseSerializer(serializers.ModelSerializer):
    category_title = serializers.ReadOnlyField(source='category.title')
    teacher_name = serializers.ReadOnlyField(source='teacher.username')
    lessons = LessonSerializer(many=True, read_only=True)
    
    # Поле для записи (принимает ID)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        write_only=True
    )

    # 👇 НОВОЕ ПОЛЕ: Вычисляемый прогресс (только чтение)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Course
        # Добавил 'progress' в список полей
        fields = ['id', 'title', 'description', 'price', 'category', 'category_title', 'teacher_name', 'lessons', 'progress']

    def create(self, validated_data):
        return Course.objects.create(**validated_data)

    #  ЛОГИКА РАСЧЕТА ПРОГРЕССА
    def get_progress(self, obj):
        # Получаем текущего пользователя из запроса
        request = self.context.get('request')
        
        # Если юзер не залогинен, прогресс 0
        if not request or not request.user.is_authenticated:
            return 0
        
        # 1. Считаем общее количество уроков в курсе
        total_lessons = obj.lessons.count()
        if total_lessons == 0:
            return 0
            
        # 2. Считаем, сколько уроков прошел ЭТОТ студент
        completed_lessons = LessonProgress.objects.filter(
            student=request.user, 
            lesson__course=obj
        ).count()
        
        # 3. Возвращаем процент (целое число)
        return int((completed_lessons / total_lessons) * 100)