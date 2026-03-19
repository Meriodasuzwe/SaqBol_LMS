import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- SECURITY ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    # --- AI ---
    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_TIMEOUT_SECONDS: float = 30.0
    GROQ_MAX_RETRIES: int = 3

    # --- LIMITS ---
    MAX_FILE_SIZE_MB: int = 10
    MAX_TEXT_CHARS: int = 15000
    RATE_LIMIT_QUIZ: str = "10/minute"
    RATE_LIMIT_SCENARIO: str = "10/minute"
    RATE_LIMIT_COURSE: str = "5/minute"

    # --- CORS ---
    ALLOWED_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> Settings:
    secret_key = os.getenv("DJANGO_SECRET_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    if not secret_key:
        raise RuntimeError("❌ DJANGO_SECRET_KEY не задан! Остановка сервиса.")
    if not groq_key:
        raise RuntimeError("❌ GROQ_API_KEY не задан! Остановка сервиса.")

    return Settings(SECRET_KEY=secret_key, GROQ_API_KEY=groq_key)


settings = get_settings()