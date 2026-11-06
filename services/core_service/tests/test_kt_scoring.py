"""Pure KT scoring against an explicit rule table; artificial content only.

No application endpoint or persisted grading policy is switched by these tests.
The existing training/submit regressions run beside this file in the offline runner.
"""
from copy import deepcopy
from itertools import combinations, permutations
import json
from pathlib import Path

import pytest

from quizzes import grading


RULES = json.loads((Path(__file__).parent / 'fixtures/kt_scoring_cases.json').read_text(encoding='utf-8'))


def calculator():
    function = getattr(grading, 'calculate_kt_profile_score', None)
    assert callable(function), 'The separate KT profile scorer has not been implemented yet.'
    return function


def synthetic_profile():
    # IDs and answer keys are artificial; there is no exam/learning content.
    first = {qid: {qid * 100 + index: index == 0 for index in range(5)}
        for qid in range(1, 31)}
    second = {qid: {qid * 100 + index: index < 1 + (qid - 31) % 3 for index in range(8)}
        for qid in range(31, 51)}
    return first, second


def all_correct_answers(first, second):
    return [{'question_id': qid, 'choice_ids': [cid for cid, correct in choices.items() if correct]}
        for qid, choices in {**first, **second}.items()]


def all_subsets(items):
    for size in range(len(items) + 1):
        yield from combinations(items, size)


def answer(qid, selected):
    return {'question_id': qid, 'choice_ids': list(selected)}


def assert_totals(result):
    assert result['scoring_version'] == RULES['scoring_version']
    assert result['max_points'] == 70
    assert result['sections']['first_subject']['max_points'] == 30
    assert result['sections']['first_subject']['total_questions'] == 30
    assert result['sections']['second_subject']['max_points'] == 40
    assert result['sections']['second_subject']['total_questions'] == 20
    assert len(result['questions']) == 50
    assert result['earned_points'] == sum(section['earned_points'] for section in result['sections'].values())
    assert result['earned_points'] == sum(question['earned_points'] for question in result['questions'].values())
    assert sum(question['max_points'] for question in result['questions'].values()) == 70


def test_kt_rule_fixture_records_source_revision_and_explicit_expected_matrix():
    assert RULES['source']['paragraph'] == 42
    assert RULES['source']['revision'] == '2023-06-12'
    assert RULES['source']['url'].endswith('/V1900018657')
    assert set(RULES['multiple_choice_points']) == {'1', '2', '3'}
    assert RULES['multiple_choice_points']['2'][1][1] == 1
    assert RULES['multiple_choice_points']['3'][3][1] == 1


@pytest.mark.parametrize('option_count', [6, 7, 8])
@pytest.mark.parametrize('correct_count', [1, 2, 3])
def test_kt_multiple_choice_all_selection_subsets_match_explicit_matrix(option_count, correct_count):
    calculate = calculator()
    first, second = synthetic_profile()
    # Non-contiguous key positions also catch reliance on option order.
    option_ids = [3100 + index for index in range(option_count)]
    key = set(option_ids[::2][:correct_count])
    second[31] = {cid: cid in key for cid in option_ids}
    expected_matrix = RULES['multiple_choice_points'][str(correct_count)]
    for selected_tuple in all_subsets(option_ids):
        selected = set(selected_tuple)
        expected = expected_matrix[len(selected & key)][len(selected - key)]
        result = calculate(first, second, [answer(31, selected_tuple)])
        assert result['questions'][31] == {
            'earned_points': expected, 'max_points': 2,
            'is_correct': selected == key,
        }, (option_count, key, selected)
        assert result['earned_points'] == result['sections']['second_subject']['earned_points'] == expected
        assert result['sections']['first_subject']['earned_points'] == 0
        assert_totals(result)


@pytest.mark.parametrize('key_position', range(5))
def test_kt_single_choice_all_selection_subsets(key_position):
    calculate = calculator()
    first, second = synthetic_profile()
    option_ids = list(first[1])
    key = {option_ids[key_position]}
    first[1] = {cid: cid in key for cid in option_ids}
    for selected_tuple in all_subsets(option_ids):
        exact = set(selected_tuple) == key
        result = calculate(first, second, [answer(1, selected_tuple)])
        assert result['questions'][1] == {'earned_points': int(exact), 'max_points': 1, 'is_correct': exact}
        assert result['earned_points'] == int(exact)


@pytest.mark.parametrize('selected, expected', [
    ([3101, 3105], 2), ([3101], 1), ([3101, 3102], 1),
    ([3101, 3105, 3102], 1), ([3102, 3103], 0), ([3101, 3102, 3103], 0),
])
def test_kt_two_key_examples_include_one_correct_plus_one_wrong(selected, expected):
    first, second = synthetic_profile()
    second[31] = {3100 + index: index in (1, 5) for index in range(6)}
    result = calculator()(first, second, [answer(31, selected)])
    assert result['questions'][31]['earned_points'] == expected


def test_kt_three_correct_plus_one_wrong_earns_one_without_a_three_selection_cap():
    first, second = synthetic_profile()
    second[31] = {3100 + index: index in (0, 2, 4) for index in range(8)}
    result = calculator()(first, second, [answer(31, [3100, 3102, 3104, 3107])])
    assert result['questions'][31] == {'earned_points': 1, 'max_points': 2, 'is_correct': False}


def test_kt_same_one_correct_key_has_different_weights_in_the_two_subjects():
    first, second = synthetic_profile()
    result = calculator()(first, second, [answer(1, [100]), answer(31, [3100])])
    assert result['questions'][1]['earned_points'] == 1
    assert result['questions'][31]['earned_points'] == 2
    assert result['earned_points'] == 3


def test_kt_full_profile_and_each_subject_have_exact_maxima():
    first, second = synthetic_profile()
    selected = all_correct_answers(first, second)
    result = calculator()(first, second, selected)
    assert result['earned_points'] == 70
    assert result['sections']['first_subject']['earned_points'] == 30
    assert result['sections']['second_subject']['earned_points'] == 40
    assert all(item['is_correct'] for item in result['questions'].values())
    assert_totals(result)
    assert calculator()(first, second, selected[:30])['earned_points'] == 30
    assert calculator()(first, second, selected[30:])['earned_points'] == 40


def test_kt_omitted_and_explicit_empty_answers_are_equal_and_keep_full_maximum():
    first, second = synthetic_profile()
    omitted = calculator()(first, second, [])
    explicit = calculator()(first, second, [answer(qid, []) for qid in {**first, **second}])
    assert omitted == explicit
    assert omitted['earned_points'] == 0
    assert all(item['earned_points'] == 0 and item['is_correct'] is False for item in omitted['questions'].values())
    assert_totals(omitted)


def test_kt_one_skip_loses_the_question_weight_not_the_number_of_selected_choices():
    first, second = synthetic_profile()
    selected = all_correct_answers(first, second)
    assert calculator()(first, second, [item for item in selected if item['question_id'] != 1])['earned_points'] == 69
    assert calculator()(first, second, [item for item in selected if item['question_id'] != 31])['earned_points'] == 68


def test_kt_selected_order_and_question_order_do_not_change_scoring():
    first, second = synthetic_profile()
    second[31] = {3100 + index: index in (0, 2) for index in range(6)}
    expected = calculator()(first, second, [answer(1, [100]), answer(31, [3100, 3102, 3105])])
    for order in permutations([3100, 3102, 3105]):
        actual = calculator()(dict(reversed(list(first.items()))), dict(reversed(list(second.items()))),
            [answer(31, order), answer(1, [100])])
        assert actual == expected


def test_kt_caller_scores_correctness_and_policy_labels_do_not_determine_result():
    first, second = synthetic_profile()
    selected = [answer(1, [101]), answer(31, [3101])]
    baseline = calculator()(first, second, selected)
    for item in selected:
        item.update(score=100, percent=100, earned_points=70, max_points=999,
            is_correct=True, correct_choice_ids=item['choice_ids'], scoring_version='forged')
    assert calculator()(first, second, selected) == baseline
    assert baseline['earned_points'] == 0
    assert baseline['scoring_version'] == RULES['scoring_version']


def test_kt_calculation_does_not_mutate_inputs_and_result_is_not_a_live_reference():
    first, second = synthetic_profile()
    selected = all_correct_answers(first, second)
    before = deepcopy((first, second, selected))
    result = calculator()(first, second, selected)
    assert (first, second, selected) == before
    result['questions'][1]['earned_points'] = -1
    result['sections']['first_subject']['earned_points'] = -1
    assert calculator()(first, second, selected)['earned_points'] == 70


@pytest.mark.parametrize('section, count', [('first', 0), ('first', 29), ('first', 31), ('second', 0), ('second', 19), ('second', 21)])
def test_kt_rejects_wrong_subject_question_counts(section, count):
    first, second = synthetic_profile()
    target = first if section == 'first' else second
    template = next(iter(target.values()))
    target.clear()
    target.update({1000 + index: dict(template) for index in range(count)})
    with pytest.raises(ValueError):
        calculator()(first, second, [])


@pytest.mark.parametrize('section, correct_count', [('first', 0), ('first', 2), ('second', 0), ('second', 4)])
def test_kt_rejects_invalid_correct_key_cardinality(section, correct_count):
    first, second = synthetic_profile()
    target, qid = (first, 1) if section == 'first' else (second, 31)
    target[qid] = {qid * 100 + index: index < correct_count for index in range(8)}
    with pytest.raises(ValueError):
        calculator()(first, second, [])


def test_kt_rejects_overlapping_question_ids_between_subjects():
    first, second = synthetic_profile()
    second[1] = second.pop(31)
    with pytest.raises(ValueError):
        calculator()(first, second, [])


@pytest.mark.parametrize('invalid_answers', [
    None, {}, 'answers', [None], [[]], [{}],
    [{'question_id': 1}], [{'choice_ids': []}],
    [{'question_id': '1', 'choice_ids': []}],
    [{'question_id': True, 'choice_ids': []}],
    [{'question_id': 1.0, 'choice_ids': []}],
    [{'question_id': 1, 'choice_ids': None}],
    [{'question_id': 1, 'choice_ids': '100'}],
    [{'question_id': 1, 'choice_ids': (100,)}],
    [{'question_id': 1, 'choice_ids': ['100']}],
    [{'question_id': 1, 'choice_ids': [True]}],
    [{'question_id': 1, 'choice_ids': [100.0]}],
    [{'question_id': 1, 'choice_ids': [100, 100]}],
    [{'question_id': 1, 'choice_ids': []}, {'question_id': 1, 'choice_ids': [100]}],
    [{'question_id': 999, 'choice_ids': []}],
    [{'question_id': 1, 'choice_ids': [3100]}],
    [{'question_id': 1, 'choice_ids': [999999]}],
])
def test_kt_rejects_malformed_duplicate_or_foreign_answers(invalid_answers):
    first, second = synthetic_profile()
    calculate = calculator()
    with pytest.raises(ValueError):
        calculate(first, second, invalid_answers)


@pytest.mark.parametrize('invalid_content', ['section_type', 'question_id_type', 'choice_map_type', 'choice_id_type', 'correct_flag_type'])
def test_kt_rejects_malformed_server_answer_key(invalid_content):
    first, second = synthetic_profile()
    if invalid_content == 'section_type':
        first = list(first.items())
    elif invalid_content == 'question_id_type':
        first['1'] = first.pop(1)
    elif invalid_content == 'choice_map_type':
        first[1] = list(first[1].items())
    elif invalid_content == 'choice_id_type':
        first[1]['100'] = first[1].pop(100)
    else:
        first[1][100] = 1
    calculate = calculator()
    with pytest.raises(ValueError):
        calculate(first, second, [])


def test_training_mode_stays_exact_match_and_one_point_per_question():
    questions = {1: {100: True, 101: False}, 2: {200: True, 201: True, 202: False}}
    exact = grading.calculate_submission_score(questions, [answer(1, [100]), answer(2, [200, 201])])
    partial = grading.calculate_submission_score(questions, [answer(1, [100]), answer(2, [200])])
    assert exact['correct_count'] == 2 and exact['score'] == 100
    assert partial['correct_count'] == 1 and partial['score'] == 50
    assert partial['is_correct_by_question'] == {1: True, 2: False}
    assert 'earned_points' not in exact and 'scoring_version' not in exact
