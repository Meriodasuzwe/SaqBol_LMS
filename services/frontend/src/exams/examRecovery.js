// Only answer identifiers and frozen write requests are kept, never question content.
export function recoveryKey(owner, attemptId) {
    return 'saqbol.exam.answers.v1.' + owner + '.' + encodeURIComponent(attemptId);
}

export function validateRecovery(value, attempt) {
    const integer = n => Number.isSafeInteger(n) && n >= 0;
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const unique = list => Array.isArray(list) && new Set(list).size === list.length;
    const questions = new Map(attempt.sections.flatMap(section => section.questions.map(question => [question.id, { section, question }])));
    function choices(id, selected) {
        const item = questions.get(id);
        return item && unique(selected) && selected.every(choice => item.question.choices.some(option => option.id === choice))
            && (item.section.response_type !== 'single' || selected.length <= 1);
    }
    function validState(answers, flags, positions) {
        return object(answers) && Object.keys(answers).length === questions.size
            && [...questions.keys()].every(id => Object.hasOwn(answers, id) && choices(id, answers[id]))
            && unique(flags) && flags.every(id => questions.has(id))
            && object(positions) && Object.entries(positions).every(([section, id]) => questions.get(id)?.section.id === section);
    }
    function payload(body) {
        if (!object(body) || Object.keys(body).sort().join(',') !== 'answers,flagged_question_ids,last_question_by_section,request_id,revision'
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.request_id)
            || !integer(body.revision) || !Array.isArray(body.answers)
            || !unique(body.answers.map(answer => answer?.question_id))) return false;
        return validState(Object.fromEntries(body.answers.map(answer => [answer.question_id, answer.choice_ids])),
            body.flagged_question_ids, body.last_question_by_section);
    }
    return object(value) && value.schema === 1 && value.attemptId === String(attempt.id)
        && integer(value.revision) && integer(value.localVersion) && integer(value.acknowledgedVersion)
        && value.localVersion >= value.acknowledgedVersion
        && (value.localVersion > value.acknowledgedVersion || Boolean(value.pendingWrite || value.pendingFinish))
        && validState(value.answers, value.flags, value.positions)
        && (!value.pendingWrite || (integer(value.pendingWrite.version)
            && value.pendingWrite.version <= value.localVersion && payload(value.pendingWrite.payload)))
        && (!value.pendingFinish || payload(value.pendingFinish.payload));
}

export const browserExamStorage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
};
