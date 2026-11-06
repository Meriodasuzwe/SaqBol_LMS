import { useEffect, useMemo, useSyncExternalStore } from 'react';
import defaultApi from '../api';
import { AUTOSAVE_DELAY, createExamSession } from './examSession';

export default function useExamSession(attemptId, { api = defaultApi } = {}) {
    const session = useMemo(() => createExamSession({ api, attemptId }), [api, attemptId]);
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

    useEffect(() => {
        void session.load();
        const interval = window.setInterval(() => session.tick(), 1000);
        return () => { window.clearInterval(interval); void session.dispose({ flushPending: true }); };
    }, [session]);

    useEffect(() => {
        if (!state.editable || state.saveStatus !== 'unsaved') return undefined;
        const timeout = window.setTimeout(() => { void session.save(); }, AUTOSAVE_DELAY);
        return () => window.clearTimeout(timeout);
    }, [session, state.answers, state.flaggedQuestionIds, state.lastQuestionBySection, state.editable, state.saveStatus]);

    useEffect(() => {
        if (!state.hasUnsentChanges) return undefined;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [state.hasUnsentChanges]);

    return { ...state, ...session };
}
