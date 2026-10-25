// Preview-only transport replacement. It cannot forward arbitrary URLs or credentials.
const base = 'http://builder-preview.invalid/';
const allowed = {
    GET: [/^\/courses\/901\/$/, /^\/courses\/901\/lessons\/$/, /^\/quizzes\/lesson\/902\/$/],
    POST: [/^\/quizzes\/save-generated\/$/],
    PATCH: [/^\/courses\/steps\/(903|905)\/$/],
};

async function request(method, requestPath, payload) {
    const input = new URL(requestPath, base);
    if (input.origin !== new URL(base).origin || !allowed[method]?.some(pattern => pattern.test(input.pathname))) {
        throw new Error(`Unsupported operation blocked by isolated builder preview: ${method} ${requestPath}`);
    }
    const response = await fetch(`/__builder_preview__/api${input.pathname}${input.search}`, {
        method, cache: 'no-store', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.detail || 'Synthetic API error'), { response: { status: response.status, data } });
    return { data };
}

export default {
    get: path => request('GET', path),
    post: (path, payload) => request('POST', path, payload),
    patch: (path, payload) => request('PATCH', path, payload),
    delete: path => request('DELETE', path),
};
