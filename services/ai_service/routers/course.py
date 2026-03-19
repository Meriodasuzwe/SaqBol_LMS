import io
import logging
import os

import docx
import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from groq_service import groq_chat_json
from prompts import COURSE_SYSTEM, COURSE_USER
from security import verify_token

logger = logging.getLogger("ai_security")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/generate-course-from-file", tags=["Course"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024


def extract_text_from_pdf(content: bytes) -> str:
    pdf_doc = fitz.open(stream=content, filetype="pdf")
    return "\n".join(page.get_text() for page in pdf_doc)


def extract_text_from_docx(content: bytes) -> str:
    doc = docx.Document(io.BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs)


@router.post("")
@limiter.limit(settings.RATE_LIMIT_COURSE)
async def generate_course_from_file(
    request: Request,
    file: UploadFile = File(...),
    user_data: dict = Depends(verify_token),
):
    user_id = user_data.get("user_id", "Unknown")
    logger.info(f"FILE UPLOAD | user_id={user_id} | filename={file.filename}")

    # --- Валидация расширения ---
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Неподдерживаемый формат. Загрузите PDF или DOCX.")

    # --- Чтение и проверка размера ---
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            413,
            f"Файл слишком большой. Максимум {settings.MAX_FILE_SIZE_MB} MB.",
        )

    # --- Извлечение текста ---
    try:
        if file_ext == ".pdf":
            extracted_text = extract_text_from_pdf(content)
        else:
            extracted_text = extract_text_from_docx(content)
    except Exception as e:
        logger.error(f"FILE PARSE ERROR | user_id={user_id} | error={e}", exc_info=True)
        raise HTTPException(500, f"Не удалось прочитать файл: {e}")

    extracted_text = extracted_text.strip()
    if len(extracted_text) < 100:
        raise HTTPException(400, "Файл пуст или текст не удалось извлечь.")

    # --- Обрезка до лимита токенов ---
    truncated = extracted_text[: settings.MAX_TEXT_CHARS]
    if len(extracted_text) > settings.MAX_TEXT_CHARS:
        logger.info(
            f"FILE TRUNCATED | user_id={user_id} | "
            f"original={len(extracted_text)} → used={settings.MAX_TEXT_CHARS} chars"
        )

    # --- Генерация курса ---
    logger.info(f"AI COURSE | user_id={user_id} | chars={len(truncated)}")
    result = await groq_chat_json(
        system_prompt=COURSE_SYSTEM,
        user_prompt=COURSE_USER.substitute(text=truncated),
        temperature=0.2,
    )

    logger.info(f"AI COURSE SUCCESS | user_id={user_id} | title={result.get('course_title')}")
    return result