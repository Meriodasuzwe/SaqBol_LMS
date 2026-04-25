import logging
from fastapi import APIRouter, Depends, Request
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
)
from schemas import ScenarioRequest
from fastapi import HTTPException
from security import verify_token

logger = logging.getLogger("ai_security")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/generate-scenario", tags=["Scenario"])


# 🔥 Добавили параметр language
async def _generate_chat_scenario(topic: str, difficulty: str, language: str) -> dict:
    """Генерирует интерактивный chat-сценарий с валидацией и fallback."""
    # 🔥 Прокидываем язык в системный и юзер промпты
    sys_prompt = SCENARIO_CHAT_SYSTEM.substitute(difficulty=difficulty, language=language)
    user_prompt = SCENARIO_CHAT_USER.substitute(topic=topic, language=language)

    scenario = await groq_chat_json(sys_prompt, user_prompt, temperature=0.05)

    # Попытка 1: конвертация из speaker-формата
    if has_speaker_format(scenario):
        logger.warning("SCENARIO: got speaker format, converting...")
        scenario = convert_speaker_to_interactive(scenario)

    # Попытка 2: повторный запрос с более строгим промптом
    if not is_interactive_chat_format(scenario):
        logger.warning("SCENARIO: invalid format, retrying with strict prompt...")
        # 🔥 Прокидываем язык и в строгий промпт тоже
        strict_prompt = SCENARIO_CHAT_USER_STRICT.substitute(topic=topic, language=language)
        scenario = await groq_chat_json(sys_prompt, strict_prompt, temperature=0.01)

        if has_speaker_format(scenario):
            scenario = convert_speaker_to_interactive(scenario)

    # Финальная проверка
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
    # Можно добавить язык в логи, чтобы видеть, на каком генерят чаще
    logger.info(
        f"SCENARIO REQUEST | user_id={user_id} | type={body.scenario_type} | "
        f"topic={body.topic[:50]} | difficulty={body.difficulty} | lang={body.language}"
    )

    if body.scenario_type == "chat":
        # 🔥 Передаем язык в функцию генерации чата
        result = await _generate_chat_scenario(body.topic, body.difficulty, body.language)
    else:
        # 🔥 Передаем язык в генерацию email (обрати внимание, SCENARIO_EMAIL_SYSTEM теперь тоже Template)
        result = await groq_chat_json(
            system_prompt=SCENARIO_EMAIL_SYSTEM.substitute(language=body.language),
            user_prompt=SCENARIO_EMAIL_USER.substitute(topic=body.topic, language=body.language),
            temperature=0.1,
        )

    logger.info(f"SCENARIO SUCCESS | user_id={user_id} | type={body.scenario_type}")
    return result