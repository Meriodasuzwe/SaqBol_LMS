import requests
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

# Импортируем Result (твоя текущая модель)
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
            answers = serializer.data.get('answers')
            total_questions = Question.objects.filter(quiz_id=quiz_id).count()
            correct_answers_count = 0

            for ans in answers:
                q_id = ans.get('question_id')
                c_id = ans.get('choice_id')
                
                # Проверяем правильность
                is_correct = Choice.objects.filter(
                    id=c_id, 
                    question_id=q_id, 
                    is_correct=True
                ).exists()
                
                if is_correct:
                    correct_answers_count += 1

            score = int((correct_answers_count / total_questions * 100)) if total_questions > 0 else 0
            
            # Сохраняем в модель Result
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

# 3. Список результатов (ДЛЯ ПРОФИЛЯ)
class MyQuizResultsView(generics.ListAPIView):
    serializer_class = MyResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Используем Result и completed_at
        return Result.objects.filter(student=self.request.user).order_by('-completed_at')

# 4. ГЕНЕРАЦИЯ ТЕСТА (AI)
class GenerateQuizView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, lesson_id):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            
            # Удаляем старый тест, чтобы не было дублей
            Quiz.objects.filter(lesson=lesson).delete()
            
            # Адрес AI-сервиса в Docker
            ai_url = "http://saqbol_ai_service:8000/generate-quiz"
            payload = {"text": lesson.content}
            
            response = requests.post(ai_url, json=payload, timeout=30)
            
            if response.status_code != 200:
                return Response({"error": "AI-сервис недоступен"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            data = response.json()
            
            # Создаем тест
            quiz = Quiz.objects.create(title=f"Тест: {lesson.title}", lesson=lesson)
            
            questions_data = data.get('generated_questions', [])
            
            for q_item in questions_data:
                question = Question.objects.create(quiz=quiz, text=q_item.get('question'))
                correct_text = q_item.get('correct_answer')
                
                for opt_text in q_item.get('options', []):
                    Choice.objects.create(
                        question=question, 
                        text=opt_text, 
                        # Сравниваем строки без пробелов
                        is_correct=(opt_text.strip() == correct_text.strip())
                    )
            
            return Response({"message": "Тест создан", "quiz_id": quiz.id}, status=status.HTTP_201_CREATED)
            
        except Lesson.DoesNotExist:
            return Response({"error": "Урок не найден"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Ошибка AI: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)