from rest_framework import serializers
from .models import Quiz, Question, Choice, Result

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'text'] # is_correct скрыт от студентов

class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id', 'text', 'explanation', 'choices']

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'description', 'questions', 'lesson']

class QuizSubmissionSerializer(serializers.Serializer):
    answers = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField()),
        min_length=1,
        max_length=50
    )

class QuizResultSerializer(serializers.ModelSerializer):
    quiz_title = serializers.ReadOnlyField(source='quiz.title')
    class Meta:
        model = Result
        fields = ['id', 'quiz_title', 'score', 'completed_at']

class MyResultSerializer(serializers.ModelSerializer):
    # Безопасное получение полей. Если тест удален, вернем null или заглушку.
    quiz_id = serializers.IntegerField(source='quiz.id', read_only=True)
    quiz_title = serializers.SerializerMethodField()
    lesson_title = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = ['id', 'score', 'completed_at', 'quiz_id', 'quiz_title', 'lesson_title', 'course_title']

    def get_quiz_title(self, obj):
        return obj.quiz.title if obj.quiz else "Тест удален"

    def get_lesson_title(self, obj):
        # Цепочка проверок: Result -> Quiz -> Lesson
        if obj.quiz and obj.quiz.lesson:
            return obj.quiz.lesson.title
        return None

    def get_course_title(self, obj):
        # Цепочка: Result -> Quiz -> Lesson -> Course
        if obj.quiz and obj.quiz.lesson and obj.quiz.lesson.course:
            return obj.quiz.lesson.course.title
        return None