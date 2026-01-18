from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

class TextData(BaseModel):
    text: str

@app.post("/generate-quiz")
async def generate_quiz(data: TextData):
    # Здесь в будущем будет вызов OpenAI/Llama
    # А пока имитируем работу AI
    questions = [
        {
            "text": f"О чем был этот текст: {data.text[:20]}...?",
            "choices": [
                {"text": "Вариант А", "is_correct": True},
                {"text": "Вариант Б", "is_correct": False},
                {"text": "Вариант В", "is_correct": False},
            ]
        }
    ]
    return {"questions": questions}