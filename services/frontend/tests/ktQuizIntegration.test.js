// Execute the real QuizPage handlers and render the real JSX. API responses are
// synthetic server fixtures; no scoring algorithm is implemented in these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getKtQuizCopy, ktQuizMessages } from '../src/ktQuizCopy.js';

const source = readFileSync(new URL('../src/QuizPage.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
function find(predicate, node = ast) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (const child of value) { const result = find(predicate, child); if (result) return result; }
        } else if (value && typeof value === 'object') { const result = find(predicate, value); if (result) return result; }
    }
}
function initializer(name) {
    return find(node => node.type === 'VariableDeclarator' && node.id.name === name).init;
}
function evaluate(node, bindings) {
    return new Script(`(${source.slice(node.start, node.end)})`).runInNewContext(bindings, { timeout: 1000 });
}
const normalize = value => JSON.parse(JSON.stringify(value));
const fixtureQuiz = {
    id: 801, mode: 'kt_profile', title: 'Искусственный профильный блок',
    questions: [
        { id: 811, kt_subject: 'first_subject', text: 'Synthetic first subject', choices: [{ id: 821, text: 'Alpha' }, { id: 822, text: 'Bravo' }] },
        { id: 812, kt_subject: 'second_subject', text: 'Synthetic second subject', choices: [831, 832, 833, 834, 835].map(id => ({ id, text: `Option ${id}` })) },
    ],
};
const fixtureResult = {
    id: 901, mode: 'kt_profile', score: 2, correct_count: 1, total_questions: 50,
    correct_answers_ids: { 811: [821], 812: [831, 832] },
    explanations: { 811: 'Server explanation one.', 812: 'Server explanation two.' },
    grading: { earned_points: 2, max_points: 70, scoring_version: 'synthetic_server_fixture',
        sections: { first_subject: { earned_points: 1, max_points: 30 }, second_subject: { earned_points: 1, max_points: 40 } },
        questions: { 811: { earned_points: 1, max_points: 1, is_correct: true }, 812: { earned_points: 1, max_points: 2, is_correct: false } },
    },
};
function handlers({ mode = 'kt_profile', result = fixtureResult, request } = {}) {
    const requests = [], storage = [], notices = [], results = [];
    let uuid = 0;
    const bindings = {
        quiz: { ...fixtureQuiz, mode }, selectedAnswers: {}, selectedAnswersRef: { current: {} },
        submissionRef: { current: null }, startTimeRef: { current: 0 }, attempts: 0,
        ktCopy: getKtQuizCopy('ru'), crypto: { randomUUID: () => `synthetic-${++uuid}` },
        Date: { now: () => 10000 }, setSubmissionStatus() {}, setCurrentIndex() {}, setCheatWarnings() {},
        setSelectedAnswers(update) { bindings.selectedAnswers = typeof update === 'function' ? update(bindings.selectedAnswers) : update; bindings.selectedAnswersRef.current = bindings.selectedAnswers; },
        setCurrentResult(value) { results.push(value); }, setAttempts() { assert.fail('KT must not update failed training attempts'); },
        localStorage: { setItem: (...args) => storage.push(args), removeItem: (...args) => storage.push(args) },
        toast: { success: text => notices.push(text), error: text => notices.push(text) },
        confetti() { assert.fail('KT has no arbitrary pass threshold'); }, console: { error() {} },
        api: { post: async (url, payload) => { requests.push({ url, payload: normalize(payload) }); return request ? request(url, payload) : { data: result }; } },
    };
    return { bindings, requests, storage, notices, results,
        answer: evaluate(initializer('handleAnswer'), bindings),
        submit: evaluate(initializer('submitQuiz'), bindings),
        restart: evaluate(initializer('restartQuiz'), bindings),
    };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('KT first subject: real selection handler replaces the previous radio choice and can clear it', () => {
    const run = handlers();
    run.answer(811, 821); run.answer(811, 822);
    assert.deepEqual(normalize(run.bindings.selectedAnswers[811]), [822]);
    run.answer(811, null);
    assert.deepEqual(normalize(run.bindings.selectedAnswers[811]), []);
});

test('KT second subject: real selection handler supports multiple choices without incorrectly capping selections at three', () => {
    const run = handlers();
    [831, 832, 833, 834].forEach(id => run.answer(812, id));
    assert.deepEqual(normalize(run.bindings.selectedAnswers[812]), [831, 832, 833, 834]);
    run.answer(812, 832);
    assert.deepEqual(normalize(run.bindings.selectedAnswers[812]), [831, 833, 834]);
});

test('legacy training: choices remain toggleable even when question section metadata exists', () => {
    const run = handlers({ mode: 'training' });
    run.answer(811, 821); run.answer(811, 822);
    assert.deepEqual(normalize(run.bindings.selectedAnswers[811]), [821, 822]);
});

test('KT actual submit sends selections only, stores the server result and does not apply 70% training gating', async () => {
    const run = handlers();
    run.answer(811, 821); run.answer(812, 831); run.submit();
    await settle();
    assert.equal(run.requests.length, 1);
    assert.equal(run.requests[0].url, 'quizzes/801/submit/');
    assert.deepEqual(run.requests[0].payload, {
        submission_id: 'synthetic-1', answers: [{ question_id: 811, choice_ids: [821] }, { question_id: 812, choice_ids: [831] }], time_spent_seconds: 10,
    });
    assert.deepEqual(run.results, [fixtureResult]);
    assert.deepEqual(run.storage, []);
    assert.deepEqual(run.notices, [getKtQuizCopy('ru').saved]);
});

test('KT skips: actual submit accepts an empty selection and explicit restart creates another submission ID', async () => {
    const run = handlers();
    run.submit(); await settle();
    assert.deepEqual(run.requests[0].payload.answers, []);
    run.restart(); run.submit(); await settle();
    assert.notEqual(run.requests[0].payload.submission_id, run.requests[1].payload.submission_id);
});

test('KT retries: selections freeze and ambiguous failure reuses the exact same payload', async () => {
    let calls = 0;
    const run = handlers({ request: async () => { if (++calls === 1) throw new Error('Synthetic lost response'); return { data: fixtureResult }; } });
    run.answer(812, 831); run.submit(); await settle();
    run.answer(812, 832); run.submit(); await settle();
    assert.deepEqual(run.requests[1], run.requests[0]);
    assert.deepEqual(run.requests[1].payload.answers, [{ question_id: 812, choice_ids: [831] }]);
});

test('KT does not force-submit on tab visibility changes; legacy training behavior is preserved', () => {
    for (const [mode, expectedSubmits] of [['kt_profile', 0], ['training', 1]]) {
        let submits = 0;
        evaluate(initializer('handleVisibilityChange'), {
            document: { hidden: true }, currentResult: null, quiz: { mode },
            cheatWarningsRef: { current: 2 }, setCheatWarnings() {},
            toast: { error() {}, warning() {} }, submitQuiz() { submits++; },
        })();
        assert.equal(submits, expectedSubmits);
    }
});

const submitButton = find(node => node.type === 'JSXOpeningElement' && node.name.name === 'button' && node.attributes.some(a => a.name?.name === 'onClick' && source.slice(a.start, a.end).includes('submitQuiz(false)')));
const disabledSubmit = submitButton.attributes.find(a => a.name?.name === 'disabled').value.expression;
test('KT finish control permits skipped questions but disables in-flight submission; training still requires all answers', () => {
    assert.equal(evaluate(disabledSubmit, { isKtProfile: true, isAllAnswered: false, submissionStatus: 'idle' }), false);
    assert.equal(evaluate(disabledSubmit, { isKtProfile: true, isAllAnswered: false, submissionStatus: 'sending' }), true);
    assert.equal(evaluate(disabledSubmit, { isKtProfile: false, isAllAnswered: false, submissionStatus: 'idle' }), true);
});

const runtimeSource = ast.program.body.filter(node => !['ImportDeclaration', 'ExportDefaultDeclaration'].includes(node.type)).map(node => source.slice(node.start, node.end)).join('\n');
const runtime = transformSync(`${runtimeSource}\nQuizPage;`, { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' }).code;
function renderQuiz({ result = null, currentIndex = 1, mode = 'kt_profile', language = 'ru' } = {}) {
    const quiz = { ...fixtureQuiz, mode };
    const hookValues = [quiz, false, currentIndex, { 811: [821], 812: [831] }, result, 'idle', 0, 0];
    const bindings = { React, getKtQuizCopy, useTranslation: () => ({ i18n: { language } }),
        useState: () => [hookValues.shift(), () => {}], useEffect() {}, useRef: value => ({ current: value }),
        useParams: () => ({ lessonId: '902' }), useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams()],
        ChevronLeft: () => null, Check: () => null, ArrowRight: () => null, RefreshCcw: () => null, HelpCircle: () => null, EyeOff: () => null,
    };
    const Component = new Script(runtime).runInNewContext(bindings);
    return renderToStaticMarkup(React.createElement(Component));
}

test('KT actual JSX: before submission shows section selection rules, hides explanations and uses radio only in first section', () => {
    const first = renderQuiz({ currentIndex: 0 });
    const second = renderQuiz();
    assert.match(first, /type="radio"/);
    assert.doesNotMatch(first, /type="checkbox"/);
    assert.match(second, /type="checkbox"/);
    assert.match(second, /Правильных может быть от 1 до 3/);
    assert.doesNotMatch(second, /Server explanation|Результат профильного блока|Нужно минимум 70/);
});

test('KT actual JSX: low result shows raw section totals, partial credit and server explanation immediately', () => {
    const html = renderQuiz({ result: fixtureResult });
    assert.match(html, /2 \/ 70/);
    assert.match(html, /1 \/ 30/);
    assert.match(html, /1 \/ 40/);
    assert.match(html, /Баллы за вопрос: 1 \/ 2 · Частичный ответ/);
    assert.match(html, /Server explanation two/);
    assert.match(html, /Ваш выбор/);
    assert.match(html, /Правильный вариант/);
    assert.match(html, /Пройти заново/);
    assert.doesNotMatch(html, /Нужно минимум 70|после 5 попыток|Тест не пройден/);
});

test('legacy training actual JSX: failed attempts still use the existing gated review', () => {
    const html = renderQuiz({ mode: 'training', result: { score: 20, correct_answers_ids: {} } });
    assert.match(html, /Нужно минимум 70/);
    assert.match(html, /после 5 попыток/);
    assert.doesNotMatch(html, /Server explanation/);
});

test('KT translations provide the same keys in Russian, Kazakh and English, including localized results', () => {
    const keys = Object.keys(ktQuizMessages.ru).sort();
    for (const language of ['ru', 'kk', 'en']) {
        assert.deepEqual(Object.keys(ktQuizMessages[language]).sort(), keys);
        const html = renderQuiz({ result: fixtureResult, language });
        assert.ok(html.includes(ktQuizMessages[language].summary));
    }
    assert.equal(getKtQuizCopy('kk-KZ'), ktQuizMessages.kk);
    assert.equal(getKtQuizCopy('unknown'), ktQuizMessages.ru);
});

for (const [name, error, expected] of [
    ['server text', 'Пробник должен содержать 30 и 20 вопросов.', 'Пробник должен содержать 30 и 20 вопросов.'],
    ['server list', ['Первый предмет: 30 вопросов.', 'Второй предмет: 20 вопросов.'], 'Первый предмет: 30 вопросов. Второй предмет: 20 вопросов.'],
    ['structured object', { detail: 'Unexpected object' }, getKtQuizCopy('ru').invalid],
    ['mixed list', ['Valid text', { detail: 'Unexpected object' }], getKtQuizCopy('ru').invalid],
]) {
    test(`KT 400 validation: displays ${name} safely as text without locking answers`, async () => {
        const run = handlers({ request: async () => { throw { response: { status: 400, data: { error } } }; } });
        run.submit(); await settle();
        assert.deepEqual(run.notices, [expected]);
        assert.equal(run.bindings.submissionRef.current, null);
        run.answer(811, 821);
        assert.deepEqual(normalize(run.bindings.selectedAnswers[811]), [821]);
        assert.deepEqual(run.results, []);
    });
}

function focusEffect(marker) {
    return find(node => node.type === 'CallExpression' && node.callee.name === 'useEffect'
        && source.slice(node.start, node.end).includes(marker)).arguments[0];
}

test('KT mobile navigation: real handler requests question focus after index changes and same-index click focuses immediately', () => {
    const focused = [], indices = [];
    const bindings = { isKtProfile: true, currentIndex: 0,
        pendingQuestionFocusRef: { current: false },
        questionHeadingRef: { current: { focus: () => focused.push('question') } },
        setCurrentIndex: index => indices.push(index),
    };
    const navigate = evaluate(initializer('navigateQuestion'), bindings);
    navigate(31);
    assert.deepEqual(indices, [31]);
    assert.equal(bindings.pendingQuestionFocusRef.current, true);
    assert.deepEqual(focused, []);
    evaluate(focusEffect('pendingQuestionFocusRef.current'), bindings)();
    assert.deepEqual(focused, ['question']);
    assert.equal(bindings.pendingQuestionFocusRef.current, false);
    navigate(0);
    assert.deepEqual(focused, ['question', 'question']);
});

test('KT result focus runs only after a KT result; legacy training navigation never moves heading focus', () => {
    const focused = [];
    const bindings = { isKtProfile: true, currentResult: null,
        resultHeadingRef: { current: { focus: () => focused.push('result') } },
    };
    const afterResult = evaluate(focusEffect('resultHeadingRef.current'), bindings);
    afterResult();
    assert.deepEqual(focused, []);
    bindings.currentResult = fixtureResult;
    afterResult();
    assert.deepEqual(focused, ['result']);
    bindings.isKtProfile = false;
    afterResult();
    assert.deepEqual(focused, ['result']);
    evaluate(initializer('navigateQuestion'), {
        isKtProfile: false, currentIndex: 0, setCurrentIndex() {},
        questionHeadingRef: { current: { focus: () => assert.fail('Legacy focus must stay unchanged') } },
    })(1);
});
