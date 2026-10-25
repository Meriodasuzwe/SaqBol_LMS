// Builder regressions assert the desired CNT-03 behavior. Remaining tests named
// "audit reproduction" still document unrelated defects, not their fixes.
// No app is mounted, no browser event runs, and all fixtures are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { parse } from '@babel/parser';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import katex from 'katex';

function readSource(relativePath) {
    const url = new URL(`../src/${relativePath}`, import.meta.url);
    const source = readFileSync(url, 'utf8');
    return { source, name: relativePath, ast: parse(source, { sourceType: 'module', plugins: ['jsx'] }) };
}

function findOne(root, predicate, label) {
    const matches = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (typeof node.type !== 'string') return;
        if (predicate(node)) matches.push(node);
        for (const [key, value] of Object.entries(node)) {
            if (!['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'tokens'].includes(key)) walk(value);
        }
    }
    walk(root);
    assert.equal(matches.length, 1, `Expected one actual source node: ${label}`);
    return matches[0];
}

function evaluateNode(file, node, bindings = {}) {
    // Evaluate only the exact expression selected from the application AST.
    // No imports, component effects, network clients, or application bootstrap run.
    const expression = file.source.slice(node.start, node.end);
    return new Script(`(${expression})`, { filename: `${file.name}:${node.loc.start.line}` })
        .runInNewContext(bindings, { timeout: 1000 });
}

function initializer(file, root, variableName) {
    return findOne(root, node => node.type === 'VariableDeclarator' && node.id.name === variableName, variableName).init;
}

const builder = readSource('CourseBuilder/CourseBuilder.jsx');
const saveStep = initializer(builder, builder.ast, 'handleSaveStep');
const payloadMap = initializer(builder, saveStep, 'payloadQuestions');
assert.equal(payloadMap.type, 'CallExpression');
assert.equal(payloadMap.callee.object.name, 'quizQuestions');
assert.equal(payloadMap.callee.property.name, 'map');
assert.equal(payloadMap.arguments[0].type, 'ArrowFunctionExpression');
const actualPayloadCallback = evaluateNode(builder, payloadMap.arguments[0], { t: key => key });

function makePayload(question) {
    // Normalize the VM object's prototype for comparisons in this test realm.
    return JSON.parse(JSON.stringify(actualPayloadCallback(structuredClone(question))));
}

test('builder regression: preserves single and multiple correct answers without empty options', () => {
    for (const indices of [[1], [0, 2]]) {
        const result = makePayload({
            id: 901, question: 'Synthetic control question',
            options: ['Alpha', 'Bravo', 'Charlie'], correct_option_index: indices,
        });
        assert.equal(result.id, 901);
        assert.deepEqual(result.options, ['Alpha', 'Bravo', 'Charlie']);
        assert.deepEqual(result.correct_index, indices);
        assert.equal(result.correct_answer, indices.map(index => ['Alpha', 'Bravo', 'Charlie'][index]).join(' | '));
    }
});

test('builder regression: preserves a nonempty explanation', () => {
    const fixture = {
        question: 'Synthetic explanation question', options: ['Wrong', 'Right'],
        correct_option_index: [1], explanation: 'Synthetic rationale that must survive editing.',
    };
    const result = makePayload(fixture);
    assert.equal(result.correct_answer, 'Right');
    assert.equal(result.explanation, fixture.explanation);
});

test('builder regression: removing an earlier blank keeps the same correct answer', () => {
    const fixture = {
        question: 'Synthetic leading blank question',
        options: ['   ', 'Originally correct', 'Originally incorrect'], correct_option_index: [1],
    };
    const result = makePayload(fixture);
    assert.deepEqual(result.options, ['Originally correct', 'Originally incorrect']);
    assert.deepEqual(result.correct_index, [0]);
    assert.equal(result.correct_answer, fixture.options[fixture.correct_option_index[0]]);
});

test('builder regression: removing a middle blank remaps the key without a fallback answer', () => {
    const fixture = {
        question: 'Synthetic middle blank question',
        options: ['Originally incorrect', '', 'Originally correct'], correct_option_index: [2],
    };
    const result = makePayload(fixture);
    assert.deepEqual(result.options, ['Originally incorrect', 'Originally correct']);
    assert.deepEqual(result.correct_index, [1]);
    assert.equal(result.correct_answer, fixture.options[fixture.correct_option_index[0]]);
});

test('builder regression: blank cleanup preserves every selected option and leaves input unchanged', () => {
    const fixture = { question: 'Synthetic multi', options: ['', 'Alpha', ' ', 'Bravo', 'Charlie', ''], correct_option_index: [1, 4], explanation: 'Alpha and Charlie.' };
    const before = structuredClone(fixture);
    const result = JSON.parse(JSON.stringify(actualPayloadCallback(fixture)));
    assert.deepEqual(result.options, ['Alpha', 'Bravo', 'Charlie']);
    assert.deepEqual(result.correct_index, [0, 2]);
    assert.equal(result.correct_answer, 'Alpha | Charlie');
    assert.equal(result.explanation, fixture.explanation);
    assert.deepEqual(fixture, before);
});

function runBuilderSave(questions) {
    const writes = [], errors = [], successes = [], loading = [];
    const step = { id: 903, step_type: 'quiz', title: 'Synthetic quiz', content: '', scenario_data: { quiz_id: 904 } };
    const lesson = { id: 902, steps: [step] };
    const handler = evaluateNode(builder, saveStep, {
        quizQuestions: structuredClone(questions), activeStep: step, activeLesson: lesson,
        currentQuizId: 904, lessons: [lesson], t: key => key,
        setLoading: value => loading.push(value), setCurrentQuizId() {},
        setLessons() {}, setActiveLesson() {}, setActiveStep() {},
        toast: { error: message => errors.push(message), success: message => successes.push(message) },
        api: {
            post: async (url, payload) => { writes.push({ url, payload: JSON.parse(JSON.stringify(payload)) }); return { data: { quiz_id: 904 } }; },
            patch: async (url, payload) => { writes.push({ url, payload: JSON.parse(JSON.stringify(payload)) }); return { data: { ...step, ...payload } }; },
        },
    });
    return handler().then(() => ({ writes, errors, successes, loading }));
}

const validQuestion = { question: 'Synthetic valid question', options: ['Alpha', 'Bravo', 'Charlie'], correct_option_index: [1], explanation: 'Bravo is correct.' };
for (const [name, changes] of [
    ['no correct answer', { correct_option_index: [] }],
    ['missing key', { correct_option_index: undefined }],
    ['blank correct option', { options: ['Alpha', ' ', 'Charlie'] }],
    ['out-of-range index', { correct_option_index: [3] }],
    ['negative index', { correct_option_index: [-1] }],
    ['fractional index', { correct_option_index: [0.5] }],
    ['string index', { correct_option_index: ['1'] }],
    ['duplicate indices', { correct_option_index: [1, 1] }],
    ['too few nonblank options', { options: ['', 'Bravo', ' '] }],
    ['blank question', { question: '   ' }],
]) {
    test(`builder regression: ${name} rejects the whole save before any API write`, async () => {
        // Invalid second question must also block the valid first one.
        const result = await runBuilderSave([validQuestion, { ...validQuestion, ...changes }]);
        assert.equal(result.writes.length, 0);
        assert.equal(result.successes.length, 0);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0], /builder\.quizValidation\./);
        assert.equal(result.loading.at(-1), false);
    });
}

test('builder regression: an empty quiz is not saved', async () => {
    const result = await runBuilderSave([]);
    assert.equal(result.writes.length, 0);
    assert.equal(result.successes.length, 0);
    assert.equal(result.errors.length, 1);
});

test('builder regression: saving while quiz data is not loaded never reports success', async () => {
    const result = await runBuilderSave(null);
    assert.equal(result.writes.length, 0);
    assert.equal(result.successes.length, 0);
    assert.equal(result.errors.length, 1);
});

test('builder regression: a new question requires an explicit key', () => {
    let questions;
    evaluateNode(builder, initializer(builder, builder.ast, 'handleAddManualQuestion'), {
        quizQuestions: [], setQuizQuestions: value => { questions = JSON.parse(JSON.stringify(value)); },
    })();
    assert.deepEqual(questions[0].correct_option_index, []);
    assert.equal(questions[0].explanation, '');
});

test('builder regression: an author can uncheck the last selected option without choosing another', () => {
    let edited;
    evaluateNode(builder, initializer(builder, builder.ast, 'handleCorrectSelect'), {
        quizQuestions: [structuredClone(validQuestion)], setQuizQuestions: value => { edited = JSON.parse(JSON.stringify(value)); },
    })(0, 1);
    assert.deepEqual(edited[0].correct_option_index, []);
});

async function loadBuilderQuestions(apiQuestions) {
    let mapped;
    const handler = evaluateNode(builder, initializer(builder, builder.ast, 'fetchQuizForStep'), {
        api: { get: async () => ({ data: [{ id: 904, questions: apiQuestions }] }) },
        setCurrentQuizId() {}, setQuizQuestions: value => { mapped = JSON.parse(JSON.stringify(value)); },
    });
    await handler(902, 904);
    return mapped;
}

test('builder regression: real load/edit/save handlers preserve explanation and a multiple key', async () => {
    const loaded = await loadBuilderQuestions([{ id: 905, text: 'Synthetic SQL question', explanation: 'Both expressions filter rows.', choices: [
        { id: 911, text: 'WHERE x = 1', is_correct: true },
        { id: 912, text: 'ORDER BY x', is_correct: false },
        { id: 913, text: 'WHERE x > 2', is_correct: true },
    ] }]);
    assert.equal(loaded[0].explanation, 'Both expressions filter rows.');
    let edited;
    evaluateNode(builder, initializer(builder, builder.ast, 'handleQuestionChange'), {
        quizQuestions: loaded, setQuizQuestions: value => { edited = value; },
    })(0, 'question', 'Edited synthetic SQL question');
    const result = await runBuilderSave(edited);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.writes[0].payload.questions[0], {
        id: 905, question: 'Edited synthetic SQL question',
        options: ['WHERE x = 1', 'ORDER BY x', 'WHERE x > 2'], correct_index: [0, 2],
        correct_answer: 'WHERE x = 1 | WHERE x > 2', explanation: 'Both expressions filter rows.',
    });
    assert.equal(result.writes[0].url, 'quizzes/save-generated/');
    assert.equal(result.writes[0].payload.quiz_id, 904);
    assert.equal(result.writes[0].payload.lesson_id, 902);
    assert.equal(result.writes[1].url, 'courses/steps/903/');
    assert.equal(result.successes.length, 1);
});

test('builder regression: loading a question without a key never guesses its first option', async () => {
    const loaded = await loadBuilderQuestions([{ id: 905, text: 'No key', explanation: '', choices: [
        { text: 'Alpha', is_correct: false }, { text: 'Bravo', is_correct: false },
    ] }]);
    assert.deepEqual(loaded[0].correct_option_index, []);
    assert.equal((await runBuilderSave(loaded)).writes.length, 0);
});

test('builder regression: removing the last correct option requires a new explicit selection', async () => {
    let edited;
    evaluateNode(builder, initializer(builder, builder.ast, 'handleRemoveOption'), {
        quizQuestions: [structuredClone(validQuestion)], setQuizQuestions: value => { edited = JSON.parse(JSON.stringify(value)); },
    })(0, 1);
    assert.deepEqual(edited[0].options, ['Alpha', 'Charlie']);
    assert.deepEqual(edited[0].correct_option_index, []);
    assert.equal((await runBuilderSave(edited)).writes.length, 0);
});

test('builder regression: removing an earlier option keeps a multiple key attached to its texts', () => {
    let edited;
    evaluateNode(builder, initializer(builder, builder.ast, 'handleRemoveOption'), {
        quizQuestions: [{ ...structuredClone(validQuestion), correct_option_index: [1, 2] }],
        setQuizQuestions: value => { edited = JSON.parse(JSON.stringify(value)); },
    })(0, 0);
    assert.deepEqual(edited[0].correct_option_index, [0, 1]);
    assert.equal(edited[0].correct_answer, 'Bravo | Charlie');
});

test('audit reproduction and control: actual submitAnalytics sends only the first selected ID for a multiple-choice answer', async () => {
    const quizPage = readSource('QuizPage.jsx');
    const captured = [];
    const warnings = [];
    const submitAnalytics = evaluateNode(quizPage, initializer(quizPage, quizPage.ast, 'submitAnalytics'), {
        startTimeRef: { current: 1000 },
        Date: { now: () => 11000 },
        api: { post: async (url, payload) => { captured.push({ url, payload: JSON.parse(JSON.stringify(payload)) }); } },
        console: { warn: (...args) => warnings.push(args) },
    });
    const answers = { 811: [820, 821], 812: [830] };
    await submitAnalytics(
        { id: 801, questions: [{ id: 811 }, { id: 812 }] },
        { id: 901, score: 100, correct_answers_ids: { 811: [820, 821], 812: [830] } },
        answers,
    );
    assert.deepEqual(warnings, [], 'The actual callback completed without swallowing an error');
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, 'analytics/quiz-attempt/');
    assert.deepEqual(captured[0].payload.answers, [
        { question_id: 811, selected_choice_id: 820, is_correct: true },
        { question_id: 812, selected_choice_id: 830, is_correct: true },
    ]);
    assert.equal(captured[0].payload.correct_answers, 2, 'Correctness checks the complete selection before serialization loses the second ID');
    assert.equal(captured[0].payload.time_spent_seconds, 10);
    assert.deepEqual(answers[811], [820, 821], 'The complete synthetic answer remains present in input');
});

const lesson = readSource('LessonPage.jsx');
const actualRenderMath = evaluateNode(lesson, initializer(lesson, lesson.ast, 'renderMath'), { katex });
const htmlMarker = '<p>Synthetic audit content</p><img src="data:image/png;base64," onerror="globalThis.__SAQBOL_AUDIT_MARKER__ = 1">';
const benignHtml = '<p>Synthetic <strong>safe formatting</strong></p>';

function renderActualHtmlBoundary(file, bindings) {
    const element = findOne(file.ast, node => node.type === 'JSXElement'
        && node.openingElement.attributes.some(attribute => attribute.name?.name === 'dangerouslySetInnerHTML'),
    `${file.name} dangerouslySetInnerHTML element`);
    assert.equal(element.openingElement.name.type, 'JSXIdentifier');
    assert.ok(element.children.every(child => child.type === 'JSXText' && !child.value.trim()));
    const props = {};
    for (const attribute of element.openingElement.attributes) {
        assert.equal(attribute.type, 'JSXAttribute');
        if (attribute.value.type === 'StringLiteral') props[attribute.name.name] = attribute.value.value;
        else {
            assert.equal(attribute.value.type, 'JSXExpressionContainer');
            props[attribute.name.name] = evaluateNode(file, attribute.value.expression, bindings);
        }
    }
    // The tag and every prop come from the actual JSX element. React DOM itself
    // serializes that element; its raw-HTML behavior is not mocked or reimplemented.
    return renderToStaticMarkup(React.createElement(element.openingElement.name.name, props));
}

const htmlBoundaries = [
    { file: readSource('CourseDetail.jsx'), bindings: html => ({ course: { description: html } }) },
    { file: lesson, bindings: html => ({ currentStep: { content: html }, renderMath: actualRenderMath }) },
    { file: readSource('PythonEditor.jsx'), bindings: html => ({ stepData: { content: html } }) },
];

for (const boundary of htmlBoundaries) {
    test(`audit reproduction: ${boundary.file.name} preserves the onerror marker in React HTML serialization (no browser execution)`, () => {
        assert.equal(globalThis.__SAQBOL_AUDIT_MARKER__, undefined);
        const rendered = renderActualHtmlBoundary(boundary.file, boundary.bindings(htmlMarker));
        assert.ok(rendered.includes(htmlMarker), 'Actual HTML sink retains the complete unsanitized marker');
        assert.ok(rendered.includes('onerror="globalThis.__SAQBOL_AUDIT_MARKER__ = 1"'));
        assert.ok(!rendered.includes('&lt;img'), 'Marker remains an HTML element, not escaped text');
        const control = renderActualHtmlBoundary(boundary.file, boundary.bindings(benignHtml));
        assert.ok(control.includes(benignHtml), 'Benign formatting control passes through the same actual sink');
        assert.equal(globalThis.__SAQBOL_AUDIT_MARKER__, undefined, 'Server serialization does not execute an HTML event');
    });
}

test('audit control and reproduction: real renderMath renders KaTeX but leaves adjacent event-handler HTML intact', () => {
    const rendered = renderActualHtmlBoundary(lesson, {
        currentStep: { content: `<p>$x^2$</p>${htmlMarker}` },
        renderMath: actualRenderMath,
    });
    assert.ok(rendered.includes('class="katex"'), 'Installed KaTeX rendered the real math expression');
    assert.ok(!rendered.includes('$x^2$'));
    assert.ok(rendered.includes(htmlMarker), 'The actual math transform is not an HTML sanitizer');
    assert.equal(globalThis.__SAQBOL_AUDIT_MARKER__, undefined);
});
