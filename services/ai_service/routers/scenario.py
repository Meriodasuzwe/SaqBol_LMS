import logging
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from groq_service import (
    groq_chat_json,
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
    SCENARIO_FREE_SYSTEM, 
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
    scenario_rules: Optional[Dict[str, Any]] = None  # 🔥 Шпаргалка от учителя


class ChatReplyResponse(BaseModel):
    reply: str
    isSuccess: Optional[bool] = None
    explanation: Optional[str] = None
    reasoning: Optional[str] = None


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
                "contact_name": "Служба безопасности",
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


# 🔥 НОВЫЙ ЭНДПОИНТ: LIVE-ЧАТ (Свободный ответ + ИИ-Судья) 🔥
@router.post("/chat-reply", response_model=ChatReplyResponse)
@limiter.limit("20/minute") 
async def chat_reply(
    request: Request,
    body: ChatReplyRequest,
):
    try:
        # 1. Формируем правила от учителя в строку
        rules_str = "Правил нет, действуй на свое усмотрение"
        if body.scenario_rules:
            rules_str = json.dumps(body.scenario_rules, ensure_ascii=False, indent=2)

        # 2. Подготавливаем системный промпт (роль + правила)
        system_prompt = SCENARIO_FREE_SYSTEM.substitute(
            contact_name=body.contact_name,
            language=body.language,
            scenario_rules=rules_str
        )
        
        # 3. Собираем историю переписки в единый текстовый контекст для user_prompt
        # (Так как groq_chat_json принимает sys_prompt и user_prompt)
        history_text = "ИСТОРИЯ ДИАЛОГА:\n"
        for msg in body.history:
            role_name = "Ученик" if msg.sender == 'user' else body.contact_name
            history_text += f"[{role_name}]: {msg.text}\n"
            
        user_prompt = (
            f"{history_text}\n"
            f"НОВОЕ СООБЩЕНИЕ ОТ УЧЕНИКА:\n[Ученик]: {body.message}\n\n"
            f"Оцени это сообщение по правилам и верни JSON."
        )
        
        # 4. Отправляем в Groq с ожиданием строгого JSON
        # Используем groq_chat_json, потому что нам нужны ключи reply, isSuccess, explanation
        ai_response = await groq_chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3  # Температура пониже, чтобы он судил логично
        )
        
        # 5. Возвращаем распарсенный JSON на фронтенд
        return ChatReplyResponse(
            reply=ai_response.get("reply", "Ошибка генерации ответа..."),
            isSuccess=ai_response.get("isSuccess"),
            explanation=ai_response.get("explanation")
        )

    except Exception as e:
        logger.error(f"Live Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))