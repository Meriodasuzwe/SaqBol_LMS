# Этот импорт нужен для работы с AI-сервисом
import requests
import hashlib
import json
from django.conf import settings
from django.shortcuts import get_object_or_404
# Стандартные импорты Django и DRF
from django.db import transaction
from django.db.models import Prefetch, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema

from .models import Quiz, Question, Choice, Result
from .grading import calculate_submission_score, calculate_kt_profile_score
from analytics.models import QuizAttemptDetail, QuestionAnswer
# Импорт модели Lesson для получения контента урока при генерации тестов через AI
from courses.models import Lesson, LessonStep
from courses.serializers import LessonStepSerializer
from .serializers import (
    QuizSerializer, 
    QuizSubmissionSerializer, 
    QuizResultSerializer, 
    MyResultSerializer,
    GeneratePreviewSerializer,
    SaveGeneratedSerializer,
    BuilderQuizStepSerializer,
)

def visible_quizzes(user):
    """Keep legacy access; new profile blocks require publication or authorship."""
    quizzes = Quiz.objects.all()
    if not user.is_authenticated:
        return quizzes.none()
    if user.is_staff or user.is_superuser or getattr(user, 'role', '') == 'admin':
        return quizzes
    return quizzes.filter(
        Q(mode=Quiz.Mode.TRAINING)
        | Q(lesson__course__status='published')
        | Q(lesson__course__teacher=user)
    )


# 1. ОБЫЧНЫЙ СПИСОК (для админки или общих целей)
class QuizListView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return visible_quizzes(self.request.user).order_by('-id')

# 2. Получение тестов по конкретному уроку
class QuizByLessonView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        lesson_id = self.kwargs.get('lesson_id')
        if lesson_id:
            return visible_quizzes(self.request.user).filter(lesson_id=lesson_id).order_by('id')
        return Quiz.objects.none()

# 3. Детальный просмотр теста по ID теста
class QuizDetailView(generics.RetrieveAPIView):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return visible_quizzes(self.request.user)

# 4. Сдача теста
class QuizSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def submission_fingerprint(answers):
        # Question/choice order and explicit empty selections do not change a submission.
        canonical = sorted(
            (answer['question_id'], sorted(answer['choice_ids']))
            for answer in answers if answer['choice_ids']
        )
        return hashlib.sha256(json.dumps(canonical, separators=(',', ':')).encode()).hexdigest()

    @staticmethod
    def replay_submission(result, answers, fingerprint):
        response_data = result.submission_response or {}
        original_questions = {int(key) for key in response_data.get('correct_answers_ids', {})}
        if any(answer['question_id'] not in original_questions for answer in answers):
            return Response({'answers': ['Вопрос не принадлежит сохранённой сдаче.']}, status=400)
        if result.submission_fingerprint != fingerprint:
            return Response(
                {'submission_id': ['Эта сдача уже сохранена с другими ответами.']},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(response_data, status=status.HTTP_200_OK)
    
    @extend_schema(request=QuizSubmissionSerializer, responses={200: QuizResultSerializer})
    @transaction.atomic
    def post(self, request, quiz_id):
        serializer = QuizSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answers = serializer.validated_data['answers']
        submission_id = serializer.validated_data.get('submission_id')
        fingerprint = self.submission_fingerprint(answers)
        if submission_id is not None:
            # Detached attempts retain their original quiz ID in the server snapshot.
            # Scope by owner AND original quiz; a UUID may be reused across quizzes.
            existing = Result.objects.filter(
                student=request.user, submission_id=submission_id,
            ).filter(
                Q(quiz_id=quiz_id)
                | Q(quiz__isnull=True, detail__quiz_snapshot__id=quiz_id),
            ).first()
            if existing is not None:
                return self.replay_submission(existing, answers, fingerprint)

        quiz = Quiz.objects.select_related('lesson__course').filter(pk=quiz_id).first()
        is_kt_profile = quiz is not None and quiz.mode == Quiz.Mode.KT_PROFILE
        if is_kt_profile and not visible_quizzes(request.user).filter(pk=quiz_id).exists():
            raise PermissionDenied('Этот пробник ещё не опубликован.')

        # Grade and snapshot the same materialized version of each question/choice.
        questions = list(Question.objects.filter(quiz_id=quiz_id).select_related('quiz').order_by('id').prefetch_related(
            Prefetch('choices', queryset=Choice.objects.order_by('id')),
        ))
        if is_kt_profile:
            questions.sort(key=lambda question: (question.kt_subject, question.pk))
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
        answers = serializer.validated_data['answers']
        if is_kt_profile:
            if any(question.kt_subject not in Question.KTSubject.values for question in questions):
                raise ValidationError({'error': 'Для каждого вопроса пробника должен быть указан профильный предмет.'})
            first_subject = {q.pk: question_choices[q.pk] for q in questions if q.kt_subject == Question.KTSubject.FIRST}
            second_subject = {q.pk: question_choices[q.pk] for q in questions if q.kt_subject == Question.KTSubject.SECOND}
            if any(answer['question_id'] in first_subject and len(answer['choice_ids']) > 1 for answer in answers):
                raise ValidationError({'answers': 'В первом профильном предмете можно выбрать только один вариант.'})
            try:
                grading = calculate_kt_profile_score(first_subject, second_subject, answers)
            except ValueError as error:
                raise ValidationError({
                    'error': 'Пробник настроен некорректно: нужны 30 вопросов с одним правильным ответом '
                             'и 20 вопросов с 1–3 правильными ответами.',
                }) from error
            is_correct_by_question = {qid: item['is_correct'] for qid, item in grading['questions'].items()}
            response_data = {
                'score': grading['earned_points'] * 100 // grading['max_points'],
                'correct_count': sum(is_correct_by_question.values()),
                'total_questions': len(questions),
                'correct_answers_ids': {qid: [cid for cid, correct in choices.items() if correct]
                                        for qid, choices in question_choices.items()},
                'mode': Quiz.Mode.KT_PROFILE,
                'grading': grading,
                'explanations': {q.pk: q.explanation for q in questions},
            }
        else:
            response_data = calculate_submission_score(question_choices, answers)
            is_correct_by_question = response_data.pop('is_correct_by_question')
        selected_by_question = {answer['question_id']: answer['choice_ids'] for answer in answers}
        result_values = {'score': response_data['score']}
        quiz_snapshot = {'id': quiz_id, 'title': quiz.title}
        if is_kt_profile:
            result_values.update(scoring_mode=Quiz.Mode.KT_PROFILE, scoring_details=grading)
            quiz_snapshot.update(mode=Quiz.Mode.KT_PROFILE, scoring_version=grading['scoring_version'])

        # Validate and grade before writing; all three tables commit together.
        if submission_id is None:
            # Older clients remain compatible, but cannot deduplicate without an ID.
            result = Result.objects.create(student=request.user, quiz_id=quiz_id, **result_values)
        else:
            # The unique DB constraint arbitrates simultaneous requests. get_or_create
            # uses an inner savepoint, then reads the winner after its transaction commits.
            result, created = Result.objects.get_or_create(
                student=request.user, quiz_id=quiz_id, submission_id=submission_id,
                defaults={**result_values, 'submission_fingerprint': fingerprint},
            )
            if not created:
                return self.replay_submission(result, answers, fingerprint)
        attempt = QuizAttemptDetail.objects.create(
            student=request.user,
            quiz_id=quiz_id,
            result=result,
            quiz_snapshot=quiz_snapshot,
            score=response_data['score'],
            total_questions=response_data['total_questions'],
            correct_answers=response_data['correct_count'],
            time_spent_seconds=serializer.validated_data['time_spent_seconds'],
        )
        answers_to_create = []
        for position, question in enumerate(questions):
            question_id = question.pk
            selected = selected_by_question.get(question_id, [])
            question_snapshot = {
                'id': question_id,
                'position': position,
                'text': question.text,
                'explanation': question.explanation,
                'choices': [{'id': choice.pk, 'text': choice.text} for choice in question.choices.all()],
                'correct_choice_ids': response_data['correct_answers_ids'][question_id],
            }
            if is_kt_profile:
                points = grading['questions'][question_id]
                question_snapshot.update(kt_subject=question.kt_subject,
                                         earned_points=points['earned_points'], max_points=points['max_points'])
            answers_to_create.append(QuestionAnswer(
                attempt=attempt,
                question_id=question_id,
                question_snapshot=question_snapshot,
                selected_choice_ids=selected,
                selected_choice_id=selected[0] if selected else None,
                is_correct=is_correct_by_question[question_id],
            ))
        QuestionAnswer.objects.bulk_create(answers_to_create)
        response_data['id'] = result.pk
        if submission_id is not None:
            result.submission_response = response_data
            result.save(update_fields=['submission_response'])
        return Response(response_data, status=status.HTTP_200_OK)

# 5. Результаты пользователя
class MyQuizResultsView(generics.ListAPIView):
    serializer_class = MyResultSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Result.objects.filter(student=self.request.user).select_related('quiz__lesson__course', 'detail').order_by('-completed_at')

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
        step_serializer = None
        scenario_data = None
        quiz = None
        if 'step_id' in data:
            # Serialise saves of one step before resolving its authoritative quiz
            # link. A retry of an initial save then reuses the newly linked quiz.
            step = get_object_or_404(LessonStep.objects.select_for_update(), id=data['step_id'])
            if step.lesson_id != lesson.id:
                raise ValidationError({'step_id': 'Шаг не принадлежит указанному уроку.'})
            if step.step_type != 'quiz':
                raise ValidationError({'step_id': 'Сохранять тест можно только в шаге типа quiz.'})
            saved_scenario = step.scenario_data if step.scenario_data is not None else {}
            if not isinstance(saved_scenario, dict):
                raise ValidationError({'step_id': 'Сохранённая связь шага с тестом повреждена.'})
            linked_quiz_id = saved_scenario.get('quiz_id')
            if 'quiz_id' in saved_scenario:
                if type(linked_quiz_id) is not int or linked_quiz_id < 1:
                    raise ValidationError({'step_id': 'Сохранённая связь шага с тестом повреждена.'})
                quiz = Quiz.objects.select_for_update().filter(id=linked_quiz_id, lesson=lesson).first()
                if quiz is None:
                    raise ValidationError({'step_id': 'Связанный тест отсутствует или относится к другому уроку.'})
            incoming_scenario = data['step']['scenario_data']
            if ('quiz_id' in data and quiz_id != linked_quiz_id
                    or 'quiz_id' in incoming_scenario and incoming_scenario['quiz_id'] != linked_quiz_id):
                raise ValidationError({'quiz_id': 'Нельзя изменить привязку теста к шагу.'})
            scenario_data = {**saved_scenario, **incoming_scenario}
            step_serializer = BuilderQuizStepSerializer(
                step, data=data['step'], context={'request': request},
            )
            step_serializer.is_valid(raise_exception=True)
        elif quiz_id:
            quiz = get_object_or_404(Quiz.objects.select_for_update(), id=quiz_id, lesson=lesson)

        if quiz is not None and quiz.mode == Quiz.Mode.KT_PROFILE:
            raise ValidationError({'quiz_id': 'Профильный пробник редактируется в админке с указанием предметов; '
                                              'обычный конструктор пока не поддерживает этот формат.'})
        if quiz is not None:
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
        response_data = {'message': 'Тест сохранен', 'quiz_id': quiz.id}
        if step_serializer is not None:
            # The server owns this link; all other step metadata is retained.
            scenario_data['quiz_id'] = quiz.id
            step = step_serializer.save(scenario_data=scenario_data)
            response_data['step'] = LessonStepSerializer(step, context={'request': request}).data
        return Response(response_data, status=201)
