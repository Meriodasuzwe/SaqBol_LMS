from pydantic import BaseModel, Field, field_validator
from typing import Literal


class QuizRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000, description="Текст для генерации вопросов")
    count: int = Field(default=3, ge=1, le=20, description="Количество вопросов")
    difficulty: Literal["easy", "medium", "hard"] = Field(default="medium")

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Текст не может быть пустым.")
        return v.strip()


class ScenarioRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500, description="Тема сценария")
    scenario_type: Literal["chat", "email"] = Field(..., description="Тип сценария")
    difficulty: Literal["easy", "medium", "hard"] = Field(default="medium")