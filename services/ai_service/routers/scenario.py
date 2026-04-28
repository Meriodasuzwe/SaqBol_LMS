import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from groq_service import (
    groq_chat_json,
    groq_chat_text,  # 🔥 НОВЫЙ ИМПОРТ
    has_speaker_format,
    convert_speaker_to_interactive,
    is_interactive_chat_format,
    validate_choice_options,
)
from prompts import (
    SCENARIO_CHAT_SYSTEM,
    SCENARIO_CHAT_USER,
    SCENARIO_CHAT_USER_STRICT,
    SCENARIO_EMAIL_SYSTEM,
    SCENARIO_EMAIL_USER,
    SCENARIO_FREE_SYSTEM, # 🔥 НОВЫЙ ИМПОРТ
)
from schemas import ScenarioRequest
from security import verify_token

logger = logging.getLogger("ai_security")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/generate-scenario", tags=["Scenario"])

# ---------------------------------------------------------------------------
# MODELS ДЛЯ LIVE-ЧАТА
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatReplyRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    contact_name: str = "Мошенник"
    language: str = "Русский"

class ChatReplyResponse(BaseModel):
    reply: str
    isSuccess: Optional[bool] = None
    explanation: Optional[str] = None


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

async def _generate_chat_scenario(topic: str, difficulty: str, language: str) -> dict:
    """Генерирует интерактивный chat-сценарий (граф) с валидацией и fallback."""
    sys_prompt = SCENARIO_CHAT_SYSTEM.substitute(difficulty=difficulty, language=language)
    user_prompt = SCENARIO_CHAT_USER.substitute(topic=topic, language=language)

    scenario = await groq_chat_json(sys_prompt, user_prompt, temperature=0.05)

    if has_speaker_format(scenario):
        logger.warning("SCENARIO: got speaker format, converting...")
        scenario = convert_speaker_to_interactive(scenario)

    if not is_interactive_chat_format(scenario):
        logger.warning("SCENARIO: invalid format, retrying with strict prompt...")
        strict_prompt = SCENARIO_CHAT_USER_STRICT.substitute(topic=topic, language=language)
        scenario = await groq_chat_json(sys_prompt, strict_prompt, temperature=0.01)

        if has_speaker_format(scenario):
            scenario = convert_speaker_to_interactive(scenario)

    if not is_interactive_chat_format(scenario):
        raise HTTPException(
            status_code=500,
            detail="AI не смог сгенерировать сценарий в правильном формате. Попробуйте другую тему.",
        )

    validate_choice_options(scenario)
    return scenario


@router.post("")
@limiter.limit(settings.RATE_LIMIT_SCENARIO)
async def generate_scenario(
    request: Request,
    body: ScenarioRequest,
    user_data: dict = Depends(verify_token),
):
    user_id = user_data.get("user_id")
    logger.info(
        f"SCENARIO REQUEST | user_id={user_id} | type={body.scenario_type} | "
        f"topic={body.topic[:50]} | difficulty={body.difficulty} | lang={body.language}"
    )

    # Заглушка для нового типа (если мы генерируем начальные данные свободного ответа)
    if body.scenario_type == "free_response":
        result = {
            "scenario_data": {
                "contact_name": "Служба безопасности (АИ)",
                "steps": [
                    {
                        "id": 1,
                        "type": "message",
                        "speaker": "bot",
                        "text": f"Здравствуйте. Мы зафиксировали подозрительную активность по вашему счету. Подтвердите вашу личность.",
                        "next_step_id": None
                    }
                ]
            }
        }
    elif body.scenario_type == "chat":
        result = await _generate_chat_scenario(body.topic, body.difficulty, body.language)
    else:
        result = await groq_chat_json(
            system_prompt=SCENARIO_EMAIL_SYSTEM.substitute(language=body.language),
            user_prompt=SCENARIO_EMAIL_USER.substitute(topic=body.topic, language=body.language),
            temperature=0.1,
        )

    logger.info(f"SCENARIO SUCCESS | user_id={user_id} | type={body.scenario_type}")
    return result


# 🔥 НОВЫЙ ЭНДПОИНТ: LIVE-ЧАТ (Свободный ответ) 🔥
@router.post("/chat-reply", response_model=ChatReplyResponse)
@limiter.limit("20/minute") # Отдельный лимит для чата (сообщения могут лететь часто)
async def chat_reply(
    request: Request,
    body: ChatReplyRequest,
    # Мы убрали Depends(verify_token) здесь, так как этот запрос делает 
    # наш собственный Django-бэкенд, а не фронтенд (Django уже проверил токен)
):
    try:
        # 1. Подготавливаем системный промпт
        system_prompt = SCENARIO_FREE_SYSTEM.substitute(
            contact_name=body.contact_name,
            language=body.language
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # 2. Восстанавливаем контекст истории
        for msg in body.history:
            role = "user" if msg.sender == 'user' else "assistant"
            messages.append({"role": role, "content": msg.text})
            
        # 3. Текущее сообщение пользователя
        messages.append({"role": "user", "content": body.message})
        
        # 4. Отправляем в Groq
        ai_reply = await groq_chat_text(messages=messages, temperature=0.7)
        
        # 5. Парсим ответ на [SUCCESS] или [FATAL]
        is_success = None
        explanation = None

        if "[SUCCESS]" in ai_reply:
            is_success = True
            ai_reply = ai_reply.replace("[SUCCESS]", "").strip()
            explanation = "Вы успешно отразили атаку и не поддались на уловки злоумышленника!"
            
            # Если ИИ дал более подробное объяснение с новой строки
            parts = ai_reply.split('\n', 1)
            if len(parts) > 1:
                ai_reply = parts[0].strip()
                explanation = parts[1].strip()
                
        elif "[FATAL]" in ai_reply:
            is_success = False
            ai_reply = ai_reply.replace("[FATAL]", "").strip()
            explanation = "Критическая ошибка. Вы выдали конфиденциальные данные злоумышленнику."
            
            parts = ai_reply.split('\n', 1)
            if len(parts) > 1:
                ai_reply = parts[0].strip()
                explanation = parts[1].strip()
                
        return ChatReplyResponse(
            reply=ai_reply,
            isSuccess=is_success,
            explanation=explanation
        )

    except Exception as e:
        logger.error(f"Live Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))