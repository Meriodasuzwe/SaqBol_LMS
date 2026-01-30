import requests
from django.db import transaction
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
from courses.models import Lesson
from .serializers import (
    QuizSerializer, 
    QuizSubmissionSerializer, 
    QuizResultSerializer, 
    MyResultSerializer
)

# 1. Просмотр теста
class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'lesson_id'

# 2. Сдача теста
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
            for ans in answers:
                is_correct = Choice.objects.filter(
                    id=ans.get('choice_id'), 
                    question_id=ans.get('question_id'), 
                    is_correct=True
                ).exists()
                if is_correct:
                    correct_answers_count += 1

            score = int((correct_answers_count / total_questions * 100))
            
            Result.objects.create(
                student=request.user,
                quiz_id=quiz_id,
                score=score
            )

            return Response({
                "score": score,
                "correct_count": correct_answers_count,
                "total_questions": total_questions,
                "status": "Pass" if score >= 70 else "Fail"
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 3. Список результатов
class MyQuizResultsView(generics.ListAPIView):
    serializer_class = MyResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Result.objects.filter(student=self.request.user).order_by('-completed_at')

# --- БЛОК AI ФУНКЦИЙ ---

# 4. ПРЕДПРОСМОТР (Генерация без сохранения)
class GeneratePreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        custom_text = request.data.get('custom_text')
        count = request.data.get('count', 3)
        difficulty = request.data.get('difficulty', 'medium')

        content = ""

        # --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
        # 1. Сначала проверяем "Свой текст". Если там больше 5 символов - берем его.
        if custom_text and len(str(custom_text).strip()) > 5:
            content = custom_text
            print(f"DEBUG: Использую пользовательский текст длиной {len(content)}")
        
        # 2. Если своего текста нет, тогда ищем урок по ID
        elif lesson_id:
            try:
                content = Lesson.objects.get(id=lesson_id).content
                print(f"DEBUG: Использую текст из урока ID {lesson_id}")
            except Lesson.DoesNotExist:
                return Response({"error": "Урок не найден"}, status=404)
        
        # 3. Если ни того, ни другого нет - ошибка
        else:
            return Response({"error": "Введите текст или выберите урок"}, status=400)
        # -----------------------

        if not content or len(content) < 10:
            return Response({"error": "Слишком короткий текст для генерации"}, status=400)

        try:
            ai_url = "http://saqbol_ai_service:8000/generate-quiz"
            payload = {
                "text": content,
                "count": int(count),
                "difficulty": difficulty
            }
            # Увеличим тайм-аут, так как большие тексты обрабатываются дольше
            response = requests.post(ai_url, json=payload, timeout=60)
            
            if response.status_code != 200:
                return Response({"error": "AI-сервис вернул ошибку"}, status=503)
            
            return Response(response.json(), status=200)
        except Exception as e:
            return Response({"error": f"Ошибка связи с AI: {str(e)}"}, status=500)

# 5. СОХРАНЕНИЕ УТВЕРЖДЕННОГО ТЕСТА
class SaveGeneratedView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        questions_data = request.data.get('questions')

        if not lesson_id or not questions_data:
            return Response({"error": "Данные неполные"}, status=400)

        try:
            lesson = Lesson.objects.get(id=lesson_id)
            # Удаляем старый тест и вопросы
            Quiz.objects.filter(lesson=lesson).delete()
            
            quiz = Quiz.objects.create(title=f"Тест: {lesson.title}", lesson=lesson)
            
            for q_item in questions_data:
                question = Question.objects.create(quiz=quiz, text=q_item.get('question'))
                correct_text = q_item.get('correct_answer')
                
                for opt_text in q_item.get('options', []):
                    Choice.objects.create(
                        question=question,
                        text=opt_text,
                        is_correct=(opt_text.strip() == correct_text.strip())
                    )
            
            return Response({"message": "Тест успешно сохранен"}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 6. БЫСТРАЯ ГЕНЕРАЦИЯ (Старая кнопка, но улучшенная)
class GenerateQuizView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, lesson_id):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            ai_url = "http://saqbol_ai_service:8000/generate-quiz"
            
            # Добавили параметры по умолчанию для быстрой генерации
            payload = {
                "text": lesson.content,
                "count": 3,
                "difficulty": "medium"
            }
            
            response = requests.post(ai_url, json=payload, timeout=60)
            if response.status_code != 200:
                return Response({"error": "AI-сервис недоступен"}, status=503)
            
            data = response.json()
            Quiz.objects.filter(lesson=lesson).delete()
            quiz = Quiz.objects.create(title=f"Тест: {lesson.title}", lesson=lesson)
            
            for q_item in data.get('generated_questions', []):
                question = Question.objects.create(quiz=quiz, text=q_item.get('question'))
                correct_text = q_item.get('correct_answer')
                for opt_text in q_item.get('options', []):
                    Choice.objects.create(
                        question=question, 
                        text=opt_text, 
                        is_correct=(opt_text.strip() == correct_text.strip())
                    )
            
            return Response({"message": "Тест создан", "quiz_id": quiz.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)