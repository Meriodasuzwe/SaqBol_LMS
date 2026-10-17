// Audit reproductions: these assertions document the current defects. They are
// expected to change when application fixes are authorized. No app is mounted,
// no browser event is executed, and all fixtures below are synthetic.
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
const actualPayloadCallback = evaluateNode(builder, payloadMap.arguments[0]);

function makePayload(question) {
    // Normalize the VM object's prototype for comparisons in this test realm.
    return JSON.parse(JSON.stringify(actualPayloadCallback(structuredClone(question))));
}

test('audit control: actual builder callback preserves single and multiple correct answers without empty options', () => {
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

test('audit reproduction: actual builder callback discards a nonempty explanation', () => {
    const fixture = {
        question: 'Synthetic explanation question', options: ['Wrong', 'Right'],
        correct_option_index: [1], explanation: 'Synthetic rationale that must survive editing.',
    };
    const result = makePayload(fixture);
    assert.equal(result.correct_answer, 'Right');
    assert.equal(result.explanation, '');
    assert.notEqual(result.explanation, fixture.explanation);
});

test('audit reproduction: removing an earlier empty option shifts the selected answer to a different option', () => {
    const fixture = {
        question: 'Synthetic leading blank question',
        options: ['   ', 'Originally correct', 'Originally incorrect'], correct_option_index: [1],
    };
    const result = makePayload(fixture);
    assert.deepEqual(result.options, ['Originally correct', 'Originally incorrect']);
    assert.deepEqual(result.correct_index, [1]);
    assert.equal(result.correct_answer, 'Originally incorrect');
    assert.notEqual(result.correct_answer, fixture.options[fixture.correct_option_index[0]]);
});

test('audit reproduction: an out-of-range original index after filtering falls back to the first wrong answer', () => {
    const fixture = {
        question: 'Synthetic middle blank question',
        options: ['Originally incorrect', '', 'Originally correct'], correct_option_index: [2],
    };
    const result = makePayload(fixture);
    assert.deepEqual(result.options, ['Originally incorrect', 'Originally correct']);
    assert.deepEqual(result.correct_index, [0]);
    assert.equal(result.correct_answer, 'Originally incorrect');
    assert.notEqual(result.correct_answer, fixture.options[fixture.correct_option_index[0]]);
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
