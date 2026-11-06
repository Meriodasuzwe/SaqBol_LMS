import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { examMessages, getExamCopy } from '../src/exams/examCopy.js';

// Execute the actual JSX module through the installed compiler. These tests
// inspect rendered content, not a second text formatter written in the test.
const source = readFileSync(new URL('../src/exams/ExamPrimitives.jsx', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
const module = { exports: {} };
new Script(compiled).runInNewContext({
  module, exports: module.exports,
  require(name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'lucide-react') return { X: () => null };
    throw new Error(`Unexpected dependency ${name}`);
  },
}, { timeout: 1000 });
const { ExamText, DemoNotice } = module.exports;
const renderText = text => renderToStaticMarkup(React.createElement(ExamText, { text }));

test('exam controls have complete nonempty RU, KK and EN translations', () => {
  const required = Object.keys(examMessages.ru).sort();
  assert.ok(required.length > 50);
  for (const language of ['ru', 'kk', 'en']) {
    assert.deepEqual(Object.keys(examMessages[language]).sort(), required, language);
    for (const [key, message] of Object.entries(examMessages[language])) {
      assert.equal(typeof message, 'string', `${language}.${key}`);
      assert.ok(message.trim().length, `${language}.${key}`);
    }
  }
  assert.equal(getExamCopy('kk-KZ'), examMessages.kk);
  assert.equal(getExamCopy('en-US'), examMessages.en);
  assert.equal(getExamCopy('missing'), examMessages.ru);
});

test('real question renderer preserves multiline SQL indentation in keyboard-accessible code', () => {
  const sql = 'SELECT name, grade\n  FROM applicants\n WHERE grade >= 60;';
  const html = renderText(sql);
  assert.match(html, /<pre tabindex="0"><code>/);
  assert.ok(html.includes('SELECT name, grade\n  FROM applicants\n WHERE grade &gt;= 60;'));
});

test('real question renderer separates prose from a fenced SQL fragment without losing either', () => {
  const html = renderText('Read this query.\n```sql\nSELECT id\nFROM topics;\n```\nChoose an answer.');
  assert.ok(html.includes('Read this query.'));
  assert.ok(html.includes('<code>SELECT id\nFROM topics;\n</code>'));
  assert.ok(html.includes('Choose an answer.'));
  assert.equal(html.includes('```'), false);
});

test('question and explanation content cannot inject executable HTML through the renderer', () => {
  const html = renderText('<script>window.unwanted = true</script><img src=x onerror=alert(1)>');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('artificial-data notice appears only for a server-marked demonstration', () => {
  const c = examMessages.ru;
  const demo = renderToStaticMarkup(React.createElement(DemoNotice, { config: { is_demo: true }, c }));
  assert.ok(demo.includes(c.demo));
  assert.ok(demo.includes(c.demoNotice));
  const ordinary = renderToStaticMarkup(React.createElement(DemoNotice, { config: { is_demo: false }, c }));
  assert.equal(ordinary, '');
});


test('real question renderer preserves unfenced SQL after prose without turning surrounding text into code', () => {
  const html = renderText('Рассмотрите запрос:\nSELECT id\nFROM demo;\nПояснение.');
  assert.ok(html.includes('<code>SELECT id\nFROM demo;'), html);
  assert.match(html, /<div>Рассмотрите запрос:[\s\S]*?<\/div>/);
  assert.match(html, /<\/pre>\s*Пояснение\./);
  assert.doesNotMatch(html, /<code>[^<]*Пояснение/);
});
