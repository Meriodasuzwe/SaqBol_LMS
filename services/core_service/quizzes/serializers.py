# Выгрузка сериализаторов для моделей тестов. Сериализаторы преобразуют модели в формат JSON для API и обратно, обеспечивая правильное отображение данных и безопасность
from rest_framework import serializers
# Загрузка таблиц для создания сериализаторов
from .models import Quiz, Question, Choice, Result

# Сериализатор для вариантов ответа
# ModelSerializer автоматически создает поля на основе модели Choice.
class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        # Поле is_correct не включается в сериализатор, чтобы студенты не видели правильные ответы при получении данных теста.
        fields = ['id', 'text'] # is_correct скрыт от студентов

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

# Сериализатор для отправки ответов на тест
# serializers.Serializer используется потому что answers не сохраняется в базу в таком виде это просто форма проверки данных
class QuizSubmissionSerializer(serializers.Serializer):
    # Внутри списка должны быть словари а внутри словарей должны быть целые числа для question_id и choice_id
    answers = serializers.ListField(
        # child указывает, что каждый элемент списка должен быть словарем с определенными полями и типами данных
        child=serializers.DictField(child=serializers.IntegerField()),
        min_length=1,
        max_length=50
    )

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