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

function runBuilderSave(questions, { failSave = false, incompleteResponse = false, stepType = 'quiz', newQuiz = false } = {}) {
    const writes = [], errors = [], successes = [], loading = [];
    const step = { id: 903, step_type: stepType, title: 'Synthetic quiz', content: 'Synthetic draft content', scenario_data: { note: 'Keep metadata', ...(newQuiz ? {} : { quiz_id: 904 }) } };
    const lesson = { id: 902, steps: [step] };
    const draft = structuredClone(questions);
    const updates = { quizzes: [], steps: [], lessons: [] };
    const handler = evaluateNode(builder, saveStep, {
        quizQuestions: draft, activeStep: step, activeLesson: lesson,
        currentQuizId: newQuiz ? null : 904, lessons: [lesson], t: key => key,
        setLoading: value => loading.push(value), setCurrentQuizId: value => updates.quizzes.push(value),
        setLessons: value => updates.lessons.push(value), setActiveLesson() {}, setActiveStep: value => updates.steps.push(value),
        toast: { error: message => errors.push(message), success: message => successes.push(message) },
        api: {
            post: async (url, payload) => {
                writes.push({ method: 'POST', url, payload: JSON.parse(JSON.stringify(payload)) });
                if (failSave) throw new Error('Synthetic server write failure');
                if (incompleteResponse) return { data: { quiz_id: 904 } };
                return { data: { quiz_id: 904, step: { ...step, ...payload.step, scenario_data: { ...step.scenario_data, quiz_id: 904 } } } };
            },
            patch: async (url, payload) => {
                writes.push({ method: 'PATCH', url, payload: JSON.parse(JSON.stringify(payload)) });
                if (failSave) throw new Error('Synthetic server write failure');
                return { data: { ...step, ...payload } };
            },
        },
    });
    return handler().then(() => JSON.parse(JSON.stringify({ writes, errors, successes, loading, updates, draft, step })));
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
    assert.equal(result.writes.length, 1, 'The quiz and step must have one atomic write');
    assert.equal(result.writes[0].payload.step_id, 903);
    assert.equal(result.writes[0].payload.step.title, 'Synthetic quiz');
    assert.equal(result.writes[0].payload.step.scenario_data.note, 'Keep metadata');
    assert.equal(result.successes.length, 1);
});

test('builder atomic save: an unlinked quiz step is saved and linked in one request', async () => {
    const result = await runBuilderSave([validQuestion], { newQuiz: true });
    assert.deepEqual(result.errors, []);
    assert.equal(result.writes.length, 1);
    assert.equal(result.writes[0].method, 'POST');
    assert.equal(result.writes[0].payload.step_id, 903);
    assert.equal(Object.hasOwn(result.writes[0].payload, 'quiz_id'), false);
    assert.deepEqual(result.writes[0].payload.step, {
        title: 'Synthetic quiz', content: 'Synthetic draft content', step_type: 'quiz', scenario_data: { note: 'Keep metadata' },
    });
    assert.deepEqual(result.updates.quizzes, [904]);
    assert.equal(result.updates.steps[0].scenario_data.quiz_id, 904);
    assert.equal(result.successes.length, 1);
});

test('builder atomic save: failure preserves the draft and allows retry without optimistic state updates', async () => {
    const questions = [structuredClone(validQuestion)];
    const failed = await runBuilderSave(questions, { failSave: true, newQuiz: true });
    assert.equal(failed.writes.length, 1);
    assert.deepEqual(failed.draft, questions);
    assert.deepEqual(failed.updates, { quizzes: [], steps: [], lessons: [] });
    assert.deepEqual(failed.successes, []);
    assert.deepEqual(failed.errors, ['builder.toasts.stepSaveError']);
    assert.equal(failed.step.title, 'Synthetic quiz');
    assert.equal(failed.loading.at(-1), false);
    const retried = await runBuilderSave(failed.draft, { newQuiz: true });
    assert.equal(retried.writes.length, 1);
    assert.deepEqual(retried.errors, []);
    assert.equal(retried.successes.length, 1);
});

test('builder atomic save: a text step still uses only its existing PATCH', async () => {
    const result = await runBuilderSave(null, { stepType: 'text', newQuiz: true });
    assert.deepEqual(result.errors, []);
    assert.equal(result.writes.length, 1);
    assert.equal(result.writes[0].method, 'PATCH');
    assert.equal(result.writes[0].url, 'courses/steps/903/');
    assert.equal(result.writes[0].payload.content, 'Synthetic draft content');
    assert.equal(result.updates.steps[0].step_type, 'text');
    assert.equal(result.successes.length, 1);
});

test('builder atomic save: an incomplete server response never falls back to a separate PATCH or reports success', async () => {
    const result = await runBuilderSave([validQuestion], { incompleteResponse: true });
    assert.equal(result.writes.length, 1);
    assert.deepEqual(result.updates, { quizzes: [], steps: [], lessons: [] });
    assert.deepEqual(result.successes, []);
    assert.deepEqual(result.errors, ['builder.toasts.stepSaveError']);
    assert.deepEqual(result.draft, [validQuestion]);
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

const quizPage = readSource('QuizPage.jsx');
const actualSubmitQuiz = initializer(quizPage, quizPage.ast, 'submitQuiz');

function prepareQuizSubmission(answers, { forcedAnswers = answers, request, now = 11000 } = {}) {
    const captured = [], results = [], errors = [], successes = [], warnings = [], attempts = [], storage = [], statuses = [];
    let uuidSequence = 0;
    let currentTime = now;
    const quiz = { id: 801, questions: [{ id: 811 }, { id: 812 }] };
    const response = { id: 901, score: 100, correct_count: 2, total_questions: 2, correct_answers_ids: { 811: [820, 821], 812: [830] } };
    const bindings = {
        quiz, selectedAnswers: answers, selectedAnswersRef: { current: forcedAnswers },
        startTimeRef: { current: 1000 }, Date: { now: () => currentTime }, attempts: 0,
        currentResult: null, submissionRef: { current: null }, submissionStatus: 'idle',
        crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}` },
        setSubmissionStatus: value => { bindings.submissionStatus = value; statuses.push(value); },
        setCurrentResult: value => { bindings.currentResult = value; results.push(JSON.parse(JSON.stringify(value))); },
        setSelectedAnswers: update => {
            bindings.selectedAnswers = typeof update === 'function' ? update(bindings.selectedAnswers) : update;
            bindings.selectedAnswersRef.current = bindings.selectedAnswers;
        },
        setCurrentIndex() {}, setCheatWarnings() {},
        setAttempts: value => attempts.push(value), confetti() {},
        toast: { error: message => errors.push(message), success: message => successes.push(message) },
        localStorage: { removeItem: key => storage.push(['remove', key]), setItem: (key, value) => storage.push(['set', key, value]) },
        api: { post: async (url, payload) => {
            captured.push({ url, payload: JSON.parse(JSON.stringify(payload)) });
            return request ? request(url, payload) : { data: response };
        } },
        console: { error() {}, warn: (...args) => warnings.push(args) },
    };
    // During RED, execute the old secondary callback too, so a second HTTP call
    // cannot be hidden by replacing submitAnalytics with a no-op mock.
    if (quizPage.source.includes('const submitAnalytics =')) {
        bindings.submitAnalytics = evaluateNode(quizPage, initializer(quizPage, quizPage.ast, 'submitAnalytics'), bindings);
    }
    const submit = evaluateNode(quizPage, actualSubmitQuiz, bindings);
    const restart = evaluateNode(quizPage, initializer(quizPage, quizPage.ast, 'restartQuiz'), bindings);
    const answer = evaluateNode(quizPage, initializer(quizPage, quizPage.ast, 'handleAnswer'), bindings);
    return { submit, restart, answer, captured, results, errors, successes, warnings, attempts, storage, response, statuses, bindings,
        setTime: value => { currentTime = value; },
    };
}

const settleSubmission = () => new Promise(resolve => setImmediate(resolve));

for (const selection of [
    { name: 'one option', selected: [820] },
    { name: 'two options', selected: [820, 821] },
    { name: 'three options', selected: [820, 821, 822] },
    { name: 'reversed options', selected: [821, 820] },
    { name: 'explicit skip', selected: [] },
    { name: 'omitted answer', selected: undefined },
]) {
    test(`atomic quiz submit: actual handler preserves ${selection.name} in one request`, async () => {
        const answers = Object.freeze({
            ...(selection.selected === undefined ? {} : { 811: Object.freeze([...selection.selected]) }),
            812: Object.freeze([830]),
        });
        const before = JSON.parse(JSON.stringify(answers));
        const run = prepareQuizSubmission(answers);
        run.submit(false);
        await settleSubmission();
        assert.deepEqual(run.warnings, []);
        assert.deepEqual(run.errors, []);
        assert.equal(run.captured.length, 1, 'Completion must not rely on a separate analytics request');
        assert.equal(run.captured[0].url, 'quizzes/801/submit/');
        assert.deepEqual(run.captured[0].payload, {
            answers: [
                ...(selection.selected === undefined ? [] : [{ question_id: 811, choice_ids: selection.selected }]),
                { question_id: 812, choice_ids: [830] },
            ],
            time_spent_seconds: 10,
            submission_id: '00000000-0000-4000-8000-000000000001',
        }, 'The client sends selections and elapsed time, not scores or correctness flags');
        assert.deepEqual(run.results, [run.response]);
        assert.equal(run.successes.length, 1);
        assert.deepEqual(answers, before, 'Submitting must not modify selected answers');
    });
}

test('atomic quiz submit: forced completion uses the current ref selection in the same single request', async () => {
    const run = prepareQuizSubmission({ 811: [820] }, { forcedAnswers: { 811: [821, 820], 812: [] } });
    run.submit(true);
    await settleSubmission();
    assert.equal(run.captured.length, 1);
    assert.deepEqual(run.captured[0].payload.answers, [
        { question_id: 811, choice_ids: [821, 820] }, { question_id: 812, choice_ids: [] },
    ]);
    assert.deepEqual(run.errors, []);
});

test('atomic quiz submit: waits for the save and does not display a result on request failure', async () => {
    let rejectSave;
    const pending = new Promise((_, reject) => { rejectSave = reject; });
    const run = prepareQuizSubmission({ 811: [820, 821], 812: [830] }, { request: () => pending });
    run.submit(false);
    await settleSubmission();
    assert.equal(run.captured.length, 1);
    assert.deepEqual(run.results, [], 'No result is shown before the server confirms the complete save');
    assert.deepEqual(run.successes, []);
    rejectSave(new Error('Synthetic atomic save failure'));
    await settleSubmission();
    assert.equal(run.captured.length, 1);
    assert.deepEqual(run.results, []);
    assert.deepEqual(run.successes, []);
    assert.deepEqual(run.attempts, []);
    assert.deepEqual(run.storage, []);
    assert.deepEqual(run.errors, ['Не удалось получить результат. Повторите отправку: выбранные ответы сохранены для повтора.']);
});

test('atomic quiz submit: a clock adjustment cannot send negative elapsed seconds', async () => {
    const run = prepareQuizSubmission({ 811: [820], 812: [830] }, { now: 0 });
    run.submit(false);
    await settleSubmission();
    assert.equal(run.captured.length, 1);
    assert.equal(run.captured[0].payload.time_spent_seconds, 0);
});

test('idempotent quiz submit: concurrent manual and forced clicks send one UUID and show one result', async () => {
    let resolveSave;
    const pending = new Promise(resolve => { resolveSave = resolve; });
    const run = prepareQuizSubmission({ 811: [820, 821], 812: [830] }, { request: () => pending });
    run.submit(false);
    run.submit(true);
    assert.equal(run.captured.length, 1);
    assert.match(run.captured[0].payload.submission_id, /^[0-9a-f-]{36}$/);
    assert.equal(run.statuses.at(-1), 'sending');
    resolveSave({ data: run.response });
    await settleSubmission();
    run.submit(false);
    assert.equal(run.captured.length, 1, 'A completed submission must not send again from a stale callback');
    assert.deepEqual(run.results, [run.response]);
    assert.equal(run.successes.length, 1);
});

for (const status of [undefined, 500]) {
    test(`idempotent quiz submit: ambiguous ${status || 'network'} failure retries the same frozen payload`, async () => {
        let calls = 0;
        const original = { 811: [820, 821], 812: [830] };
        const run = prepareQuizSubmission(original, { request: async () => {
            if (++calls === 1) throw Object.assign(new Error('Synthetic lost response'), status ? { response: { status } } : {});
            return { data: run.response };
        } });
        run.submit(false);
        await settleSubmission();
        assert.equal(run.statuses.at(-1), 'retry');
        assert.equal(run.successes.length, 0);
        const before = JSON.parse(JSON.stringify(run.bindings.selectedAnswers));
        run.answer(811, 822);
        assert.deepEqual(run.bindings.selectedAnswers, before, 'Choices remain frozen while acknowledgement is unknown');
        original[811].push(822);
        run.setTime(90000);
        run.submit(false);
        await settleSubmission();
        assert.equal(run.captured.length, 2);
        assert.deepEqual(run.captured[1], run.captured[0]);
        assert.match(run.captured[0].payload.submission_id, /^[0-9a-f-]{36}$/);
        assert.deepEqual(run.results, [run.response]);
        assert.equal(run.successes.length, 1);
    });
}

test('idempotent quiz submit: validation rejection unlocks choices and allows a fresh corrected request', async () => {
    let calls = 0;
    const run = prepareQuizSubmission({ 811: [820], 812: [830] }, { request: async () => {
        if (++calls === 1) throw { response: { status: 400 } };
        return { data: run.response };
    } });
    run.submit(false);
    await settleSubmission();
    assert.equal(run.statuses.at(-1), 'idle');
    run.answer(811, 821);
    assert.deepEqual(JSON.parse(JSON.stringify(run.bindings.selectedAnswers[811])), [820, 821]);
    run.submit(false);
    await settleSubmission();
    assert.equal(run.captured.length, 2);
    assert.notEqual(run.captured[1].payload.submission_id, run.captured[0].payload.submission_id);
    assert.deepEqual(run.captured[1].payload.answers[0].choice_ids, [820, 821]);
    assert.equal(run.successes.length, 1);
});

test('idempotent quiz submit: explicit restart creates a new UUID even for the same selections', async () => {
    const run = prepareQuizSubmission({ 811: [820], 812: [830] });
    run.submit(false);
    await settleSubmission();
    run.restart();
    run.answer(811, 820);
    run.answer(812, 830);
    run.submit(false);
    await settleSubmission();
    assert.equal(run.captured.length, 2);
    assert.notEqual(run.captured[1].payload.submission_id, run.captured[0].payload.submission_id);
    assert.deepEqual(run.captured[1].payload.answers, run.captured[0].payload.answers);
    assert.equal(run.successes.length, 2);
});

test('idempotent quiz submit: a different quiz never reuses the previous submission payload', async () => {
    const run = prepareQuizSubmission({ 811: [820], 812: [830] });
    run.submit(false);
    await settleSubmission();
    run.bindings.quiz = { id: 802, questions: [{ id: 815 }] };
    run.bindings.currentResult = null;
    run.bindings.selectedAnswers = { 815: [840] };
    run.submit(false);
    await settleSubmission();
    assert.equal(run.captured[1].url, 'quizzes/802/submit/');
    assert.deepEqual(run.captured[1].payload.answers, [{ question_id: 815, choice_ids: [840] }]);
    assert.notEqual(run.captured[1].payload.submission_id, run.captured[0].payload.submission_id);
});

test('idempotent quiz submit: a response for a reset attempt cannot overwrite the current screen', async () => {
    let resolveSave;
    const pending = new Promise(resolve => { resolveSave = resolve; });
    const run = prepareQuizSubmission({ 811: [820], 812: [830] }, { request: () => pending });
    run.submit(false);
    run.restart();
    resolveSave({ data: run.response });
    await settleSubmission();
    assert.deepEqual(run.results, [null]);
    assert.equal(run.successes.length, 0);
    assert.equal(run.statuses.at(-1), 'idle');
});

test('idempotent quiz submit: real controls freeze choices but allow retry of a forced incomplete submission', () => {
    const checkbox = findOne(quizPage.ast, node => node.type === 'JSXOpeningElement' && node.name.name === 'input'
        && node.attributes.some(attr => attr.name?.name === 'onChange' && quizPage.source.slice(attr.start, attr.end).includes('handleAnswer(')), 'answer control');
    const disabledChoices = checkbox.attributes.find(attr => attr.name?.name === 'disabled').value.expression;
    const submitButton = findOne(quizPage.ast, node => node.type === 'JSXOpeningElement' && node.name.name === 'button'
        && node.attributes.some(attr => attr.name?.name === 'onClick' && quizPage.source.slice(attr.start, attr.end).includes('submitQuiz(false)')), 'submit button');
    const disabledSubmit = submitButton.attributes.find(attr => attr.name?.name === 'disabled').value.expression;
    for (const submissionStatus of ['sending', 'retry']) {
        assert.equal(evaluateNode(quizPage, disabledChoices, { currentResult: null, submissionStatus }), true);
    }
    assert.equal(evaluateNode(quizPage, disabledChoices, { currentResult: null, submissionStatus: 'idle' }), false);
    assert.equal(evaluateNode(quizPage, disabledSubmit, { isKtProfile: false, isAllAnswered: true, submissionStatus: 'sending' }), true);
    assert.equal(evaluateNode(quizPage, disabledSubmit, { isKtProfile: false, isAllAnswered: false, submissionStatus: 'retry' }), false);
    assert.equal(evaluateNode(quizPage, disabledSubmit, { isKtProfile: false, isAllAnswered: false, submissionStatus: 'idle' }), true);
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
