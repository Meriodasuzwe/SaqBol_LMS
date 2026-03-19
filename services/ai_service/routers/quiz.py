import logging
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from groq_service import groq_chat_json
from prompts import QUIZ_SYSTEM, QUIZ_USER
from schemas import QuizRequest
from security import verify_token

logger = logging.getLogger("ai_security")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/generate-quiz", tags=["Quiz"])


@router.post("")
@limiter.limit(settings.RATE_LIMIT_QUIZ)
async def generate_quiz(
    request: Request,  # нужен slowapi
    body: QuizRequest,
    user_data: dict = Depends(verify_token),
):
    user_id = user_data.get("user_id")
    logger.info(f"QUIZ REQUEST | user_id={user_id} | count={body.count} | difficulty={body.difficulty}")

    result = await groq_chat_json(
        system_prompt=QUIZ_SYSTEM.substitute(difficulty=body.difficulty),
        user_prompt=QUIZ_USER.substitute(count=body.count, text=body.text),
        temperature=0.3,
    )

    question_count = len(result.get("generated_questions", []))
    logger.info(f"QUIZ SUCCESS | user_id={user_id} | questions_generated={question_count}")
    return result