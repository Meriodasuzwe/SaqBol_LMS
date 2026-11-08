"""Artificial 30 + 20 profile block for isolated tests/preview only.

Not official KT content, not verified learning material. Never import into a
working database or publish automatically.
"""
from quizzes.models import Choice, Question, Quiz


def create_profile_quiz(lesson, *, quiz_id=None):
    fields = {
        'lesson': lesson, 'title': 'Демонстрация: профильный блок КТ',
        'description': '50 искусственных вопросов для проверки интеграции. Не официальный материал КТ.',
        'mode': 'kt_profile',
    }
    if quiz_id is not None:
        fields['id'] = quiz_id
    quiz = Quiz.objects.create(**fields)
    items = []
    for index in range(50):
        first = index < 30
        section = 'first_subject' if first else 'second_subject'
        number = index + 1 if first else index - 29
        key_count = 1 if first else (index - 30) % 3 + 1
        question = Question.objects.create(
            quiz=quiz, kt_subject=section,
            text=(
                f'Искусственный вопрос {number}. Какой вариант соответствует условию демонстрации?'
                if first else
                f'Искусственный вопрос {number}. Выберите подходящие варианты SQL.\n'
                'SELECT id, title\nFROM demo_materials\nWHERE published = TRUE;'
            ),
            explanation=f'Демонстрационное объяснение: подходящих вариантов — {key_count}. '
                        'Этот вопрос предназначен для проверки интерфейса и сохранения ответов.',
        )
        choices = [
            Choice.objects.create(
                question=question, text=f'Демонстрационный вариант {option + 1}',
                is_correct=option < key_count,
            )
            for option in range(5 if first else 6)
        ]
        items.append({
            'question': question, 'choices': choices,
            'correct_ids': [choice.pk for choice in choices[:key_count]],
        })
    return quiz, items

