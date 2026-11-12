import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from 'esbuild';
import { getExamCopy } from '../src/exams/examCopy.js';
import * as examSession from '../src/exams/examSession.js';

// Compile the shipping components, so these assertions cover the actual
// question, choice-label and review-explanation paths rather than a test formatter.
const empty = () => null;
const icons = Object.fromEntries(['X', 'ArrowLeft', 'ArrowRight', 'Check', 'Clock3', 'Flag', 'List', 'LogOut', 'RefreshCw'].map(name => [name, empty]));
function loadJsx(name, dependencies = {}) {
  const source = readFileSync(new URL(`../src/exams/${name}.jsx`, import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  const module = { exports: {} };
  const imports = { react: React, 'react/jsx-runtime': jsxRuntime, 'lucide-react': icons, ...dependencies };
  new Script(compiled).runInNewContext({
    module, exports: module.exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency ${name}`);
      return imports[name];
    },
  }, { timeout: 1000 });
  return module.exports;
}
const primitives = loadJsx('ExamPrimitives');
const navigation = loadJsx('ExamNavigation', { './examSession': examSession });
const renderText = text => renderToStaticMarkup(React.createElement(primitives.ExamText, { text }));

function renderAttempt(question, { mode = 'active', responseType = 'single' } = {}) {
  const sections = [{ id: 'first_subject', title: 'Алгоритмы', response_type: responseType, questions: [question] }];
  const session = {
    attempt: {
      id: 'synthetic-attempt', status: mode === 'review' ? 'completed' : 'active', sections,
      configuration: { title: 'Синтетический вариант', program: { code: 'M094' }, format: 'profile' },
    },
    answers: { [question.id]: [question.choices[0].id] }, flaggedQuestionIds: [], lastQuestionBySection: {},
    loading: false, editable: true, saveStatus: 'saved', remainingSeconds: null,
  };
  let stateIndex = 0;
  const react = {
    ...React,
    useState(initial) {
      // SSR does not execute the API-loading effect. Seed only the existing
      // third state slot (viewData) with the completed review API response.
      const isViewData = stateIndex++ === 2 && mode === 'review';
      if (isViewData) assert.equal(initial, null, 'Review state slot changed; update the fixture');
      return React.useState(isViewData ? { sections } : initial);
    },
  };
  const { default: ExamAttempt } = loadJsx('ExamAttempt', {
    react,
    'react-router-dom': {
      Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children),
      useNavigate: () => empty,
      useLocation: () => ({ pathname: '/exams/attempts/synthetic-attempt' }),
      useSearchParams: () => [new URLSearchParams(), empty],
    },
    '../api': { get: () => { throw new Error('Rendering must not call an API'); } },
    '../BugReportWidget': empty,
    './useExamSession': () => session,
    './examSession': examSession,
    './ExamPrimitives': primitives,
    './ExamNavigation': navigation,
    './ExamResult': empty,
  });
  return renderToStaticMarkup(React.createElement(ExamAttempt, {
    attemptId: 'synthetic-attempt', mode, c: getExamCopy('ru'), language: 'ru',
  }));
}

const question = {
  id: 101, number: 1,
  text: 'Найдите результат программы.\nҚазақша: ә, ғ, қ, ң, ө, ұ, ү, һ, і.\n\n```cpp\nint main() {\n    int x = 2;\n\treturn x < 3;\n}\n```\nВыберите ответ.',
  choices: [
    { id: 201, text: 'Первая строка\n    Отступ четыре пробела\n\tТабуляция' },
    { id: 202, text: '```sql\nSELECT name\n  FROM students\n WHERE score >= 60;\n```' },
  ],
  explanation: 'Пояснение по шагам:\n    Значение сохраняется.\n\n```python\nif x < 3:\n    print("Да")\n```\nСоңы.',
  selected_choice_ids: [201], correct_choice_ids: [202], answer_state: 'incorrect', earned_points: 0, max_points: 1,
};

test('imported Cyrillic, blank lines and code reach the real active question and choice labels', () => {
  for (const responseType of ['single', 'multiple']) {
    const html = renderAttempt(question, { responseType });
    assert.ok(html.includes('Қазақша: ә, ғ, қ, ң, ө, ұ, ү, һ, і.\n\n'));
    assert.ok(html.includes('<pre tabindex="0"><code>int main() {\n    int x = 2;\n\treturn x &lt; 3;\n}\n</code></pre>'));
    const labels = [...html.matchAll(/<label class="exam-option [\s\S]*?<\/label>/g)].map(match => match[0]);
    assert.equal(labels.length, 2);
    assert.ok(labels[0].includes(`<input type="${responseType === 'single' ? 'radio' : 'checkbox'}"`));
    assert.ok(labels[0].includes('class="exam-option-letter">A</span>'));
    assert.ok(labels[0].includes('<div class="exam-text exam-option-text"><div>Первая строка\n    Отступ четыре пробела\n\tТабуляция</div></div>'));
    assert.ok(labels[1].includes('class="exam-option-letter">B</span>'));
    assert.ok(labels[1].includes('<code>SELECT name\n  FROM students\n WHERE score &gt;= 60;\n</code>'));
    assert.doesNotMatch(html, /```/);
    assert.doesNotMatch(html, /Пояснение по шагам/);
  }
});

test('completed review uses the real text renderer for explanations and choice labels', () => {
  const html = renderAttempt(question, { mode: 'review' });
  assert.ok(html.includes('class="exam-text exam-explanation"><div>Пояснение по шагам:\n    Значение сохраняется.\n\n</div>'));
  assert.ok(html.includes('<pre tabindex="0"><code>if x &lt; 3:\n    print(&quot;Да&quot;)\n</code></pre><div>\nСоңы.</div>'));
  assert.match(html, /<label class="exam-option is-right">[\s\S]*?<code>SELECT name/);
  assert.match(html, /<input type="radio"[^>]*disabled=""/);
  assert.doesNotMatch(html, /```/);
});

test('the renderer retains plain multiline text and displays rich Markdown as literal text', () => {
  const plain = 'Сұрақ\n\n    Вложенный шаг\n\tСледующий шаг';
  assert.equal(renderText(plain), `<div class="exam-text "><div>${plain}</div></div>`);
  const rich = '# Заголовок\n**Жирный** и `код`\n![Схема](https://example.invalid/image.png)\n| A | B |\n| --- | --- |\n| 1 | 2 |';
  const html = renderText(rich);
  assert.ok(html.includes(rich));
  assert.doesNotMatch(html, /<(?:h1|strong|img|table|a|code)(?:\s|>)/);
});

test('valid LF and CRLF fences preserve the code contents without normalizing line endings', () => {
  for (const newline of ['\n', '\r\n']) {
    const code = ['if (x) {', '    // Қазақша түсіндірме', '\treturn 1;', '}', ''].join(newline);
    const html = renderText(`До.${newline}\`\`\`cpp${newline}${code}\`\`\`${newline}После.`);
    assert.ok(html.includes(`<div>До.${newline}</div>`));
    assert.ok(html.includes(`<pre tabindex="0"><code>${code}</code></pre>`));
    assert.ok(html.includes(`<div>${newline}После.</div>`));
  }
});

test('imported HTML is escaped in the actual question, choice and explanation paths', () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  const html = renderAttempt({ ...question, text: payload, choices: [{ id: 201, text: payload }], explanation: payload }, { mode: 'review' });
  assert.equal((html.match(/&lt;img/g) || []).length, 3);
  assert.equal((html.match(/&lt;script&gt;/g) || []).length, 3);
  assert.doesNotMatch(html, /<(?:img|script)(?:\s|>)/);
});
