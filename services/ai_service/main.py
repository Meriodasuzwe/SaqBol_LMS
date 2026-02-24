import os
import time
import json
import logging
import io
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
import docx  # python-docx

from fastapi import FastAPI, HTTPException, Depends, status, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel
from groq import Groq


# --- LOGGING ---
if not os.path.exists("logs"):
    os.makedirs("logs")

logging.basicConfig(
    level=logging.INFO,
    format="{levelname} {asctime} | {message}",
    style="{",
    handlers=[
        logging.FileHandler("logs/ai_security.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ai_security")


# --- APP ---
app = FastAPI(
    title="SaqBol AI Service",
    root_path="/ai",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    log_msg = f"[{response.status_code}] {request.method} {request.url.path} (IP: {request.client.host}) - {duration:.3f}s"

    if response.status_code >= 500:
        logger.error(f"SERVER ERROR: {log_msg}")
    elif response.status_code >= 400:
        logger.warning(f"CLIENT ERROR: {log_msg}")
    else:
        logger.info(f"AI ACTION: {log_msg}")

    return response


# --- CORS ---
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
        logger.warning("Authentication failed: Invalid Token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --- AI SETUP ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.critical("❌ GROQ_API_KEY не найден!")
client = Groq(api_key=GROQ_API_KEY)


# --- DATA MODELS ---
class QuizRequest(BaseModel):
    text: str
    count: int = 3
    difficulty: str = "medium"


class ScenarioRequest(BaseModel):
    topic: str
    scenario_type: str  # "chat" | "email"
    difficulty: str = "medium"


# --- HELPERS ---

def safe_json_loads(s: str) -> Dict[str, Any]:
    """Parse JSON safely, stripping code fences."""
    if not s:
        return {}
    clean = s.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)

def is_interactive_chat_format(scenario: Dict[str, Any]) -> bool:
    """Check if scenario looks like correct interactive format."""
    steps = scenario.get("steps", [])
    if not isinstance(steps, list) or len(steps) == 0:
        return False
    # must have type keys
    if any("type" not in step for step in steps if isinstance(step, dict)):
        return False
    # must alternate message/choice
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            return False
        if i % 2 == 0:
            if step.get("type") != "message":
                return False
            if not isinstance(step.get("text"), str) or not step.get("text").strip():
                return False
        else:
            if step.get("type") != "choice":
                return False
            opts = step.get("options")
            if not isinstance(opts, list) or len(opts) < 2:
                return False
    return True

def has_speaker_format(scenario: Dict[str, Any]) -> bool:
    steps = scenario.get("steps", [])
    if not isinstance(steps, list) or not steps:
        return False
    return any(isinstance(s, dict) and "speaker" in s for s in steps)

def convert_speaker_to_interactive(scenario: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert legacy speaker/text dialogue into interactive message/choice.
    We keep only scammer/attacker lines as message, after each message we insert a choice.
    """
    steps_in = scenario.get("steps", [])
    out_steps: List[Dict[str, Any]] = []

    # базовые варианты (можешь усилить/усложнить потом)
    default_choice = {
        "type": "choice",
        "options": [
            {
                "text": "Отказаться, завершить разговор и проверить информацию через официальный канал.",
                "is_correct": True,
                "feedback": "Правильно: верифицируйте запрос через официальный номер/почту, не передавайте секреты."
            },
            {
                "text": "Сразу сообщить свои данные/пароль, чтобы быстрее восстановили доступ.",
                "is_correct": False,
                "feedback": "Ошибка: это похоже на социнжиниринг. Никогда не передавайте пароли/коды."
            }
        ]
    }

    for item in steps_in:
        if not isinstance(item, dict):
            continue
        speaker = (item.get("speaker") or "").lower()
        text = (item.get("text") or item.get("message") or item.get("content") or "").strip()
        if not text:
            continue

        # считаем мошенником всё, что не "пользователь"
        is_user = ("польз" in speaker) or ("user" in speaker) or ("victim" in speaker)
        if is_user:
            continue

        out_steps.append({"type": "message", "text": text})
        out_steps.append(json.loads(json.dumps(default_choice)))  # копия

    # если вообще ничего не собрали — вернём как есть (пусть дальше упадёт)
    return {
        "contact_name": scenario.get("contact_name", "Служба безопасности"),
        "steps": out_steps[:12]  # 6 сообщений -> 12 шагов
    }

def validate_choice_options_have_one_correct(scenario: Dict[str, Any]) -> None:
    """Optional strict validation: each choice should have at least one true and one false."""
    steps = scenario.get("steps", [])
    for step in steps:
        if step.get("type") == "choice":
            opts = step.get("options", [])
            trues = sum(1 for o in opts if o.get("is_correct") is True)
            falses = sum(1 for o in opts if o.get("is_correct") is False)
            if trues < 1 or falses < 1:
                raise HTTPException(
                    status_code=500,
                    detail="AI вернул choice без нормальной разметки правильного/неправильного варианта."
                )

def groq_chat_json(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
    """One Groq call that expects json_object."""
    chat_completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=temperature
    )
    content = chat_completion.choices[0].message.content
    return safe_json_loads(content)


# --- ENDPOINTS ---
@app.get("/")
def root():
    return {"message": "AI Service is running. Go to /docs for Swagger."}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest, user_data=Depends(verify_token)):
    logger.info(f"User {user_data.get('user_id')} запросил квиз.")
    if len(request.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Текст слишком короткий.")

    try:
        system_prompt = f"Ты методист. Создай тест. Уровень: {request.difficulty}. Отвечай JSON."
        user_prompt = (
            f"Составь {request.count} вопросов по тексту: '{request.text}'. "
            f"Формат JSON: {{'generated_questions': [...]}}"
        )
        return groq_chat_json(system_prompt, user_prompt, temperature=0.3)
    except Exception as e:
        logger.error(f"Error Quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-scenario")
async def generate_scenario(request: ScenarioRequest, user_data=Depends(verify_token)):
    logger.info(
        f"User {user_data.get('user_id')} запросил сценарий: {request.topic} | type={request.scenario_type}"
    )

    if request.scenario_type not in ("chat", "email"):
        raise HTTPException(status_code=400, detail="Тип должен быть 'chat' или 'email'")

    # --- PROMPTS ---
    if request.scenario_type == "chat":
        system_prompt = f"""
ВЫ — СТРОГИЙ REST API СЕРВЕР. ВЕРНИ ВАЛИДНЫЙ JSON ДЛЯ ИНТЕРАКТИВНОГО ТРЕНАЖЕРА.

ОБЯЗАТЕЛЬНО:
- Используй ТОЛЬКО ключи: contact_name, steps, type, text, options, is_correct, feedback.
- НЕ используй: step, speaker, moshenik, polzovatel, user, victim.
- В steps строго чередуй:
  0) {{ "type": "message", "text": "..." }}
  1) {{ "type": "choice", "options": [ ... ] }}
  2) message
  3) choice
  ...
- В message текст ТОЛЬКО от злоумышленника (никаких "Вы:", "Пользователь:" и т.п.)
- В choice минимум 2 options: хотя бы 1 is_correct:true и 1 is_correct:false.

Уровень сложности: {request.difficulty}

ФОРМАТ:
{{
  "contact_name": "Имя злоумышленника",
  "steps": [
    {{ "type": "message", "text": "..." }},
    {{ "type": "choice", "options": [
      {{ "text": "...", "is_correct": false, "feedback": "..." }},
      {{ "text": "...", "is_correct": true,  "feedback": "..." }}
    ]}}
  ]
}}
""".strip()

        user_prompt = (
            f"Сгенерируй сценарий из 4-6 шагов (строго чередуя message и choice) "
            f"на тему: '{request.topic}'. Язык: русский. Верни ТОЛЬКО JSON."
        )

    else:
        system_prompt = "Ты эксперт по фишингу. Отвечай СТРОГО в формате JSON."
        user_prompt = f"""
Создай фишинговое письмо. Тема: "{request.topic}".
Формат JSON: {{ "subject": "Тема письма", "body_html": "Текст письма", "explanation": "Объяснение уловок" }}
Язык: Русский.
Верни ТОЛЬКО JSON.
""".strip()

    # --- GENERATION WITH RETRY ---
    try:
        # 1) первый вызов
        scenario = groq_chat_json(system_prompt, user_prompt, temperature=0.05)

        if request.scenario_type == "chat":
            # если AI вернул speaker-формат — конвертим
            if has_speaker_format(scenario):
                logger.warning("AI returned speaker-format. Converting to interactive.")
                scenario = convert_speaker_to_interactive(scenario)

            # если не интерактивный — ретрай один раз жёстко
            if not is_interactive_chat_format(scenario):
                logger.warning("AI returned invalid chat format. Retrying with stricter prompt.")
                strict_user_prompt = (
                    user_prompt
                    + "\n\nВАЖНО: запрещено использовать speaker. Каждый шаг обязан иметь поле type."
                )
                scenario = groq_chat_json(system_prompt, strict_user_prompt, temperature=0.01)

                if has_speaker_format(scenario):
                    logger.warning("Retry returned speaker-format. Converting to interactive.")
                    scenario = convert_speaker_to_interactive(scenario)

            # финальная проверка
            if not is_interactive_chat_format(scenario):
                logger.error("SCENARIO FORMAT ERROR: AI did not follow required message/choice alternation.")
                raise HTTPException(status_code=500, detail="AI не сгенерировал правильный формат сценария. Попробуйте снова.")

            # доп. строгая проверка правильных/неправильных вариантов
            validate_choice_options_have_one_correct(scenario)

        return scenario

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error Scenario: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-course-from-file")
async def generate_course_from_file(file: UploadFile = File(...), user_data=Depends(verify_token)):
    user_id = user_data.get('user_id', 'Unknown')
    logger.info(f"FILE UPLOAD: User ID {user_id} uploaded {file.filename}")

    allowed_extensions = [".pdf", ".docx"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        logger.warning(f"FILE ERROR: Unsupported extension {file_ext}")
        raise HTTPException(400, "Неподдерживаемый формат. Загрузите PDF или DOCX.")

    try:
        content = await file.read()
        extracted_text = ""

        if file_ext == ".pdf":
            pdf_doc = fitz.open(stream=content, filetype="pdf")
            for page in pdf_doc:
                extracted_text += page.get_text() + "\n"

        elif file_ext == ".docx":
            doc = docx.Document(io.BytesIO(content))
            extracted_text = "\n".join([para.text for para in doc.paragraphs])

    except Exception as e:
        logger.error(f"FILE PARSE ERROR: {str(e)}")
        raise HTTPException(500, f"Ошибка при чтении файла: {str(e)}")

    extracted_text = extracted_text.strip()
    if len(extracted_text) < 100:
        raise HTTPException(400, "Файл пуст или текст не удалось распознать (возможно, это сканы без OCR).")

    extracted_text = extracted_text[:30000]

    system_prompt = """
Ты профессиональный методист и проектировщик образовательных программ.
Тебе на вход дается сырой текст из документа (рабочей программы или лекций).
Твоя задача — проанализировать его и составить полноценную структуру курса.

Верни СТРОГО валидный JSON:
{
  "course_title": "...",
  "course_description": "...",
  "lessons": [
    {"title": "...", "content": "..."}
  ]
}
Сделай от 3 до 7 уроков в зависимости от объема исходного текста.
""".strip()

    try:
        logger.info(f"AI PARSING: Sending {len(extracted_text)} chars to Groq...")

        result = groq_chat_json(
            system_prompt,
            f"Сгенерируй структуру курса на основе этого текста:\n\n{extracted_text}",
            temperature=0.2
        )

        logger.info(f"AI PARSING SUCCESS: Course '{result.get('course_title')}' generated.")
        return result

    except Exception as e:
        logger.error(f"AI PARSING ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка генерации курса: {str(e)}")