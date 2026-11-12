"""Real importer/command/ORM tests; synthetic content and in-memory SQLite only.

The offline audit runner copies this module into an ephemeral directory. No
environment file, production package, external service or grading mock is used.
"""

from copy import deepcopy
import importlib.util
from io import StringIO
import json
from pathlib import Path
import re
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext

from courses.models import Category, Course, Lesson, LessonStep
from quizzes.kt_variant_import import (
    ImportConflict, PackageError, import_variant, load_package, validate_package,
)
from quizzes.grading import calculate_kt_profile_score
from quizzes.models import Choice, Question, Quiz, QuizImportReceipt


_fixture_spec = importlib.util.spec_from_file_location(
    'synthetic_kt_variant_package',
    Path(__file__).parent / 'fixtures' / 'kt_variant_package.py',
)
_fixture_module = importlib.util.module_from_spec(_fixture_spec)
_fixture_spec.loader.exec_module(_fixture_module)
make_package = _fixture_module.make_package


@pytest.fixture
def package():
    data = make_package()
    # Exercise the write path only in the graph fixture's guarded, ephemeral
    # SQLite database. This artificial fixture is never a publishable package.
    data['example_only'] = False
    return data


@pytest.fixture
def graph(db):
    name = str(connection.settings_dict['NAME'])
    assert connection.vendor == 'sqlite'
    assert name == ':memory:' or (name.startswith('file:memorydb_') and 'mode=memory' in name)
    teacher = get_user_model().objects.create_user(
        username='synthetic_import_teacher', role='teacher',
    )
    category = Category.objects.create(title='Artificial importer tests')
    course = Course.objects.create(
        title='Artificial draft container', teacher=teacher, category=category,
        description='Synthetic importer tests only', status='draft',
    )
    lesson = Lesson.objects.create(course=course, title='Artificial import lesson')
    quiz = Quiz.objects.create(
        lesson=lesson, title='Artificial profile target', description='Preserve this description',
        mode='kt_profile', exam_configuration_key='',
    )
    # Existing training data must never be replaced by an import elsewhere.
    training = Quiz.objects.create(lesson=lesson, title='Existing artificial training')
    question = Question.objects.create(quiz=training, text='Preserve artificial training question')
    Choice.objects.create(question=question, text='Preserve training answer', is_correct=True)
    return SimpleNamespace(
        teacher=teacher, category=category, course=course, lesson=lesson,
        quiz=quiz, training=training,
    )


def snapshot():
    return {
        model.__name__: list(model.objects.order_by('pk').values())
        for model in (Course, Lesson, LessonStep, Quiz, Question, Choice, QuizImportReceipt)
    }


def assert_no_write_queries(queries):
    writes = [entry['sql'] for entry in queries if re.match(
        r'^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b', entry['sql'], re.I,
    )]
    assert writes == []


def write_package(tmp_path, package, **kwargs):
    path = tmp_path / 'synthetic-package.json'
    path.write_text(json.dumps(package, ensure_ascii=False, **kwargs), encoding='utf-8')
    return path


def set_path(data, path, value):
    for part in path[:-1]:
        data = data[part]
    data[path[-1]] = value


def test_valid_package_returns_preserved_data_without_mutating_input(package):
    before = deepcopy(package)
    assert validate_package(package) == before
    assert package == before
    assert len(package['questions']) == 50
    assert make_package()['example_only'] is True


@pytest.mark.parametrize('example_only', [True, False])
def test_example_only_is_an_explicit_boolean_not_an_import_side_effect(package, example_only):
    package['example_only'] = example_only
    assert validate_package(package)['example_only'] is example_only


@pytest.mark.parametrize('value', [None, [], 'package', 1, True])
def test_package_must_be_an_object(value):
    with pytest.raises(PackageError):
        validate_package(value)


@pytest.mark.parametrize('path,value', [
    (('schema_version',), True),
    (('schema_version',), 1.0),
    (('schema_version',), '1'),
    (('schema_version',), 2),
    (('package_id',), 1),
    (('package_id',), ''),
    (('package_id',), 'bad id'),
    (('package_id',), 'p' * 129),
    (('example_only',), 1),
    (('example_only',), 'false'),
    (('example_only',), None),
    (('sources',), {}),
    (('sources',), []),
    (('sources', 0), 'source'),
    (('sources', 0, 'id'), None),
    (('sources', 0, 'id'), '../source'),
    (('sources', 0, 'title'), ''),
    (('sources', 0, 'title'), ' \t\n'),
    (('sources', 0, 'title'), 123),
    (('sources', 1, 'file_sha256'), None),
    (('sources', 1, 'file_sha256'), 'a' * 63),
    (('sources', 1, 'file_sha256'), 'g' * 64),
    (('questions',), {}),
    (('questions', 0), 'question'),
    (('questions', 0, 'id'), ''),
    (('questions', 0, 'id'), 'bad/question'),
    (('questions', 0, 'kt_subject'), 'training'),
    (('questions', 0, 'kt_subject'), 1),
    (('questions', 0, 'source'), 'source'),
    (('questions', 0, 'source', 'id'), 'unknown-source'),
    (('questions', 0, 'source', 'location'), ''),
    (('questions', 0, 'source', 'location'), ' \n'),
    (('questions', 0, 'source', 'location'), 2),
    (('questions', 0, 'text'), ''),
    (('questions', 0, 'text'), ' \t\n'),
    (('questions', 0, 'text'), None),
    (('questions', 0, 'choices'), {}),
    (('questions', 0, 'choices'), []),
    (('questions', 0, 'choices', 0), 'choice'),
    (('questions', 0, 'choices', 0, 'id'), ''),
    (('questions', 0, 'choices', 0, 'id'), 1),
    (('questions', 0, 'choices', 0, 'text'), None),
    (('questions', 0, 'choices', 0, 'text'), ' \t'),
    (('questions', 0, 'choices', 0, 'text'), 'x' * 256),
    (('questions', 0, 'correct_choice_ids'), 'one'),
    (('questions', 0, 'correct_choice_ids'), []),
    (('questions', 0, 'correct_choice_ids'), [1]),
    (('questions', 0, 'correct_choice_ids'), ['unknown-choice']),
    (('questions', 0, 'explanation'), 123),
    (('questions', 0, 'explanation'), False),
    (('questions', 0, 'explanation'), []),
])
def test_wrong_field_types_values_and_references_are_rejected(package, path, value):
    set_path(package, path, value)
    with pytest.raises(PackageError):
        validate_package(package)


@pytest.mark.parametrize('path', [
    ('schema_version',), ('package_id',), ('example_only',), ('sources',), ('questions',),
    ('sources', 0, 'id'), ('sources', 0, 'title'),
    ('questions', 0, 'id'), ('questions', 0, 'kt_subject'), ('questions', 0, 'source'),
    ('questions', 0, 'source', 'id'), ('questions', 0, 'source', 'location'),
    ('questions', 0, 'text'), ('questions', 0, 'choices'),
    ('questions', 0, 'choices', 0, 'id'), ('questions', 0, 'choices', 0, 'text'),
    ('questions', 0, 'correct_choice_ids'), ('questions', 0, 'explanation'),
])
def test_required_fields_cannot_be_omitted(package, path):
    parent = package
    for part in path[:-1]:
        parent = parent[part]
    del parent[path[-1]]
    with pytest.raises(PackageError):
        validate_package(package)


@pytest.mark.parametrize('path', [
    (), ('sources', 0), ('questions', 0), ('questions', 0, 'source'),
    ('questions', 0, 'choices', 0),
])
def test_unknown_fields_are_rejected_at_every_object_level(package, path):
    parent = package
    for part in path:
        parent = parent[part]
    parent['unexpected'] = 'must not be silently ignored'
    with pytest.raises(PackageError):
        validate_package(package)


@pytest.mark.parametrize('field', ['source', 'question', 'choice', 'correct_choice'])
def test_duplicate_identifiers_are_rejected(package, field):
    question = package['questions'][0]
    if field == 'source':
        package['sources'].append(deepcopy(package['sources'][0]))
    elif field == 'question':
        package['questions'][1]['id'] = question['id']
    elif field == 'choice':
        question['choices'][1]['id'] = question['choices'][0]['id']
    else:
        question['correct_choice_ids'] *= 2
    with pytest.raises(PackageError):
        validate_package(package)


@pytest.mark.parametrize('mutation', ['49', '51', '29+21', '31+19', 'interleaved'])
def test_exact_subject_counts_and_grouped_order_are_required(package, mutation):
    questions = package['questions']
    if mutation == '49':
        questions.pop()
    elif mutation == '51':
        extra = deepcopy(questions[-1])
        extra['id'] = 'extra-synthetic-question'
        questions.append(extra)
    elif mutation == '29+21':
        questions[29]['kt_subject'] = 'second_subject'
    elif mutation == '31+19':
        questions[30]['kt_subject'] = 'first_subject'
    else:
        questions[0], questions[30] = questions[30], questions[0]
    with pytest.raises(PackageError):
        validate_package(package)


@pytest.mark.parametrize('index,count', [(0, 2), (0, 3), (30, 0), (30, 4)])
def test_subject_answer_key_limits_are_enforced(package, index, count):
    question = package['questions'][index]
    question['correct_choice_ids'] = [choice['id'] for choice in question['choices'][:count]]
    with pytest.raises(PackageError):
        validate_package(package)


def test_single_choice_and_255_character_choice_are_valid(package):
    question = package['questions'][0]
    question['choices'] = question['choices'][:1]
    question['choices'][0]['text'] = 'x' * 255
    assert validate_package(package) == package


@pytest.mark.parametrize('explanation', [None, '', ' \t\n', ' Exact explanation \n'])
def test_null_and_text_explanations_are_preserved(package, explanation):
    package['questions'][0]['explanation'] = explanation
    assert validate_package(package)['questions'][0]['explanation'] == explanation


@pytest.mark.parametrize('path', [
    ('sources', 0, 'title'), ('questions', 0, 'source', 'location'),
    ('questions', 0, 'text'), ('questions', 0, 'choices', 0, 'text'),
    ('questions', 0, 'explanation'),
])
@pytest.mark.parametrize('invalid', ['invalid\x00text', 'invalid\ud800text'])
def test_nul_and_invalid_unicode_are_rejected(package, path, invalid):
    set_path(package, path, invalid)
    with pytest.raises(PackageError):
        validate_package(package)


def test_load_package_accepts_utf8_and_preserves_sql_whitespace(package, tmp_path):
    package['questions'][0]['text'] = '  Қазақша SQL\r\nSELECT a,\t b\nFROM demo;  '
    package['questions'][0]['choices'][0]['text'] = ' SELECT  a\nFROM demo; '
    path = write_package(tmp_path, package, indent=3)
    assert load_package(path) == package


@pytest.mark.parametrize('field', ['text', 'choice', 'explanation'])
@pytest.mark.parametrize('text', [
    'Inline ```sql SELECT 1; ``` fence',
    '```sql\nSELECT 1;',
    '```sql SELECT 1;\n```',
    '```sql\nSELECT 1;\n``` trailing text',
    '```',
])
def test_unrenderable_code_fences_are_rejected_with_field_address(package, field, text):
    question = package['questions'][0]
    if field == 'choice':
        question['choices'][0]['text'] = text
        field_path = 'choices[0].text'
    else:
        question[field] = text
        field_path = field
    with pytest.raises(PackageError) as error:
        validate_package(package)
    assert 'questions[0]' in str(error.value)
    assert field_path in str(error.value)


@pytest.mark.parametrize('newline', ['\n', '\r\n'])
def test_valid_code_fences_preserve_sql_and_line_endings(graph, package, newline):
    text = newline.join(['Artificial SQL:', '```sql', 'SELECT  a,\tb', 'FROM demo;', '```', ' End '])
    question = package['questions'][0]
    question['text'] = text
    question['choices'][0]['text'] = text
    question['explanation'] = text
    assert validate_package(package) == package
    import_variant(package, graph.quiz.pk, apply=True)
    saved = graph.quiz.questions.order_by('pk').first()
    assert saved.text == saved.explanation == text
    assert saved.choices.order_by('pk').first().text == text


@pytest.mark.parametrize('raw', [
    b'{invalid', b'\xff', b'null', b'[]',
    b'{"schema_version":1,"schema_version":1}',
    b'{"schema_version":NaN}', b'{"schema_version":Infinity}',
])
def test_invalid_file_content_is_a_package_error(tmp_path, raw):
    path = tmp_path / 'invalid.json'
    path.write_bytes(raw)
    with pytest.raises(PackageError):
        load_package(path)


def test_missing_file_is_a_package_error(tmp_path):
    with pytest.raises(PackageError):
        load_package(tmp_path / 'missing.json')


def test_dry_run_reports_missing_explanations_without_any_writes(graph, package):
    for index, explanation in enumerate([None, '', ' \t\n']):
        package['questions'][index]['explanation'] = explanation
    before = snapshot()
    with CaptureQueriesContext(connection) as queries:
        report = import_variant(package, graph.quiz.pk)
    assert report['status'] == 'ready'
    assert report['missing_explanations'] == 3
    assert snapshot() == before
    assert_no_write_queries(queries)


def test_example_only_package_can_be_checked_but_never_written(graph):
    example = make_package()
    before = snapshot()
    with CaptureQueriesContext(connection) as queries:
        assert import_variant(example, graph.quiz.pk, apply=False)['status'] == 'ready'
        with pytest.raises(PackageError, match='example_only'):
            import_variant(example, graph.quiz.pk, apply=True)
    assert snapshot() == before
    assert_no_write_queries(queries)


def test_apply_preserves_order_strings_keys_null_and_source_mapping(graph, package):
    package['questions'][0]['text'] = ' \nSELECT  a,\tb\r\nFROM demo;  '
    package['questions'][0]['choices'][0]['text'] = ' SELECT  a\nFROM demo; '
    package['questions'][0]['explanation'] = None
    package['questions'][1]['explanation'] = ''
    package['questions'][2]['explanation'] = ' \t\n'
    package['questions'][3]['explanation'] = ' Exact explanation \n'
    package['sources'][0]['title'] = '  Artificial source title  '
    package['questions'][0]['source']['location'] = '  page 1, line 2  '
    old_quiz = Quiz.objects.values().get(pk=graph.quiz.pk)
    training_before = list(graph.training.questions.values())
    report = import_variant(package, graph.quiz.pk, apply=True)
    assert report['status'] == 'imported'
    assert report['missing_explanations'] == 3
    assert Quiz.objects.values().get(pk=graph.quiz.pk) == old_quiz
    assert list(graph.training.questions.values()) == training_before
    receipt = QuizImportReceipt.objects.get(quiz=graph.quiz)
    assert receipt.package_id == package['package_id']
    assert re.fullmatch('[0-9a-f]{64}', receipt.package_checksum)
    assert re.fullmatch('[0-9a-f]{64}', receipt.content_checksum)
    assert receipt.created_at is not None
    questions = list(graph.quiz.questions.order_by('pk'))
    assert len(questions) == 50
    expected_manifest = {
        key: deepcopy(package[key])
        for key in ('schema_version', 'package_id', 'example_only', 'sources')
    }
    expected_manifest['questions'] = []
    for original, question in zip(package['questions'], questions):
        assert question.text == original['text']
        assert question.explanation == original['explanation']
        assert question.kt_subject == original['kt_subject']
        choices = list(question.choices.order_by('pk'))
        assert [choice.text for choice in choices] == [choice['text'] for choice in original['choices']]
        assert [choice.is_correct for choice in choices] == [
            choice['id'] in original['correct_choice_ids'] for choice in original['choices']
        ]
        expected_manifest['questions'].append({
            'id': original['id'], 'question_id': question.pk,
            'source': original['source'], 'kt_subject': original['kt_subject'],
            'choices': [
                {'id': original_choice['id'], 'choice_id': choice.pk}
                for original_choice, choice in zip(original['choices'], choices)
            ],
        })
    assert receipt.manifest == expected_manifest
    with connection.cursor() as cursor:
        cursor.execute('SELECT explanation IS NULL FROM quizzes_question WHERE id = %s', [questions[0].pk])
        assert cursor.fetchone() == (1,)


@pytest.mark.parametrize('apply', [False, True])
def test_identical_repeat_is_noop_even_after_publication_and_binding(graph, package, apply):
    import_variant(package, graph.quiz.pk, apply=True)
    graph.course.status = 'published'
    graph.course.save(update_fields=['status'])
    graph.quiz.exam_configuration_key = 'm094_profile_v1'
    graph.quiz.save(update_fields=['exam_configuration_key'])
    before = snapshot()
    with CaptureQueriesContext(connection) as queries:
        report = import_variant(deepcopy(package), graph.quiz.pk, apply=apply)
    assert report['status'] == 'already_loaded'
    assert report['missing_explanations'] == 0
    assert snapshot() == before
    assert_no_write_queries(queries)


def reverse_object_keys(value):
    if isinstance(value, dict):
        return {key: reverse_object_keys(value[key]) for key in reversed(value)}
    if isinstance(value, list):
        return [reverse_object_keys(item) for item in value]
    return value


def test_json_formatting_and_object_key_order_do_not_change_identity(graph, package, tmp_path):
    import_variant(load_package(write_package(tmp_path, package, indent=4)), graph.quiz.pk, apply=True)
    reordered = reverse_object_keys(package)
    path = write_package(tmp_path, reordered, separators=(',', ':'))
    before = snapshot()
    report = import_variant(load_package(path), graph.quiz.pk, apply=True)
    assert report['status'] == 'already_loaded'
    assert snapshot() == before


@pytest.mark.parametrize('mutation', [
    'question_text', 'choice_text', 'explanation', 'source_title', 'source_location',
    'source_hash', 'question_id', 'choice_id', 'correct_key', 'choice_order',
    'question_order', 'source_order', 'example_only', 'package_id', 'null_to_empty',
])
def test_any_package_content_change_conflicts_without_writes(graph, package, mutation):
    if mutation == 'null_to_empty':
        package['questions'][0]['explanation'] = None
    import_variant(package, graph.quiz.pk, apply=True)
    changed = deepcopy(package)
    question = changed['questions'][0]
    if mutation == 'question_text':
        question['text'] += ' '
    elif mutation == 'choice_text':
        question['choices'][0]['text'] += ' '
    elif mutation == 'explanation':
        question['explanation'] += ' '
    elif mutation == 'source_title':
        changed['sources'][0]['title'] += ' '
    elif mutation == 'source_location':
        question['source']['location'] += ' '
    elif mutation == 'source_hash':
        changed['sources'][0]['file_sha256'] = 'b' * 64
    elif mutation == 'question_id':
        question['id'] += '-changed'
    elif mutation == 'choice_id':
        original = question['choices'][0]['id']
        question['choices'][0]['id'] = original + '-changed'
        question['correct_choice_ids'] = [original + '-changed']
    elif mutation == 'correct_key':
        question['correct_choice_ids'] = [question['choices'][1]['id']]
    elif mutation == 'choice_order':
        question['choices'].reverse()
    elif mutation == 'question_order':
        changed['questions'][0], changed['questions'][1] = changed['questions'][1], changed['questions'][0]
    elif mutation == 'source_order':
        changed['sources'].reverse()
    elif mutation == 'example_only':
        changed['example_only'] = True
    elif mutation == 'package_id':
        changed['package_id'] += '-changed'
    else:
        question['explanation'] = ''
    before = snapshot()
    error_type = PackageError if mutation == 'example_only' else ImportConflict
    with CaptureQueriesContext(connection) as queries, pytest.raises(error_type):
        import_variant(changed, graph.quiz.pk, apply=True)
    assert snapshot() == before
    assert_no_write_queries(queries)


@pytest.mark.parametrize('mutation', [
    'question_text', 'explanation', 'subject', 'choice_text', 'correct_flag',
    'delete_question', 'add_question', 'delete_choice', 'add_choice',
    'replace_choice_id', 'mode', 'lesson', 'title', 'description',
])
def test_manual_database_edit_is_detected_and_never_overwritten(graph, package, mutation):
    import_variant(package, graph.quiz.pk, apply=True)
    question = graph.quiz.questions.order_by('pk').first()
    choice = question.choices.order_by('pk').first()
    if mutation == 'question_text':
        Question.objects.filter(pk=question.pk).update(text=question.text + ' ')
    elif mutation == 'explanation':
        Question.objects.filter(pk=question.pk).update(explanation=None)
    elif mutation == 'subject':
        Question.objects.filter(pk=question.pk).update(kt_subject='second_subject')
    elif mutation == 'choice_text':
        Choice.objects.filter(pk=choice.pk).update(text=choice.text + ' ')
    elif mutation == 'correct_flag':
        Choice.objects.filter(pk=choice.pk).update(is_correct=False)
    elif mutation == 'delete_question':
        question.delete()
    elif mutation == 'add_question':
        Question.objects.create(quiz=graph.quiz, text='Extra manual artificial question', kt_subject='first_subject')
    elif mutation == 'delete_choice':
        choice.delete()
    elif mutation == 'add_choice':
        Choice.objects.create(question=question, text='Extra manual artificial choice')
    elif mutation == 'replace_choice_id':
        text, correct = choice.text, choice.is_correct
        choice.delete()
        Choice.objects.create(question=question, text=text, is_correct=correct)
    elif mutation == 'mode':
        Quiz.objects.filter(pk=graph.quiz.pk).update(mode='training')
    elif mutation == 'lesson':
        lesson = Lesson.objects.create(course=graph.course, title='Another artificial lesson')
        Quiz.objects.filter(pk=graph.quiz.pk).update(lesson=lesson)
    else:
        Quiz.objects.filter(pk=graph.quiz.pk).update(**{mutation: 'Manual ' + mutation})
    before = snapshot()
    with CaptureQueriesContext(connection) as queries, pytest.raises(ImportConflict):
        import_variant(package, graph.quiz.pk, apply=True)
    assert snapshot() == before
    assert_no_write_queries(queries)


@pytest.mark.parametrize('apply', [False, True])
@pytest.mark.parametrize('reason', ['training', 'bound', 'published', 'pending', 'nonempty'])
def test_first_import_refuses_ineligible_target_without_writes(graph, package, reason, apply):
    if reason == 'training':
        graph.quiz.mode = 'training'
        graph.quiz.save(update_fields=['mode'])
    elif reason == 'bound':
        graph.quiz.exam_configuration_key = 'm094_profile_v1'
        graph.quiz.save(update_fields=['exam_configuration_key'])
    elif reason in ('published', 'pending'):
        graph.course.status = reason
        graph.course.save(update_fields=['status'])
    else:
        Question.objects.create(quiz=graph.quiz, text='Manual artificial question', kt_subject='first_subject')
    before = snapshot()
    with CaptureQueriesContext(connection) as queries, pytest.raises(PackageError):
        import_variant(package, graph.quiz.pk, apply=apply)
    assert snapshot() == before
    assert_no_write_queries(queries)


def test_missing_quiz_is_a_package_error_and_creates_nothing(graph, package):
    before = snapshot()
    with pytest.raises(PackageError):
        import_variant(package, 987654321, apply=True)
    assert snapshot() == before


def test_invalid_package_is_rejected_before_any_import_writes(graph, package):
    package['questions'][-1]['correct_choice_ids'] = []
    before = snapshot()
    with CaptureQueriesContext(connection) as queries, pytest.raises(PackageError):
        import_variant(package, graph.quiz.pk, apply=True)
    assert snapshot() == before
    assert_no_write_queries(queries)


def test_same_package_cannot_be_imported_into_a_second_quiz(graph, package):
    import_variant(package, graph.quiz.pk, apply=True)
    second = Quiz.objects.create(lesson=graph.lesson, title='Another artificial target', mode='kt_profile')
    before = snapshot()
    with pytest.raises(ImportConflict):
        import_variant(package, second.pk, apply=True)
    assert snapshot() == before


def test_imported_keys_work_with_real_existing_kt_scorer(graph, package):
    import_variant(package, graph.quiz.pk, apply=True)
    sections = {'first_subject': {}, 'second_subject': {}}
    answers = []
    for question in graph.quiz.questions.order_by('pk'):
        choices = dict(question.choices.values_list('pk', 'is_correct'))
        sections[question.kt_subject][question.pk] = choices
        answers.append({
            'question_id': question.pk,
            'choice_ids': [choice_id for choice_id, correct in choices.items() if correct],
        })
    result = calculate_kt_profile_score(sections['first_subject'], sections['second_subject'], answers)
    assert result['earned_points'] == result['max_points'] == 70
    assert len(result['questions']) == 50
    assert all(question['is_correct'] for question in result['questions'].values())


def test_receipt_integrity_failure_rolls_back_all_import_rows(graph, package):
    before = snapshot()
    with patch.object(QuizImportReceipt.objects, 'create', side_effect=IntegrityError('Synthetic receipt conflict')):
        with pytest.raises(ImportConflict):
            import_variant(package, graph.quiz.pk, apply=True)
    assert snapshot() == before


@pytest.mark.parametrize('failure_model', [Choice, QuizImportReceipt])
def test_creation_failure_rolls_back_all_questions_choices_and_receipt(graph, package, failure_model):
    before = snapshot()
    original_create = failure_model.objects.create
    calls = 0

    def fail_during_create(*args, **kwargs):
        nonlocal calls
        calls += 1
        if failure_model is QuizImportReceipt or calls == 3:
            raise RuntimeError('Injected isolated import failure')
        return original_create(*args, **kwargs)

    with patch.object(failure_model.objects, 'create', side_effect=fail_during_create):
        with pytest.raises(RuntimeError, match='Injected isolated import failure'):
            import_variant(package, graph.quiz.pk, apply=True)
    assert calls > 0
    assert snapshot() == before
    # A clean retry must still be possible after the failed transaction.
    assert import_variant(package, graph.quiz.pk, apply=True)['status'] == 'imported'


@pytest.mark.parametrize('duplicate', ['quiz', 'package_id'])
def test_receipt_uniqueness_is_enforced_by_database(graph, package, duplicate):
    import_variant(package, graph.quiz.pk, apply=True)
    receipt = QuizImportReceipt.objects.get(quiz=graph.quiz)
    quiz = graph.quiz
    package_id = 'different-synthetic-package'
    if duplicate == 'package_id':
        quiz = Quiz.objects.create(lesson=graph.lesson, title='Second receipt target', mode='kt_profile')
        package_id = receipt.package_id
    with pytest.raises(IntegrityError), transaction.atomic():
        QuizImportReceipt.objects.create(
            quiz=quiz, package_id=package_id,
            package_checksum=receipt.package_checksum,
            content_checksum=receipt.content_checksum, manifest=receipt.manifest,
        )
    assert QuizImportReceipt.objects.count() == 1


def test_deleting_quiz_cascades_its_import_receipt(graph, package):
    import_variant(package, graph.quiz.pk, apply=True)
    graph.quiz.delete()
    assert QuizImportReceipt.objects.count() == 0


@pytest.mark.parametrize('flags', [[], ['--dry-run', '--apply']])
def test_command_requires_exactly_one_explicit_execution_mode(graph, package, tmp_path, flags):
    path = write_package(tmp_path, package)
    before = snapshot()
    with pytest.raises(CommandError):
        call_command('import_kt_variant', str(path), '--quiz-id', str(graph.quiz.pk), *flags, stdout=StringIO())
    assert snapshot() == before


def test_command_requires_explicit_target_quiz(graph, package, tmp_path):
    path = write_package(tmp_path, package)
    before = snapshot()
    with pytest.raises(CommandError):
        call_command('import_kt_variant', str(path), '--dry-run', stdout=StringIO())
    assert snapshot() == before


@pytest.mark.parametrize('dry_run,apply', [(False, False), (True, True)])
def test_command_keyword_invocation_also_requires_one_mode(graph, package, tmp_path, dry_run, apply):
    path = write_package(tmp_path, package)
    before = snapshot()
    with pytest.raises(CommandError):
        call_command(
            'import_kt_variant', str(path), quiz_id=graph.quiz.pk,
            dry_run=dry_run, apply=apply, stdout=StringIO(),
        )
    assert snapshot() == before


def test_command_dry_run_apply_and_repeat_report_outcomes(graph, package, tmp_path):
    package['questions'][0]['explanation'] = None
    path = write_package(tmp_path, package)
    before = snapshot()
    output = StringIO()
    call_command('import_kt_variant', str(path), '--quiz-id', str(graph.quiz.pk), '--dry-run', stdout=output)
    assert 'Проверка пройдена' in output.getvalue()
    assert 'без объяснений: 1' in output.getvalue()
    assert snapshot() == before
    output = StringIO()
    call_command('import_kt_variant', str(path), '--quiz-id', str(graph.quiz.pk), '--apply', stdout=output)
    assert 'Пакет загружен' in output.getvalue()
    assert graph.quiz.questions.count() == 50
    assert QuizImportReceipt.objects.count() == 1
    before = snapshot()
    output = StringIO()
    call_command('import_kt_variant', str(path), '--quiz-id', str(graph.quiz.pk), '--apply', stdout=output)
    assert 'Уже загружено' in output.getvalue()
    assert snapshot() == before


def test_command_turns_package_and_target_errors_into_command_errors(graph, package, tmp_path):
    path = write_package(tmp_path, package)
    before = snapshot()
    with pytest.raises(CommandError):
        call_command('import_kt_variant', str(path), '--quiz-id', '987654321', '--apply', stdout=StringIO())
    path.write_text('{invalid', encoding='utf-8')
    with pytest.raises(CommandError):
        call_command('import_kt_variant', str(path), '--quiz-id', str(graph.quiz.pk), '--apply', stdout=StringIO())
    assert snapshot() == before
