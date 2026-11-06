import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { parse } from '@babel/parser';
import { buildExamReportContext, reportDescription, submitBugReport } from '../src/exams/examReport.js';

const context = {
  attempt_id: '00000000-0000-4000-8000-000000000001',
  section_id: 'second_subject', question_id: 131,
  path: '/exams/attempts/00000000-0000-4000-8000-000000000001?access=do-not-send#private',
};
const form = { title: '  Synthetic issue  ', category: 'functionality', description: '  Synthetic question description  ', page_url: 'http://localhost/exams' };

test('question report allowlists public IDs and strips URL query/hash without copying answers or secrets', () => {
  const safe = buildExamReportContext({
    ...context, token: 'do-not-send', answers: [131], correct_choice_ids: [1301],
    content_snapshot: { explanation: 'do-not-send' }, password: 'do-not-send',
  });
  assert.deepEqual(safe, {
    attempt_id: context.attempt_id, section_id: 'second_subject', question_id: 131,
    path: context.path.split('?')[0],
  });
  assert.equal(JSON.stringify(safe).includes('do-not-send'), false);
});

test('question report rejects malformed identifiers and non-exam paths', () => {
  for (const input of [null, undefined, { attempt_id: 'not-an-id', section_id: '<script>', question_id: '131', path: 'https://external.test/?access=x' }, { question_id: -1, path: '/profile' }]) {
    assert.deepEqual(buildExamReportContext(input), { path: '/exams' });
  }
});

test('report context freezes the actual public question independently of mutable attempt state', () => {
  const original = { ...context };
  const safe = buildExamReportContext(original);
  original.question_id = 132;
  assert.equal(safe.question_id, 131);
  assert.match(reportDescription('User description', safe), /"question_id":131/);
});

test('ordinary floating bug report keeps its original trimmed description and multipart contract', async () => {
  let call;
  await submitBugReport({ post: async (...args) => { call = args; return { data: { id: 1 } }; } }, form);
  assert.equal(call[0], '/bugs/');
  assert.deepEqual(Object.fromEntries(call[1].entries()), {
    title: 'Synthetic issue', category: 'functionality',
    description: 'Synthetic question description', page_url: form.page_url,
  });
  assert.equal(call[2].headers['Content-Type'], 'multipart/form-data');
});

test('exam report uses the same endpoint and attaches only safe context to description', async () => {
  let payload;
  const response = await submitBugReport({ post: async (url, data) => {
    assert.equal(url, '/bugs/'); payload = data;
    return { status: 201, data: { id: 9 } };
  } }, form, [], { ...context, answers: ['do-not-send'] });
  assert.equal(response.data.id, 9);
  assert.deepEqual([...payload.keys()], ['title', 'category', 'description', 'page_url']);
  assert.match(payload.get('description'), /"question_id":131/);
  assert.equal(payload.get('description').includes('do-not-send'), false);
});

test('failed report remains a rejected operation, not a synthetic successful receipt', async () => {
  const failure = new Error('Synthetic offline error');
  await assert.rejects(submitBugReport({ post: async () => { throw failure; } }, form, [], context), failure);
});


function actualLogoutHandler(window, onLogout) {
  const source = readFileSync(new URL('../src/Navbar.jsx', import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  function find(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'VariableDeclarator' && node.id.name === 'requestLogout') return node.init;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) { const found = find(child); if (found) return found; } }
      else if (value && typeof value === 'object') { const found = find(value); if (found) return found; }
    }
    return null;
  }
  const node = find(ast);
  assert.ok(node, 'actual Navbar logout handler exists');
  return new Script(`(${source.slice(node.start, node.end)})`).runInNewContext({ window, onLogout, CustomEvent });
}

test('ordinary Navbar logout still invokes existing action immediately when no exam guard is present', () => {
  let calls = 0;
  const handler = actualLogoutHandler(new EventTarget(), () => { calls++; });
  handler();
  assert.equal(calls, 1);
});

test('exam guard can defer actual Navbar logout until saved answers have been confirmed', () => {
  const window = new EventTarget();
  let calls = 0;
  let proceed;
  window.addEventListener('saqbol:before-logout', event => {
    event.preventDefault();
    proceed = event.detail.proceed;
  });
  actualLogoutHandler(window, () => { calls++; })();
  assert.equal(calls, 0);
  assert.equal(typeof proceed, 'function');
  proceed();
  assert.equal(calls, 1);
});
