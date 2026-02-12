import os
import json
import logging
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # <--- Для защиты
from jose import JWTError, jwt # <--- Для расшифровки токена
from pydantic import BaseModel
from groq import Groq

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# root_path="/ai" говорит Swagger-у, что все запросы должны идти через префикс /ai
app = FastAPI(
    title="SaqBol AI Service",
    root_path="/ai", 
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- БЕЗОПАСНОСТЬ (SECURITY) ---
security = HTTPBearer()
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-dev-secret-key") # Тот же ключ, что в Django
ALGORITHM = "HS256"

def verify_token(auth: HTTPAuthorizationCredentials = Depends(security)):
    """Проверяет токен, пришедший в заголовке Authorization: Bearer <token>"""
    try:
        token = auth.credentials
        # Расшифровываем токен. Если он поддельный или истек — будет ошибка.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен доступа (Invalid Token)",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- НАСТРОЙКА AI ---
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

# --- ЭНДПОИНТЫ ---

@app.get("/")
def root():
    return {"message": "AI Service is running. Go to /docs for Swagger."}

@app.get("/health")
def health():
    return {"status": "ok"}

# 🔐 ЗАЩИЩЕННЫЙ МЕТОД: Генерация тестов
# Добавили аргумент `user_data=Depends(verify_token)`
@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest, user_data=Depends(verify_token)):
    logger.info(f"User {user_data.get('user_id')} запросил квиз.")
    
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

# 🔐 ЗАЩИЩЕННЫЙ МЕТОД: Генерация сценариев
@app.post("/generate-scenario")
async def generate_scenario(request: ScenarioRequest, user_data=Depends(verify_token)):
    logger.info(f"User {user_data.get('user_id')} запросил сценарий: {request.topic}")

    system_prompt = "Ты эксперт по кибербезопасности. Твоя задача — создать обучающую симуляцию атаки."
    user_prompt = ""

    if request.scenario_type == "chat":
        user_prompt = f"""
        Создай сценарий диалога (мошенник vs пользователь). Тема: "{request.topic}".
        Формат JSON: {{ "contact_name": "...", "steps": [ ... ] }}
        Язык: Русский.
        """
    elif request.scenario_type == "email":
        user_prompt = f"""
        Создай фишинговое письмо. Тема: "{request.topic}".
        Формат JSON: {{ "subject": "...", "body_html": "...", "explanation": "..." }}
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