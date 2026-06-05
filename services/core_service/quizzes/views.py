# Этот импорт нужен для работы с AI-сервисом
import requests
# Стандартные импорты Django и DRF
from django.db import transaction
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
# Импорт модели Lesson для получения контента урока при генерации тестов через AI
from courses.models import Lesson
from .serializers import (
    QuizSerializer, 
    QuizSubmissionSerializer, 
    QuizResultSerializer, 
    MyResultSerializer
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
        serializer = QuizSubmissionSerializer(data=request.data)
        if serializer.is_valid():
            answers = serializer.validated_data.get('answers')
            questions = Question.objects.filter(quiz_id=quiz_id)
            total_questions = questions.count()
            
            if total_questions == 0:
                return Response({"error": "В тесте нет вопросов"}, status=400)

            correct_answers_count = 0
            # Словарь для хранения правильных ответов { question_id: [id1, id2, ...] }
            correct_answers_ids = {}

            for ans in answers:
                question_id = ans.get('question_id')
                choice_ids = ans.get('choice_ids', [])

                # Получаем все правильные ID для этого вопроса
                correct_ids = set(
                    Choice.objects.filter(question_id=question_id, is_correct=True)
                    .values_list('id', flat=True)
                )

                # Строгая проверка: выбранное множество должно точно совпадать с правильным
                is_correct = set(choice_ids) == correct_ids
                if is_correct:
                    correct_answers_count += 1

                # Сохраняем правильные ID для фронта
                correct_answers_ids[question_id] = list(correct_ids)

            score = int((correct_answers_count / total_questions) * 100)
            
            Result.objects.create(
                student=request.user,
                quiz_id=quiz_id,
                score=score
            )
            
            response_data = {
                "score": score,
                "correct_count": correct_answers_count,
                "total_questions": total_questions,
                "status": "Pass" if score >= 70 else "Fail",
                "correct_answers_ids": correct_answers_ids,
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
        lesson_id = request.data.get('lesson_id')
        custom_text = request.data.get('custom_text')
        count = request.data.get('count', 3)
        difficulty = request.data.get('difficulty', 'medium')
        content = ""

        if custom_text and len(str(custom_text).strip()) > 5:
            content = custom_text
        elif lesson_id:
            try:
                content = Lesson.objects.get(id=lesson_id).content
            except Lesson.DoesNotExist:
                return Response({"error": "Урок не найден"}, status=404)
        else:
            return Response({"error": "Введите текст или выберите урок"}, status=400)

        if not content or len(content) < 10:
            return Response({"error": "Слишком короткий текст"}, status=400)

        try:
            ai_url = "http://saqbol_ai_service:8000/generate-quiz"
            payload = {"text": content, "count": int(count), "difficulty": difficulty}
            response = requests.post(ai_url, json=payload, timeout=60)
            
            if response.status_code != 200:
                return Response({"error": "AI-сервис вернул ошибку"}, status=503)
            
            return Response(response.json(), status=200)
        except Exception as e:
            return Response({"error": f"Ошибка связи с AI: {str(e)}"}, status=500)

class SaveGeneratedView(APIView):
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        questions_data = request.data.get('questions')
        quiz_id = request.data.get('quiz_id')
        quiz_title = request.data.get('quiz_title')

        if not lesson_id or not questions_data:
            return Response({"error": "Данные неполные"}, status=400)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            
            if quiz_id:
                quiz = Quiz.objects.get(id=quiz_id)
                if quiz_title:
                    quiz.title = quiz_title
                    quiz.save()
                
                # 🔥 ГЛАВНЫЙ ФИКС: Удаляем старые вопросы перед сохранением новых!
                # Без этой строки старые неправильные варианты копились дубликатами в БД.
                Question.objects.filter(quiz=quiz).delete()
            else:
                title = quiz_title or f"Тест: {lesson.title}"
                quiz = Quiz.objects.create(title=title, lesson=lesson)

            for q_item in questions_data:
                q_text = str(q_item.get('question', '')).strip()
                if not q_text: continue
                
                question = Question.objects.create(
                    quiz=quiz, 
                    text=q_text, 
                    explanation=q_item.get('explanation', '')
                )

                options = q_item.get('options', [])
                
                # 🔥 ИСПРАВЛЕНИЕ: Получаем массив индексов правильных ответов
                # Фронтенд теперь присылает 'correct_index' как массив [0, 2]
                correct_indices = q_item.get('correct_index', [])
                
                # Если пришло одно число (старый формат), превращаем в массив
                if isinstance(correct_indices, (int, str)):
                    correct_indices = [int(correct_indices)]
                elif not isinstance(correct_indices, list):
                    correct_indices = []

                for i, opt_text in enumerate(options):
                    # 🔥 Проверяем наличие индекса в списке правильных
                    is_correct = i in correct_indices
                    
                    Choice.objects.create(
                        question=question,
                        text=str(opt_text).strip(),
                        is_correct=is_correct
                    )

            return Response({"message": "Тест сохранен", "quiz_id": quiz.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)