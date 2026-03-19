"""
routers/insights.py — AI анализ данных аналитики.

GET /ai/analytics/insights/teacher/  — рекомендации учителю по слабым темам
GET /ai/analytics/insights/student/  — рекомендации студенту по его ошибкам
"""

import logging
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from groq_service import groq_chat_json
from security import verify_token
from pydantic import BaseModel
from typing import List

logger = logging.getLogger("ai_security")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/analytics", tags=["Analytics AI"])


# ---------------------------------------------------------------------------
# SCHEMAS
# ---------------------------------------------------------------------------

class WeakTopic(BaseModel):
    question_text: str
    error_rate: float      # процент ошибок 0-100
    total_answers: int


class HardScenarioStep(BaseModel):
    message_text: str
    error_rate: float


class TeacherInsightsRequest(BaseModel):
    course_title: str
    weak_topics: List[WeakTopic]
    hardest_scenario_steps: List[HardScenarioStep] = []
    avg_quiz_score: float
    total_students: int


class StudentInsightsRequest(BaseModel):
    avg_quiz_score: float
    weak_topics: List[WeakTopic]
    scenario_pass_rate: float
    total_quizzes: int


# ---------------------------------------------------------------------------
# PROMPTS
# ---------------------------------------------------------------------------

TEACHER_INSIGHTS_SYSTEM = """
Ты опытный педагогический аналитик и методист.
Получи данные аналитики по курсу и дай конкретные, практичные рекомендации учителю.

Правила:
- Будь конкретным: не "улучшите объяснение", а "добавьте визуальную схему атаки MITM"
- Максимум 5 рекомендаций, приоритизированных по важности
- Для каждой слабой темы — конкретный способ исправления
- Тон: коллегиальный, поддерживающий, не критикующий

Верни JSON:
{
  "summary": "Краткий вывод в 1-2 предложения",
  "recommendations": [
    {
      "priority": 1,
      "topic": "Название проблемной темы",
      "issue": "В чём проблема (конкретно)",
      "action": "Что сделать (конкретное действие)"
    }
  ]
}
"""

STUDENT_INSIGHTS_SYSTEM = """
Ты персональный наставник по обучению.
Получи данные об успехах студента и дай мотивирующие, конкретные рекомендации.

Правила:
- Начни с позитива — что студент делает хорошо
- Укажи 2-3 конкретные темы для повторения
- Предложи конкретные шаги для улучшения
- Тон: поддерживающий, мотивирующий, как хороший наставник

Верни JSON:
{
  "strengths": "Что студент делает хорошо (1 предложение)",
  "focus_areas": ["Тема 1 для повторения", "Тема 2"],
  "recommendations": [
    {
      "topic": "Тема",
      "tip": "Конкретный совет как улучшить понимание"
    }
  ],
  "motivation": "Мотивирующая фраза (1 предложение)"
}
"""


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

@router.post("/insights/teacher/")
@limiter.limit("20/minute")
async def teacher_insights(
    request: Request,
    body: TeacherInsightsRequest,
    user_data: dict = Depends(verify_token),
):
    """
    FastAPI получает агрегированные данные от Django и просит Groq
    сделать конкретные педагогические рекомендации.
    """
    user_id = user_data.get("user_id")
    logger.info(f"INSIGHTS TEACHER | user_id={user_id} | course={body.course_title}")

    # Формируем понятный промпт из данных
    weak_topics_text = "\n".join(
        f"- '{t.question_text}' — {t.error_rate:.0f}% ошибок ({t.total_answers} ответов)"
        for t in body.weak_topics
    ) or "Слабых тем не выявлено."

    hard_steps_text = "\n".join(
        f"- '{s.message_text[:100]}' — {s.error_rate:.0f}% ошибок"
        for s in body.hardest_scenario_steps
    ) or "Данных по сценариям нет."

    user_prompt = f"""
Курс: "{body.course_title}"
Средний балл по квизам: {body.avg_quiz_score:.1f}%
Всего студентов: {body.total_students}

Слабые темы в квизах (вопросы с наибольшим % ошибок):
{weak_topics_text}

Сложные шаги в сценариях кибербеза:
{hard_steps_text}

Дай рекомендации учителю как улучшить курс.
"""

    result = await groq_chat_json(
        system_prompt=TEACHER_INSIGHTS_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.4,
    )

    logger.info(f"INSIGHTS TEACHER SUCCESS | user_id={user_id}")
    return result


@router.post("/insights/student/")
@limiter.limit("20/minute")
async def student_insights(
    request: Request,
    body: StudentInsightsRequest,
    user_data: dict = Depends(verify_token),
):
    """Персональные рекомендации студенту на основе его ошибок."""
    user_id = user_data.get("user_id")
    logger.info(f"INSIGHTS STUDENT | user_id={user_id}")

    weak_topics_text = "\n".join(
        f"- '{t.question_text}' — {t.error_rate:.0f}% ошибок"
        for t in body.weak_topics
    ) or "Явных слабых тем нет."

    user_prompt = f"""
Статистика студента:
- Пройдено квизов: {body.total_quizzes}
- Средний балл: {body.avg_quiz_score:.1f}%
- Сценарии кибербеза — % прохождения: {body.scenario_pass_rate:.1f}%

Темы с наибольшим количеством ошибок:
{weak_topics_text}

Дай персональные рекомендации студенту.
"""

    result = await groq_chat_json(
        system_prompt=STUDENT_INSIGHTS_SYSTEM,
        user_prompt=user_prompt,
        temperature=0.4,
    )

    logger.info(f"INSIGHTS STUDENT SUCCESS | user_id={user_id}")
    return result