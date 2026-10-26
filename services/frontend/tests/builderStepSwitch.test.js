// Run the real CourseBuilder effect and loader from its AST. Only React state
// setters and the asynchronous transport are test receivers; no copied loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { parse } from '@babel/parser';

const source = readFileSync(new URL('../src/CourseBuilder/CourseBuilder.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
function findOne(predicate) {
    const found = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node.type) return;
        if (predicate(node)) found.push(node);
        for (const [key, value] of Object.entries(node)) {
            if (!['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) walk(value);
        }
    }
    walk(ast);
    assert.equal(found.length, 1, 'Expected one actual CourseBuilder source node');
    return found[0];
}
const loadNode = findOne(n => n.type === 'VariableDeclarator' && n.id.name === 'fetchQuizForStep').init;
const addNode = findOne(n => n.type === 'VariableDeclarator' && n.id.name === 'handleAddManualQuestion').init;
const effectNode = findOne(n => n.type === 'CallExpression' && n.callee.name === 'useEffect'
    && n.arguments[1] && source.slice(n.arguments[1].start, n.arguments[1].end).includes('scenario_data?.quiz_id'));
const evaluate = (node, bindings) => new Script(`(${source.slice(node.start, node.end)})`)
    .runInNewContext(bindings, { timeout: 1000 });
const plain = value => JSON.parse(JSON.stringify(value));
const quizA = { id: 904, questions: [{ id: 910, text: 'Synthetic A', explanation: 'Explanation A',
    choices: [{ text: 'A correct', is_correct: true }, { text: 'A wrong', is_correct: false }] }] };
const quizB = { id: 914, questions: [{ id: 920, text: 'Synthetic B', explanation: 'Explanation B',
    choices: [{ text: 'B one', is_correct: true }, { text: 'B two', is_correct: true }] }] };
const linked = (id, quizId) => ({ id, step_type: 'quiz', scenario_data: { quiz_id: quizId } });
const empty = { id: 906, step_type: 'quiz', scenario_data: {} };
const lesson = { id: 902 };

function editor() {
    const state = { questions: null, quizId: null };
    const requests = [], tasks = [], mutations = [];
    let cleanup, previousDependencies;
    const setters = {
        setQuizQuestions: value => { state.questions = plain(value); mutations.push('questions'); },
        setCurrentQuizId: value => { state.quizId = value; mutations.push('quizId'); },
    };
    const loader = evaluate(loadNode, {
        ...setters,
        api: { get: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) },
    });
    return {
        state, requests, mutations,
        render(step, activeLesson = lesson) {
            const scope = {
                activeStep: step, activeLesson, quizQuestions: state.questions, currentQuizId: state.quizId,
                ...setters,
                fetchQuizForStep: (...args) => { const task = loader(...args); tasks.push(task); return task; },
            };
            // Use actual dependencies so a title edit does not simulate a step change.
            const dependencies = plain(evaluate(effectNode.arguments[1], scope));
            if (previousDependencies && dependencies.every((v, i) => Object.is(v, previousDependencies[i]))) return;
            cleanup?.();
            previousDependencies = dependencies;
            cleanup = evaluate(effectNode.arguments[0], scope)();
        },
        addDraftQuestion() {
            evaluate(addNode, { quizQuestions: state.questions, setQuizQuestions: setters.setQuizQuestions })();
        },
        async respond(index, quizzes) {
            requests[index].resolve({ data: quizzes });
            await tasks[index];
        },
        async reject(index) { requests[index].reject(new Error('Synthetic delayed GET failure')); await tasks[index]; },
        unmount() { cleanup?.(); },
    };
}

async function loadedA() {
    const e = editor();
    e.render(linked(903, 904));
    await e.respond(0, [quizA]);
    assert.equal(e.state.quizId, 904);
    assert.equal(e.state.questions[0].explanation, 'Explanation A');
    return e;
}

test('builder step switch: loaded quiz to unlinked step clears previous questions and key', async () => {
    const e = await loadedA();
    e.render(empty);
    assert.deepEqual(e.state, { questions: [], quizId: null });
    assert.equal(e.requests.length, 1, 'An unlinked step needs no quiz GET');
    e.addDraftQuestion();
    const draft = plain(e.state);
    e.render({ ...empty, title: 'Edited title' });
    assert.deepEqual(e.state, draft, 'Same-step editing must preserve its new draft');
    assert.equal(e.state.questions.length, 1);
});

test('builder step switch: another linked step clears old data while loading', async () => {
    const e = await loadedA();
    e.render(linked(913, 914));
    assert.deepEqual(e.state, { questions: null, quizId: null });
    await e.respond(1, [quizA, quizB]);
    assert.equal(e.state.quizId, 914);
    assert.equal(e.state.questions[0].question, 'Synthetic B');
    assert.deepEqual(e.state.questions[0].correct_option_index, [0, 1]);
});

for (const outcome of ['success', 'failure']) {
    test(`builder step switch: late ${outcome} cannot overwrite a new draft in the empty step`, async () => {
        const e = editor();
        e.render(linked(903, 904));
        e.render(empty);
        e.addDraftQuestion();
        const draft = plain(e.state);
        if (outcome === 'success') await e.respond(0, [quizA]); else await e.reject(0);
        assert.deepEqual(e.state, draft);
        assert.equal(e.state.quizId, null);
    });
    test(`builder step switch: late ${outcome} from A cannot replace already loaded B`, async () => {
        const e = editor();
        e.render(linked(903, 904));
        e.render(linked(913, 914));
        await e.respond(1, [quizA, quizB]);
        const expected = plain(e.state);
        if (outcome === 'success') await e.respond(0, [quizA]); else await e.reject(0);
        assert.deepEqual(e.state, expected);
        assert.equal(e.state.quizId, 914);
    });
}

test('builder step switch: late response cannot populate a text step', async () => {
    const e = editor();
    e.render(linked(903, 904));
    e.render({ id: 905, step_type: 'text' });
    await e.respond(0, [quizA]);
    assert.deepEqual(e.state, { questions: null, quizId: null });
});

test('builder step switch: unmount prevents late state writes', async () => {
    const e = editor();
    e.render(linked(903, 904));
    e.unmount();
    const mutations = e.mutations.length;
    await e.respond(0, [quizA]);
    assert.equal(e.mutations.length, mutations);
});

test('builder step switch: returning from empty to filled reloads that quiz', async () => {
    const e = await loadedA();
    e.render(empty);
    e.render(linked(903, 904));
    await e.respond(1, [quizA]);
    assert.equal(e.state.quizId, 904);
    assert.equal(e.state.questions.length, 1);
    assert.equal(e.state.questions[0].question, 'Synthetic A');
});

test('builder step switch: same-step edits and save metadata do not clear its draft or refetch', async () => {
    const e = await loadedA();
    e.addDraftQuestion();
    const draft = plain(e.state);
    e.render({ ...linked(903, 904), title: 'Edited title', content: 'Saved content' });
    assert.deepEqual(e.state, draft);
    assert.equal(e.requests.length, 1);
});

test('builder step switch: an empty linked quiz or missing quiz never inherits old questions', async () => {
    for (const response of [[{ id: 914, questions: [] }], [quizA]]) {
        const e = await loadedA();
        e.render(linked(913, 914));
        await e.respond(1, response);
        assert.deepEqual(e.state.questions, []);
        assert.equal(e.state.quizId, response[0].id === 914 ? 914 : null);
    }
});

test('builder step switch: type change of the current step clears its quiz state', async () => {
    const e = await loadedA();
    e.render({ ...linked(903, 904), step_type: 'text' });
    assert.deepEqual(e.state, { questions: null, quizId: null });
});
