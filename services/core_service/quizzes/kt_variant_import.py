"""Strict create-or-verify import of one fixed variant; never publishes content."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

from django.db import IntegrityError, transaction

from courses.models import Course, Lesson
from .grading import calculate_kt_profile_score
from .models import Choice, Question, Quiz, QuizImportReceipt


class PackageError(ValueError):
    """A field-addressed package error, safe to display without dumping content."""


class ImportConflict(PackageError):
    """Existing content/provenance is inconsistent with the requested import."""


_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z')
_SECTIONS = ('first_subject', 'second_subject')


def checksum(value):
    """v1: UTF-8 JSON, sorted object keys, compact separators; arrays/text exact."""
    return hashlib.sha256(json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False,
    ).encode('utf-8')).hexdigest()


def _fail(path, message):
    raise PackageError(f'{path}: {message}')


def _object(value, path, required, optional=()):
    if type(value) is not dict:
        _fail(path, 'ожидается объект JSON')
    for key in required:
        if key not in value:
            _fail(f'{path}.{key}', 'обязательное поле отсутствует')
    for key in value:
        if key not in (*required, *optional):
            _fail(f'{path}.{key}', 'неизвестное поле')


def _text(value, path, *, limit=None, empty=False):
    if type(value) is not str:
        _fail(path, 'ожидается строка')
    if not empty and not value.strip():
        _fail(path, 'строка не должна быть пустой')
    if '\x00' in value:
        _fail(path, 'нулевой символ не поддерживается PostgreSQL')
    try:
        value.encode('utf-8')
    except UnicodeEncodeError:
        _fail(path, 'строка содержит некорректную последовательность Unicode')
    if limit is not None and len(value) > limit:
        _fail(path, f'максимум {limit} символов, получено {len(value)}; текст не обрезан')


def _identifier(value, path):
    _text(value, path)
    if not _ID.fullmatch(value):
        _fail(path, 'нужен идентификатор из 1–128 ASCII-букв, цифр, точек, дефисов или подчёркиваний')


def _array(value, path, *, nonempty=True):
    if type(value) is not list or (nonempty and not value):
        _fail(path, 'ожидается непустой массив' if nonempty else 'ожидается массив')


def _display_text(value, path, **kwargs):
    _text(value, path, **kwargs)
    # The existing ExamText is not a Markdown renderer. Inline/unclosed fences
    # can lose text in its opening-fence parser, so reject rather than rewrite.
    fenced = False
    for line in value.splitlines(keepends=True):
        if '```' not in line:
            continue
        boundary = line.rstrip('\r\n')
        if not fenced:
            if not re.fullmatch(r'```[A-Za-z0-9_+.-]*', boundary) or not line.endswith('\n'):
                _fail(path, 'блок кода должен начинаться отдельной строкой ```язык с переносом строки')
        elif boundary != '```':
            _fail(path, 'закрывающая строка блока кода должна содержать только ```')
        fenced = not fenced
    if fenced:
        _fail(path, 'незакрытый блок кода ```')


def validate_package(data):
    """Validate structure, not educational correctness, quotas or licensing."""
    _object(data, '$', ('schema_version', 'package_id', 'example_only', 'sources', 'questions'))
    if type(data['schema_version']) is not int or data['schema_version'] != 1:
        _fail('schema_version', 'поддерживается только целая версия 1')
    _identifier(data['package_id'], 'package_id')
    if type(data['example_only']) is not bool:
        _fail('example_only', 'ожидается true или false')
    _array(data['sources'], 'sources')
    sources = set()
    for index, source in enumerate(data['sources']):
        path = f'sources[{index}]'
        _object(source, path, ('id', 'title'), ('file_sha256',))
        _identifier(source['id'], f'{path}.id')
        if source['id'] in sources:
            _fail(f'{path}.id', 'повтор идентификатора источника')
        sources.add(source['id'])
        _text(source['title'], f'{path}.title')
        if 'file_sha256' in source:
            if type(source['file_sha256']) is not str or not re.fullmatch(r'[0-9a-f]{64}', source['file_sha256']):
                _fail(f'{path}.file_sha256', 'ожидается SHA-256: 64 строчных шестнадцатеричных символа')

    _array(data['questions'], 'questions')
    seen = set()
    counts = dict.fromkeys(_SECTIONS, 0)
    section_keys = {section: {} for section in _SECTIONS}
    second_started = False
    choice_number = 1
    for index, question in enumerate(data['questions']):
        path = f'questions[{index}]'
        _object(question, path, ('id', 'kt_subject', 'source', 'text', 'choices', 'correct_choice_ids', 'explanation'))
        _identifier(question['id'], f'{path}.id')
        path += f' ({question["id"]})'
        if question['id'] in seen:
            _fail(f'{path}.id', 'повтор идентификатора вопроса')
        seen.add(question['id'])
        section = question['kt_subject']
        if type(section) is not str or section not in _SECTIONS:
            _fail(f'{path}.kt_subject', 'нужен first_subject или second_subject')
        if section == 'second_subject':
            second_started = True
        elif second_started:
            _fail(f'{path}.kt_subject', 'сначала должны идти все вопросы первого предмета, затем второго')
        counts[section] += 1
        _object(question['source'], f'{path}.source', ('id', 'location'))
        _identifier(question['source']['id'], f'{path}.source.id')
        if question['source']['id'] not in sources:
            _fail(f'{path}.source.id', 'неизвестный источник')
        _text(question['source']['location'], f'{path}.source.location')
        _display_text(question['text'], f'{path}.text')
        if question['explanation'] is not None:
            _display_text(question['explanation'], f'{path}.explanation', empty=True)
        _array(question['choices'], f'{path}.choices')
        options = {}
        for option_index, choice in enumerate(question['choices']):
            option_path = f'{path}.choices[{option_index}]'
            _object(choice, option_path, ('id', 'text'))
            _identifier(choice['id'], f'{option_path}.id')
            if choice['id'] in options:
                _fail(f'{option_path}.id', 'повтор идентификатора варианта')
            _display_text(choice['text'], f'{option_path}.text', limit=255)
            options[choice['id']] = choice_number
            choice_number += 1
        _array(question['correct_choice_ids'], f'{path}.correct_choice_ids')
        correct = set()
        for answer_index, option_id in enumerate(question['correct_choice_ids']):
            key_path = f'{path}.correct_choice_ids[{answer_index}]'
            _identifier(option_id, key_path)
            if option_id not in options:
                _fail(key_path, 'вариант не принадлежит этому вопросу')
            if option_id in correct:
                _fail(key_path, 'повтор правильного варианта')
            correct.add(option_id)
        max_correct = 1 if section == 'first_subject' else 3
        if not 1 <= len(correct) <= max_correct:
            _fail(f'{path}.correct_choice_ids', f'допустимо правильных вариантов: от 1 до {max_correct}')
        section_keys[section][index + 1] = {pk: key in correct for key, pk in options.items()}
    if counts != {'first_subject': 30, 'second_subject': 20}:
        _fail('questions.kt_subject', f'нужны ровно 30 + 20 вопросов; получено {counts["first_subject"]} + {counts["second_subject"]}')
    # Reuse the current policy validator. No new scoring algorithm is introduced.
    try:
        calculate_kt_profile_score(section_keys['first_subject'], section_keys['second_subject'], [])
    except ValueError as error:
        _fail('questions', str(error))
    return deepcopy(data)


class _ObjectPairs(list):
    pass


def _decode_pairs(value, path='$'):
    if isinstance(value, _ObjectPairs):
        result = {}
        for key, item in value:
            if key in result:
                _fail(f'{path}.{key}', 'повтор ключа объекта JSON')
            result[key] = _decode_pairs(item, f'{path}.{key}')
        return result
    if type(value) is list:
        return [_decode_pairs(item, f'{path}[{index}]') for index, item in enumerate(value)]
    return value


def load_package(path):
    try:
        raw = Path(path).read_text(encoding='utf-8')
        pairs = json.loads(raw, object_pairs_hook=_ObjectPairs,
                           parse_constant=lambda value: _fail('$', 'нечисловые константы JSON запрещены'))
    except (OSError, UnicodeError) as error:
        raise PackageError(f'file: не удалось прочитать файл UTF-8 ({type(error).__name__})') from error
    except json.JSONDecodeError as error:
        raise PackageError(f'JSON: строка {error.lineno}, столбец {error.colno}: {error.msg}') from error
    return validate_package(_decode_pairs(pairs))


def _content(quiz, *, lock=False):
    questions = Question.objects.filter(quiz_id=quiz.pk).order_by('id')
    if lock:
        questions = questions.select_for_update()
    rows = list(questions.values('id', 'kt_subject', 'text', 'explanation'))
    choices = Choice.objects.filter(question_id__in=[row['id'] for row in rows]).order_by('id')
    if lock:
        choices = choices.select_for_update()
    by_question = {row['id']: [] for row in rows}
    for option in choices.values('id', 'question_id', 'text', 'is_correct'):
        by_question[option.pop('question_id')].append(option)
    for row in rows:
        row['choices'] = by_question[row['id']]
    return {
        'schema_version': 1,
        'quiz': {key: getattr(quiz, key) for key in ('id', 'lesson_id', 'mode', 'title', 'description')},
        'questions': rows,
    }


def _manifest(package, content):
    if len(content['questions']) != len(package['questions']):
        raise ImportConflict('quiz.questions: состав изменён после импорта')
    questions = []
    for incoming, stored in zip(package['questions'], content['questions']):
        if len(incoming['choices']) != len(stored['choices']):
            raise ImportConflict(f'questions ({incoming["id"]}).choices: состав изменён после импорта')
        questions.append({
            'id': incoming['id'], 'question_id': stored['id'], 'source': incoming['source'],
            'kt_subject': incoming['kt_subject'],
            'choices': [{'id': option['id'], 'choice_id': row['id']}
                        for option, row in zip(incoming['choices'], stored['choices'])],
        })
    return {'schema_version': 1, 'package_id': package['package_id'],
            'example_only': package['example_only'], 'sources': package['sources'], 'questions': questions}


def import_variant(package, quiz_id, *, apply=False):
    """First load or verify the same receipt/content. No replace/delete path exists."""
    package = validate_package(package)
    if type(quiz_id) is not int or quiz_id < 1:
        _fail('quiz_id', 'нужен положительный целый ID существующего Quiz')
    if type(apply) is not bool:
        _fail('apply', 'ожидается bool')
    if apply and package['example_only']:
        _fail('example_only', 'пример формата запрещено записывать в базу')
    package_hash = checksum(package)
    report = {
        'quiz_id': quiz_id, 'package_id': package['package_id'], 'question_count': 50,
        'example_only': package['example_only'],
        'choice_count': sum(len(question['choices']) for question in package['questions']),
        'missing_explanations': sum(not (question['explanation'] or '').strip() for question in package['questions']),
        'package_checksum': package_hash,
    }
    try:
        with transaction.atomic():
            query = Quiz.objects.select_for_update() if apply else Quiz.objects
            try:
                quiz = query.get(pk=quiz_id)
            except Quiz.DoesNotExist:
                _fail('quiz_id', 'Quiz не найден; команда не создаёт курсы, уроки или тесты')
            receipt = QuizImportReceipt.objects.filter(quiz_id=quiz_id).first()
            content = _content(quiz, lock=apply)
            content_hash = checksum(content)
            if receipt is not None:
                if receipt.package_id != package['package_id'] or receipt.package_checksum != package_hash:
                    raise ImportConflict('package_id/package_checksum: пакет отличается от ранее загруженного')
                if receipt.content_checksum != content_hash:
                    raise ImportConflict('quiz.content_checksum: данные Quiz, вопросов или вариантов изменены после импорта')
                if receipt.manifest != _manifest(package, content):
                    raise ImportConflict('receipt.manifest: происхождение или соответствие ID изменены')
                return {**report, 'status': 'already_loaded', 'content_checksum': content_hash, 'receipt_id': receipt.pk}

            if QuizImportReceipt.objects.filter(package_id=package['package_id']).exists():
                raise ImportConflict('package_id: пакет уже закреплён за другим Quiz')
            if content['questions']:
                raise ImportConflict('quiz.questions: непустой Quiz без журнала нельзя перезаписывать')
            if quiz.mode != Quiz.Mode.KT_PROFILE:
                _fail('quiz.mode', 'для первой загрузки нужен режим kt_profile')
            if quiz.exam_configuration_key:
                _fail('quiz.exam_configuration_key', 'для первой загрузки требуется пустой ключ')
            # Lock parent metadata on writes, without changing status or binding.
            lessons = Lesson.objects.select_for_update() if apply else Lesson.objects
            courses = Course.objects.select_for_update() if apply else Course.objects
            lesson = lessons.get(pk=quiz.lesson_id)
            course = courses.get(pk=lesson.course_id)
            if course.status != 'draft':
                _fail('quiz.lesson.course.status', 'первая загрузка допустима только в курс draft')
            if not apply:
                return {**report, 'status': 'ready', 'content_checksum': None, 'receipt_id': None}

            for incoming in package['questions']:
                question = Question.objects.create(
                    quiz=quiz, kt_subject=incoming['kt_subject'], text=incoming['text'],
                    explanation=incoming['explanation'],  # None is SQL NULL, not an empty string.
                )
                for option in incoming['choices']:
                    Choice.objects.create(question=question, text=option['text'],
                                          is_correct=option['id'] in incoming['correct_choice_ids'])
            # Fingerprint a fresh ORM read, including generated IDs; not the input JSON.
            content = _content(quiz, lock=True)
            content_hash = checksum(content)
            receipt = QuizImportReceipt.objects.create(
                quiz=quiz, package_id=package['package_id'], package_checksum=package_hash,
                content_checksum=content_hash, manifest=_manifest(package, content),
            )
            return {**report, 'status': 'imported', 'content_checksum': content_hash, 'receipt_id': receipt.pk}
    except IntegrityError as error:
        # The whole losing transaction, including its questions, has rolled back.
        raise ImportConflict('receipt: конфликт ограничений БД при импорте; пакет целиком отменён') from error
