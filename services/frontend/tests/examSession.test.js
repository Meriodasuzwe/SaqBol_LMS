import test from 'node:test';
import assert from 'node:assert/strict';
import { createExamSession, sectionProgress, questionState, remainingSeconds, formatRemainingTime } from '../src/exams/examSession.js';
const clone = value => structuredClone(value);
const originTime = Date.parse('2026-11-06T08:00:00Z');
function fixture() {
    return { id: 'synthetic-attempt', status: 'active', revision: 0, server_time: new Date(originTime).toISOString(),
        started_at: new Date(originTime).toISOString(), deadline: new Date(originTime + 600000).toISOString(),
        result: null, completion_reason: '', configuration: { id: 'synthetic-configuration', is_demo: true },
        sections: [
            { id: 'first_subject', response_type: 'single', question_count: 2, max_points: 2, questions: [
                { id: 101, number: 1, text: 'Synthetic first question', choices: [11, 12].map(id => ({ id, text: String(id) })) },
                { id: 102, number: 2, text: 'Synthetic second question', choices: [21, 22].map(id => ({ id, text: String(id) })) }] },
            { id: 'second_subject', response_type: 'multiple', question_count: 2, max_points: 4, questions: [
                { id: 201, number: 1, text: 'Synthetic SQL', choices: [31, 32, 33, 34].map(id => ({ id, text: String(id) })) },
                { id: 202, number: 2, text: 'Synthetic SQL two', choices: [41, 42, 43].map(id => ({ id, text: String(id) })) }] }],
        answers: [101, 102, 201, 202].map(question_id => ({ question_id, choice_ids: [] })),
        flagged_question_ids: [], last_question_by_section: { first_subject: 101, second_subject: 201 } };
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((accept, deny) => { resolve = accept; reject = deny; });
    return { promise, resolve, reject };
}
const httpError = (status, code) => ({ response: { status, data: { code, detail: 'Synthetic server response' } } });
function harness(initial = fixture()) {
    let server = clone(initial), clock = originTime, requestNumber = 0;
    const calls = [], behavior = {};
    function commit(payload, completed = false) {
        assert.equal(payload.revision, server.revision);
        server = { ...server, revision: server.revision + 1, answers: clone(payload.answers),
            flagged_question_ids: clone(payload.flagged_question_ids), last_question_by_section: clone(payload.last_question_by_section) };
        if (completed) Object.assign(server, { status: 'completed', completion_reason: 'manual', result: { id: 999, grading: { earned_points: 17, max_points: 70 } } });
        return { data: clone(server) };
    }
    const api = {
        async get(url) { calls.push({ method: 'GET', url }); return behavior.get ? behavior.get(url) : { data: clone(server) }; },
        async patch(url, payload) { calls.push({ method: 'PATCH', url, payload: clone(payload) }); return behavior.patch ? behavior.patch(payload) : commit(payload); },
        async post(url, payload) { calls.push({ method: 'POST', url, payload: clone(payload) }); return behavior.post ? behavior.post(payload) : commit(payload, true); },
    };
    const session = createExamSession({ api, attemptId: initial.id, now: () => clock, uuid: () => `synthetic-${++requestNumber}` });
    return { session, calls, behavior, commit, setTime(value) { clock = value; }, get server() { return server; }, set server(value) { server = value; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const writes = run => run.calls.filter(call => call.method === 'PATCH');
const posts = run => run.calls.filter(call => call.method === 'POST');
// Tests execute the shipped controller. The transport supplies server responses;
// it does not implement an alternative scoring algorithm.

test('resume restores ID selections, flags and per-section position', async () => {
    const data = fixture(); data.answers[2].choice_ids = [31, 33]; data.flagged_question_ids = [201]; data.last_question_by_section.second_subject = 202;
    const run = harness(data); assert.equal(await run.session.load(), true);
    const state = run.session.getSnapshot();
    assert.deepEqual(state.answers[201], [31, 33]); assert.deepEqual(state.flaggedQuestionIds, [201]);
    assert.equal(state.lastQuestionBySection.second_subject, 202); assert.equal(state.hasUnsentChanges, false); assert.equal(state.editable, true);
    assert.deepEqual(run.calls, [{ method: 'GET', url: 'exams/attempts/synthetic-attempt/' }]);
});

test('same local question numbers never overwrite another subject; clear uses stable IDs', async () => {
    const { session } = harness(); await session.load(); session.setAnswer(101, [11]); session.setAnswer(201, [31, 33]);
    assert.deepEqual(session.getSnapshot().answers[101], [11]); assert.deepEqual(session.getSnapshot().answers[201], [31, 33]);
    session.setAnswer(201, []); assert.deepEqual(session.getSnapshot().answers[101], [11]); assert.deepEqual(session.getSnapshot().answers[201], []);
});

test('choice cardinality follows section metadata, never an answer key or a limit of three selected options', async () => {
    const { session } = harness(); await session.load();
    assert.equal(session.setAnswer(101, [11, 12]), false); assert.equal(session.setAnswer(201, [31, 32, 33, 34]), true);
    assert.equal(session.setAnswer(201, [31, 31]), false); assert.equal(session.setAnswer(201, [11]), false); assert.equal(session.setAnswer(999, [11]), false);
    assert.deepEqual(session.getSnapshot().answers[201], [31, 32, 33, 34]);
});

test('flags coexist with answers and last positions remain independent', async () => {
    const { session } = harness(); await session.load(); session.setAnswer(201, [31]); session.toggleFlag(201); session.setPosition('second_subject', 202);
    assert.deepEqual(session.getSnapshot().answers[201], [31]); assert.deepEqual(session.getSnapshot().flaggedQuestionIds, [201]);
    assert.equal(session.getSnapshot().lastQuestionBySection.first_subject, 101); assert.equal(session.setPosition('first_subject', 201), false);
    session.toggleFlag(201); assert.deepEqual(session.getSnapshot().flaggedQuestionIds, []);
});

test('progress counts questions, review state uses each server question without global score heuristics', () => {
    const section = fixture().sections[1]; assert.deepEqual(sectionProgress(section, { 201: [31, 32, 33] }), { total: 2, answered: 1, unanswered: 1 });
    assert.equal(questionState(section.questions[0], { 201: [31] }), 'answered');
    for (const answer_state of ['unanswered', 'correct', 'partial', 'incorrect']) assert.equal(questionState({ id: 201, answer_state }, { 201: [31] }, { review: true }), answer_state);
});

test('timer uses server offset, supports long durations and no-timer configuration', () => {
    assert.equal(remainingSeconds(fixture(), 30000, originTime), 570); assert.equal(remainingSeconds({ deadline: null }, 0, originTime), null);
    assert.equal(remainingSeconds(fixture(), 0, originTime + 900000), 0); assert.equal(formatRemainingTime(6000), '1:40:00');
    assert.equal(formatRemainingTime(14100), '3:55:00'); assert.equal(formatRemainingTime(9), '0:09');
});

test('in-flight save preserves newer local edits and never runs parallel PATCH requests', async () => {
    const run = harness(); await run.session.load(); const gate = deferred(); run.behavior.patch = payload => gate.promise.then(() => run.commit(payload));
    run.session.setAnswer(201, [31]); const first = run.session.save(); run.session.setAnswer(201, [31, 33]); const second = run.session.save();
    assert.equal(writes(run).length, 1); assert.equal(run.session.getSnapshot().saveStatus, 'saving'); gate.resolve(); await Promise.all([first, second]);
    assert.deepEqual(run.session.getSnapshot().answers[201], [31, 33]); assert.equal(run.session.getSnapshot().saveStatus, 'unsaved');
    assert.equal(run.session.getSnapshot().attempt.revision, 1); delete run.behavior.patch; assert.equal(await run.session.flush(), true);
    assert.deepEqual(run.server.answers[2].choice_ids, [31, 33]); assert.equal(run.session.getSnapshot().hasUnsentChanges, false);
});

test('lost save response retries exact payload then flush sends newer edits at acknowledged revision', async () => {
    const run = harness(); await run.session.load(); let receipt;
    run.behavior.patch = payload => { receipt = run.commit(payload); throw new Error('Synthetic lost response'); };
    run.session.setAnswer(201, [31]); assert.equal(await run.session.save(), false); run.session.setAnswer(201, [31, 33]);
    assert.equal(run.session.getSnapshot().saveStatus, 'error'); let retries = 0;
    run.behavior.patch = payload => ++retries === 1 ? receipt : run.commit(payload);
    assert.equal(await run.session.flush(), true); assert.deepEqual(writes(run)[1].payload, writes(run)[0].payload);
    assert.notEqual(writes(run)[2].payload.request_id, writes(run)[0].payload.request_id); assert.equal(writes(run)[2].payload.revision, 1);
    assert.deepEqual(writes(run)[2].payload.answers[2].choice_ids, [31, 33]);
});

test('revision conflict freezes edits until explicit reload; local choices are not silently replaced', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(101, [11]); run.server.revision = 2; run.server.answers[0].choice_ids = [12];
    run.behavior.patch = () => { throw httpError(409, 'revision_conflict'); }; assert.equal(await run.session.save(), false);
    assert.equal(run.session.getSnapshot().saveStatus, 'conflict'); assert.equal(run.session.setAnswer(101, [12]), false); assert.equal(await run.session.finish(), false);
    assert.deepEqual(run.session.getSnapshot().answers[101], [11]); await run.session.reload(); assert.deepEqual(run.session.getSnapshot().answers[101], [12]);
    assert.equal(run.session.getSnapshot().hasUnsentChanges, false); assert.equal(run.session.getSnapshot().editable, true);
});

test('400 save keeps local choices editable; corrected write gets a fresh request UUID', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(101, [11]); run.behavior.patch = () => { throw httpError(400, 'invalid'); };
    await run.session.save(); assert.equal(run.session.getSnapshot().editable, true); assert.equal(run.session.getSnapshot().error.kind, 'validation');
    run.session.setAnswer(101, [12]); delete run.behavior.patch; assert.equal(await run.session.save(), true);
    assert.notEqual(writes(run)[0].payload.request_id, writes(run)[1].payload.request_id); assert.deepEqual(run.server.answers[0].choice_ids, [12]);
});

test('finish sends current full selection with skips and accepts server points without client scoring', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(201, [31, 33]); assert.equal(await run.session.finish(), true);
    assert.equal(posts(run)[0].payload.answers.length, 4); assert.deepEqual(posts(run)[0].payload.answers[0].choice_ids, []);
    assert.deepEqual(posts(run)[0].payload.answers[2].choice_ids, [31, 33]); assert.equal(run.session.getSnapshot().attempt.result.grading.earned_points, 17);
    assert.equal(run.session.getSnapshot().editable, false); assert.equal(run.session.getSnapshot().hasUnsentChanges, false);
});

test('finish waits for pending save and uses its revision, freezing changes during submission', async () => {
    const run = harness(); await run.session.load(); const gate = deferred(); run.behavior.patch = payload => gate.promise.then(() => run.commit(payload));
    run.session.setAnswer(101, [11]); const write = run.session.save(); run.session.setAnswer(201, [31]); const finish = run.session.finish();
    assert.equal(posts(run).length, 0); assert.equal(run.session.setAnswer(201, [32]), false); gate.resolve(); await write; assert.equal(await finish, true);
    assert.equal(posts(run)[0].payload.revision, 1); assert.deepEqual(posts(run)[0].payload.answers[2].choice_ids, [31]);
});

test('duplicate finish shares POST; ambiguous failure locks edits and repeats exact request', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(201, [31, 33]); const gate = deferred(); let receipt;
    run.behavior.post = async payload => { await gate.promise; receipt = run.commit(payload, true); throw new Error('Synthetic lost result'); };
    const one = run.session.finish(), two = run.session.finish(); assert.equal(posts(run).length, 1); gate.resolve();
    assert.deepEqual(await Promise.all([one, two]), [false, false]); assert.equal(run.session.getSnapshot().finishUncertain, true);
    assert.equal(run.session.getSnapshot().hasUnsentChanges, true); assert.equal(run.session.setAnswer(201, []), false);
    run.behavior.post = () => receipt; assert.equal(await run.session.retryFinish(), true);
    assert.deepEqual(posts(run)[0].payload, posts(run)[1].payload); assert.equal(run.session.getSnapshot().attempt.result.id, 999);
});

test('failed save during finish aborts POST and keeps local selection for retry', async () => {
    const run = harness(); await run.session.load(); const gate = deferred(); run.behavior.patch = () => gate.promise;
    run.session.setAnswer(101, [11]); const write = run.session.save(), finish = run.session.finish(); gate.reject(new Error('Synthetic unavailable'));
    await write; assert.equal(await finish, false); assert.equal(posts(run).length, 0); assert.equal(run.session.getSnapshot().finishing, false);
    assert.equal(run.session.getSnapshot().editable, true); assert.deepEqual(run.session.getSnapshot().answers[101], [11]);
});

test('deadline discards unacknowledged local draft from displayed result and never POSTs it late', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(101, [11]); run.setTime(originTime + 600001);
    run.server.status = 'completed'; run.server.completion_reason = 'deadline'; run.server.result = { id: 700, grading: { earned_points: 0, max_points: 70 } };
    run.session.tick(); await settle(); assert.equal(run.session.setAnswer(101, [12]), false); assert.equal(run.calls.some(call => call.method !== 'GET'), false);
    assert.deepEqual(run.session.getSnapshot().answers[101], []); assert.equal(run.session.getSnapshot().attempt.result.id, 700);
});

test('late active save response cannot resurrect a completed attempt', async () => {
    const run = harness(); await run.session.load(); const gate = deferred(); let saved;
    run.behavior.patch = payload => { saved = run.commit(payload); return gate.promise.then(() => saved); };
    run.session.setAnswer(101, [11]); const saving = run.session.save(); run.setTime(originTime + 600001);
    run.server.status = 'completed'; run.server.completion_reason = 'deadline'; run.server.result = { id: 700 };
    run.session.tick(); await settle(); assert.equal(run.session.getSnapshot().attempt.status, 'completed'); gate.resolve(); await saving;
    assert.equal(run.session.getSnapshot().attempt.status, 'completed'); assert.equal(run.session.getSnapshot().hasUnsentChanges, false);
});

test('deadline read failure is visible and explicit reload retrieves completed result', async () => {
    const run = harness(); await run.session.load(); run.behavior.get = () => { throw new Error('Synthetic offline'); };
    run.setTime(originTime + 600001); run.session.tick(); await settle(); assert.equal(run.session.getSnapshot().error.kind, 'deadline');
    assert.equal(run.session.getSnapshot().editable, false); run.server.status = 'completed'; run.server.completion_reason = 'deadline'; run.server.result = { id: 701 };
    delete run.behavior.get; await run.session.reload(); assert.equal(run.session.getSnapshot().attempt.status, 'completed');
});

test('unmount best-effort flush saves edits without notifying detached subscriber', async () => {
    const run = harness(); await run.session.load(); run.session.setAnswer(201, [31, 33]);
    const unsubscribe = run.session.subscribe(() => assert.fail('Detached subscriber called'));
    await run.session.dispose({ flushPending: true }); unsubscribe(); assert.deepEqual(run.server.answers[2].choice_ids, [31, 33]);
});

test('StrictMode reconnect ignores stale load completion', async () => {
    const run = harness(); const gate = deferred(); let gets = 0; run.behavior.get = () => ++gets === 1 ? gate.promise : { data: clone(run.server) };
    const old = run.session.load(); await run.session.dispose(); await run.session.load(); gate.resolve({ data: { ...fixture(), revision: 999 } }); await old;
    assert.equal(run.session.getSnapshot().attempt.revision, 0); assert.equal(run.session.getSnapshot().loading, false);
});

test('load error can retry without creating a replacement attempt', async () => {
    const run = harness(); run.behavior.get = () => { throw httpError(404, 'missing'); };
    assert.equal(await run.session.load(), false); assert.equal(run.session.getSnapshot().error.kind, 'load'); assert.equal(run.session.getSnapshot().editable, false);
    assert.equal(posts(run).length, 0); delete run.behavior.get; assert.equal(await run.session.reload(), true);
});

test('server still-active response corrects an early client clock expiry instead of freezing a valid attempt', async () => {
    const run = harness(); await run.session.load();
    run.setTime(originTime + 600001); // local device clock jumped; server has not expired
    run.session.tick(); await settle();
    assert.equal(run.session.getSnapshot().attempt.status, 'active');
    assert.equal(run.session.getSnapshot().remainingSeconds, 600);
    assert.equal(run.session.getSnapshot().deadlineReached, false);
    assert.equal(run.session.getSnapshot().editable, true);
});
