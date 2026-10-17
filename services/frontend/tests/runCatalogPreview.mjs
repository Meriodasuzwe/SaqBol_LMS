// Isolated catalog design harness. No production configuration, .env, auth or DB.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, build, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { catalogFixture } from './catalog-preview/catalogFixture.mjs';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = resolve(testsDirectory, '..');
const previewDirectory = resolve(testsDirectory, 'catalog-preview');
const catalogSource = normalizePath(resolve(frontendDirectory, 'src/CourseList.jsx'));
const commonConfig = {
    configFile: false,
    envDir: false,
    envPrefix: '__SAQBOL_CATALOG_PREVIEW_UNUSED_ENV_PREFIX__',
    plugins: [react(), tailwindcss()],
};

if (process.argv.includes('--build')) {
    await build({
        ...commonConfig,
        root: frontendDirectory,
        build: { outDir: resolve(previewDirectory, '.build-app'), emptyOutDir: true },
    });
} else {
    function sendJson(response, status, data) {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(data));
    }

    const previewPlugin = {
        name: 'isolated-catalog-design-preview',
        enforce: 'pre',
        resolveId(source, importer) {
            if (importer?.split('?')[0] !== catalogSource) return;
            if (source === './api') return resolve(previewDirectory, 'apiStub.js');
            // The real tour opens an overlay and writes sq_onboarding_done. Hide
            // it only here so screenshots and fixture controls never write that key.
            if (source === './OnboardingTour') return resolve(previewDirectory, 'OnboardingPreviewStub.jsx');
        },
        transform(code, id) {
            if (normalizePath(id.split('?')[0]) !== catalogSource) return;
            const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');";
            if (code.includes(fontImport)) {
                return { code: code.replace(fontImport, '/* Remote font omitted only in isolated preview. */'), map: null };
            }
        },
        configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
                const url = new URL(request.url || '/', 'http://127.0.0.1:4174');
                if (url.pathname.startsWith('/api/')) {
                    return sendJson(response, 503, { preview_only: true, detail: 'Production API is disabled in this isolated preview.' });
                }
                if (url.pathname === '/covers/missing-synthetic.svg') {
                    response.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
                    return response.end('Intentional missing synthetic cover for layout validation.');
                }
                if (!url.pathname.startsWith('/__catalog_preview__/')) return next();
                if (request.method !== 'GET') return sendJson(response, 405, { preview_only: true, detail: 'Read-only preview.' });
                const scene = url.searchParams.get('scene') || 'baseline';
                if (!['baseline', 'guest', 'empty', 'slow', 'error'].includes(scene)) {
                    return sendJson(response, 400, { preview_only: true, detail: 'Unknown synthetic scenario.' });
                }
                if (scene === 'slow') await new Promise(done => setTimeout(done, 1400));
                if (scene === 'error') return sendJson(response, 503, { preview_only: true, detail: 'Intentional synthetic API failure.' });
                if (url.pathname === '/__catalog_preview__/categories') return sendJson(response, 200, catalogFixture.categories);
                if (url.pathname === '/__catalog_preview__/promo-slots') return sendJson(response, 200, { remaining: 37, preview_only: true });
                if (url.pathname === '/__catalog_preview__/courses') {
                    let courses = scene === 'empty' ? [] : structuredClone(catalogFixture.courses);
                    if (scene === 'guest') courses = courses.map(course => ({ ...course, is_enrolled: false, progress: 0 }));
                    const search = (url.searchParams.get('search') || '').trim().toLocaleLowerCase('ru');
                    const category = url.searchParams.get('category');
                    if (search) courses = courses.filter(course => `${course.title} ${course.description || ''}`.toLocaleLowerCase('ru').includes(search));
                    if (category) courses = courses.filter(course => String(course.category) === category);
                    // Deliberately no mock sorting, level or duration behavior:
                    // the original API calls supply only search and category.
                    return sendJson(response, 200, courses);
                }
                return sendJson(response, 404, { preview_only: true, detail: 'Unknown isolated preview operation.' });
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
            host: '127.0.0.1', port: 4174, strictPort: true, open: false,
            fs: { allow: [frontendDirectory] },
            headers: {
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' ws://127.0.0.1:4174; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'",
            },
        },
    });
    await server.listen();
    console.log('Isolated synthetic CourseList preview: http://127.0.0.1:4174/');
    console.log('MemoryRouter /courses; actual CourseList and i18n; no production services, auth or .env.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
}
