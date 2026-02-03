import os
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- ВАЖНО: РАЗРЕШАЕМ ЗАПРОСЫ С ФРОНТЕНДА (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Для разработки разрешаем всем. В продакшене укажи конкретный домен.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Получение ключа
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.critical("❌ ОШИБКА: GROQ_API_KEY не найден!")
else:
    logger.info(f"✅ AI Service запущен. Ключ: ...{GROQ_API_KEY[-4:]}")

client = Groq(api_key=GROQ_API_KEY)

# --- МОДЕЛИ ДАННЫХ ---

class QuizRequest(BaseModel):
    text: str
    count: int = 3
    difficulty: str = "medium"

class ScenarioRequest(BaseModel):
    topic: str              
    scenario_type: str      # "chat" или "email"
    difficulty: str = "medium"

# --- ЭНДПОИНТ 1: ГЕНЕРАЦИЯ ОБЫЧНЫХ ТЕСТОВ ---
@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    logger.info(f"Запрос на квиз: {request.count} вопросов")
    if len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Текст слишком короткий.")
    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": f"Ты методист. Создай тест. Уровень: {request.difficulty}. Отвечай JSON."},
                {"role": "user", "content": f"Составь {request.count} вопросов по тексту: '{request.text}'. Формат JSON: {{'generated_questions': [...]}}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        return json.loads(chat_completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Error Quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ЭНДПОИНТ 2: ГЕНЕРАЦИЯ СЦЕНАРИЕВ (ЧАТ/EMAIL) ---
@app.post("/generate-scenario")
async def generate_scenario(request: ScenarioRequest):
    logger.info(f"Запрос на сценарий: {request.scenario_type} | Тема: {request.topic}")

    system_prompt = "Ты эксперт по кибербезопасности. Твоя задача — создать обучающую симуляцию атаки на сотрудника."
    user_prompt = ""

    # 1. Сценарий ЧАТА
    if request.scenario_type == "chat":
        user_prompt = f"""
        Создай сценарий диалога (мошенник vs пользователь). Тема: "{request.topic}".
        
        Формат JSON СТРОГО такой:
        {{
          "contact_name": "Имя отправителя",
          "steps": [
            {{ "type": "message", "text": "..." }},
            {{ 
              "type": "choice", 
              "options": [
                {{ "text": "Правильный ответ", "is_correct": true, "feedback": "Похвала" }},
                {{ "text": "Неправильный ответ", "is_correct": false, "feedback": "Объяснение ошибки" }}
              ] 
            }},
            {{ "type": "message", "text": "Реакция бота..." }}
          ]
        }}
        Сделай минимум 3 шага. Язык: Русский.
        """

    # 2. Сценарий EMAIL
    elif request.scenario_type == "email":
        user_prompt = f"""
        Создай фишинговое письмо. Тема: "{request.topic}".
        Если нужна ссылка, используй: <a href='#' class='fake-link' data-url='http://fake.com'>Текст</a>
        
        Формат JSON СТРОГО такой:
        {{
          "subject": "Тема письма",
          "sender_name": "Имя",
          "sender_email": "fake@email.com",
          "body_html": "HTML текст письма",
          "is_phishing": true,
          "explanation": "Почему это фишинг?"
        }}
        Язык: Русский.
        """
    else:
        raise HTTPException(status_code=400, detail="Тип должен быть 'chat' или 'email'")

    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.6
        )
        return json.loads(chat_completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Error Scenario: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}