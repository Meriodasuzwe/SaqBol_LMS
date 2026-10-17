# Этот импорт нужен для работы с AI-сервисом
import requests
from django.conf import settings
from django.shortcuts import get_object_or_404
# Стандартные импорты Django и DRF
from django.db import transaction
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
from .grading import calculate_submission_score
# Импорт модели Lesson для получения контента урока при генерации тестов через AI
from courses.models import Lesson
from .serializers import (
    QuizSerializer, 
    QuizSubmissionSerializer, 
    QuizResultSerializer, 
    MyResultSerializer,
    GeneratePreviewSerializer,
    SaveGeneratedSerializer,
)

# 1. ОБЫЧНЫЙ СПИСОК (для админки или общих целей)
class QuizListView(generics.ListAPIView):
    queryset = Quiz.objects.all().order_by('-id')
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

# 2. Получение тестов по конкретному уроку
class QuizByLessonView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        lesson_id = self.kwargs.get('lesson_id')
        if lesson_id:
            return Quiz.objects.filter(lesson_id=lesson_id).order_by('id')
        return Quiz.objects.none()

# 3. Детальный просмотр теста по ID теста
class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

# 4. Сдача теста
class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(request=QuizSubmissionSerializer, responses={200: QuizResultSerializer})
    def post(self, request, quiz_id):
        questions = Question.objects.filter(quiz_id=quiz_id).prefetch_related('choices')
        question_choices = {
            question.id: {choice.id: choice.is_correct for choice in question.choices.all()}
            for question in questions
        }
        if not question_choices:
            return Response({'error': 'В тесте нет вопросов'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = QuizSubmissionSerializer(
            data=request.data, context={'question_choices': question_choices},
        )
        serializer.is_valid(raise_exception=True)
        response_data = calculate_submission_score(question_choices, serializer.validated_data['answers'])

        # No result records are written until the entire submission is validated.
        Result.objects.create(student=request.user, quiz_id=quiz_id, score=response_data['score'])
        return Response(response_data, status=status.HTTP_200_OK)

# 5. Результаты пользователя
class MyQuizResultsView(generics.ListAPIView):
    serializer_class = MyResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Result.objects.filter(student=self.request.user).order_by('-completed_at')

# --- AI ФУНКЦИОНАЛ ---
class GeneratePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not settings.AI_ENABLED:
            return Response({'error': 'AI-функции сейчас отключены.'}, status=503)

        serializer = GeneratePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lesson_id = data.get('lesson_id')
        custom_text = data.get('custom_text')
        content = ""

        if custom_text and len(custom_text) > 5:
            content = custom_text
        elif lesson_id:
            lesson = get_object_or_404(Lesson.objects.select_related('course'), id=lesson_id)
            if not (lesson.course.teacher_id == request.user.id or request.user.is_superuser or request.user.role == 'admin'):
                raise PermissionDenied('Только автор курса может генерировать тесты по уроку.')
            content = '\n\n'.join(
                lesson.steps.filter(step_type='text').exclude(content='')
                .order_by('order', 'id').values_list('content', flat=True)
            )
        else:
            return Response({"error": "Введите текст или выберите урок"}, status=400)

        if not content or len(content) < 10:
            return Response({"error": "Слишком короткий текст"}, status=400)
        if len(content) > 50000:
            return Response({'error': 'Текст не должен превышать 50000 символов.'}, status=400)

        try:
            ai_url = f"{settings.AI_SERVICE_URL.rstrip('/')}/generate-quiz"
            payload = {"text": content, "count": data['count'], "difficulty": data['difficulty'], "language": data['language']}
            response = requests.post(
                ai_url, json=payload, timeout=60,
                headers={'Authorization': request.headers.get('Authorization', '')},
            )
            
            if response.status_code != 200:
                return Response({"error": "AI-сервис вернул ошибку"}, status=503)
            
            return Response(response.json(), status=200)
        except (requests.exceptions.RequestException, ValueError):
            return Response({"error": "Сервер ИИ временно недоступен"}, status=503)

class SaveGeneratedView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        serializer = SaveGeneratedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lesson = get_object_or_404(Lesson.objects.select_related('course'), id=data['lesson_id'])
        if not (lesson.course.teacher_id == request.user.id or request.user.is_superuser or request.user.role == 'admin'):
            raise PermissionDenied('Только автор курса может сохранять тесты.')

        quiz_id = data.get('quiz_id')
        quiz_title = data.get('quiz_title')
        if quiz_id:
            quiz = get_object_or_404(Quiz.objects.select_for_update(), id=quiz_id, lesson=lesson)
            if quiz_title:
                quiz.title = quiz_title
                quiz.save(update_fields=['title'])
            quiz.questions.all().delete()
        else:
            quiz = Quiz.objects.create(title=quiz_title or f'Тест: {lesson.title}', lesson=lesson)

        # Validate the entire payload before replacing existing content. Database
        # failures escape the transaction so the previous quiz is restored.
        for item in data['questions']:
            question = Question.objects.create(
                quiz=quiz, text=item['question'], explanation=item['explanation'],
            )
            Choice.objects.bulk_create([
                Choice(question=question, text=option, is_correct=index in item['correct_index'])
                for index, option in enumerate(item['options'])
            ])
        return Response({'message': 'Тест сохранен', 'quiz_id': quiz.id}, status=201)
