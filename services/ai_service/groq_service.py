"""
groq_service.py — Вся логика работы с Groq AI.

Содержит:
- Базовый async вызов с таймаутом и retry
- Валидаторы формата сценария (поддержка графов)
- Конвертер speaker → interactive формат
"""

import asyncio
import json
import logging
from typing import Any, Dict, List

from fastapi import HTTPException
from groq import AsyncGroq, RateLimitError, APIStatusError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from config import settings

logger = logging.getLogger("ai_security")

# Единственный экземпляр клиента на весь сервис
aclient = AsyncGroq(api_key=settings.GROQ_API_KEY)


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def safe_json_loads(s: str) -> Dict[str, Any]:
    """Парсит JSON, удаляя markdown code fences если они есть."""
    if not s:
        raise ValueError("Groq вернул пустой ответ.")
    clean = s.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error. Raw response: {s[:500]}")
        raise ValueError(f"Groq вернул невалидный JSON: {e}") from e


# ---------------------------------------------------------------------------
# CORE AI CALL — retry + timeout
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(settings.GROQ_MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((RateLimitError, APIStatusError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def _call_groq(system_prompt: str, user_prompt: str, temperature: float) -> str:
    """Низкоуровневый вызов Groq с retry на 429/503."""
    chat_completion = await aclient.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    return chat_completion.choices[0].message.content


async def groq_chat_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """
    Публичный метод: вызов Groq с таймаутом + retry + парсинг JSON.
    Бросает HTTPException при ошибках — удобно использовать в роутерах.
    """
    try:
        raw = await asyncio.wait_for(
            _call_groq(system_prompt, user_prompt, temperature),
            timeout=settings.GROQ_TIMEOUT_SECONDS,
        )
        return safe_json_loads(raw)

    except asyncio.TimeoutError:
        logger.error("Groq timeout exceeded.")
        raise HTTPException(
            status_code=504,
            detail="AI сервис не ответил вовремя. Попробуйте позже.",
        )
    except (RateLimitError, APIStatusError) as e:
        logger.error(f"Groq API error after retries: {e}")
        raise HTTPException(
            status_code=503,
            detail="AI сервис временно недоступен. Попробуйте позже.",
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# SCENARIO VALIDATORS & CONVERTERS
# ---------------------------------------------------------------------------

def is_interactive_chat_format(scenario: Dict[str, Any]) -> bool:
    """Проверяет что сценарий соответствует новому формату графа (message/choice с id)."""
    scenario_data = scenario.get("scenario_data", scenario)
    steps = scenario_data.get("steps", [])
    
    if not isinstance(steps, list) or len(steps) == 0:
        return False

    for step in steps:
        if not isinstance(step, dict) or "type" not in step or "id" not in step:
            return False
            
    return True


def has_speaker_format(scenario: Dict[str, Any]) -> bool:
    """Определяет, использует ли сценарий устаревший speaker-формат без id."""
    scenario_data = scenario.get("scenario_data", scenario)
    steps = scenario_data.get("steps", [])
    if not isinstance(steps, list) or not steps:
        return False
    # Если есть speaker, text, но нет id — это старый формат
    return any(isinstance(s, dict) and "speaker" in s and "id" not in s for s in steps)


def convert_speaker_to_interactive(scenario: Dict[str, Any]) -> Dict[str, Any]:
    """Аварийный конвертер: если нейросеть отдала старый формат, пытаемся переделать в новый граф."""
    scenario_data = scenario.get("scenario_data", scenario)
    old_steps = scenario_data.get("steps", [])
    
    new_steps = []
    current_id = 1
    
    for item in old_steps:
        if not isinstance(item, dict):
            continue
        speaker = (item.get("speaker") or "").lower()
        text = (item.get("text") or item.get("message") or item.get("content") or "").strip()

        if not text:
            continue

        is_user = any(kw in speaker for kw in ("польз", "user", "victim", "жертв"))
        
        if is_user:
            new_steps.append({
                "id": current_id,
                "type": "choice",
                "options": [
                    {
                        "text": text,
                        "next_step_id": current_id + 1
                    }
                ]
            })
        else:
            new_steps.append({
                "id": current_id,
                "type": "message",
                "speaker": "bot",
                "text": text,
                "next_step_id": current_id + 1
            })
        current_id += 1

    # У последнего шага убираем next_step_id, чтобы граф завершился
    if new_steps:
        new_steps[-1].pop("next_step_id", None)
        
    return {
        "scenario_data": {
            "contact_name": scenario_data.get("contact_name", "Служба безопасности"),
            "steps": new_steps
        }
    }


def validate_choice_options(scenario: Dict[str, Any]) -> None:
    """Проверяет что в каждом choice есть варианты ответов."""
    scenario_data = scenario.get("scenario_data", scenario)
    
    for step in scenario_data.get("steps", []):
        if step.get("type") == "choice":
            opts = step.get("options", [])
            if not isinstance(opts, list) or len(opts) < 1:
                raise HTTPException(
                    status_code=500,
                    detail="AI вернул узел 'choice' без вариантов ответа (options).",
                )