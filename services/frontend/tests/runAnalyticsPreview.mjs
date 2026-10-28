// Manual real QuizPage + real API + Django + ephemeral SQLite. Test harness only.
// Docker stdio is a transport only; no API response, validation or persistence mocks.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const tests = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(tests, '..');
const core = resolve(frontend, '../core_service');
const root = resolve(tests, 'analytics-preview');
const origin = 'http://127.0.0.1:4179';
const containerName = `saqbol-analytics-preview-${process.pid}`;
const backend = spawn('docker', [
    'run', '--rm', '-i', '--name', containerName, '--pull', 'never', '--network', 'none', '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m',
    '--mount', `type=bind,source=${core},target=/source,readonly`,
    '--entrypoint', 'python', 'saqbol_lms-core_service:latest', '/source/tests/run_analytics_preview.py',
], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

let sequence = 0, server, closing = false, backendReady = false, backendFinished = false, shutdownPromise;
const pending = new Map();
let resolveBackendExit;
const backendExit = new Promise(resolve => { resolveBackendExit = resolve; });
let readyResolve, readyReject;
const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
const startupTimeout = setTimeout(() => readyReject(new Error('Isolated backend startup timed out.')), 60000);
function rejectPending(error) {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
}
function backendFailed(error) {
    clearTimeout(startupTimeout);
    readyReject(error);
    rejectPending(error);
    if (!closing && backendReady) {
        console.error(error.message);
        process.exitCode = 1;
        void shutdown();
    }
}
backend.stderr.resume(); // Never expose incidental server diagnostics or synthetic credentials.
backend.on('error', error => {
    if (!backend.pid) { backendFinished = true; resolveBackendExit(); }
    backendFailed(error);
});
backend.stdin.on('error', backendFailed);
backend.on('exit', (code, signal) => {
    backendFinished = true;
    resolveBackendExit();
    backendFailed(new Error(`Isolated backend exited (${signal || code}). `));
});
createInterface({ input: backend.stdout }).on('line', line => {
    try {
        const value = JSON.parse(line);
        if (value.ready) { backendReady = true; clearTimeout(startupTimeout); readyResolve(value); return; }
        const request = pending.get(value.id);
        if (request) { clearTimeout(request.timer); pending.delete(value.id); request.resolve(value); }
    } catch { readyReject(new Error('Backend did not return the JSONL transport protocol.')); }
});

function callBackend(payload) {
    if (closing || backendFinished) return Promise.reject(new Error('Isolated backend is not running.'));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Backend request timed out.')); }, 30000);
        pending.set(id, { resolve, reject, timer });
        backend.stdin.write(JSON.stringify({ ...payload, id }) + '\n', error => {
            if (error) { clearTimeout(timer); pending.delete(id); reject(error); }
        });
    });
}
function json(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
}
async function readBody(request) {
    let body = '';
    for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 512 * 1024) throw new Error('Test request is too large.');
    }
    return body ? JSON.parse(body) : undefined;
}
function waitForBackend(milliseconds) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), milliseconds);
        backendExit.then(() => { clearTimeout(timer); resolve(true); });
    });
}
function stopOwnContainer() {
    return new Promise((resolve, reject) => {
        // Never stop other containers, prune data, or use a broad container selector.
        const stop = spawn('docker', ['stop', '--time', '2', containerName], {
            stdio: 'ignore', windowsHide: true,
        });
        const timer = setTimeout(() => {
            stop.kill();
            reject(new Error(`Timed out stopping isolated container ${containerName}.`));
        }, 5000);
        stop.once('error', error => { clearTimeout(timer); reject(error); });
        stop.once('exit', code => {
            clearTimeout(timer);
            if (code === 0 || backendFinished) resolve();
            else reject(new Error(`Could not stop isolated container ${containerName} (${code}).`));
        });
    });
}
function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    closing = true;
    clearTimeout(startupTimeout);
    const error = new Error('Isolated preview is shutting down.');
    readyReject(error);
    rejectPending(error);
    shutdownPromise = (async () => {
        try { await server?.close(); }
        catch (closeError) { console.error(closeError.message); process.exitCode = 1; }
        if (!backendFinished) backend.stdin.end(); // Prefer EOF and normal --rm cleanup.
        if (await waitForBackend(3000)) return;
        try { await stopOwnContainer(); }
        catch (stopError) { console.error(stopError.message); process.exitCode = 1; }
        if (!await waitForBackend(3000)) {
            console.error(`Docker transport did not exit after stopping ${containerName}.`);
            process.exitCode = 1;
            backend.kill();
        }
    })();
    return shutdownPromise;
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

try {
    const fixture = await ready;
    if (!fixture.isolated || fixture.course_id !== 901) throw new Error('Unexpected backend fixture.');
    server = await createServer({
        configFile: false, envDir: false, envPrefix: '__SAQBOL_ROUNDTRIP_UNUSED_ENV__',
        root, publicDir: false, cacheDir: resolve(root, '.vite-cache'),
        plugins: [{
            name: 'real-isolated-django-transport',
            configureServer(vite) {
                vite.middlewares.use(async (request, response, next) => {
                    const url = new URL(request.url || '/', origin);
                    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__analytics_preview__/')) return next();
                    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) return json(response, 403, { detail: 'Cross-origin access is disabled.' });
                    try {
                        if (url.pathname === '/__analytics_preview__/bootstrap' && request.method === 'GET') {
                            return json(response, 200, fixture); // Explicitly synthetic login, never a production credential.
                        }
                        if (url.pathname === '/__analytics_preview__/state' && request.method === 'GET') {
                            const result = await callBackend({ control: 'selection_state' });
                            return json(response, result.status, result.data);
                        }
                        if (!url.pathname.startsWith('/api/')) return json(response, 404, { detail: 'Unknown test control.' });
                        const result = await callBackend({
                            method: request.method, path: url.pathname.slice(4) + url.search,
                            body: await readBody(request),
                            headers: { authorization: request.headers.authorization || '' },
                        });
                        json(response, result.status, result.data);
                    } catch (error) { json(response, 502, { detail: `Isolated transport: ${error.message}` }); }
                });
            },
        }, react(), tailwindcss()],
        server: {
            host: '127.0.0.1', port: 4179, strictPort: true, open: false,
            fs: { allow: [frontend] },
            headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:4179; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'" },
        },
    });
    if (closing || backendFinished) {
        await server.close();
        throw new Error('Isolated backend stopped before the preview could start.');
    }
    await server.listen();
    console.log(`Real QuizPage analytics preview: ${origin}/`);
    console.log(`Read-only synthetic database state: ${origin}/__analytics_preview__/state`);
    console.log(`Container: ${containerName}. Network disabled; ephemeral SQLite; no .env or production data.`);
} catch (error) {
    console.error(error.message);
    await shutdown();
    process.exitCode = 1;
}
