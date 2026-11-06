import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import { DemoNotice, formatDate } from './ExamPrimitives';

export default function ExamResult({ attempt, result, c, language }) {
  const grading = result.grading;
  return <div className="exam-page exam-result">
    <div className="exam-result-heading"><span className="exam-recorded"><Check size={17} aria-hidden="true" />{c.recorded}</span><h1>{c.result}</h1><p>{attempt.configuration.title}</p><p className="exam-muted">{c.completed}: {formatDate(attempt.completed_at, language)}</p></div>
    <DemoNotice config={attempt.configuration} c={c} />
    {attempt.completion_reason === 'deadline' && <p className="exam-notice">{c.deadlineResult}</p>}
    <section className="exam-result-summary" aria-labelledby="exam-total-heading"><div><h2 id="exam-total-heading">{c.total}</h2><p className="exam-muted">{c.resultNotice}</p></div><p className="exam-result-points"><strong>{grading.earned_points}</strong><span> / {grading.max_points} {c.points}</span></p></section>
    <section className="exam-result-sections" aria-labelledby="exam-sections-heading"><h2 id="exam-sections-heading">{c.sectionResult}</h2>{attempt.configuration.sections.map(section => {
      const points = grading.sections[section.id];
      return <div key={section.id}><div><h3>{section.title}</h3><p>{section.question_count} {c.questions}</p></div><p><strong>{points.earned_points}</strong> / {points.max_points} {c.points}</p></div>;
    })}</section>
    <div className="exam-result-actions"><Link className="exam-button exam-button-primary" to={'/exams/attempts/' + attempt.id + '/review'}>{c.viewReview}<ArrowRight size={18} aria-hidden="true" /></Link><Link className="exam-button" to={'/exams?configuration=' + encodeURIComponent(attempt.configuration.id)}><RotateCcw size={17} aria-hidden="true" />{c.newExam}</Link><Link className="exam-button exam-button-quiet" to="/courses">{c.preparation}</Link></div>
  </div>;
}
