// Only QuizPage's ./api import is redirected here by the isolated Vite plugin.
// These are loopback-only mock endpoints, not the application backend.
async function previewRequest(operation, payload) {
    const response = await fetch(`/__quiz_preview__/${operation}`, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Synthetic preview failed.');
    return { data };
}

export default {
    get(url) {
        if (/^quizzes\/lesson\/9001\/(?:\?.*)?$/.test(url)) return previewRequest('quiz');
        throw new Error(`Isolated preview blocked an unexpected GET: ${url}`);
    },
    post(url, payload) {
        if (url === 'quizzes/9002/submit/') return previewRequest('submit', payload);
        if (url === 'analytics/quiz-attempt/') return previewRequest('analytics', payload);
        throw new Error(`Isolated preview blocked an unexpected POST: ${url}`);
    },
};
