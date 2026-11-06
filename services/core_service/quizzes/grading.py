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
    is_correct_by_question = {}
    for question_id, correct_ids in correct_answers_ids.items():
        selected = selected_by_question.get(question_id, set())
        # Both an omitted question and an explicit empty selection earn zero,
        # including when content has no correct option configured.
        is_correct = bool(selected) and selected == set(correct_ids)
        is_correct_by_question[question_id] = is_correct
        if is_correct:
            correct_count += 1

    return {
        'score': correct_count * 100 // total_questions,
        'correct_count': correct_count,
        'total_questions': total_questions,
        'correct_answers_ids': correct_answers_ids,
        'is_correct_by_question': is_correct_by_question,
    }


# Rules of comprehensive testing, paragraph 42, revision of 12 June 2023:
# https://adilet.zan.kz/rus/docs/V1900018657
# https://adilet.zan.kz/rus/docs/V2300032777
KT_PROFILE_SCORING_VERSION = 'kt_profile_2023_06_12_v1'


def _kt_section_keys(questions, expected_count, max_correct, section):
    """Reject an incomplete profile block or an invalid server answer key."""
    if not isinstance(questions, dict) or len(questions) != expected_count:
        raise ValueError(f'{section}: expected {expected_count} questions')
    correct_by_question = {}
    for question_id, choices in questions.items():
        if type(question_id) is not int or question_id < 1:
            raise ValueError('Question IDs must be positive integers')
        if not isinstance(choices, dict) or not choices:
            raise ValueError('Every question must have an answer key')
        if any(type(choice_id) is not int or choice_id < 1 or type(correct) is not bool
               for choice_id, correct in choices.items()):
            raise ValueError('Choice IDs must be positive integers and key flags must be booleans')
        correct_ids = {choice_id for choice_id, correct in choices.items() if correct}
        if not 1 <= len(correct_ids) <= max_correct:
            raise ValueError(f'{section}: expected 1 to {max_correct} correct choices per question')
        correct_by_question[question_id] = correct_ids
    return correct_by_question


def _kt_selected_choices(question_choices, answers):
    """Keep invalid input distinct from a valid answer worth zero points.

    This is a pure-calculator guard, not an HTTP serializer. The eventual API
    must retain its own validation/access checks before calling the calculator.
    """
    if not isinstance(answers, list):
        raise ValueError('Answers must be a list')
    selected_by_question = {}
    for answer in answers:
        if not isinstance(answer, dict):
            raise ValueError('Each answer must be an object')
        question_id = answer.get('question_id')
        selected = answer.get('choice_ids')
        if type(question_id) is not int or question_id not in question_choices:
            raise ValueError('Answer question does not belong to this profile block')
        if question_id in selected_by_question:
            raise ValueError('A question must not be answered twice')
        if not isinstance(selected, list) or any(type(choice_id) is not int for choice_id in selected):
            raise ValueError('Selected choice IDs must be a list of integers')
        if len(selected) != len(set(selected)):
            raise ValueError('A selected choice must not repeat')
        if any(choice_id not in question_choices[question_id] for choice_id in selected):
            raise ValueError('Selected choice does not belong to its question')
        selected_by_question[question_id] = set(selected)
    return selected_by_question


def _kt_multiple_choice_points(correct, selected):
    """Paragraph 42's partial credit is NOT set-difference distance.

    For a key of two choices, one correct plus one incorrect earns one point.
    For a key of three, three correct plus one incorrect also earns one point.
    The maximum of three applies to the key, not to the number selected here.
    """
    if selected == correct:
        return 2
    correct_selected = len(selected & correct)
    wrong_selected = len(selected - correct)
    if wrong_selected <= 1 and correct_selected >= max(1, len(correct) - 1):
        return 1
    return 0


def calculate_kt_profile_score(first_subject_questions, second_subject_questions, answers):
    """Calculate only the two-subject KT profile block, without I/O or writes.

    The server supplies separate maps of 30 single-answer and 20 multiple-answer
    questions, each shaped as {question_id: {choice_id: is_correct}}. Answers use
    the existing [{question_id, choice_ids}] shape. Omitted questions earn zero.
    Invalid keys, block sizes or answers raise ValueError before scoring.

    The result contains raw points (30 + 40), per-question points and a policy
    version, never the legacy percentage named ``score``. Input choice count is
    not a question-format validator; the two supplied sections define scoring,
    even when a second-subject question has only one correct choice.

    This opt-in calculator is not wired to submit, persistence or the frontend.
    The existing calculate_submission_score remains the training policy.
    """
    first_keys = _kt_section_keys(first_subject_questions, 30, 1, 'first_subject')
    second_keys = _kt_section_keys(second_subject_questions, 20, 3, 'second_subject')
    if first_keys.keys() & second_keys.keys():
        raise ValueError('Question IDs must not overlap between subjects')
    selected_by_question = _kt_selected_choices(
        {**first_subject_questions, **second_subject_questions}, answers,
    )

    sections = {}
    questions = {}
    for name, keys, max_points in (
        ('first_subject', first_keys, 1), ('second_subject', second_keys, 2),
    ):
        earned = 0
        for question_id, correct in keys.items():
            selected = selected_by_question.get(question_id, set())
            fully_correct = selected == correct
            points = int(fully_correct) if max_points == 1 else _kt_multiple_choice_points(correct, selected)
            questions[question_id] = {
                'earned_points': points, 'max_points': max_points, 'is_correct': fully_correct,
            }
            earned += points
        sections[name] = {
            'earned_points': earned, 'max_points': len(keys) * max_points, 'total_questions': len(keys),
        }

    return {
        'scoring_version': KT_PROFILE_SCORING_VERSION,
        'earned_points': sum(section['earned_points'] for section in sections.values()),
        'max_points': sum(section['max_points'] for section in sections.values()),
        'sections': sections,
        'questions': questions,
    }
