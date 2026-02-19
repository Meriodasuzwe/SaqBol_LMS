import os
import time
import json
import logging
import io  # Для работы с файлами в оперативной памяти (безопасно)
import fitz  # Это библиотека PyMuPDF
import docx  # Это python-docx

from fastapi import FastAPI, HTTPException, Depends, status, Request,UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # <--- Для защиты
from jose import JWTError, jwt # <--- Для расшифровки токена
from pydantic import BaseModel
from groq import Groq

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
# Создаем папку для логов, если нет
if not os.path.exists("logs"):
    os.makedirs("logs")

# Настраиваем формат, как в Django
logging.basicConfig(
    level=logging.INFO,
    format="{levelname} {asctime} | {message}",
    style="{",
    handlers=[
        logging.FileHandler("logs/ai_security.log"), # Пишем в файл
        logging.StreamHandler() # И в консоль
    ]
)
logger = logging.getLogger("ai_security")

app = FastAPI(
    title="SaqBol AI Service",
    root_path="/ai", 
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# --- MIDDLEWARE (ПЕРЕХВАТЧИК ЗАПРОСОВ) ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Обрабатываем запрос
    response = await call_next(request)
    
    # Считаем время
    duration = time.time() - start_time
    
    # Логируем (IP, Метод, Путь, Статус, Время)
    log_msg = f"[{response.status_code}] {request.method} {request.url.path} (IP: {request.client.host}) - {duration:.3f}s"
    
    if response.status_code >= 500:
        logger.error(f"SERVER ERROR: {log_msg}")
    elif response.status_code >= 400:
        logger.warning(f"CLIENT ERROR: {log_msg}")
    else:
        logger.info(f"AI ACTION: {log_msg}")
        
    return response

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SECURITY ---
security = HTTPBearer()
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-dev-secret-key")
ALGORITHM = "HS256"

def verify_token(auth: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = auth.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        logger.warning("Authentication failed: Invalid Token") # Логируем ошибку входа
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Token",
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


# --- ИМПОРТ КУРСА ИЗ PDF/WORD ---
@app.post("/generate-course-from-file")
async def generate_course_from_file(
    file: UploadFile = File(...),
    user_data=Depends(verify_token)
):
    user_id = user_data.get('user_id', 'Unknown')
    logger.info(f"FILE UPLOAD: User ID {user_id} uploaded {file.filename}")
    
    if not client:
        raise HTTPException(500, "Groq API Key missing")

    # 1. Проверяем расширение файла
    allowed_extensions = [".pdf", ".docx"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        logger.warning(f"FILE ERROR: Unsupported extension {file_ext}")
        raise HTTPException(400, "Неподдерживаемый формат. Загрузите PDF или DOCX.")

    # 2. Читаем файл в оперативную память (Memory)
    # Это безопасно, так как мы не сохраняем потенциально вредоносный файл на диск контейнера
    try:
        content = await file.read()
        extracted_text = ""

        if file_ext == ".pdf":
            # Парсим PDF
            pdf_doc = fitz.open(stream=content, filetype="pdf")
            for page in pdf_doc:
                extracted_text += page.get_text() + "\n"
                
        elif file_ext == ".docx":
            # Парсим Word
            doc = docx.Document(io.BytesIO(content))
            extracted_text = "\n".join([para.text for para in doc.paragraphs])

    except Exception as e:
        logger.error(f"FILE PARSE ERROR: {str(e)}")
        raise HTTPException(500, f"Ошибка при чтении файла: {str(e)}")

    # 3. Валидация текста
    extracted_text = extracted_text.strip()
    if len(extracted_text) < 100:
        raise HTTPException(400, "Файл пуст или текст не удалось распознать (возможно, это сканы без OCR).")

    # Обрезаем текст, чтобы не превысить лимит токенов Groq (Llama 3 принимает много, но лучше перестраховаться)
    max_chars = 30000 
    extracted_text = extracted_text[:max_chars]

    # 4. Формируем строгий Промпт для Нейросети
    system_prompt = """
    Ты профессиональный методист и проектировщик образовательных программ.
    Тебе на вход дается сырой текст из документа (рабочей программы или лекций).
    Твоя задача — проанализировать его и составить полноценную структуру курса.
    
    Ты должен вернуть СТРОГО валидный JSON в следующем формате, без лишних слов:
    {
        "course_title": "Краткое и емкое название курса",
        "course_description": "Описание курса (2-3 предложения)",
        "lessons": [
            {
                "title": "Название урока 1",
                "content": "Подробный контент урока, написанный понятно для студентов на основе текста документа. Минимум 3-4 абзаца с сохранением терминологии."
            },
            {
                "title": "Название урока 2",
                "content": "Подробный контент..."
            }
        ]
    }
    Сделай от 3 до 7 уроков в зависимости от объема исходного текста.
    """

    try:
        logger.info(f"AI PARSING: Sending {len(extracted_text)} chars to Groq...")
        
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Сгенерируй структуру курса на основе этого текста:\n\n{extracted_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2 # Низкая температура для большей точности и следования фактам
        )
        
        response_data = json.loads(chat_completion.choices[0].message.content)
        logger.info(f"AI PARSING SUCCESS: Course '{response_data.get('course_title')}' generated.")
        
        return response_data

    except Exception as e:
        logger.error(f"AI PARSING ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации курса: {str(e)}")