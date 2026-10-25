from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- SECURITY ---
    SECRET_KEY: str = Field(validation_alias="DJANGO_SECRET_KEY", min_length=1)
    ALGORITHM: str = "HS256"

    # --- AI ---
    GROQ_API_KEY: str = Field(min_length=1)
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


def get_settings() -> Settings:
    # Let BaseSettings load both process variables and a shared .env file.
    return Settings()


settings = get_settings()
