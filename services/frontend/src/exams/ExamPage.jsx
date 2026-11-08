import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getExamCopy } from './examCopy';
import ExamSetup from './ExamSetup';
import ExamAttempt from './ExamAttempt';
import './exams.css';

export default function ExamPage() {
  const { attemptId } = useParams();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || 'ru';
  const c = getExamCopy(language);
  const mode = pathname.endsWith('/review') ? 'review' : pathname.endsWith('/result') ? 'result' : 'active';
  return attemptId ? <ExamAttempt key={attemptId + mode} attemptId={attemptId} mode={mode} c={c} language={language} /> : <ExamSetup c={c} language={language} />;
}
