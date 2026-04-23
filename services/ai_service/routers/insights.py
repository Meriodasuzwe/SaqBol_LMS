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
    error_rate: float      
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
    language: str = "ru" # 🔥 Принимаем язык с фронтенда

class StudentInsightsRequest(BaseModel):
    avg_quiz_score: float
    weak_topics: List[WeakTopic]
    scenario_pass_rate: float
    total_quizzes: int
    language: str = "ru"

# ---------------------------------------------------------------------------
# PROMPTS (Инструкции на английском, чтобы LLM не путалась)
# ---------------------------------------------------------------------------

def get_teacher_system_prompt(target_lang: str) -> str:
    return f"""
You are an expert educational analyst and methodologist.
Analyze the provided course analytics data and provide specific, actionable recommendations for the teacher.

Rules:
- Be specific: instead of "improve explanation", write "add a visual diagram of a MITM attack".
- Provide maximum 5 recommendations, prioritized by importance.
- Tone: supportive, professional, not critical.

CRITICAL INSTRUCTION: You MUST translate and write ALL text values in the JSON output strictly in the following language: {target_lang}. 
Do NOT use English unless {target_lang} is English.

Return exactly this JSON format:
{{
  "summary": "Brief summary in 1-2 sentences (IN {target_lang})",
  "recommendations": [
    {{
      "priority": 1,
      "topic": "Name of the problematic topic (IN {target_lang})",
      "issue": "What is the specific issue (IN {target_lang})",
      "action": "Specific action to take (IN {target_lang})"
    }}
  ]
}}
"""

def get_student_system_prompt(target_lang: str) -> str:
    return f"""
You are a personal learning mentor.
Analyze the student's progress data and provide motivating, specific recommendations.

Rules:
- Start with a positive note about what the student is doing well.
- Identify 2-3 specific topics to review.
- Suggest concrete steps for improvement.
- Tone: supportive, motivating, like a good mentor.

CRITICAL INSTRUCTION: You MUST translate and write ALL text values in the JSON output strictly in the following language: {target_lang}.
Do NOT use English unless {target_lang} is English.

Return exactly this JSON format:
{{
  "strengths": "What the student does well in 1 sentence (IN {target_lang})",
  "focus_areas": ["Topic 1 to review", "Topic 2"],
  "recommendations": [
    {{
      "topic": "Topic Name (IN {target_lang})",
      "tip": "Specific advice on how to improve understanding (IN {target_lang})"
    }}
  ],
  "motivation": "A motivating closing sentence (IN {target_lang})"
}}
"""

# Маппинг языков (используем названия, которые LLM понимает лучше всего)
LANG_MAP = {
    "ru": "Russian",
    "kk": "Kazakh (Қазақ тілі)",
    "en": "English"
}

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
    user_id = user_data.get("user_id")
    
    # 1. Извлекаем нужный язык (обрезаем локали типа 'en-US' до 'en')
    lang_code = body.language[:2] if body.language else "ru"
    target_lang = LANG_MAP.get(lang_code, "Russian")
    
    logger.info(f"INSIGHTS TEACHER | user_id={user_id} | lang={target_lang}")

    # 2. Формируем системный промпт
    system_prompt = get_teacher_system_prompt(target_lang)

    weak_topics_text = "\n".join(
        f"- '{t.question_text}' — {t.error_rate:.0f}% ошибок ({t.total_answers} ответов)"
        for t in body.weak_topics
    ) or "Слабых тем не выявлено."

    hard_steps_text = "\n".join(
        f"- '{s.message_text[:100]}' — {s.error_rate:.0f}% ошибок"
        for s in body.hardest_scenario_steps
    ) or "Данных по сценариям нет."

    # 3. Пользовательский запрос (входные данные могут быть на русском, ИИ сам переведет ответ)
    user_prompt = f"""
Course Title: "{body.course_title}"
Average Quiz Score: {body.avg_quiz_score:.1f}%
Total Students: {body.total_students}

Weak topics in quizzes:
{weak_topics_text}

Difficult steps in scenarios:
{hard_steps_text}

Provide recommendations for the teacher. Output strictly in {target_lang}.
"""

    result = await groq_chat_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3, # Температура 0.3 делает ИИ более послушным к инструкциям
    )

    logger.info(f"INSIGHTS TEACHER SUCCESS | user_id={user_id} | Translated to: {target_lang}")
    return result


@router.post("/insights/student/")
@limiter.limit("20/minute")
async def student_insights(
    request: Request,
    body: StudentInsightsRequest,
    user_data: dict = Depends(verify_token),
):
    user_id = user_data.get("user_id")
    
    # 1. Извлекаем язык
    lang_code = body.language[:2] if body.language else "ru"
    target_lang = LANG_MAP.get(lang_code, "Russian")
    
    logger.info(f"INSIGHTS STUDENT | user_id={user_id} | lang={target_lang}")

    # 2. Формируем системный промпт
    system_prompt = get_student_system_prompt(target_lang)

    weak_topics_text = "\n".join(
        f"- '{t.question_text}' — {t.error_rate:.0f}% ошибок"
        for t in body.weak_topics
    ) or "Явных слабых тем нет."

    # 3. Пользовательский запрос
    user_prompt = f"""
Student Statistics:
- Quizzes taken: {body.total_quizzes}
- Average score: {body.avg_quiz_score:.1f}%
- Scenario pass rate: {body.scenario_pass_rate:.1f}%

Topics with highest error rate:
{weak_topics_text}

Provide personal recommendations for the student. Output strictly in {target_lang}.
"""

    result = await groq_chat_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3,
    )

    logger.info(f"INSIGHTS STUDENT SUCCESS | user_id={user_id} | Translated to: {target_lang}")
    return result