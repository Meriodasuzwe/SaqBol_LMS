from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated  # Тот самый импорт!
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
from .serializers import QuizSerializer, QuizSubmissionSerializer

# 1. Просмотр теста (уже был)
class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'lesson_id'

# 2. Сдача теста (новый)
class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    @extend_schema(request=QuizSubmissionSerializer)

    def post(self, request, quiz_id):
        serializer = QuizSubmissionSerializer(data=request.data)
        if serializer.is_valid():
            answers = serializer.data.get('answers')
            # Считаем общее кол-во вопросов в этом тесте
            total_questions = Question.objects.filter(quiz_id=quiz_id).count()
            correct_answers_count = 0

            for ans in answers:
                q_id = ans.get('question_id')
                c_id = ans.get('choice_id')
                
                # Ищем, есть ли такой вариант и помечен ли он как правильный
                is_correct = Choice.objects.filter(
                    id=c_id, 
                    question_id=q_id, 
                    is_correct=True
                ).exists()
                
                if is_correct:
                    correct_answers_count += 1

            # Считаем процент
            score = (correct_answers_count / total_questions * 100) if total_questions > 0 else 0
            
            # Сохраняем результат в базу
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