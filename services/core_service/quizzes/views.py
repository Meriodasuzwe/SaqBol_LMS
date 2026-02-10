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

# 1. Список тестов (можно фильтровать по lesson_id)
class QuizListView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Quiz.objects.all().order_by('-id')
        lesson_id = self.request.query_params.get('lesson_id')
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        return qs

# 2. Просмотр конкретного теста
class QuizDetailView(generics.RetrieveAPIView):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

# 3. Сдача теста (оставляем без изменений)
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

# 4. Список результатов
class MyQuizResultsView(generics.ListAPIView):
    serializer_class = MyResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Result.objects.filter(student=self.request.user).order_by('-completed_at')

# --- БЛОК AI ФУНКЦИЙ ---

# 5. ПРЕДПРОСМОТР (Генерация без сохранения)
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

# 6. СОХРАНЕНИЕ УТВЕРДЕННОГО ТЕСТА (поддерживает добавление к существующему тесту или создание нового)
class SaveGeneratedView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        lesson_id = request.data.get('lesson_id')
        questions_data = request.data.get('questions')
        quiz_id = request.data.get('quiz_id')
        quiz_title = request.data.get('quiz_title') or request.data.get('title')

        if not lesson_id or not questions_data:
            return Response({"error": "Данные неполные"}, status=400)

        try:
            try:
                lesson = Lesson.objects.get(id=lesson_id)
            except Lesson.DoesNotExist:
                return Response({"error": "Урок не найден"}, status=404)

            # Получаем или создаём тест
            if quiz_id:
                try:
                    quiz = Quiz.objects.get(id=quiz_id)
                except Quiz.DoesNotExist:
                    return Response({"error": "Тест не найден"}, status=404)
                if quiz.lesson_id != lesson.id:
                    return Response({"error": "Тест не принадлежит указанному уроку"}, status=400)
            else:
                title = quiz_title.strip() if quiz_title and str(quiz_title).strip() else f"Тест: {lesson.title}"
                quiz = Quiz.objects.create(title=title, lesson=lesson)

            # Добавляем вопросы и варианты — не удаляем предыдущие (поддержка нескольких тестов)
            for q_item in questions_data:
                q_text = (q_item.get('question') or q_item.get('text') or '').strip()
                if not q_text:
                    continue
                explanation = (q_item.get('explanation') or q_item.get('explain') or '').strip()
                question = Question.objects.create(quiz=quiz, text=q_text, explanation=explanation)

                options_raw = q_item.get('options') or []
                # Нормализуем опции
                normalized_options = []
                for o in options_raw:
                    if isinstance(o, dict):
                        val = o.get('text') or o.get('value') or ''
                    else:
                        val = o
                    if val is None:
                        continue
                    s = str(val).strip()
                    if s:
                        normalized_options.append(s)

                correct_text = (q_item.get('correct_answer') or q_item.get('correct') or '').strip()

                # Если correct_text это индекс
                if correct_text and correct_text.isdigit():
                    idx = int(correct_text)
                    if 0 <= idx < len(normalized_options):
                        correct_text = normalized_options[idx]
                    else:
                        correct_text = ''

                # Если корректного варианта не указали — пометим первым
                for i, opt_text in enumerate(normalized_options):
                    is_correct = False
                    if correct_text:
                        is_correct = (opt_text == correct_text)
                    elif i == 0:
                        is_correct = True
                    Choice.objects.create(question=question, text=opt_text, is_correct=is_correct)

            return Response({"message": "Тест успешно сохранен", "quiz_id": quiz.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 7. БЫСТРАЯ ГЕНЕРАЦИЯ (создаёт новый тест для урока)
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
            # НЕ удаляем старые тесты — создаём новый
            quiz = Quiz.objects.create(title=f"Тест: {lesson.title}", lesson=lesson)
            
            for q_item in data.get('generated_questions', []):
                q_text = (q_item.get('question') or q_item.get('text') or '').strip()
                if not q_text:
                    continue
                question = Question.objects.create(quiz=quiz, text=q_text)
                correct_text = (q_item.get('correct_answer') or q_item.get('correct') or '').strip()
                options_raw = q_item.get('options') or []
                normalized_options = []
                for o in options_raw:
                    if isinstance(o, dict):
                        val = o.get('text') or o.get('value') or ''
                    else:
                        val = o
                    if val is None:
                        continue
                    s = str(val).strip()
                    if s:
                        normalized_options.append(s)

                if correct_text and correct_text.isdigit():
                    idx = int(correct_text)
                    if 0 <= idx < len(normalized_options):
                        correct_text = normalized_options[idx]
                    else:
                        correct_text = ''

                for i, opt_text in enumerate(normalized_options):
                    is_correct = False
                    if correct_text:
                        is_correct = (opt_text == correct_text)
                    elif i == 0:
                        is_correct = True
                    Choice.objects.create(question=question, text=opt_text, is_correct=is_correct)
            
            return Response({"message": "Тест создан", "quiz_id": quiz.id}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)