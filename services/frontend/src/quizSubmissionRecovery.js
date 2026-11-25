// Browser-only selection copy and frozen submit request; never a server attempt.
export function createQuizSubmissionRecovery({ storage, ownerId, lessonId, quizId, quiz = null }) {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error('Unverified account');
    const key = ['saqbol.quiz.submit.v1', ownerId, lessonId, quizId].join('.');
    const draftKey = ['saqbol.quiz.draft.v1', ownerId, lessonId, quizId].join('.');
    let draftId = null;
    // Exact comparison of visible question content; excludes keys, explanations and scores.
    const content = quiz ? JSON.stringify({
        mode: quiz.mode || 'training', title: quiz.title || '',
        questions: quiz.questions.map(question => ({
            id: question.id, text: question.text || '',
            choices: question.choices.map(choice => ({id: choice.id, text: choice.text || ''})),
        })),
    }) : null;
    const positive = n => Number.isSafeInteger(n) && n > 0;
    const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
    function valid(value) {
        const body = value?.payload;
        return value?.schema === 1 && value.quizId === quizId && String(value.lessonId) === String(lessonId)
            && nonnegative(value.startedAt) && nonnegative(value.warnings)
            && body && Object.keys(body).sort().join(',') === 'answers,submission_id,time_spent_seconds'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.submission_id)
            && nonnegative(body.time_spent_seconds) && Array.isArray(body.answers)
            && new Set(body.answers.map(answer => answer?.question_id)).size === body.answers.length
            && body.answers.every(answer => positive(answer?.question_id) && Array.isArray(answer.choice_ids)
                && new Set(answer.choice_ids).size === answer.choice_ids.length && answer.choice_ids.every(positive));
    }
    function clearDraft() {
        storage.removeItem(draftKey);
        draftId = null;
    }
    function validDraft(value) {
        return value?.schema === 1 && value.quizId === quizId && String(value.lessonId) === String(lessonId)
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.draftId)
            && value.content === content && nonnegative(value.startedAt) && nonnegative(value.warnings) && value.warnings < 3
            && nonnegative(value.currentIndex) && value.currentIndex < quiz.questions.length
            && value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers)
            && Object.entries(value.answers).every(([id, selected]) => {
                const question = quiz.questions.find(item => String(item.id) === id);
                return question && Array.isArray(selected) && new Set(selected).size === selected.length
                    && selected.every(choiceId => question.choices.some(choice => choice.id === choiceId));
            });
    }
    return {
        get draftId() { return draftId; },
        loadDraft() {
            if (!quiz) throw new Error('Draft requires loaded quiz content');
            const raw = storage.getItem(draftKey);
            if (!raw) return null;
            const value = JSON.parse(raw);
            if (!validDraft(value)) throw new Error('Draft does not match current question content');
            draftId = value.draftId;
            return value;
        },
        saveDraft(answers, { startedAt, warnings, currentIndex }) {
            if (!quiz) throw new Error('Draft requires loaded quiz content');
            draftId ||= globalThis.crypto.randomUUID();
            const value = {schema: 1, quizId, lessonId: String(lessonId), draftId, content, answers,
                startedAt, warnings, currentIndex};
            if (!validDraft(value)) throw new Error('Invalid quiz selection copy');
            storage.setItem(draftKey, JSON.stringify(value));
        },
        load() {
            const raw = storage.getItem(key);
            if (!raw) return null;
            const value = JSON.parse(raw);
            if (!valid(value)) throw new Error('Invalid pending quiz submission');
            return value;
        },
        save(submission, { startedAt, warnings }) {
            const value = {schema: 1, quizId, lessonId: String(lessonId), startedAt, warnings, payload: submission.payload};
            if (!valid(value)) throw new Error('Invalid pending quiz submission');
            storage.setItem(key, JSON.stringify(value));
            clearDraft();
        },
        clear() { storage.removeItem(key); clearDraft(); },
    };
}
export const quizSubmissionStorage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
};
