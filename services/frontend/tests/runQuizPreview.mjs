// Isolated design preview. It never imports Django, uses production APIs, or loads .env files.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, build, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(testsDirectory, '..');
const previewDirectory = resolve(testsDirectory, 'quiz-preview');
const commonConfig = {
    configFile: false,
    envDir: false,
    // Do not inject inherited VITE_* settings from a developer's shell either.
    envPrefix: '__SAQBOL_ISOLATED_PREVIEW_UNUSED_ENV_PREFIX__',
    plugins: [react(), tailwindcss()],
};

if (process.argv.includes('--build')) {
    // Compile the real application with its real API import, without loading its
    // vite.config.js or .env. The generated files stay inside this test harness.
    await build({
        ...commonConfig,
        root: frontendDirectory,
        build: { outDir: resolve(previewDirectory, '.build-app'), emptyOutDir: true },
    });
} else {
    const fixturePath = resolve(frontendDirectory, '../core_service/tests/fixtures/sql_selection_training.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    if (fixture.metadata?.synthetic !== true || fixture.questions?.length !== 10) {
        throw new Error('The isolated preview requires the explicit ten-question synthetic fixture.');
    }

    const quiz = {
        id: 9002,
        lesson: 9001,
        title: 'SQL: выборка и фильтрация',
        preview_only: true,
        questions: fixture.questions.map((question, index) => ({
            id: 9101 + index,
            text: question.question,
            choices: question.options.map((text, optionIndex) => ({ id: 92000 + index * 10 + optionIndex, text })),
        })),
    };
    const correctIds = Object.fromEntries(fixture.questions.map((question, index) => [
        9101 + index,
        question.correct_index.map(optionIndex => 92000 + index * 10 + optionIndex),
    ]));
    const analytics = [];
    let resultSequence = 9900;

    function sendJson(response, status, data) {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(data));
    }

    async function readJson(request) {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
            size += chunk.length;
            if (size > 65536) throw new Error('Preview request is too large.');
            chunks.push(chunk);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    }

    const previewPlugin = {
        name: 'isolated-quiz-design-preview',
        enforce: 'pre',
        resolveId(source, importer) {
            if (source === './api' && importer?.split('?')[0] === normalizePath(resolve(frontendDirectory, 'src/QuizPage.jsx'))) {
                return resolve(previewDirectory, 'apiStub.js');
            }
        },
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const path = request.url?.split('?')[0];
                if (path?.startsWith('/api/')) {
                    sendJson(response, 503, { preview_only: true, detail: 'Production API is unavailable in this isolated preview.' });
                    return;
                }
                if (!path?.startsWith('/__quiz_preview__/')) return next();
                try {
                    if (request.method === 'GET' && path === '/__quiz_preview__/quiz') {
                        sendJson(response, 200, [quiz]);
                    } else if (request.method === 'POST' && path === '/__quiz_preview__/submit') {
                        const payload = await readJson(request);
                        const supplied = new Map((payload.answers || []).map(answer => [answer.question_id, new Set(answer.choice_ids || [])]));
                        const correctCount = quiz.questions.filter(question => {
                            const answer = supplied.get(question.id) || new Set();
                            const expected = correctIds[question.id];
                            return answer.size === expected.length && expected.every(id => answer.has(id));
                        }).length;
                        sendJson(response, 200, {
                            id: ++resultSequence,
                            score: Math.trunc(correctCount / quiz.questions.length * 100),
                            correct_count: correctCount,
                            total_questions: quiz.questions.length,
                            correct_answers_ids: correctIds,
                            preview_only: true,
                            preview_notice: 'Искусственный результат только для проверки интерфейса; серверный подсчет не проверяется.',
                        });
                    } else if (request.method === 'POST' && path === '/__quiz_preview__/analytics') {
                        analytics.push(await readJson(request));
                        sendJson(response, 200, { preview_only: true, stored_in_memory: true, count: analytics.length });
                    } else {
                        sendJson(response, 404, { preview_only: true, detail: 'Unknown isolated preview operation.' });
                    }
                } catch {
                    sendJson(response, 400, { preview_only: true, detail: 'Invalid synthetic preview request.' });
                }
            });
        },
    };

    const server = await createServer({
        ...commonConfig,
        root: previewDirectory,
        publicDir: false,
        cacheDir: resolve(previewDirectory, '.vite-cache'),
        plugins: [previewPlugin, ...commonConfig.plugins],
        server: {
            host: '127.0.0.1',
            port: 4173,
            strictPort: true,
            open: false,
            fs: { allow: [frontendDirectory] },
            headers: {
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:4173; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'",
            },
        },
    });
    await server.listen();
    console.log('Isolated synthetic QuizPage preview: http://127.0.0.1:4173/');
    console.log('Actual component route: /quiz/lesson/9001?quiz_id=9002 (MemoryRouter). No production services or .env files.');
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, async () => { await server.close(); process.exit(0); });
    }
}
