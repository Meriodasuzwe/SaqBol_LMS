import { Flag, Check } from 'lucide-react';
import { questionState, sectionProgress } from './examSession';

export default function ExamNavigation({ sections, activeSection, questionId, answers, flags, review, onSection, onQuestion, c }) {
  const total = sections.reduce((sum, section) => sum + sectionProgress(section, answers).answered, 0);
  const count = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const names = { answered: c.chosen, unanswered: c.unanswered, correct: c.correct, partial: c.partial, incorrect: c.incorrect };
  return <div className="exam-navigation">
    <h2>{c.subjects}</h2>
    <nav className="exam-subjects" aria-label={c.subjects}>{sections.map(section => {
      const progress = sectionProgress(section, answers);
      return <button key={section.id} type="button" aria-current={section.id === activeSection.id ? 'true' : undefined} className={'exam-subject ' + (section.id === activeSection.id ? 'is-active' : '')} onClick={() => onSection(section.id)}><strong>{section.title}</strong><span>{c.answeredLabel}: {progress.answered} / {progress.total}</span></button>;
    })}</nav>
    <nav className="exam-question-map" aria-label={activeSection.title}>{activeSection.questions.map(question => {
      const state = questionState(question, answers, { review });
      const flagged = flags.includes(question.id);
      return <button type="button" key={question.id} className={'exam-map-button state-' + state + (questionId === question.id ? ' is-current' : '')} aria-current={questionId === question.id ? 'step' : undefined} aria-label={c.question + ' ' + question.number + ', ' + names[state] + (flagged ? ', ' + c.flagged : '')} onClick={() => onQuestion(question.id)}>{question.number}{flagged && <Flag size={11} className="exam-map-flag" aria-hidden="true" />}{state === 'answered' && <Check size={10} className="exam-map-check" aria-hidden="true" />}</button>;
    })}</nav>
    <div className="exam-map-key">{(review ? ['unanswered','correct','partial','incorrect'] : ['unanswered','answered']).map(state => <span key={state}><i className={'state-' + state} aria-hidden="true" />{names[state]}</span>)}<span><i className="is-current" aria-hidden="true" />{c.current}</span><span><Flag size={13} aria-hidden="true" />{c.flagged}</span></div>
    <p className="exam-total-answered">{c.totalAnswered}<strong>{total} / {count}</strong></p>
  </div>;
}
