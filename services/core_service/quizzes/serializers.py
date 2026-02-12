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
    lesson_title = serializers.CharField(source='quiz.lesson.title', read_only=True)
    course_title = serializers.CharField(source='quiz.lesson.course.title', read_only=True)
    class Meta:
        model = Result
        fields = ['id', 'score', 'completed_at', 'lesson_title', 'course_title']