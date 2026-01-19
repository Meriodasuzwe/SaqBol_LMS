import requests
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
from .serializers import QuizSerializer, QuizSubmissionSerializer, QuizResultSerializer
from courses.models import Lesson

# 1. Просмотр теста (БЕЗ ИЗМЕНЕНИЙ)
class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'lesson_id'

# 2. Сдача теста (БЕЗ ИЗМЕНЕНИЙ)
class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        request=QuizSubmissionSerializer,
        responses={200: QuizResultSerializer}
    )
    def post(self, request, quiz_id):
        serializer = QuizSubmissionSerializer(data=request.data)
        if serializer.is_valid():
            answers = serializer.data.get('answers')
            total_questions = Question.objects.filter(quiz_id=quiz_id).count()
            correct_answers_count = 0

            for ans in answers:
                q_id = ans.get('question_id')
                c_id = ans.get('choice_id')
                
                is_correct = Choice.objects.filter(
                    id=c_id, 
                    question_id=q_id, 
                    is_correct=True
                ).exists()
                
                if is_correct:
                    correct_answers_count += 1

            score = (correct_answers_count / total_questions * 100) if total_questions > 0 else 0
            
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

# 3. Список результатов (БЕЗ ИЗМЕНЕНИЙ)
class MyResultsView(generics.ListAPIView):
    serializer_class = QuizResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Result.objects.filter(student=self.request.user).order_by('-id')

# 4. ГЕНЕРАЦИЯ ТЕСТА ЧЕРЕЗ AI (ИСПРАВЛЕНО ПОД ТВОЙ AI)
class GenerateQuizView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={201: QuizSerializer},
        description="Генерирует тест на основе контента урока через AI-сервис"
    )
    def post(self, request, lesson_id):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
            
            # ШАГ 1: Удаляем старый тест для этого урока, чтобы избежать ошибки "Unique Constraint"
            Quiz.objects.filter(lesson=lesson).delete()
            
            # ШАГ 2: Запрос к AI
            ai_url = "http://ai_service:8000/generate-quiz"
            payload = {"text": lesson.content}
            response = requests.post(ai_url, json=payload, timeout=10)
            
            if response.status_code != 200:
                return Response(
                    {"error": "AI-сервис вернул ошибку"}, 
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            data = response.json()
            
            # ШАГ 3: Создаем новый Quiz
            quiz = Quiz.objects.create(
                title=f"Тест: {lesson.title}",
                lesson=lesson
            )
            
            # ШАГ 4: Парсим данные в формате твоего FastAPI (generated_questions)
            # Мы используем ключи 'question', 'options' и 'correct_answer'
            questions_data = data.get('generated_questions', [])
            
            for q_item in questions_data:
                question = Question.objects.create(
                    quiz=quiz,
                    text=q_item.get('question') # Ключ из твоего FastAPI
                )
                
                correct_answer_text = q_item.get('correct_answer')
                options = q_item.get('options', [])
                
                for opt_text in options:
                    Choice.objects.create(
                        question=question,
                        text=opt_text,
                        # Если текст варианта совпадает с правильным ответом - ставим True
                        is_correct=(opt_text == correct_answer_text) 
                    )
            
            return Response(
                {"message": "Тест успешно сгенерирован", "quiz_id": quiz.id}, 
                status=status.HTTP_201_CREATED
            )
            
        except Lesson.DoesNotExist:
            return Response({"error": "Урок не найден"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # Выводим ошибку в консоль для дебага
            print(f"Ошибка генерации: {e}") 
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)