import os
import json
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from groq import Groq

# Настройка профессионального логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# 1. Получение и проверка ключа
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.critical("❌ ОШИБКА: GROQ_API_KEY не найден в переменных окружения!")
else:
    logger.info(f"✅ AI Service запущен. Ключ: ...{GROQ_API_KEY[-4:]}")

client = Groq(api_key=GROQ_API_KEY)

class QuizRequest(BaseModel):
    text: str
    count: int = 3
    difficulty: str = "medium"

@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    logger.info(f"Запрос на генерацию: {request.count} вопросов, сложность: {request.difficulty}")

    # Защита от слишком короткого текста
    if len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Текст слишком короткий для генерации.")

    try:
        # Промпт с запросом объяснений
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"Ты профессиональный методист. Твоя задача — создать тест на русском языке. "
                        f"Уровень сложности: {request.difficulty}. "
                        "Отвечай СТРОГО валидным JSON."
                    )
                },
                {
                    "role": "user",
                    "content": f"""
                    Проанализируй текст и составь ровно {request.count} тестовых вопросов.
                    
                    Текст материала: "{request.text}"
                    
                    Верни ответ строго в таком JSON формате:
                    {{
                      "generated_questions": [
                        {{
                          "question": "Текст вопроса",
                          "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
                          "correct_answer": "Текст правильного ответа (должен совпадать с одним из вариантов)",
                          "explanation": "Короткое объяснение (1-2 предложения), почему этот ответ верный."
                        }}
                      ]
                    }}
                    """
                }
            ],
            # JSON-режим гарантирует структуру
            response_format={"type": "json_object"},
            # Ограничение температуры для более точных фактов
            temperature=0.3 
        )

        # Парсинг ответа
        raw_content = chat_completion.choices[0].message.content
        result = json.loads(raw_content)

        # Дополнительная проверка структуры
        if "generated_questions" not in result:
            logger.error(f"Некорректный ответ AI: {raw_content}")
            # Пытаемся спасти ситуацию, если ключа нет, но список есть (редкий кейс)
            raise ValueError("JSON не содержит ключа generated_questions")

        logger.info(f"Успешно сгенерировано {len(result['generated_questions'])} вопросов.")
        return result

    except json.JSONDecodeError:
        logger.error("Ошибка парсинга JSON от AI")
        raise HTTPException(status_code=500, detail="ИИ вернул некорректный формат данных.")
        
    except Exception as e:
        logger.error(f"Критическая ошибка Groq: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации: {str(e)}")

@app.get("/health")
def health():
    return {"status": "ok", "service": "AI Generator", "model": "llama-3.3"}