import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from groq import Groq

app = FastAPI()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") 

if not GROQ_API_KEY:
    print("ВНИМАНИЕ: GROQ_API_KEY не найден в переменных окружения!")
    
client = Groq(api_key=GROQ_API_KEY)

class QuizRequest(BaseModel):
    text: str
    count: int = 3
    difficulty: str = "medium"

@app.post("/generate-quiz")
async def generate_quiz(request: QuizRequest):
    print(f"AI Service: Генерация {request.count} вопросов, сложность: {request.difficulty}")

    try:
        chat_completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"Ты профессиональный методист. Создай тест на русском языке. Сложность: {request.difficulty}. Отвечай строго в формате JSON."
                },
                {
                    "role": "user",
                    "content": f"""
                    На основе текста составь ровно {request.count} вопросов.
                    Текст: "{request.text}"
                    
                    Формат ответа:
                    {{
                      "generated_questions": [
                        {{
                          "question": "Текст вопроса",
                          "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
                          "correct_answer": "Вариант 1"
                        }}
                      ]
                    }}
                    """
                }
            ],
            response_format={"type": "json_object"}
        )

        result = json.loads(chat_completion.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Ошибка Groq: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}