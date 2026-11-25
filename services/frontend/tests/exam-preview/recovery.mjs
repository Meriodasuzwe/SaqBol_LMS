// Uses the real session controller against the isolated Django/ORM runner only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createExamSession} from '../../src/exams/examSession.js';
const port = Number(process.argv[2] || 4187);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const origin = 'http://127.0.0.1:' + port;
let token;
async function request(path, method = 'GET', body) {
    const response = await fetch(origin + path, {
        method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json();
    if (!response.ok) throw {response: {status: response.status, data}};
    return {data, status: response.status};
}
const fixture = await request('/__exam_preview__/bootstrap');
assert.equal(fixture.data.isolated, true);
assert.equal(fixture.data.quiz_id, 904);
token = (await request('/api/users/login/', 'POST', fixture.data.login)).data.access;
const before = (await request('/__exam_preview__/state')).data;
assert.equal(before.database, 'SQLite :memory:');
const storageRecords = new Map();
const storage = {getItem: key => storageRecords.get(key) ?? null, setItem: (key, value) => storageRecords.set(key, value), removeItem: key => storageRecords.delete(key)};
const writes = [];
const api = {
    get: path => request('/api/' + path),
    patch: (path, body) => {writes.push(structuredClone(body)); return request('/api/' + path, 'PATCH', body)},
    post: (path, body) => request('/api/' + path, 'POST', body),
};
const recovery = {storage, getOwnerId: async () => (await api.get('users/me/')).data.id};
const start = async () => (await api.post('exams/attempts/', {request_id: randomUUID(), configuration_id:'m094_profile_ru_demo_v1'})).data;
const attempt = await start();
const client = (id = attempt.id) => createExamSession({api, attemptId:id, recovery});
const firstQuestion = attempt.sections[0].questions[0];
const multi = attempt.sections[1].questions[0];
const pair = [multi.choices[0].id, multi.choices[2].id];
let session = client(); await session.load();
session.setAnswer(multi.id, pair); session.toggleFlag(multi.id); await session.dispose();
session = client(); await session.load();
assert.deepEqual(session.getSnapshot().answers[multi.id], pair);
assert.ok(session.getSnapshot().flaggedQuestionIds.includes(multi.id));
await session.flush();
assert.equal((await api.get('exams/attempts/' + attempt.id + '/')).data.revision, 1);
console.log('PASS: unsent selection and flag restore, real Django save reaches revision 1');

await request('/__exam_preview__/control', 'POST', {command:'lose_next_save_response'});
session.setAnswer(multi.id, [pair[0]]); assert.equal(await session.save(), false);
const frozen = structuredClone(writes.at(-1));
session.setAnswer(multi.id, pair); await session.dispose();
session = client(); await session.load(); assert.deepEqual(session.getSnapshot().answers[multi.id], pair);
const previousWrites = writes.length;
assert.equal(await session.flush(), true);
assert.deepEqual(writes[previousWrites], frozen);
assert.notEqual(writes[previousWrites + 1].request_id, frozen.request_id);
let stored = (await api.get('exams/attempts/' + attempt.id + '/')).data;
assert.equal(stored.revision, 3);
assert.deepEqual(stored.answers.find(a => a.question_id === multi.id).choice_ids, pair);
console.log('PASS: real lost response replays original UUID/body, then saves newer selection at revision 3');

session.setAnswer(firstQuestion.id, [firstQuestion.choices[0].id]); await session.dispose();
await api.patch('exams/attempts/' + attempt.id + '/answers/', {
    request_id: randomUUID(), revision: stored.revision,
    answers: stored.answers.map(a => a.question_id === firstQuestion.id ? {...a,choice_ids:[firstQuestion.choices[1].id]} : a),
    flagged_question_ids: stored.flagged_question_ids, last_question_by_section: stored.last_question_by_section,
});
session = client(); await session.load();
assert.equal(session.getSnapshot().saveStatus, 'conflict');
const count = writes.length; assert.equal(await session.flush(), false); assert.equal(writes.length, count);
assert.equal(await session.reload(), true);
assert.deepEqual(session.getSnapshot().answers[firstQuestion.id], [firstQuestion.choices[1].id]);
await session.dispose();
console.log('PASS: newer real server revision blocks overwrite until explicit reload');

const expired = await start();
session = client(expired.id); await session.load(); session.setAnswer(firstQuestion.id, [firstQuestion.choices[0].id]); await session.dispose();
await request('/__exam_preview__/control', 'POST', {command:'deadline_in_five_seconds', attempt_id:expired.id});
await new Promise(resolve => setTimeout(resolve, 5200));
const lastCount = writes.length; session = client(expired.id); await session.load();
assert.equal(session.getSnapshot().attempt.status,'completed');
assert.equal(session.getSnapshot().attempt.completion_reason,'deadline');
assert.equal(session.getSnapshot().attempt.result.grading.earned_points,0);
assert.equal(session.getSnapshot().editable,false);
assert.equal(writes.length,lastCount);
const after = (await request('/__exam_preview__/state')).data;
assert.equal(after.counts.attempts,before.counts.attempts+2);
assert.equal(after.counts.results,before.counts.results+1);
console.log('PASS: server deadline excludes late local answer; no extra attempt or result from replay');
