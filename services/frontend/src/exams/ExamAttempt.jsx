import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Flag, List, LogOut, RefreshCw } from 'lucide-react';
import api from '../api';
import BugReportWidget from '../BugReportWidget';
import useExamSession from './useExamSession';
import { formatRemainingTime, sectionProgress } from './examSession';
import { DemoNotice, ExamDialog, ExamLoading, ExamText } from './ExamPrimitives';
import ExamNavigation from './ExamNavigation';
import ExamResult from './ExamResult';

function SessionError({ session, c, reload, hideAction = false }) {
  if (!session.error && !session.finishUncertain && !session.deadlineReached) return null;
  if (session.attempt?.status === 'completed') return null;
  const conflict = session.saveStatus === 'conflict';
  const deadline = session.deadlineReached;
  const finishing = session.finishUncertain;
  const message = deadline ? c.expired : conflict ? c.conflict : finishing ? c.finishError : session.error?.kind === 'auth' ? c.auth : session.error?.kind === 'validation' ? c.validation : c.saveError;
  return <div className="exam-notice is-error" role="alert"><div><strong>{message}</strong><p>{deadline ? c.expiryHint : conflict ? c.conflictHint : finishing ? c.finishRetryHint : c.saveHint}</p></div>{!hideAction && <button type="button" className="exam-button" disabled={session.finishing || session.saveStatus === 'saving'} onClick={deadline ? session.load : conflict ? reload : finishing ? session.retryFinish : session.retrySave}>{deadline ? c.checkStatus : conflict ? c.reload : finishing ? c.finishRetry : c.saveRetry}</button>}</div>;
}

export default function ExamAttempt({ attemptId, mode, c, language }) {
  const session = useExamSession(attemptId);
  const { attempt } = session;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [selectedSection, setSelectedSection] = useState(params.get('section'));
  const [reviewPositions, setReviewPositions] = useState({});
  const [viewData, setViewData] = useState(null);
  const [viewError, setViewError] = useState(false);
  const [reloadView, setReloadView] = useState(0);
  const [modal, setModal] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const leaveTo = useRef('/exams');
  const leaveAction = useRef(null);
  const heading = useRef(null);
  const focusQuestion = useRef(false);
  const isReview = mode === 'review';

  useEffect(() => {
    if (!attempt) return;
    if (mode === 'active' && attempt.status === 'completed') navigate('/exams/attempts/' + attemptId + '/result', { replace: true });
    if (mode !== 'active' && attempt.status === 'active') navigate('/exams/attempts/' + attemptId, { replace: true });
  }, [attempt?.status, mode, attemptId, navigate]);

  useEffect(() => {
    if (mode === 'active' || attempt?.status !== 'completed') return;
    let live = true; setViewData(null); setViewError(false);
    api.get('exams/attempts/' + attemptId + '/' + mode + '/').then(({ data }) => { if (live) setViewData(data); }).catch(() => { if (live) setViewError(true); });
    return () => { live = false; };
  }, [attemptId, attempt?.status, mode, reloadView]);

  // BrowserRouter has no data-router blocker. Protect ordinary in-app links;
  // beforeunload and best-effort cleanup are provided by the session hook.
  useEffect(() => {
    if (attempt?.status !== 'active') return;
    const guard = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === location.pathname) return;
      event.preventDefault(); event.stopPropagation();
      leaveAction.current = null;
      leaveTo.current = url.pathname + url.search + url.hash;
      setModal('exit');
    };
    const logout = event => {
      if (typeof event.detail?.proceed !== 'function') return;
      event.preventDefault(); leaveAction.current = event.detail.proceed;
      leaveTo.current = '/login'; setModal('exit');
    };
    document.addEventListener('click', guard, true);
    window.addEventListener('saqbol:before-logout', logout);
    return () => { document.removeEventListener('click', guard, true); window.removeEventListener('saqbol:before-logout', logout); };
  }, [attempt?.status, location.pathname]);

  const sections = isReview && viewData ? viewData.sections : attempt?.sections || [];
  const section = sections.find(item => item.id === selectedSection) || sections[0];
  const positions = isReview ? { ...session.lastQuestionBySection, ...reviewPositions } : session.lastQuestionBySection;
  const question = section?.questions.find(item => item.id === positions[section.id]) || section?.questions[0];
  useEffect(() => { if (focusQuestion.current && question) { heading.current?.focus({ preventScroll: true }); heading.current?.closest('.exam-question-area')?.scrollIntoView({ block: 'start' }); focusQuestion.current = false; } }, [question?.id]);
  const selectQuestion = id => {
    focusQuestion.current = true;
    if (isReview) setReviewPositions(previous => ({ ...previous, [section.id]: id }));
    else session.setPosition(section.id, id);
    setModal(null);
  };
  const selectSection = id => {
    focusQuestion.current = true; setSelectedSection(id);
    setParams({ section: id }, { replace: true }); setModal(null);
  };
  const leave = async () => {
    if (leaving || session.finishUncertain || session.finishing) return;
    setLeaving(true);
    const saved = await session.flush();
    setLeaving(false);
    if (saved) { leaveAction.current?.(); navigate(leaveTo.current); }
  };
  const finish = () => { if (!session.finishing) void (session.finishUncertain ? session.retryFinish() : session.finish()); };

  if (session.loading) return <div className="exam-page"><ExamLoading label={c.load} /></div>;
  if (!attempt) return <div className="exam-page"><div className="exam-notice is-error" role="alert"><p>{session.error?.kind === 'auth' ? c.auth : c.loadError}</p><button className="exam-button" onClick={session.load}>{c.retry}</button><Link className="exam-button exam-button-quiet" to="/exams">{c.title}</Link></div></div>;
  if (mode !== 'active' && !viewData) return <div className="exam-page">{viewError ? <div className="exam-notice is-error" role="alert"><p>{c.loadError}</p><button className="exam-button" onClick={() => setReloadView(value => value + 1)}>{c.retry}</button></div> : <ExamLoading label={isReview ? c.reviewLoading : c.load} />}</div>;
  if (mode === 'result') return <ExamResult attempt={attempt} result={viewData.result} c={c} language={language} />;
  if (!section || !question) return <div className="exam-page"><p className="exam-notice">{c.loadError}</p></div>;
  const selected = isReview ? question.selected_choice_ids : session.answers[question.id] || [];
  const correct = isReview ? question.correct_choice_ids : [];
  const questionIndex = section.questions.findIndex(item => item.id === question.id);
  const sectionIndex = sections.findIndex(item => item.id === section.id);
  const lastQuestion = questionIndex === section.questions.length - 1;
  const lastSection = sectionIndex === sections.length - 1;
  const answered = sectionProgress(section, session.answers);
  const saveNames = { saved: c.saved, unsaved: c.unsaved, saving: c.saving, error: c.saveError, conflict: c.conflict };
  const currentFlag = session.flaggedQuestionIds.includes(question.id);
  const nav = <ExamNavigation sections={sections} activeSection={section} questionId={question.id} answers={session.answers} flags={session.flaggedQuestionIds} review={isReview} onSection={selectSection} onQuestion={selectQuestion} c={c} />;
  const next = () => {
    if (!lastQuestion) selectQuestion(section.questions[questionIndex + 1].id);
    else if (!lastSection) selectSection(sections[sectionIndex + 1].id);
    else if (!isReview) setModal('finish');
  };
  const toggleChoice = id => session.setAnswer(question.id, section.response_type === 'single' ? [id] : selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  const modalTitle = modal === 'navigation' ? c.subjects : modal === 'finish' ? c.finishTitle : modal === 'reload' ? c.reloadTitle : c.exitTitle;
  return <div className="exam-page exam-workspace">
    <header className="exam-toolbar"><div className="exam-toolbar-title"><strong>{isReview ? c.review : attempt.configuration.program.code + ' · ' + (attempt.configuration.format === 'profile' ? c.profile : c.scientific)}</strong><span>{isReview ? attempt.configuration.title : section.title}</span></div>
      {!isReview && <><div className={'exam-clock ' + (session.remainingSeconds !== null && session.remainingSeconds <= 300 ? 'is-low' : '')} aria-label={c.remaining}><Clock3 size={18} aria-hidden="true" /><span role="timer" aria-live="off">{session.remainingSeconds === null ? c.noTimer : formatRemainingTime(session.remainingSeconds)}</span></div><p className={'exam-save-status status-' + session.saveStatus} role="status" aria-live="polite">{session.saveStatus === 'saved' ? <Check size={16} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}{saveNames[session.saveStatus]}</p></>}
      {isReview ? <Link className="exam-button" to={'/exams/attempts/' + attemptId + '/result'}><ArrowLeft size={17} aria-hidden="true" />{c.backResult}</Link> : <button className="exam-button exam-button-primary" disabled={session.deadlineReached || session.finishing} onClick={() => setModal('finish')}>{c.finish}</button>}
    </header>
    <DemoNotice config={attempt.configuration} c={c} />
    {!isReview && <SessionError session={session} c={c} reload={() => setModal('reload')} />}
    <div className="exam-mobile-navigation"><button className="exam-button" onClick={() => setModal('navigation')}><List size={18} aria-hidden="true" />{c.subjects}</button><span>{c.question} {question.number} {c.of} {section.questions.length}</span></div>
    <div className="exam-columns"><aside className="exam-desktop-navigation">{nav}{!isReview && <button className="exam-button exam-button-quiet exam-exit" onClick={() => { leaveAction.current = null; leaveTo.current = '/exams'; setModal('exit'); }}><LogOut size={17} aria-hidden="true" />{c.exit}</button>}</aside>
      <div className="exam-question-area"><div className="exam-section-heading"><h1>{section.title}</h1><p>{c.answeredLabel}: {answered.answered} {c.of} {answered.total}</p></div>
        <section className="exam-question" aria-labelledby="exam-question-heading"><div className="exam-question-top"><h2 id="exam-question-heading" ref={heading} tabIndex={-1}>{c.question} {question.number} {c.of} {section.questions.length}</h2>{!isReview && <button className={'exam-button exam-button-quiet exam-flag ' + (currentFlag ? 'is-flagged' : '')} disabled={!session.editable} aria-pressed={currentFlag} onClick={() => session.toggleFlag(question.id)}><Flag size={16} aria-hidden="true" />{currentFlag ? c.unflag : c.flag}</button>}</div>
          <div id="exam-question-text"><ExamText text={question.text} /></div>
          <fieldset className="exam-options" disabled={!isReview && !session.editable} aria-describedby="exam-question-text"><legend>{isReview ? c.reviewOptions : section.response_type === 'single' ? c.single : c.multiple}</legend>{question.choices.map((choice, index) => {
            const chosen = selected.includes(choice.id);
            const right = correct.includes(choice.id);
            const state = isReview ? right ? 'is-right' : chosen ? 'is-wrong' : '' : chosen ? 'is-selected' : '';
            return <label key={choice.id} className={'exam-option ' + state}><input type={section.response_type === 'single' ? 'radio' : 'checkbox'} name={'question-' + question.id} value={choice.id} checked={chosen} disabled={isReview} onChange={() => toggleChoice(choice.id)} /><span className="exam-option-letter">{String.fromCharCode(65 + index)}</span><span className="exam-option-body"><ExamText text={choice.text} className="exam-option-text" />{isReview && (chosen || right) && <span className="exam-answer-tags">{chosen && <span>{c.selected}</span>}{right && <span><Check size={13} aria-hidden="true" />{c.rightOption}</span>}</span>}</span></label>;
          })}</fieldset>
          {!isReview ? <div className="exam-question-tools"><button className="exam-button exam-button-quiet" disabled={!session.editable || !selected.length} onClick={() => session.setAnswer(question.id, [])}>{c.clear}</button><BugReportWidget inline context={{ attempt_id: attemptId, section_id: section.id, question_id: question.id, path: location.pathname }} /></div> : <div className="exam-review-feedback"><div className={'exam-question-score state-' + question.answer_state}><strong>{question.answer_state === 'unanswered' ? c.unanswered : question.answer_state === 'correct' ? c.correct : question.answer_state === 'partial' ? c.partial : c.incorrect}</strong><span>{c.questionPoints}: {question.earned_points} / {question.max_points}</span></div><h3>{c.explanation}</h3><ExamText text={question.explanation || c.noExplanation} className="exam-explanation" /><BugReportWidget inline context={{ attempt_id: attemptId, section_id: section.id, question_id: question.id, path: location.pathname }} /></div>}
        </section>
        <nav className="exam-question-actions" aria-label={c.subjects}><button className="exam-button" disabled={questionIndex === 0 || (!isReview && !session.editable)} onClick={() => selectQuestion(section.questions[questionIndex - 1].id)}><ArrowLeft size={17} aria-hidden="true" /><span>{c.previous}</span></button>{isReview && lastQuestion && lastSection ? <Link className="exam-button exam-button-primary" to={'/exams/attempts/' + attemptId + '/result'}>{c.backResult}<ArrowRight size={17} aria-hidden="true" /></Link> : <button className="exam-button exam-button-primary" disabled={!isReview && !session.editable} onClick={next}><span>{!lastQuestion ? c.next : !lastSection ? c.nextSubject : c.toFinish}</span><ArrowRight size={17} aria-hidden="true" /></button>}</nav>
        {!isReview && <button className="exam-button exam-button-quiet exam-mobile-exit" onClick={() => { leaveAction.current = null; leaveTo.current = '/exams'; setModal('exit'); }}><LogOut size={17} aria-hidden="true" />{c.exit}</button>}
      </div>
    </div>
    <ExamDialog open={modal !== null} title={modalTitle} closeLabel={c.close} onClose={() => setModal(null)} locked={leaving || session.finishing} className={modal === 'navigation' ? 'exam-nav-dialog' : ''}>
      {modal === 'navigation' ? nav : modal === 'finish' ? <><p>{c.finishHint}</p><div className="exam-finish-overview">{sections.map(item => { const progress = sectionProgress(item, session.answers); const marked = item.questions.filter(q => session.flaggedQuestionIds.includes(q.id)).length; return <div key={item.id}><h3>{item.title}</h3><dl><div><dt>{c.answeredLabel}</dt><dd>{progress.answered} / {progress.total}</dd></div><div><dt>{c.skipped}</dt><dd>{progress.unanswered}</dd></div><div><dt>{c.marked}</dt><dd>{marked}</dd></div></dl></div>; })}</div><SessionError session={session} c={c} hideAction={session.finishUncertain} reload={() => setModal('reload')} /><div className="exam-dialog-actions"><button className="exam-button" disabled={session.finishing} onClick={() => setModal(null)}>{c.backQuestions}</button><button className="exam-button exam-button-primary" disabled={session.finishing || session.deadlineReached || session.saveStatus === 'conflict'} onClick={finish}>{session.finishing ? c.submitting : session.finishUncertain ? c.finishRetry : c.submit}</button></div></> : modal === 'reload' ? <><p>{c.reloadHint}</p><div className="exam-dialog-actions"><button className="exam-button" onClick={() => setModal(null)}>{c.cancel}</button><button className="exam-button exam-button-primary" onClick={async () => { if (await session.reload()) setModal(null); }}>{c.reload}</button></div></> : <><p>{c.exitHint}</p>{attempt.deadline && <p>{c.exitTimer}</p>}<SessionError session={session} c={c} reload={() => setModal('reload')} /><div className="exam-dialog-actions"><button className="exam-button" disabled={leaving} onClick={() => setModal(null)}>{c.stay}</button><button className="exam-button exam-button-primary" disabled={leaving || session.finishUncertain || session.finishing || session.saveStatus === 'conflict'} onClick={leave}>{leaving ? c.savingExit : c.leave}</button></div></>}
    </ExamDialog>
  </div>;
}
