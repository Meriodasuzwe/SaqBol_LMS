"""
main.py — Точка входа FastAPI сервиса.

Здесь только:
- Создание приложения
- Подключение middleware
- Регистрация роутеров
- Health-check эндпоинты
"""

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import settings
from routers import course, quiz, scenario, insights

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="{levelname} {asctime} | {message}",
    style="{",
    handlers=[
        logging.FileHandler("logs/ai_security.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("ai_security")


# ---------------------------------------------------------------------------
# APP
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SaqBol AI Service",
    description="AI микросервис для генерации квизов, сценариев и курсов.",
    version="1.0.0",
    root_path="/ai",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Rate limit handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# MIDDLEWARE
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    log_msg = (
        f"[{response.status_code}] {request.method} {request.url.path} "
        f"(IP: {request.client.host}) — {duration:.3f}s"
    )

    if response.status_code >= 500:
        logger.error(f"SERVER ERROR: {log_msg}")
    elif response.status_code >= 400:
        logger.warning(f"CLIENT ERROR: {log_msg}")
    else:
        logger.info(f"OK: {log_msg}")

    return response


# ---------------------------------------------------------------------------
# ROUTERS
# ---------------------------------------------------------------------------
app.include_router(quiz.router)
app.include_router(scenario.router)
app.include_router(course.router)
app.include_router(insights.router)


# ---------------------------------------------------------------------------
# BASE ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/", tags=["System"])
def root():
    return {"message": "SaqBol AI Service is running.", "docs": "/ai/docs"}


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}