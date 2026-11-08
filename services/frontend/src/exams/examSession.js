// One client for the server-owned attempt. No scoring or answer keys live here.
export const AUTOSAVE_DELAY = 650;

export function sectionProgress(section, answers) {
    const total = section.questions.length;
    const answered = section.questions.filter(question => (answers[question.id] || []).length > 0).length;
    return { total, answered, unanswered: total - answered };
}

export function questionState(question, answers, { review = false } = {}) {
    if (review) return question.answer_state || 'unanswered';
    return (answers[question.id] || []).length ? 'answered' : 'unanswered';
}

export function remainingSeconds(attempt, clockOffset = 0, now = Date.now()) {
    if (!attempt?.deadline) return null;
    return Math.max(0, Math.ceil((Date.parse(attempt.deadline) - now - clockOffset) / 1000));
}

export function formatRemainingTime(seconds) {
    if (seconds === null) return '—';
    const whole = Math.max(0, Math.ceil(seconds));
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const rest = String(whole % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function errorInfo(error, kind) {
    const response = error?.response;
    const data = response?.data;
    const pieces = typeof data === 'object' && data !== null ? Object.values(data).flat() : [data];
    const detail = typeof data?.detail === 'string' ? data.detail : pieces.filter(value => typeof value === 'string').join(' ');
    return { kind: response?.status === 401 ? 'auth' : kind, code: data?.code || null, detail, status: response?.status || null };
}

export function createExamSession({ api, attemptId, now = Date.now, uuid = () => globalThis.crypto.randomUUID() }) {
    const path = `exams/attempts/${encodeURIComponent(attemptId)}/`;
    const listeners = new Set();
    let disposed = false;
    let generation = 0;
    let attachmentVersion = 0;
    let clockOffset = 0;
    let localVersion = 0;
    let acknowledgedVersion = 0;
    let pendingWrite = null;
    let pendingFinish = null;
    let writeFlight = null;
    let finishFlight = null;
    let readFlight = null;
    let state = {
        attempt: null, answers: {}, flaggedQuestionIds: [], lastQuestionBySection: {},
        loading: true, saveStatus: 'saved', error: null, finishing: false,
        finishUncertain: false, deadlineReached: false, remainingSeconds: null,
        editable: false, hasUnsentChanges: false,
    };

    function publish(patch = {}) {
        if (disposed) return;
        const next = { ...state, ...patch };
        next.hasUnsentChanges = localVersion !== acknowledgedVersion || Boolean(pendingWrite || pendingFinish);
        next.editable = next.attempt?.status === 'active' && !next.loading && !next.finishing
            && !next.finishUncertain && !next.deadlineReached && next.saveStatus !== 'conflict';
        state = next;
        listeners.forEach(listener => listener());
    }

    function copyAnswers(attempt) {
        return Object.fromEntries(attempt.answers.map(answer => [answer.question_id, [...answer.choice_ids]]));
    }

    function accept(attempt, { replaceLocal = false } = {}) {
        const serverNow = Date.parse(attempt.server_time);
        if (Number.isFinite(serverNow)) clockOffset = serverNow - now();
        const seconds = remainingSeconds(attempt, clockOffset, now());
        const patch = { attempt, loading: false, remainingSeconds: seconds,
            deadlineReached: attempt.status === 'active' ? seconds === 0 : state.deadlineReached };
        if (replaceLocal || attempt.status === 'completed') {
            patch.answers = copyAnswers(attempt);
            patch.flaggedQuestionIds = [...attempt.flagged_question_ids];
            patch.lastQuestionBySection = { ...attempt.last_question_by_section };
        }
        if (attempt.status === 'completed') {
            acknowledgedVersion = localVersion;
            pendingWrite = null;
            pendingFinish = null;
            Object.assign(patch, { finishing: false, finishUncertain: false, saveStatus: 'saved', error: null,
                deadlineReached: attempt.completion_reason === 'deadline' });
        }
        publish(patch);
    }

    function body() {
        return {
            request_id: uuid(), revision: state.attempt.revision,
            answers: state.attempt.sections.flatMap(section => section.questions.map(question => ({
                question_id: question.id, choice_ids: [...(state.answers[question.id] || [])],
            }))),
            flagged_question_ids: [...state.flaggedQuestionIds],
            last_question_by_section: { ...state.lastQuestionBySection },
        };
    }

    async function read({ discard = false, initial = false } = {}) {
        if (readFlight) return readFlight;
        const currentGeneration = generation;
        if (initial) publish({ loading: true, error: null });
        const operation = (async () => {
            try {
                const { data } = await api.get(path);
                if (disposed || currentGeneration !== generation) return false;
                if (discard) {
                    pendingWrite = null;
                    pendingFinish = null;
                    localVersion = 0;
                    acknowledgedVersion = 0;
                    publish({ error: null, saveStatus: 'saved', finishing: false, finishUncertain: false, deadlineReached: false });
                }
                accept(data, { replaceLocal: discard || initial });
                return true;
            } catch (error) {
                if (!disposed && currentGeneration === generation) publish({ loading: false, error: errorInfo(error, state.deadlineReached ? 'deadline' : 'load') });
                return false;
            }
        })();
        readFlight = operation;
        try { return await operation; } finally { if (readFlight === operation) readFlight = null; }
    }

    async function reconcileClosed(error) {
        if (error?.response?.data?.code === 'deadline_expired') publish({ deadlineReached: true });
        publish({ finishing: false, finishUncertain: true, error: errorInfo(error, 'finish') });
        return read();
    }

    function canMutate() {
        tick(false);
        return state.editable;
    }

    function changed(patch) {
        localVersion += 1;
        const blockedError = state.saveStatus === 'error' && pendingWrite;
        publish({ ...patch, saveStatus: blockedError ? 'error' : writeFlight ? 'saving' : 'unsaved', error: blockedError ? state.error : null });
    }

    function findQuestion(questionId) {
        for (const section of state.attempt?.sections || []) {
            const question = section.questions.find(item => item.id === questionId);
            if (question) return { section, question };
        }
        return null;
    }

    async function save() {
        if (writeFlight) return writeFlight;
        tick(false);
        if (disposed || !state.attempt || state.attempt.status !== 'active' || state.deadlineReached
            || state.saveStatus === 'conflict' || pendingFinish) return false;
        if (!pendingWrite && localVersion === acknowledgedVersion) return true;
        const write = pendingWrite || { payload: body(), version: localVersion };
        pendingWrite = write;
        const currentGeneration = generation;
        publish({ saveStatus: 'saving', error: null });
        const operation = (async () => {
            try {
                const { data } = await api.patch(path + 'answers/', write.payload);
                if (disposed || currentGeneration !== generation) return false;
                if (state.attempt.status === 'completed') return true;
                pendingWrite = null;
                acknowledgedVersion = write.version;
                accept(data);
                publish({ saveStatus: localVersion === acknowledgedVersion ? 'saved' : 'unsaved', error: null });
                return true;
            } catch (error) {
                if (disposed || currentGeneration !== generation) return false;
                if (state.attempt?.status === 'completed') return true;
                const code = error?.response?.data?.code;
                if (['deadline_expired', 'attempt_completed'].includes(code)) return reconcileClosed(error);
                if (error?.response?.status === 409) {
                    publish({ saveStatus: 'conflict', error: errorInfo(error, 'conflict') });
                } else {
                    // A 400 definitely rejected this write. A lost response may
                    // have committed, so retain its UUID and exact payload.
                    if (error?.response?.status === 400) pendingWrite = null;
                    publish({ saveStatus: 'error', error: errorInfo(error, error?.response?.status === 400 ? 'validation' : 'save') });
                }
                return false;
            }
        })();
        writeFlight = operation;
        try { return await operation; } finally { if (writeFlight === operation) writeFlight = null; }
    }

    async function flush() {
        if (pendingFinish || state.saveStatus === 'conflict') return false;
        do {
            if (!(await save())) return false;
            if (state.attempt?.status === 'completed') return true;
        } while (!disposed && localVersion !== acknowledgedVersion);
        return !disposed && !state.hasUnsentChanges;
    }

    async function finish() {
        if (finishFlight) return finishFlight;
        tick(false);
        if (disposed || !state.attempt) return false;
        if (state.attempt.status === 'completed') return true;
        if (state.deadlineReached) return read();
        if (state.saveStatus === 'conflict') return false;
        const currentGeneration = generation;
        publish({ finishing: true, error: null });
        const operation = (async () => {
            // Resolve the last save first; its response may carry a newer
            // revision. Edits stay frozen until submission is resolved.
            if (writeFlight && !(await writeFlight)) {
                publish({ finishing: false });
                return false;
            }
            if (disposed || currentGeneration !== generation) return false;
            if (state.attempt.status === 'completed') return true;
            if (pendingWrite && !(await save())) {
                publish({ finishing: false });
                return false;
            }
            tick(false);
            if (state.deadlineReached) {
                publish({ finishing: false });
                return read();
            }
            if (!pendingFinish) pendingFinish = { payload: body() };
            publish({ finishUncertain: false });
            try {
                const { data } = await api.post(path + 'finish/', pendingFinish.payload);
                if (disposed || currentGeneration !== generation) return false;
                accept(data, { replaceLocal: true });
                return true;
            } catch (error) {
                if (disposed || currentGeneration !== generation) return false;
                if (state.attempt?.status === 'completed') return true;
                const code = error?.response?.data?.code;
                if (['deadline_expired', 'attempt_completed'].includes(code)) return reconcileClosed(error);
                const status = error?.response?.status;
                if (status === 400 || status === 401 || status === 409) {
                    pendingFinish = null;
                    publish({ finishing: false, finishUncertain: false,
                        saveStatus: status === 409 ? 'conflict' : 'error',
                        error: errorInfo(error, status === 409 ? 'conflict' : 'validation') });
                } else {
                    publish({ finishing: false, finishUncertain: true, error: errorInfo(error, 'finish') });
                }
                return false;
            }
        })();
        finishFlight = operation;
        try { return await operation; } finally { if (finishFlight === operation) finishFlight = null; }
    }

    function tick(reconcile = true) {
        if (disposed || !state.attempt || state.attempt.status !== 'active') return;
        const seconds = remainingSeconds(state.attempt, clockOffset, now());
        const reached = seconds === 0;
        if (seconds !== state.remainingSeconds || (reached && !state.deadlineReached)) publish({ remainingSeconds: seconds, deadlineReached: state.deadlineReached || reached });
        if (reached && reconcile && !state.error && !readFlight) void read();
    }

    const session = {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        load() {
            // React StrictMode may disconnect/reconnect the same memoized client.
            disposed = false;
            attachmentVersion += 1;
            return read({ initial: true });
        },
        async reload() {
            if (writeFlight) await writeFlight;
            if (finishFlight) await finishFlight;
            if (pendingFinish || state.finishUncertain) return read();
            return read({ discard: true, initial: true });
        },
        save, retrySave: save, flush, finish, retryFinish: finish, tick,
        setAnswer(questionId, choices) {
            if (!canMutate()) return false;
            const found = findQuestion(questionId);
            if (!found || !Array.isArray(choices) || new Set(choices).size !== choices.length
                || choices.some(id => !found.question.choices.some(choice => choice.id === id))
                || (found.section.response_type === 'single' && choices.length > 1)) return false;
            const old = state.answers[questionId] || [];
            if (old.length === choices.length && old.every((id, index) => id === choices[index])) return true;
            changed({ answers: { ...state.answers, [questionId]: [...choices] } });
            return true;
        },
        toggleFlag(questionId) {
            if (!canMutate() || !findQuestion(questionId)) return false;
            const flags = state.flaggedQuestionIds.includes(questionId)
                ? state.flaggedQuestionIds.filter(id => id !== questionId) : [...state.flaggedQuestionIds, questionId];
            changed({ flaggedQuestionIds: flags });
            return true;
        },
        setPosition(sectionId, questionId) {
            if (!canMutate() || findQuestion(questionId)?.section.id !== sectionId) return false;
            if (state.lastQuestionBySection[sectionId] === questionId) return true;
            changed({ lastQuestionBySection: { ...state.lastQuestionBySection, [sectionId]: questionId } });
            return true;
        },
        dispose({ flushPending = false } = {}) {
            listeners.clear();
            const detachedVersion = attachmentVersion;
            const disconnect = () => {
                if (attachmentVersion !== detachedVersion) return;
                disposed = true; generation += 1; readFlight = null;
            };
            // SPA Back can unmount without beforeunload. Try to persist the
            // last edit, but only acknowledged writes are promised on resume.
            if (flushPending && state.hasUnsentChanges && !state.finishing && !pendingFinish
                && state.saveStatus !== 'conflict' && !state.deadlineReached) {
                return flush().finally(disconnect);
            }
            disconnect();
            return Promise.resolve();
        },
    };
    return session;
}
