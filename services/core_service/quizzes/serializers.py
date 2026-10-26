# Выгрузка сериализаторов для моделей тестов. Сериализаторы преобразуют модели в формат JSON для API и обратно, обеспечивая правильное отображение данных и безопасность
from rest_framework import serializers
# Загрузка таблиц для создания сериализаторов
from .models import Quiz, Question, Choice, Result
from courses.serializers import LessonStepSerializer

# Сериализатор для вариантов ответа
# ModelSerializer автоматически создает поля на основе модели Choice.
class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'text', 'is_correct']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        show_answer = False
        
        if request and request.user.is_authenticated:
            if request.user.is_staff:
                show_answer = True
            elif hasattr(instance.question.quiz.lesson.course, 'teacher'):
                if request.user == instance.question.quiz.lesson.course.teacher:
                    show_answer = True

        if not show_answer:
            ret.pop('is_correct', None)
        return ret

# Сериализатор вопросов теста
# choices = ChoiceSerializer(many=True, read_only=True) позволяет вложить список вариантов ответа внутри каждого вопроса при сериализации.
# many=True указывает, что это список, а read_only=True означает, что эти данные не будут изменяться через этот сериализатор 
class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    class Meta:
        model = Question
        fields = ['id', 'text', 'explanation', 'choices']

# Сериализатор тестов
# вызываем сериализатор вопросов внутри сериализатора тестов чтобы получить данные о вопросах вместе с тестом
class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'description', 'questions', 'lesson']

class SubmissionIdField(serializers.IntegerField):
    """IDs in a JSON submission must be integers, not coerced strings or floats."""

    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail('invalid')
        return super().to_internal_value(data)


class AnswerItemSerializer(serializers.Serializer):
    question_id = SubmissionIdField(min_value=1)
    choice_ids = serializers.ListField(
        child=SubmissionIdField(min_value=1),
        allow_empty=True,
    )

    def validate_choice_ids(self, choice_ids):
        if len(choice_ids) != len(set(choice_ids)):
            raise serializers.ValidationError('Выбранный вариант не должен повторяться.')
        return choice_ids


class QuizSubmissionSerializer(serializers.Serializer):
    answers = serializers.ListField(
        child=AnswerItemSerializer(),
        allow_empty=True,
        max_length=50
    )

    def validate_answers(self, answers):
        # Built once from this quiz's prefetched questions and choices by submit.
        question_choices = self.context['question_choices']
        seen_questions = set()
        for index, answer in enumerate(answers):
            question_id = answer['question_id']
            if question_id in seen_questions:
                raise serializers.ValidationError({
                    index: {'question_id': 'Вопрос не должен повторяться.'},
                })
            seen_questions.add(question_id)
            if question_id not in question_choices:
                raise serializers.ValidationError({
                    index: {'question_id': 'Вопрос не принадлежит сдаваемому тесту.'},
                })
            if any(choice_id not in question_choices[question_id] for choice_id in answer['choice_ids']):
                raise serializers.ValidationError({
                    index: {'choice_ids': 'Выбранный вариант не принадлежит указанному вопросу.'},
                })
        return answers


class GeneratePreviewSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField(required=False, min_value=1)
    custom_text = serializers.CharField(required=False, allow_blank=True, max_length=50000)
    count = serializers.IntegerField(default=3, min_value=1, max_value=20)
    difficulty = serializers.ChoiceField(choices=['easy', 'medium', 'hard'], default='medium')
    language = serializers.CharField(default='Русский')


class GeneratedQuestionSerializer(serializers.Serializer):
    question = serializers.CharField()
    explanation = serializers.CharField(required=False, allow_blank=True, default='')
    options = serializers.ListField(child=serializers.CharField(max_length=255), min_length=2)
    correct_index = serializers.ListField(child=serializers.IntegerField(min_value=0), min_length=1)

    def to_internal_value(self, data):
        # Older clients submit one index instead of an array.
        if isinstance(data, dict) and isinstance(data.get('correct_index'), (int, str)):
            data = {**data, 'correct_index': [data['correct_index']]}
        return super().to_internal_value(data)

    def validate(self, attrs):
        if any(index >= len(attrs['options']) for index in attrs['correct_index']):
            raise serializers.ValidationError({'correct_index': 'Индекс ответа вне списка вариантов.'})
        return attrs


class BuilderQuizStepSerializer(LessonStepSerializer):
    """Only the quiz-step fields included in an atomic builder save."""

    title = serializers.CharField(allow_blank=True, max_length=255)
    content = serializers.CharField(allow_blank=True, trim_whitespace=False)
    step_type = serializers.ChoiceField(choices=['quiz'])
    scenario_data = serializers.DictField()

    class Meta(LessonStepSerializer.Meta):
        fields = ['title', 'content', 'step_type', 'scenario_data']
        extra_kwargs = {}

    def validate_scenario_data(self, value):
        if 'quiz_id' in value and (type(value['quiz_id']) is not int or value['quiz_id'] < 1):
            raise serializers.ValidationError('Идентификатор теста должен быть положительным целым числом.')
        return value


class SaveGeneratedSerializer(serializers.Serializer):
    lesson_id = serializers.IntegerField(min_value=1)
    quiz_id = serializers.IntegerField(required=False, min_value=1)
    quiz_title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    questions = GeneratedQuestionSerializer(many=True, allow_empty=False)
    step_id = SubmissionIdField(required=False, min_value=1)
    step = BuilderQuizStepSerializer(required=False)

    def validate(self, attrs):
        if ('step_id' in attrs) != ('step' in attrs):
            raise serializers.ValidationError('Поля step_id и step необходимо передавать вместе.')
        return attrs

# Сериализатор для отображения результатов теста после сдачи
class QuizResultSerializer(serializers.ModelSerializer):
    # Безопасное получение названия теста. Если тест удален, вернем null или заглушку.
    quiz_title = serializers.ReadOnlyField(source='quiz.title')
    class Meta:
        model = Result
        fields = ['id', 'quiz_title', 'score', 'completed_at']

# Сериализатор для отображения результатов тестов конкретного пользователя
class MyResultSerializer(serializers.ModelSerializer):
    # Безопасное получение ID теста. Если тест удален, вернем null или заглушку.
    quiz_id = serializers.IntegerField(source='quiz.id', read_only=True)
    #  MethodField позволяет нам создать кастомное поле для получения названия теста с проверкой на существование теста и его связей
    quiz_title = serializers.SerializerMethodField()
    lesson_title = serializers.SerializerMethodField()
    course_title = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = ['id', 'score', 'completed_at', 'quiz_id', 'quiz_title', 'lesson_title', 'course_title']
    # Метод для получения названия теста с проверкой на существование теста и его связей. Если тест удален, возвращаем заглушку "Тест удален".
    # obj - это экземпляр модели Result, который мы сериализуем. Мы проверяем наличие связанного теста и возвращаем его название или заглушку, если тест удален.
    # self - это экземпляр сериализатора, который позволяет нам использовать методы и поля внутри класса сериализатора. В данном случае мы используем self для вызова метода get_quiz_title внутри сериализатора.
    def get_quiz_title(self, obj):
        return obj.quiz.title if obj.quiz else "Тест удален"
    # Метод для получения названия урока с проверкой на существование теста и его связей. Если тест или урок удалены, возвращаем None.
    def get_lesson_title(self, obj):
        # Цепочка проверок: Result -> Quiz -> Lesson
        if obj.quiz and obj.quiz.lesson:
            # Если тест и урок существуют, возвращаем название урока
            return obj.quiz.lesson.title
        # Если тест или урок удалены, возвращаем None
        return None
    # Метод для получения названия курса с проверкой на существование теста и его связей. Если тест, урок или курс удалены, возвращаем None.
    def get_course_title(self, obj):
        # Цепочка: Result -> Quiz -> Lesson -> Course
        if obj.quiz and obj.quiz.lesson and obj.quiz.lesson.course:
            # Если тест, урок и курс существуют, возвращаем название курса
            return obj.quiz.lesson.course.title
        # Если тест, урок или курс удалены, возвращаем None
        return None
