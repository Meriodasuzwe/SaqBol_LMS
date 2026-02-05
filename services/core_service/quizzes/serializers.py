from rest_framework import serializers
from .models import Quiz, Question, Choice, Result

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        # ВАЖНО: Убрали 'is_correct', чтобы студент не видел правильный ответ в коде страницы
        fields = ['id', 'text'] 

class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id', 'text', 'choices']

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'description', 'questions']

class QuizSubmissionSerializer(serializers.Serializer):
    answers = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField()),
        min_length=1,
        max_length=50  # Ограничиваем количество ответов для безопасности
    )
    
    def validate_answers(self, value):
        """Валидация структуры ответов"""
        for answer in value:
            if 'choice_id' not in answer or 'question_id' not in answer:
                raise serializers.ValidationError(
                    "Каждый ответ должен содержать 'choice_id' и 'question_id'"
                )
        return value

class QuizResultSerializer(serializers.ModelSerializer):
    quiz_title = serializers.ReadOnlyField(source='quiz.title')
    class Meta:
        model = Result
        # Возвращаем дату завершения сразу после сдачи
        fields = ['id', 'quiz_title', 'score', 'completed_at']

# Сериализатор для ПРОФИЛЯ
class MyResultSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='quiz.lesson.title', read_only=True)
    course_title = serializers.CharField(source='quiz.lesson.course.title', read_only=True)

    class Meta:
        model = Result
        # Используем completed_at, как в твоей базе
        fields = ['id', 'score', 'completed_at', 'lesson_title', 'course_title']