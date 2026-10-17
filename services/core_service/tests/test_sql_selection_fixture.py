"""Validate the synthetic SQL fixture using only an in-memory database.

Run from the repository root:
    python -m pytest services/core_service/tests/test_sql_selection_fixture.py -q
"""

import json
from pathlib import Path
import sqlite3

import pytest


@pytest.fixture
def training_fixture():
    path = Path(__file__).parent / "fixtures" / "sql_selection_training.json"
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture
def questions(training_fixture):
    return training_fixture["questions"]


@pytest.fixture
def database():
    connection = sqlite3.connect(":memory:")
    try:
        yield connection
    finally:
        connection.close()


def test_fixture_metadata_shape_and_order(training_fixture):
    assert training_fixture["metadata"] == {
        "synthetic": True,
        "development_only": True,
        "publish": False,
        "notice": (
            "Искусственный набор для разработки и тестирования; "
            "не официальные вопросы КТ и не проверенный учебный материал."
        ),
        "subject": "Базы данных",
        "topic": "SQL: выборка и фильтрация",
    }
    questions = training_fixture["questions"]
    assert isinstance(questions, list)
    assert len(questions) == 10
    assert [question["key"] for question in questions] == [
        f"sql-{number:02d}" for number in range(1, 11)
    ]
    for question in questions:
        assert set(question) == {
            "key", "question", "options", "correct_index", "explanation",
        }
        assert all(
            isinstance(question[key], str) and question[key].strip()
            for key in ("key", "question", "explanation")
        )
        options = question["options"]
        assert isinstance(options, list) and len(options) >= 2
        assert all(isinstance(option, str) and option.strip() for option in options)
        indices = question["correct_index"]
        assert isinstance(indices, list) and indices
        assert len(indices) == len(set(indices))
        assert all(type(index) is int and 0 <= index < len(options) for index in indices)
    assert any(len(question["correct_index"]) == 1 for question in questions)
    assert any(
        1 < len(question["correct_index"]) < len(question["options"])
        for question in questions
    )


def test_sql_01_selects_only_requested_columns(questions, database):
    database.execute("CREATE TABLE products(id INTEGER, name TEXT, price REAL)")
    database.executemany(
        "INSERT INTO products VALUES (?, ?, ?)",
        [(2, "b", 100), (3, "c", 200), (1, "a", 200)],
    )
    actual_indices = [
        index
        for index, query in enumerate(questions[0]["options"])
        if [column[0] for column in database.execute(query).description]
        == ["name", "price"]
    ]
    assert questions[0]["correct_index"] == actual_indices


def test_sql_02_where_includes_lower_boundary(questions, database):
    database.execute("CREATE TABLE students(id INTEGER, score REAL)")
    scores = [-1, 0, 59, 59.5, 60, 60.5, 61, 100]
    database.executemany("INSERT INTO students VALUES (?, ?)", enumerate(scores))
    expected = {(index,) for index, score in enumerate(scores) if score >= 60}
    actual_indices = [
        index
        for index, clause in enumerate(questions[1]["options"])
        if set(database.execute("SELECT id FROM students WHERE " + clause)) == expected
    ]
    assert questions[1]["correct_index"] == actual_indices


def test_sql_03_and_has_priority_over_or(questions, database):
    database.execute("CREATE TABLE students(id INTEGER, city TEXT, age INTEGER)")
    database.executemany(
        "INSERT INTO students VALUES (?, ?, ?)",
        [(1, "Алматы", 17), (2, "Астана", 20), (3, "Алматы", 20), (4, "Шымкент", 19)],
    )
    selected = {
        row[0]
        for row in database.execute(
            "SELECT id FROM students "
            "WHERE city = 'Алматы' OR city = 'Астана' AND age >= 18"
        )
    }
    actual_indices = [
        index
        for index, option in enumerate(questions[2]["options"])
        if {int(value.strip()) for value in option.strip("{}").split(",")} == selected
    ]
    assert questions[2]["correct_index"] == actual_indices


def test_sql_04_in_matches_exact_values(questions, database):
    database.execute("CREATE TABLE categories(category_id INTEGER)")
    database.executemany(
        "INSERT INTO categories VALUES (?)", [(value,) for value in range(-2, 7)],
    )
    actual_indices = [
        index
        for index, clause in enumerate(questions[3]["options"])
        if set(database.execute("SELECT category_id FROM categories WHERE " + clause))
        == {(1,), (3,)}
    ]
    assert questions[3]["correct_index"] == actual_indices


def test_sql_05_between_includes_both_boundaries(questions, database):
    database.execute("CREATE TABLE products(id INTEGER, price REAL)")
    prices = [-5, 0, 99, 100, 100.5, 150, 199.9, 200, 201]
    database.executemany("INSERT INTO products VALUES (?, ?)", enumerate(prices))
    expected = {(index,) for index, price in enumerate(prices) if 100 <= price <= 200}
    actual_indices = [
        index
        for index, clause in enumerate(questions[4]["options"])
        if set(database.execute("SELECT id FROM products WHERE " + clause)) == expected
    ]
    assert questions[4]["correct_index"] == actual_indices


def test_sql_06_is_null_checks_missing_values(questions, database):
    database.execute("CREATE TABLE contacts(phone TEXT)")
    database.executemany("INSERT INTO contacts VALUES (?)", [(None,), ("",), ("123",)])
    actual_indices = [
        index
        for index, clause in enumerate(questions[5]["options"])
        if database.execute("SELECT phone FROM contacts WHERE " + clause).fetchall()
        == [(None,)]
    ]
    assert questions[5]["correct_index"] == actual_indices


def test_sql_07_like_underscore_requires_one_character(questions, database):
    actual_indices = [
        index
        for index, value in enumerate(questions[6]["options"])
        if database.execute("SELECT ? LIKE 'a_%'", (value,)).fetchone()[0] == 1
    ]
    assert questions[6]["correct_index"] == actual_indices


def test_sql_08_order_by_applies_keys_in_order(questions, database):
    database.execute("CREATE TABLE products(id INTEGER, name TEXT, price REAL)")
    database.executemany(
        "INSERT INTO products VALUES (?, ?, ?)",
        [(2, "b", 100), (3, "c", 200), (1, "a", 200)],
    )
    expected = [(1, 200), (3, 200), (2, 100)]
    actual_indices = [
        index
        for index, query in enumerate(questions[7]["options"])
        if database.execute(query).fetchall() == expected
    ]
    assert questions[7]["correct_index"] == actual_indices


def test_sql_09_distinct_removes_duplicate_cities(questions, database):
    database.execute("CREATE TABLE students(city TEXT)")
    database.executemany(
        "INSERT INTO students VALUES (?)",
        [("Алматы",), ("Астана",), ("Алматы",), ("Астана",)],
    )
    assert set(database.execute("SELECT DISTINCT city FROM students")) == {
        ("Алматы",), ("Астана",),
    }
    assert questions[8]["correct_index"] == [1]


def test_sql_10_combines_distinct_status_and_null_filter(questions, database):
    database.execute("CREATE TABLE users(city TEXT, status TEXT)")
    database.executemany(
        "INSERT INTO users VALUES (?, ?)",
        [
            ("Алматы", "active"), ("Алматы", "active"), ("Астана", "active"),
            ("Шымкент", "inactive"), (None, "active"), ("Караганда", None), (None, None),
        ],
    )
    expected = [("Алматы",), ("Астана",)]
    actual_indices = []
    for index, query in enumerate(questions[9]["options"]):
        result = database.execute(query).fetchall()
        if len(result) == len(expected) and set(result) == set(expected):
            actual_indices.append(index)
    assert questions[9]["correct_index"] == actual_indices
