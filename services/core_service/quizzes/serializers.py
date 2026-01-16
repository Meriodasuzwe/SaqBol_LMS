from rest_framework import serializers
from .models import Quiz, Question, Choice, Result

class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'text', 'is_correct']

class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True) # Вложенные ответы

    class Meta:
        model = Question
        fields = ['id', 'text', 'choices']

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True) # Вложенные вопросы

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'description', 'questions']

class QuizSubmissionSerializer(serializers.Serializer):
    # Ожидаем список ответов в формате: {"question_id": 1, "choice_id": 5}
    answers = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("Список ответов не может быть пустым.")
        return value