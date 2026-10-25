// Local synthetic harness for the actual CourseBuilder. Never loads app config/.env.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createBuilderFixture } from './builder-preview/builderFixture.mjs';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(testsDirectory, '..');
const previewDirectory = resolve(testsDirectory, 'builder-preview');
const apiSource = normalizePath(resolve(frontendDirectory, 'src/api'));
let state = createBuilderFixture();

function sendJson(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
}

async function readJson(request) {
    let body = '';
    for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 512 * 1024) throw new Error('Synthetic request is too large.');
    }
    return body ? JSON.parse(body) : {};
}

const isolatedApi = {
    name: 'isolated-builder-api', enforce: 'pre',
    resolveId(source, importer) {
        if (!importer || !source.startsWith('.')) return;
        const resolved = normalizePath(resolve(dirname(importer.split('?')[0]), source)).replace(/\.js$/, '');
        if (resolved === apiSource) return resolve(previewDirectory, 'apiStub.js');
    },
    configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
            const url = new URL(request.url || '/', 'http://127.0.0.1:4177');
            if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
                return sendJson(response, 503, { preview_only: true, detail: 'Production API is disabled.' });
            }
            if (!url.pathname.startsWith('/__builder_preview__/')) return next();
            if (request.headers.origin && request.headers.origin !== 'http://127.0.0.1:4177') {
                return sendJson(response, 403, { detail: 'Cross-origin preview access is disabled.' });
            }
            if (url.pathname === '/__builder_preview__/state' && request.method === 'GET') {
                return sendJson(response, 200, { preview_only: true, ...state });
            }
            if (url.pathname === '/__builder_preview__/reset' && request.method === 'POST') {
                state = createBuilderFixture();
                return sendJson(response, 200, { preview_only: true, reset: true });
            }
            const path = url.pathname.replace('/__builder_preview__/api', '');
            try {
                const payload = ['POST', 'PATCH'].includes(request.method) ? await readJson(request) : null;
                state.requests.push({ method: request.method, path, payload });
                if (state.requests.length > 100) state.requests.shift();
                if (request.method === 'GET') {
                    if (path === '/courses/901/') return sendJson(response, 200, state.course);
                    if (path === '/courses/901/lessons/') return sendJson(response, 200, state.lessons);
                    if (path === '/quizzes/lesson/902/') return sendJson(response, 200, state.quizzes);
                }
                if (request.method === 'POST' && path === '/quizzes/save-generated/') {
                    if (payload.lesson_id !== 902 || (payload.quiz_id !== undefined && payload.quiz_id !== 904)
                        || !Array.isArray(payload.questions) || !payload.questions.length) {
                        return sendJson(response, 400, { detail: 'Synthetic fixture expects lesson 902 and a nonempty quiz.' });
                    }
                    // Transport fixture only: no grading or application validation is replaced.
                    // Convert the actual request into the response shape used by the real API.
                    const questions = payload.questions.map(question => ({
                        id: state.nextId++, text: question.question, explanation: question.explanation,
                        choices: question.options.map((text, index) => ({
                            id: state.nextId++, text, is_correct: question.correct_index.includes(index),
                        })),
                    }));
                    state.quizzes = [{ id: 904, lesson: 902, title: payload.quiz_title, description: '', questions }];
                    return sendJson(response, 201, { message: 'Synthetic quiz saved.', quiz_id: 904 });
                }
                const stepMatch = path.match(/^\/courses\/steps\/(903|905)\/$/);
                if (request.method === 'PATCH' && stepMatch) {
                    const step = state.lessons[0].steps.find(item => item.id === Number(stepMatch[1]));
                    for (const key of ['title', 'content', 'step_type', 'scenario_data', 'order']) {
                        if (Object.hasOwn(payload, key)) step[key] = payload[key];
                    }
                    return sendJson(response, 200, step);
                }
                return sendJson(response, 404, { detail: 'Operation is outside this synthetic preview.' });
            } catch (error) {
                return sendJson(response, 400, { detail: `Invalid synthetic request: ${error.message}` });
            }
        });
    },
};

const server = await createServer({
    configFile: false, envDir: false, envPrefix: '__SAQBOL_BUILDER_PREVIEW_UNUSED_ENV_PREFIX__',
    root: previewDirectory, publicDir: false, cacheDir: resolve(previewDirectory, '.vite-cache'),
    plugins: [isolatedApi, react(), tailwindcss()],
    server: {
        host: '127.0.0.1', port: 4177, strictPort: true, open: false,
        fs: { allow: [frontendDirectory] },
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:4177; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'",
        },
    },
});
await server.listen();
console.log('Isolated actual CourseBuilder: http://127.0.0.1:4177/');
console.log('Synthetic requests/state: http://127.0.0.1:4177/__builder_preview__/state');
console.log('No production API, .env, DB, credentials or external services. Data lasts until this process stops.');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
