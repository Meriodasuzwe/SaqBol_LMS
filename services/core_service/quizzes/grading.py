"""Server-side scoring shared by submission and future attempt persistence."""


def calculate_submission_score(question_choices, answers):
    """Score validated answers against one materialized quiz answer key.

    question_choices maps every question ID to {choice ID: is_correct}.
    QuizSubmissionSerializer must validate answers against this same map first.
    The function does no database writes and has no pass/fail threshold.
    """
    total_questions = len(question_choices)
    if total_questions == 0:
        raise ValueError('В тесте нет вопросов')

    selected_by_question = {
        answer['question_id']: set(answer['choice_ids']) for answer in answers
    }
    correct_answers_ids = {
        question_id: sorted(choice_id for choice_id, is_correct in choices.items() if is_correct)
        for question_id, choices in question_choices.items()
    }
    correct_count = 0
    for question_id, correct_ids in correct_answers_ids.items():
        selected = selected_by_question.get(question_id, set())
        # Both an omitted question and an explicit empty selection earn zero,
        # including when content has no correct option configured.
        if selected and selected == set(correct_ids):
            correct_count += 1

    return {
        'score': correct_count * 100 // total_questions,
        'correct_count': correct_count,
        'total_questions': total_questions,
        'correct_answers_ids': correct_answers_ids,
    }
