"""
analytics/views.py — API эндпоинты аналитики.

Эндпоинты:
  POST /analytics/quiz-attempt/        — фронт сохраняет результат квиза
  POST /analytics/scenario-attempt/    — фронт сохраняет результат сценария
  GET  /analytics/teacher/dashboard/   — дашборд учителя
  GET  /analytics/student/dashboard/   — дашборд студента
"""

import logging
from django.db.models import Avg, Count, Q, F
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from courses.models import LessonStep
from quizzes.models import Quiz, Question, Choice, Result
from .models import (
    QuizAttemptDetail, QuestionAnswer,
    ScenarioAttempt, ScenarioStepResult,
)
from .serializers import (
    SubmitQuizAttemptSerializer,
    SubmitScenarioAttemptSerializer,
    TeacherDashboardSerializer,
    StudentDashboardSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _get_weak_topics(queryset_filter: Q, limit: int = 5) -> list:
    """
    Возвращает список вопросов с наибольшим процентом ошибок.
    queryset_filter — фильтр для QuestionAnswer (например по студенту или курсу).
    """
    from django.db.models import FloatField, ExpressionWrapper

    stats = (
        QuestionAnswer.objects
        .filter(queryset_filter)
        .values('question__id', 'question__text')
        .annotate(
            total=Count('id'),
            wrong=Count('id', filter=Q(is_correct=False)),
        )
        .filter(total__gte=2)  # минимум 2 ответа чтобы статистика была значимой
        .order_by('-wrong')[:limit]
    )

    result = []
    for item in stats:
        error_rate = round(item['wrong'] / item['total'] * 100, 1) if item['total'] else 0
        result.append({
            'question_id': item['question__id'],
            'question_text': item['question__text'],
            'total_answers': item['total'],
            'wrong_answers': item['wrong'],
            'error_rate': error_rate,
        })
    return result


def _get_hardest_scenario_steps(lesson_step_id: int, limit: int = 3) -> list:
    """Шаги сценария с наибольшим процентом ошибок."""
    stats = (
        ScenarioStepResult.objects
        .filter(attempt__lesson_step_id=lesson_step_id)
        .values('step_index', 'message_text')
        .annotate(
            total=Count('id'),
            wrong=Count('id', filter=Q(is_correct=False)),
        )
        .filter(total__gte=2)
        .order_by('-wrong')[:limit]
    )

    result = []
    for item in stats:
        error_rate = round(item['wrong'] / item['total'] * 100, 1) if item['total'] else 0
        result.append({
            'step_index': item['step_index'],
            'message_text': item['message_text'],
            'total_answers': item['total'],
            'wrong_answers': item['wrong'],
            'error_rate': error_rate,
        })
    return result


# ---------------------------------------------------------------------------
# SUBMIT ENDPOINTS (фронт → сохранить результат)
# ---------------------------------------------------------------------------

class SubmitQuizAttemptView(APIView):
    """
    POST /analytics/quiz-attempt/
    Фронтенд вызывает этот эндпоинт когда студент завершил квиз.
    Сохраняет детальные данные: каждый вопрос, каждый ответ.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SubmitQuizAttemptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        student = request.user

        try:
            quiz = Quiz.objects.get(id=data['quiz_id'])
        except Quiz.DoesNotExist:
            return Response({'error': 'Квиз не найден.'}, status=404)

        # Получаем старый Result если передан (совместимость)
        result_obj = None
        if data.get('result_id'):
            result_obj = Result.objects.filter(id=data['result_id'], student=student).first()

        # Создаём детальную попытку
        attempt = QuizAttemptDetail.objects.create(
            student=student,
            quiz=quiz,
            result=result_obj,
            score=data['score'],
            total_questions=data['total_questions'],
            correct_answers=data['correct_answers'],
            time_spent_seconds=data['time_spent_seconds'],
        )

        # Сохраняем ответы на каждый вопрос
        answers_to_create = []
        for ans in data['answers']:
            question = Question.objects.filter(id=ans['question_id'], quiz=quiz).first()
            if not question:
                continue
            choice = Choice.objects.filter(id=ans['selected_choice_id']).first() if ans.get('selected_choice_id') else None
            answers_to_create.append(QuestionAnswer(
                attempt=attempt,
                question=question,
                selected_choice=choice,
                is_correct=ans['is_correct'],
            ))

        QuestionAnswer.objects.bulk_create(answers_to_create, ignore_conflicts=True)

        logger.info(f"ANALYTICS: Quiz attempt saved | student={student.id} | quiz={quiz.id} | score={data['score']}")
        return Response({'attempt_id': attempt.id}, status=status.HTTP_201_CREATED)


class SubmitScenarioAttemptView(APIView):
    """
    POST /analytics/scenario-attempt/
    Фронтенд вызывает когда студент завершил сценарий кибербеза.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SubmitScenarioAttemptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        student = request.user

        try:
            lesson_step = LessonStep.objects.get(id=data['lesson_step_id'])
        except LessonStep.DoesNotExist:
            return Response({'error': 'Шаг урока не найден.'}, status=404)

        from django.utils import timezone
        attempt = ScenarioAttempt.objects.create(
            student=student,
            lesson_step=lesson_step,
            scenario_type=data['scenario_type'],
            scenario_topic=data['scenario_topic'],
            result=data['result'],
            total_steps=data['total_steps'],
            correct_steps=data['correct_steps'],
            time_spent_seconds=data['time_spent_seconds'],
            completed_at=timezone.now(),
        )

        steps_to_create = [
            ScenarioStepResult(
                attempt=attempt,
                step_index=s['step_index'],
                message_text=s['message_text'],
                chosen_option_text=s['chosen_option_text'],
                is_correct=s['is_correct'],
                feedback_shown=s['feedback_shown'],
            )
            for s in data['step_results']
        ]
        ScenarioStepResult.objects.bulk_create(steps_to_create)

        logger.info(f"ANALYTICS: Scenario attempt saved | student={student.id} | result={data['result']}")
        return Response({'attempt_id': attempt.id}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# TEACHER DASHBOARD
# ---------------------------------------------------------------------------

class TeacherDashboardView(APIView):
    """
    GET /analytics/teacher/dashboard/?course_id=<id>
    Учитель видит статистику по своему курсу.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('teacher', 'admin'):
            return Response({'error': 'Доступ только для преподавателей.'}, status=403)

        course_id = request.query_params.get('course_id')

        # Фильтруем квизы учителя
        quiz_qs = Quiz.objects.filter(
            lesson__course__teacher=request.user
        )
        if course_id:
            quiz_qs = quiz_qs.filter(lesson__course_id=course_id)

        quiz_ids = list(quiz_qs.values_list('id', flat=True))

        # Попытки по этим квизам
        attempts_qs = QuizAttemptDetail.objects.filter(quiz_id__in=quiz_ids)

        # Сценарии по курсам учителя
        scenario_qs = ScenarioAttempt.objects.filter(
            lesson_step__lesson__course__teacher=request.user
        )
        if course_id:
            scenario_qs = scenario_qs.filter(lesson_step__lesson__course_id=course_id)

        # Общие цифры
        total_students = (
            attempts_qs.values('student').distinct().count() +
            scenario_qs.values('student').distinct().count()
        )
        avg_score = attempts_qs.aggregate(avg=Avg('score'))['avg'] or 0

        # Статистика по каждому квизу
        quiz_stats = []
        for quiz in quiz_qs.prefetch_related('questions'):
            q_attempts = attempts_qs.filter(quiz=quiz)
            total = q_attempts.count()
            if total == 0:
                continue

            avg_q_score = q_attempts.aggregate(avg=Avg('score'))['avg'] or 0
            avg_time = q_attempts.aggregate(avg=Avg('time_spent_seconds'))['avg'] or 0
            passed = q_attempts.filter(score__gte=70).count()

            quiz_stats.append({
                'quiz_id': quiz.id,
                'quiz_title': quiz.title,
                'total_attempts': total,
                'avg_score': round(avg_q_score, 1),
                'avg_time_seconds': round(avg_time, 0),
                'pass_rate': round(passed / total * 100, 1),
                'weak_topics': _get_weak_topics(
                    Q(attempt__quiz=quiz), limit=5
                ),
            })

        # Статистика по каждому сценарию
        scenario_stats = []
        scenario_step_ids = scenario_qs.values('lesson_step_id').distinct()
        for item in scenario_step_ids:
            step_id = item['lesson_step_id']
            s_attempts = scenario_qs.filter(lesson_step_id=step_id)
            total = s_attempts.count()
            if total == 0:
                continue

            passed = s_attempts.filter(result='passed').count()
            avg_success = s_attempts.aggregate(
                avg=Avg(F('correct_steps') * 100.0 / F('total_steps'))
            )['avg'] or 0
            first = s_attempts.first()

            scenario_stats.append({
                'lesson_step_id': step_id,
                'scenario_topic': first.scenario_topic if first else '',
                'scenario_type': first.scenario_type if first else '',
                'total_attempts': total,
                'pass_rate': round(passed / total * 100, 1),
                'avg_success_rate': round(avg_success, 1),
                'hardest_steps': _get_hardest_scenario_steps(step_id),
            })

        return Response({
            'total_students': total_students,
            'total_quiz_attempts': attempts_qs.count(),
            'total_scenario_attempts': scenario_qs.count(),
            'avg_quiz_score': round(avg_score, 1),
            'quiz_stats': quiz_stats,
            'scenario_stats': scenario_stats,
        })


# ---------------------------------------------------------------------------
# STUDENT DASHBOARD
# ---------------------------------------------------------------------------

class StudentDashboardView(APIView):
    """
    GET /analytics/student/dashboard/
    Студент видит свою историю и слабые темы.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student = request.user

        quiz_attempts = QuizAttemptDetail.objects.filter(
            student=student
        ).select_related('quiz').order_by('-completed_at')[:20]

        scenario_attempts = ScenarioAttempt.objects.filter(
            student=student
        ).order_by('-started_at')[:20]

        # Агрегаты
        all_quiz_attempts = QuizAttemptDetail.objects.filter(student=student)
        avg_score = all_quiz_attempts.aggregate(avg=Avg('score'))['avg'] or 0

        all_scenario = ScenarioAttempt.objects.filter(student=student)
        total_scenarios = all_scenario.count()
        passed_scenarios = all_scenario.filter(result='passed').count()
        scenario_pass_rate = (
            round(passed_scenarios / total_scenarios * 100, 1)
            if total_scenarios else 0
        )

        quiz_history = [
            {
                'attempt_id': a.id,
                'quiz_title': a.quiz.title,
                'score': a.score,
                'correct_answers': a.correct_answers,
                'total_questions': a.total_questions,
                'time_spent_seconds': a.time_spent_seconds,
                'completed_at': a.completed_at,
            }
            for a in quiz_attempts
        ]

        scenario_history = [
            {
                'attempt_id': a.id,
                'scenario_topic': a.scenario_topic,
                'scenario_type': a.scenario_type,
                'result': a.result,
                'success_rate': a.success_rate,
                'completed_at': a.completed_at,
            }
            for a in scenario_attempts
        ]

        # Слабые темы именно этого студента
        weak_topics = _get_weak_topics(Q(attempt__student=student), limit=5)

        return Response({
            'total_quizzes_taken': all_quiz_attempts.count(),
            'avg_quiz_score': round(avg_score, 1),
            'total_scenarios_taken': total_scenarios,
            'scenario_pass_rate': scenario_pass_rate,
            'quiz_history': quiz_history,
            'scenario_history': scenario_history,
            'weak_topics': weak_topics,
            'ai_recommendations': [],  # заполняется отдельным запросом к FastAPI
        })