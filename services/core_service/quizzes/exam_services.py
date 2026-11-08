"""Server lifecycle for configured exams; ordinary lesson quiz submission is unchanged.

The private start snapshot is authoritative. All mutations lock one attempt; a
late write returns an error *after* committing expiry of previously saved answers.
"""
from copy import deepcopy
from datetime import timedelta
import hashlib
import json

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from analytics.models import QuestionAnswer, QuizAttemptDetail
from .exam_config import configurations, get_configuration
from .grading import KT_PROFILE_SCORING_VERSION, calculate_kt_profile_score
from .models import Choice, ExamAttempt, Question, Quiz, Result


def _error(code, detail, attempt=None):
    error = {'code': code, 'detail': detail}
    if attempt is not None:
        error.update(attempt_id=str(attempt.pk), revision=attempt.revision)
        if attempt.result_id is not None:
            error['result_id'] = attempt.result_id
    return error


def _configuration_or_error(key):
    config = get_configuration(key)
    if config is None:
        raise ValidationError({'configuration_id': 'Неизвестная конфигурация экзамена.'})
    if config.get('unavailable_reason'):
        raise ValidationError({'configuration_id': config['unavailable_reason']})
    if config.get('scoring_version') != KT_PROFILE_SCORING_VERSION:
        raise ValidationError({'configuration_id': 'Эта версия оценивания пока не поддерживается.'})
    return config


def _source_quiz(config, *, lock=False):
    query = Quiz.objects.filter(
        exam_configuration_key=config['id'], mode=Quiz.Mode.KT_PROFILE,
        lesson__course__status='published',
    ).select_related('lesson__course')
    if lock:
        query = query.select_for_update()
    matches = list(query.order_by('id')[:2])
    if len(matches) != 1:
        reason = ('Для этой конфигурации ещё нет опубликованного набора вопросов.' if not matches
                  else 'К конфигурации привязано несколько наборов; требуется однозначная настройка.')
        raise ValidationError({'configuration_id': reason})
    return matches[0]


def _freeze_content(quiz, config, *, lock=False):
    questions = Question.objects.filter(quiz=quiz).order_by('id')
    choices = Choice.objects.order_by('id')
    if lock:
        questions = questions.select_for_update()
        choices = choices.select_for_update()
    if questions.count() != config['total_questions']:
        raise ValidationError({'configuration_id': 'Количество вопросов не соответствует конфигурации экзамена.'})
    rows = list(questions.prefetch_related(Prefetch('choices', queryset=choices)))
    section_order = {section['id']: index for index, section in enumerate(config['sections'])}
    if any(row.kt_subject not in section_order for row in rows):
        raise ValidationError({'configuration_id': 'Для каждого вопроса должен быть указан предмет конфигурации.'})
    rows.sort(key=lambda row: (section_order[row.kt_subject], row.pk))
    numbers = {section: 0 for section in section_order}
    frozen = []
    for position, question in enumerate(rows):
        numbers[question.kt_subject] += 1
        options = list(question.choices.all())
        frozen.append({
            'id': question.pk, 'position': position, 'section_id': question.kt_subject,
            'number': numbers[question.kt_subject], 'text': question.text,
            'explanation': question.explanation,
            'choices': [{'id': choice.pk, 'text': choice.text} for choice in options],
            'correct_choice_ids': [choice.pk for choice in options if choice.is_correct],
        })
    snapshot = {'quiz': {'id': quiz.pk, 'title': quiz.title}, 'questions': frozen}
    try:
        _grade(snapshot, {})  # Existing grader validates server keys and exact 30/20 structure.
    except ValueError as error:
        raise ValidationError({'configuration_id': 'Набор вопросов или правильных ответов настроен некорректно.'}) from error
    return snapshot


def _grade(snapshot, answers):
    sections = {'first_subject': {}, 'second_subject': {}}
    for question in snapshot['questions']:
        correct = set(question['correct_choice_ids'])
        sections[question['section_id']][question['id']] = {
            choice['id']: choice['id'] in correct for choice in question['choices']
        }
    payload = [{'question_id': int(qid), 'choice_ids': selected} for qid, selected in answers.items()]
    return calculate_kt_profile_score(sections['first_subject'], sections['second_subject'], payload)


def list_configurations(user):
    """Availability is evidence from a bound published source, never an attempt write."""
    output = []
    for candidate in configurations():
        config = deepcopy(candidate)
        reason = config.get('unavailable_reason')
        if not reason:
            try:
                checked = _configuration_or_error(config['id'])
                _freeze_content(_source_quiz(checked), checked)
            except ValidationError as error:
                values = error.detail.values() if isinstance(error.detail, dict) else error.detail
                reason = str(next(iter(values), 'Конфигурация недоступна.'))
        config['available'] = not bool(reason)
        config['unavailable_reason'] = reason or None
        output.append(config)
    return output


def _owned_locked(user, attempt_id):
    attempt = ExamAttempt.objects.select_for_update().filter(pk=attempt_id, student=user).first()
    if attempt is None:
        raise NotFound('Попытка не найдена.')
    return attempt


def _expired(attempt, now):
    return attempt.status == 'active' and attempt.deadline is not None and now >= attempt.deadline


def _canonical(data):
    canonical = {
        'revision': data['revision'],
        'answers': sorted(
            (answer['question_id'], sorted(answer['choice_ids']))
            for answer in data['answers'] if answer['choice_ids']
        ),
    }
    if 'flagged_question_ids' in data:
        canonical['flagged_question_ids'] = sorted(data['flagged_question_ids'])
    if 'last_question_by_section' in data:
        canonical['last_question_by_section'] = data['last_question_by_section']
    return hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _validated_state(attempt, data):
    questions = {question['id']: question for question in attempt.content_snapshot['questions']}
    answers = data['answers']
    if len(answers) > len(questions):
        raise ValidationError({'answers': 'Ответов больше, чем вопросов в этой попытке.'})
    selected = {}
    for answer in answers:
        qid = answer['question_id']
        if qid not in questions:
            raise ValidationError({'answers': 'Вопрос не принадлежит этой попытке.'})
        if str(qid) in selected:
            raise ValidationError({'answers': 'Вопрос не должен повторяться.'})
        options = answer['choice_ids']
        allowed = {choice['id'] for choice in questions[qid]['choices']}
        if len(options) != len(set(options)):
            raise ValidationError({'answers': 'Выбранный вариант не должен повторяться.'})
        if any(cid not in allowed for cid in options):
            raise ValidationError({'answers': 'Выбранный вариант не принадлежит указанному вопросу.'})
        if questions[qid]['section_id'] == 'first_subject' and len(options) > 1:
            raise ValidationError({'answers': 'В первом предмете можно выбрать только один вариант.'})
        selected[str(qid)] = list(options)
    flags = list(data.get('flagged_question_ids', attempt.flagged_question_ids))
    if len(flags) != len(set(flags)) or any(qid not in questions for qid in flags):
        raise ValidationError({'flagged_question_ids': 'Отметки должны содержать неповторяющиеся вопросы этой попытки.'})
    positions = deepcopy(attempt.last_question_by_section)
    for section, qid in data.get('last_question_by_section', {}).items():
        if qid not in questions or questions[qid]['section_id'] != section:
            raise ValidationError({'last_question_by_section': 'Вопрос не принадлежит указанному предмету.'})
        positions[section] = qid
    return selected, flags, positions


def _finalize_locked(attempt, reason, now):
    if attempt.status == 'completed':
        return
    if attempt.configuration_snapshot.get('scoring_version') != KT_PROFILE_SCORING_VERSION:
        raise ValidationError({'scoring_version': 'Версия правил этой попытки пока не поддерживается; результат не изменён.'})
    grading = _grade(attempt.content_snapshot, attempt.answers)
    score = grading['earned_points'] * 100 // grading['max_points']
    completed_at = attempt.deadline if reason == 'deadline' else now
    elapsed = max(0, int((completed_at - attempt.started_at).total_seconds()))
    # Finalized exams use frozen content only. Adding new live content FKs here
    # can race Django's deletion Collector after it has already cleared old
    # references. Original IDs remain in snapshots; no content link is required.
    # The attempt owns idempotency; never reuse the legacy submission UUID namespace.
    result = Result.objects.create(
        student=attempt.student, score=score,
        scoring_mode=Quiz.Mode.KT_PROFILE, scoring_details=grading,
    )
    quiz_snapshot = deepcopy(attempt.content_snapshot['quiz'])
    quiz_snapshot.update(mode=Quiz.Mode.KT_PROFILE, scoring_version=grading['scoring_version'],
                         configuration=deepcopy(attempt.configuration_snapshot), exam_attempt_id=str(attempt.pk))
    detail = QuizAttemptDetail.objects.create(
        student=attempt.student, result=result, quiz_snapshot=quiz_snapshot,
        score=score, total_questions=len(attempt.content_snapshot['questions']),
        correct_answers=sum(item['is_correct'] for item in grading['questions'].values()),
        time_spent_seconds=elapsed, started_at=attempt.started_at,
    )
    # Existing auto_now_add fields record insertion time; an expired exam ended at its deadline.
    Result.objects.filter(pk=result.pk).update(completed_at=completed_at)
    QuizAttemptDetail.objects.filter(pk=detail.pk).update(completed_at=completed_at)
    result.completed_at = completed_at
    detail.completed_at = completed_at
    question_ids = [q['id'] for q in attempt.content_snapshot['questions']]
    rows = []
    for question in attempt.content_snapshot['questions']:
        qid = question['id']
        selected = attempt.answers.get(str(qid), [])
        points = grading['questions'][qid]
        snapshot = deepcopy(question)
        snapshot.update(kt_subject=question['section_id'], earned_points=points['earned_points'], max_points=points['max_points'])
        rows.append(QuestionAnswer(
            attempt=detail,
            question_snapshot=snapshot, selected_choice_ids=selected,
            is_correct=points['is_correct'],
        ))
    QuestionAnswer.objects.bulk_create(rows)
    result.submission_response = {
        'id': result.pk, 'mode': Quiz.Mode.KT_PROFILE, 'score': score,
        'total_questions': len(question_ids), 'correct_count': detail.correct_answers,
        'grading': grading,
        'correct_answers_ids': {q['id']: q['correct_choice_ids'] for q in attempt.content_snapshot['questions']},
        'explanations': {q['id']: q['explanation'] for q in attempt.content_snapshot['questions']},
    }
    result.save(update_fields=['submission_response'])
    attempt.result = result
    attempt.status = 'completed'
    attempt.completed_at = completed_at
    attempt.completion_reason = reason
    attempt.save(update_fields=['answers', 'flagged_question_ids', 'last_question_by_section', 'revision',
                                'finish_id', 'finish_fingerprint', 'result', 'status', 'completed_at', 'completion_reason'])


@transaction.atomic
def start_attempt(user, data):
    existing = ExamAttempt.objects.select_for_update().filter(student=user, start_id=data['request_id']).first()
    if existing is not None:
        if existing.configuration_key != data['configuration_id']:
            return existing, False, _error('request_id_conflict', 'Этот идентификатор старта уже использован для другой конфигурации.', existing)
        if _expired(existing, timezone.now()):
            _finalize_locked(existing, 'deadline', timezone.now())
        return existing, False, None
    config = _configuration_or_error(data['configuration_id'])
    quiz = _source_quiz(config, lock=True)
    content = _freeze_content(quiz, config, lock=True)
    now = timezone.now()
    deadline = now + timedelta(seconds=config['duration_seconds']) if config['duration_seconds'] is not None else None
    initial_positions = {section['id']: next(q['id'] for q in content['questions'] if q['section_id'] == section['id']) for section in config['sections']}
    attempt, created = ExamAttempt.objects.get_or_create(
        student=user, start_id=data['request_id'],
        defaults={'source_quiz': quiz, 'configuration_key': config['id'], 'configuration_snapshot': deepcopy(config),
                  'content_snapshot': content, 'started_at': now, 'deadline': deadline,
                  'last_question_by_section': initial_positions},
    )
    if not created:
        # A simultaneous request may have won the unique INSERT after our initial lookup.
        attempt = ExamAttempt.objects.select_for_update().get(pk=attempt.pk)
        if attempt.configuration_key != data['configuration_id']:
            return attempt, False, _error('request_id_conflict', 'Этот идентификатор старта уже использован для другой конфигурации.', attempt)
        if _expired(attempt, timezone.now()):
            _finalize_locked(attempt, 'deadline', timezone.now())
    return attempt, created, None


@transaction.atomic
def read_attempt(user, attempt_id):
    attempt = _owned_locked(user, attempt_id)
    now = timezone.now()
    if _expired(attempt, now):
        _finalize_locked(attempt, 'deadline', now)
    return attempt


def _closed_error(attempt):
    if attempt.completion_reason == 'deadline':
        return _error('deadline_expired', 'Время истекло. Сохранённые ранее ответы уже оценены.', attempt)
    return _error('attempt_completed', 'Попытка уже завершена; ответы нельзя изменить.', attempt)


@transaction.atomic
def save_attempt(user, attempt_id, data):
    attempt = _owned_locked(user, attempt_id)
    now = timezone.now()
    if _expired(attempt, now):
        _finalize_locked(attempt, 'deadline', now)
    if attempt.status != 'active':
        return attempt, _closed_error(attempt)
    state = _validated_state(attempt, data)
    fingerprint = _canonical(data)
    if attempt.last_write_id == data['request_id']:
        if attempt.last_write_fingerprint == fingerprint:
            return attempt, None
        return attempt, _error('request_id_conflict', 'Идентификатор сохранения уже использован с другими данными.', attempt)
    if data['revision'] != attempt.revision:
        return attempt, _error('revision_conflict', 'Сохранена более новая версия ответов. Получите актуальную попытку.', attempt)
    attempt.answers, attempt.flagged_question_ids, attempt.last_question_by_section = state
    attempt.revision += 1
    attempt.last_write_id = data['request_id']
    attempt.last_write_fingerprint = fingerprint
    attempt.save(update_fields=['answers', 'flagged_question_ids', 'last_question_by_section', 'revision', 'last_write_id', 'last_write_fingerprint'])
    return attempt, None


@transaction.atomic
def finish_attempt(user, attempt_id, data):
    attempt = _owned_locked(user, attempt_id)
    now = timezone.now()
    if _expired(attempt, now):
        _finalize_locked(attempt, 'deadline', now)
    if attempt.status != 'active':
        if attempt.completion_reason == 'manual' and attempt.finish_id == data['request_id']:
            # Validate even empty entries: canonicalization deliberately omits
            # skipped questions, but must never hide foreign/duplicate IDs.
            _validated_state(attempt, data)
            if attempt.finish_fingerprint == _canonical(data):
                return attempt, None
            return attempt, _error('request_id_conflict', 'Эта сдача уже завершена с другими данными.', attempt)
        return attempt, _closed_error(attempt)
    state = _validated_state(attempt, data)
    if data['revision'] != attempt.revision:
        return attempt, _error('revision_conflict', 'Сохранена более новая версия ответов. Получите актуальную попытку.', attempt)
    attempt.answers, attempt.flagged_question_ids, attempt.last_question_by_section = state
    attempt.revision += 1
    attempt.finish_id = data['request_id']
    attempt.finish_fingerprint = _canonical(data)
    _finalize_locked(attempt, 'manual', now)
    return attempt, None


def expire_due_attempts(limit=100):
    """One bounded worker batch. Deployment/scheduling is intentionally external."""
    if type(limit) is not int or not 1 <= limit <= 10000:
        raise ValueError('limit must be an integer between 1 and 10000')
    ids = list(ExamAttempt.objects.filter(status='active', deadline__lte=timezone.now())
               .order_by('deadline', 'id').values_list('pk', flat=True)[:limit])
    completed = 0
    for attempt_id in ids:
        with transaction.atomic():
            attempt = ExamAttempt.objects.select_for_update().filter(pk=attempt_id).first()
            now = timezone.now()
            if attempt is not None and _expired(attempt, now):
                _finalize_locked(attempt, 'deadline', now)
                completed += 1
    return completed
