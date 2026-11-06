import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from './api';
import { useTranslation } from 'react-i18next';
import { getKtQuizCopy } from './ktQuizCopy';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { 
    ChevronLeft, 
    Check,
    ArrowRight, 
    RefreshCcw, 
    HelpCircle,
    EyeOff
} from 'lucide-react';

// Plain text stays escaped; SQL keeps its original spacing and line breaks.
function QuizText({ children }) {
    const isSql = /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|EXPLAIN)\b/i.test(children || '');
    const Tag = isSql ? 'code' : 'span';

    return (
        <Tag className={`block whitespace-pre-wrap [overflow-wrap:anywhere] ${isSql ? 'font-mono! text-[0.9375rem] leading-7' : ''}`}>
            {children}
        </Tag>
    );
}

function QuizPage() {
    const { lessonId } = useParams();
    const { i18n } = useTranslation();
    const ktCopy = getKtQuizCopy(i18n.resolvedLanguage || i18n.language);
    const navigate = useNavigate();
    
    const [searchParams] = useSearchParams();
    const targetQuizId = searchParams.get('quiz_id');

    const [quiz, setQuiz] = useState(null);
    const isKtProfile = quiz?.mode === 'kt_profile';
    const [loading, setLoading] = useState(true);

    const [currentIndex, setCurrentIndex] = useState(0); 
    // selectedAnswers теперь хранит массивы ID: { [questionId]: [choiceId1, choiceId2, ...] }
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [currentResult, setCurrentResult] = useState(null);
    const [submissionStatus, setSubmissionStatus] = useState('idle');
    const submissionRef = useRef(null);
    const questionHeadingRef = useRef(null);
    const resultHeadingRef = useRef(null);
    const pendingQuestionFocusRef = useRef(false);
    
    // Счетчик попыток
    const [attempts, setAttempts] = useState(0);

    const startTimeRef = useRef(Date.now());

    const [cheatWarnings, setCheatWarnings] = useState(0);
    const cheatWarningsRef = useRef(cheatWarnings);
    const selectedAnswersRef = useRef(selectedAnswers);
    
    useEffect(() => { cheatWarningsRef.current = cheatWarnings; }, [cheatWarnings]);
    useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);

    // Загрузка данных и попыток
    useEffect(() => {
        submissionRef.current = null;
        setSubmissionStatus('idle');
        setCurrentResult(null);
        setSelectedAnswers({});
        setCurrentIndex(0);
        const fetchData = async () => {
            setLoading(true);
            try {
                const quizzesRes = await api.get(`quizzes/lesson/${lessonId}/?t=${new Date().getTime()}`);
                const quizList = Array.isArray(quizzesRes.data) ? quizzesRes.data : [quizzesRes.data];
                const validQuizzes = quizList.filter(q => q && q.id).sort((a, b) => b.id - a.id);
                
                if (validQuizzes.length > 0) {
                    const specificQuiz = targetQuizId ? validQuizzes.find(q => String(q.id) === String(targetQuizId)) : validQuizzes[0];
                    const activeQuiz = specificQuiz || validQuizzes[0];
                    setQuiz(activeQuiz);
                    
                    // Загружаем количество попыток из памяти браузера
                    const savedAttempts = parseInt(localStorage.getItem(`quiz_attempts_${activeQuiz.id}`) || '0', 10);
                    setAttempts(savedAttempts);
                }
            } catch (err) {
                console.error("Ошибка загрузки данных:", err);
                toast.error("Не удалось загрузить тест.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        startTimeRef.current = Date.now();
        return () => { submissionRef.current = null; };
    }, [lessonId, targetQuizId]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && !currentResult && quiz && quiz.mode !== 'kt_profile') {
                const currentWarnings = cheatWarningsRef.current + 1;
                setCheatWarnings(currentWarnings);

                if (currentWarnings >= 3) {
                    toast.error("ТЕСТ ЗАВЕРШЕН: Зафиксировано переключение вкладок.", {
                        autoClose: false, theme: "colored"
                    });
                    submitQuiz(true);
                } else {
                    toast.warning(`ПРЕДУПРЕЖДЕНИЕ (${currentWarnings}/3): Не покидайте вкладку с тестом!`, {
                        autoClose: 7000, theme: "colored"
                    });
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [currentResult, quiz]);

    // Native focus reveals the new question/result without animated scrolling.
    useEffect(() => {
        if (isKtProfile && currentResult) resultHeadingRef.current?.focus();
    }, [isKtProfile, currentResult]);

    useEffect(() => {
        if (isKtProfile && pendingQuestionFocusRef.current) {
            pendingQuestionFocusRef.current = false;
            questionHeadingRef.current?.focus();
        }
    }, [isKtProfile, currentIndex]);

    const navigateQuestion = (index) => {
        if (isKtProfile) {
            if (index === currentIndex) questionHeadingRef.current?.focus();
            else pendingQuestionFocusRef.current = true;
        }
        setCurrentIndex(index);
    };

    // Обновлённый handleAnswer: переключает выбор в массиве для конкретного вопроса
    const handleAnswer = (questionId, optionId) => {
        if (submissionRef.current?.quizId === quiz?.id) return;
        setSelectedAnswers(prev => {
            if (quiz?.mode === 'kt_profile' && quiz.questions.find(q => q.id === questionId)?.kt_subject === 'first_subject') {
                return { ...prev, [questionId]: optionId === null ? [] : [optionId] };
            }
            const currentChoices = prev[questionId] || [];
            if (currentChoices.includes(optionId)) {
                // Убираем, если уже выбран
                return { ...prev, [questionId]: currentChoices.filter(id => id !== optionId) };
            } else {
                // Добавляем, если не выбран
                return { ...prev, [questionId]: [...currentChoices, optionId] };
            }
        });
    };

    const submitQuiz = (isForced = false) => {
        if (!quiz) return;
        let submission = submissionRef.current;
        if (submission?.quizId === quiz.id && (submission.inFlight || submission.completed)) return;

        if (submission?.quizId !== quiz.id) {
            const answersToSubmit = isForced ? selectedAnswersRef.current : selectedAnswers;
            // Keep the exact request for a retry if the server response is lost.
            submission = {
                quizId: quiz.id,
                payload: {
                    submission_id: crypto.randomUUID(),
                    answers: Object.entries(answersToSubmit).map(([qId, oIds]) => ({
                        question_id: parseInt(qId),
                        choice_ids: Array.isArray(oIds) ? [...oIds] : [oIds],
                    })),
                    time_spent_seconds: Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)),
                },
                inFlight: false,
                completed: false,
            };
            submissionRef.current = submission;
        }
        submission.inFlight = true;
        setSubmissionStatus('sending');
        api.post(`quizzes/${submission.quizId}/submit/`, submission.payload)
            .then(res => {
                if (submissionRef.current !== submission) return;
                submission.completed = true;
                setSubmissionStatus('idle');
                setCurrentResult(res.data);

                if (quiz.mode === 'kt_profile') {
                    toast.success(ktCopy.saved);
                    return;
                }
                const isPassed = res.data.score >= 70;

                if (isPassed) {
                    confetti({
                        particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999,
                        colors: ['#10B981', '#047857', '#059669'] 
                    });
                    toast.success(`Тест успешно сдан! Результат: ${res.data.score}%`);
                    localStorage.removeItem(`quiz_attempts_${quiz.id}`);
                } else {
                    const newAttempts = attempts + 1;
                    setAttempts(newAttempts);
                    localStorage.setItem(`quiz_attempts_${quiz.id}`, newAttempts);
                    toast.error(`Тест не пройден. Результат: ${res.data.score}%`);
                }
            })
            .catch(err => {
                if (submissionRef.current !== submission) return;
                if (err.response?.status === 400) {
                    // Validation rejected the entire request before any result was saved.
                    submissionRef.current = null;
                    setSubmissionStatus('idle');
                    const serverError = err.response?.data?.error;
                    const validationMessage = typeof serverError === 'string'
                        ? serverError
                        : Array.isArray(serverError) && serverError.every(message => typeof message === 'string')
                            ? serverError.join(' ')
                            : '';
                    toast.error(quiz.mode === 'kt_profile' ? validationMessage || ktCopy.invalid : 'Ответы не приняты. Проверьте выбранные варианты и отправьте снова.');
                } else {
                    setSubmissionStatus('retry');
                    toast.error(quiz.mode === 'kt_profile' ? ktCopy.unavailable : 'Не удалось получить результат. Повторите отправку: выбранные ответы сохранены для повтора.');
                }
                console.error(err);
            })
            .finally(() => { submission.inFlight = false; });
    };

    const restartQuiz = () => {
        submissionRef.current = null;
        setSubmissionStatus('idle');
        setCurrentResult(null);
        setSelectedAnswers({});
        setCurrentIndex(0);
        setCheatWarnings(0);
        startTimeRef.current = Date.now();
    };

    if (loading) return (
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-base-content/70" role="status">
            <span className="loading loading-spinner loading-sm text-blue-600" aria-hidden="true" />
            Загрузка теста…
        </div>
    );

    if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
        <div className="flex min-h-[50vh] items-center justify-center py-8">
            <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-center sm:p-10">
                <HelpCircle size={48} className="text-base-content/20 mx-auto mb-6" />
                <h2 className="mb-2 text-2xl font-semibold text-base-content">Вопросы отсутствуют</h2>
                <button 
                    className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                    onClick={() => navigate(`/lesson/${lessonId}`)}
                >
                    <ChevronLeft size={18} /> Вернуться к уроку
                </button>
            </div>
        </div>
    );

    const questions = quiz.questions;
    const currentQuestion = questions[currentIndex];
    const choices = currentQuestion?.choices || []; 

    // Вопрос считается отвеченным, если выбран хотя бы один вариант
    const isAllAnswered = questions.every(q => (selectedAnswers[q.id] || []).length > 0);
    
    const isPassed = !isKtProfile && currentResult?.score >= 70;
    const showAnswers = isKtProfile ? !!currentResult : isPassed || attempts >= 5; // Показывать ответы если сдал ИЛИ 5 попыток
    const isSingleChoice = isKtProfile && currentQuestion.kt_subject === 'first_subject';
    const currentPoints = currentResult?.grading?.questions?.[currentQuestion.id];
    const explanation = isKtProfile ? currentResult?.explanations?.[currentQuestion.id] : currentQuestion.explanation;
    const answeredCount = questions.filter(q => (selectedAnswers[q.id] || []).length > 0).length;
    const secondaryButtonClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-base-content/70 hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600';
    const primaryButtonClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/50 sm:px-6';

    return (
        <div className="mx-auto max-w-6xl py-2 font-sans text-base-content selection:bg-blue-600/20 sm:py-4">
                <header className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-base-300 pb-4 sm:mb-8 sm:pb-6">
                    <div className="min-w-0">
                        <p className="sr-only">
                            {currentResult ? 'Результат теста' : 'Прохождение теста'}
                        </p>
                        <h1 className="break-words text-xl font-semibold leading-snug sm:text-2xl">{quiz.title || 'Тест'}</h1>
                        {isKtProfile && <p className="mt-2 max-w-[70ch] text-sm leading-6 text-base-content/75">{ktCopy.scope}</p>}
                    </div>
                    <button 
                        onClick={() => navigate(`/lesson/${lessonId}`)} 
                        className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-base-content/65 hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        <ChevronLeft size={18} aria-hidden="true" /> {isKtProfile ? ktCopy.exit : 'Покинуть тест'}
                    </button>
                </header>

            <div className="grid items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
                {/* НАВИГАЦИЯ ВОПРОСОВ */}
                <aside className="min-w-0 border-b border-base-300 pb-5 lg:sticky lg:top-6 lg:border-0 lg:pb-0" aria-label={isKtProfile ? ktCopy.navigation : 'Навигация по тесту'}>
                    <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                        <h2 className="font-semibold">{isKtProfile ? ktCopy.navigation : 'Вопросы'}</h2>
                        <span className="tabular-nums text-base-content/65">
                            {isKtProfile
                                ? currentResult ? `${currentResult.grading.earned_points} / ${currentResult.grading.max_points}` : `${answeredCount} / ${questions.length}`
                                : currentResult ? `Результат: ${currentResult.score}%` : `Отвечено ${answeredCount} из ${questions.length}`}
                            {isKtProfile && <span className="sr-only"> {currentResult ? ktCopy.points : ktCopy.answered}</span>}
                        </span>
                    </div>
                    {!currentResult && (
                        <progress
                            className="mb-4 hidden h-1.5 w-full overflow-hidden rounded-full bg-base-300 text-blue-600 lg:block [&::-webkit-progress-bar]:bg-base-300 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
                            value={answeredCount}
                            max={questions.length}
                            aria-label="Количество отвеченных вопросов"
                        />
                    )}
                    <nav className={`grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5 lg:gap-1.5 ${isKtProfile ? 'max-h-52 overflow-y-auto p-1 lg:max-h-none' : ''}`} aria-label={isKtProfile ? ktCopy.navigation : 'Вопросы теста'}>
                        {questions.map((q, idx) => {
                            const isAnswered = (selectedAnswers[q.id] || []).length > 0;
                            const isActive = idx === currentIndex;
                            
                            let btnClass = "border-base-300 text-base-content/65 bg-base-100 hover:border-blue-500/60";
                            
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-blue-500/10 border-blue-500/40 text-blue-700";
                                if (isActive) btnClass = "bg-blue-600 border-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 ring-offset-base-100 z-10";
                            } else {
                                if (isKtProfile) {
                                    const points = currentResult.grading.questions[q.id];
                                    btnClass = points.earned_points === points.max_points
                                        ? "bg-emerald-700 border-emerald-700 text-white"
                                        : points.earned_points > 0
                                            ? "bg-amber-100 border-amber-600 text-amber-900"
                                            : "bg-red-700 border-red-700 text-white";
                                } else if (isPassed) {
                                    btnClass = "bg-emerald-500 border-emerald-500 text-white";
                                } else if (showAnswers) {
                                    // Проверяем правильность через correct_answers_ids от бэкенда
                                    const correctIds = currentResult.correct_answers_ids?.[q.id] || [];
                                    const userIds = selectedAnswers[q.id] || [];
                                    const isCorrect = correctIds.length > 0 &&
                                        correctIds.every(id => userIds.includes(id)) &&
                                        userIds.every(id => correctIds.includes(id));
                                    btnClass = isCorrect
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : "bg-red-500 border-red-500 text-white";
                                } else {
                                    // Нейтральный цвет, если завалил, но попыток < 5
                                    btnClass = "bg-base-200 border-base-300 text-base-content/65";
                                }
                                if (isActive) btnClass += " ring-2 ring-base-content/50 ring-offset-2 ring-offset-base-100 z-10";
                            }

                            return (
                                <button
                                    key={q.id}
                                    onClick={() => navigateQuestion(idx)}
                                    aria-label={isKtProfile
                                        ? `${ktCopy.question} ${idx + 1}${currentResult ? `: ${currentResult.grading.questions[q.id].earned_points} / ${currentResult.grading.questions[q.id].max_points} ${ktCopy.points}` : isAnswered ? `, ${ktCopy.chosen}` : ''}`
                                        : `Вопрос ${idx + 1}${isAnswered ? ', ответ выбран' : ''}`}
                                    title={isKtProfile && currentResult ? `${currentResult.grading.questions[q.id].earned_points} / ${currentResult.grading.questions[q.id].max_points} ${ktCopy.points}` : undefined}
                                    aria-current={isActive ? 'step' : undefined}
                                    className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${btnClass}`}
                                >
                                    {idx + 1}
                                    {!currentResult && isAnswered && <Check size={10} className="absolute right-1 top-1" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </nav>
                    {!currentResult && (
                        <div className="mt-4 hidden flex-wrap gap-x-4 gap-y-2 text-xs text-base-content/70 lg:flex">
                            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden="true" /> {isKtProfile ? ktCopy.current : 'Текущий'}</span>
                            <span className="flex items-center gap-2"><Check size={13} className="text-blue-700" aria-hidden="true" /> {isKtProfile ? ktCopy.chosen : 'Ответ выбран'}</span>
                        </div>
                    )}
                </aside>

                <div className="min-w-0">
                {isKtProfile && currentResult && (
                    <section className="mb-7 border-b border-base-300 pb-6" aria-labelledby="kt-result-title" aria-live="polite">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 id="kt-result-title" ref={resultHeadingRef} tabIndex={-1} className="text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{ktCopy.summary}</h2>
                            <p className="text-xl font-semibold tabular-nums text-blue-600">{currentResult.grading.earned_points} / {currentResult.grading.max_points} <span className="text-sm font-normal text-base-content/75">{ktCopy.points}</span></p>
                        </div>
                        <dl className="mt-4 space-y-2 text-sm">
                            {['first_subject', 'second_subject'].map(section => <div key={section} className="flex items-baseline justify-between gap-4">
                                <dt>{section === 'first_subject' ? ktCopy.first : ktCopy.second}</dt>
                                <dd className="shrink-0 font-semibold tabular-nums">{currentResult.grading.sections[section].earned_points} / {currentResult.grading.sections[section].max_points}</dd>
                            </div>)}
                        </dl>
                        <p className="mt-3 text-sm text-base-content/75">{ktCopy.review}</p>
                        <button onClick={restartQuiz} className={`${secondaryButtonClass} mt-3 -ml-4`}>
                            <RefreshCcw size={16} aria-hidden="true" /> {ktCopy.restart}
                        </button>
                    </section>
                )}
                {/* ВЕРДИКТ ЕСЛИ ЗАВАЛИЛ И ПОПЫТОК < 5 */}
                {currentResult && !isPassed && !showAnswers && (
                    <div className="mb-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 sm:p-6">
                        <EyeOff size={24} className="mb-3 text-amber-600" aria-hidden="true" />
                        <h3 className="mb-2 text-lg font-semibold">Вы набрали {currentResult.score}%. Нужно минимум 70%.</h3>
                        <p className="mb-4 text-sm leading-relaxed text-base-content/75">
                            Правильные ответы скрыты, чтобы вы могли подумать сами. <br/>
                            Они откроются после 5 попыток. (Использовано попыток: {attempts}/5)
                        </p>
                        <button onClick={restartQuiz} className={primaryButtonClass}>
                            <RefreshCcw size={16} aria-hidden="true" /> Попробовать снова
                        </button>
                    </div>
                )}

                {/* ТЕЛО ВОПРОСА */}
                <section aria-labelledby="quiz-question">
                    <div>
                        <div className="mb-7 sm:mb-8">
                            <h2 id="quiz-question" ref={questionHeadingRef} tabIndex={isKtProfile ? -1 : undefined} className="mb-4 text-sm font-semibold tabular-nums text-blue-600">{isKtProfile ? ktCopy.question : 'Вопрос'} {currentIndex + 1} {isKtProfile ? ktCopy.of : 'из'} {questions.length}</h2>
                            {isKtProfile && <p className="mb-3 text-sm font-semibold">{isSingleChoice ? ktCopy.first : ktCopy.second}</p>}
                            <div id="quiz-question-text" className="max-w-[70ch] text-lg leading-8 text-base-content sm:text-xl sm:leading-8">
                                <QuizText>{currentQuestion?.question || currentQuestion?.text}</QuizText>
                            </div>
                        </div>

                        {/* ВАРИАНТЫ ОТВЕТОВ */}
                        <fieldset className="grid min-w-0 gap-3" aria-describedby="quiz-question-text">
                            <legend className="mb-3 text-sm font-semibold text-base-content/70">{isKtProfile ? ktCopy.options : 'Варианты ответа'}</legend>
                            {isKtProfile && <p className="mb-1 text-sm leading-6 text-base-content/75">{isSingleChoice ? ktCopy.single : ktCopy.multiple}</p>}
                            {isKtProfile && currentPoints && <p className="mb-1 text-sm font-semibold tabular-nums">{ktCopy.questionPoints}: {currentPoints.earned_points} / {currentPoints.max_points} · {currentPoints.earned_points === currentPoints.max_points ? ktCopy.full : currentPoints.earned_points > 0 ? ktCopy.partial : ktCopy.zero}</p>}
                            {choices.map(choice => {
                                // Массив выбранных ID для текущего вопроса
                                const selectedIds = selectedAnswers[currentQuestion.id] || [];
                                const isSelected = selectedIds.includes(choice.id);

                                let labelClass = isSelected
                                    ? 'border-blue-600 bg-blue-500/10 ring-1 ring-blue-600'
                                    : 'border-base-300 bg-base-100 hover:border-blue-500/60 hover:bg-base-200/50';

                                if (currentResult) {
                                    if (isPassed || showAnswers) {
                                        // correct_answers_ids: { [questionId]: [choiceId1, choiceId2, ...] }
                                        const correctIds = currentResult.correct_answers_ids?.[currentQuestion.id] || [];
                                        const isCorrect = correctIds.includes(choice.id);

                                        if (isCorrect) {
                                            labelClass = 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500';
                                        } else if (isSelected && !isCorrect) {
                                            labelClass = 'border-red-500 bg-red-500/10 ring-1 ring-red-500';
                                        } else {
                                            labelClass = 'border-base-300 text-base-content/60';
                                        }
                                    } else {
                                        // Провалил, попыток < 5 — скрываем правильность
                                        labelClass = isSelected
                                            ? 'border-base-content/35 bg-base-200 text-base-content/75 cursor-not-allowed'
                                            : 'border-base-300 text-base-content/60 cursor-not-allowed';
                                    }
                                }

                                return (
                                    <label
                                        key={choice.id}
                                        className={`flex min-h-16 items-start gap-3 rounded-xl border p-4 motion-safe:transition-colors motion-safe:duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-blue-700 sm:gap-4 sm:px-5 ${currentResult || submissionStatus !== 'idle' ? 'cursor-not-allowed' : 'cursor-pointer'} ${labelClass}`}
                                    >
                                        <span className="relative mt-0.5 flex shrink-0 items-center justify-center">
                                            <input 
                                                type={isSingleChoice ? 'radio' : 'checkbox'}
                                                name={`question-${currentQuestion.id}`}
                                                className={`h-5 w-5 appearance-none border-2 border-base-content/50 checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-none disabled:cursor-not-allowed ${isSingleChoice ? 'rounded-full' : 'rounded'}`}
                                                checked={isSelected}
                                                disabled={!!currentResult || submissionStatus !== 'idle'}
                                                onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                            />
                                            {isSelected && (
                                                <Check size={14} strokeWidth={3} className="pointer-events-none absolute text-white" aria-hidden="true" />
                                            )}
                                        </span>
                                        <span className="min-w-0 text-base leading-7">
                                            <QuizText>{choice.text}</QuizText>
                                            {isKtProfile && currentResult && (isSelected || currentResult.correct_answers_ids?.[currentQuestion.id]?.includes(choice.id)) && <span className="mt-1 block text-sm font-medium">
                                                {[isSelected ? ktCopy.selected : null, currentResult.correct_answers_ids?.[currentQuestion.id]?.includes(choice.id) ? ktCopy.correct : null].filter(Boolean).join(' · ')}
                                            </span>}
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>
                        {isSingleChoice && !currentResult && (selectedAnswers[currentQuestion.id] || []).length > 0 && (
                            <button className={`${secondaryButtonClass} mt-2 -ml-4`} disabled={submissionStatus !== 'idle'} onClick={() => handleAnswer(currentQuestion.id, null)}>{ktCopy.clear}</button>
                        )}

                        {/* ОБЪЯСНЕНИЕ (ПОКАЗЫВАЕТСЯ ТОЛЬКО ЕСЛИ СДАЛ ИЛИ 5 ПОПЫТОК) */}
                        {currentResult && showAnswers && (
                            <div className={`mt-6 rounded-xl border p-4 sm:p-5 ${isPassed ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-base-200 border-base-300'}`}>
                                <h2 className="mb-2 text-sm font-semibold">{isKtProfile ? ktCopy.explanation : 'Объяснение:'}</h2>
                                <div className="text-base leading-7 text-base-content/80"><QuizText>{explanation || (isKtProfile ? ktCopy.noExplanation : 'Объяснение для этого вопроса отсутствует.')}</QuizText></div>
                            </div>
                        )}

                        {submissionStatus === 'retry' && (
                            <p id="quiz-retry-hint" className="mt-5 text-sm leading-relaxed text-base-content/75" role="status">
                                {isKtProfile ? ktCopy.retryHint : 'Результат пока не получен. Выбранные ответы зафиксированы; повторная отправка не создаст вторую попытку.'}
                            </p>
                        )}
                        {/* КНОПКИ УПРАВЛЕНИЯ */}
                        {!currentResult ? (
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-5 sm:mt-8">
                                <button
                                    className={`${secondaryButtonClass} ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => navigateQuestion(currentIndex - 1)}
                                >
                                    <ChevronLeft size={16} aria-hidden="true" /> {isKtProfile ? ktCopy.back : 'Назад'}
                                </button>
                                {currentIndex < questions.length - 1 ? (
                                    <button
                                        className={primaryButtonClass}
                                        onClick={() => navigateQuestion(currentIndex + 1)}
                                    >
                                        {isKtProfile ? ktCopy.next : 'Далее'} <ArrowRight size={16} aria-hidden="true" />
                                    </button>
                                ) : (
                                    <button 
                                        className={primaryButtonClass}
                                        disabled={submissionStatus === 'sending' || (!isKtProfile && !isAllAnswered && submissionStatus !== 'retry')}
                                        aria-describedby={submissionStatus === 'retry' ? 'quiz-retry-hint' : !isAllAnswered ? 'quiz-submit-hint' : undefined}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        {isKtProfile
                                            ? submissionStatus === 'sending' ? ktCopy.saving : submissionStatus === 'retry' ? ktCopy.retry : ktCopy.finish
                                            : submissionStatus === 'sending' ? 'Сохранение…' : submissionStatus === 'retry' ? 'Повторить отправку' : 'Завершить тест'}
                                    </button>
                                )}
                                {currentIndex === questions.length - 1 && !isAllAnswered && submissionStatus === 'idle' && (
                                    <p id="quiz-submit-hint" className="mt-2 basis-full text-sm leading-relaxed text-base-content/65">
                                        {isKtProfile ? ktCopy.skipped : 'Для завершения выберите ответы во всех вопросах.'}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-5 sm:mt-8">
                                <button
                                    className={`${secondaryButtonClass} ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => navigateQuestion(currentIndex - 1)}
                                >
                                    <ChevronLeft size={16} aria-hidden="true" /> {isKtProfile ? ktCopy.back : 'Назад'}
                                </button>
                                {currentIndex < questions.length - 1 ? (
                                    <button
                                        className={primaryButtonClass}
                                        onClick={() => navigateQuestion(currentIndex + 1)}
                                    >
                                        {isKtProfile ? ktCopy.nextQuestion : 'Следующий вопрос'}
                                    </button>
                                ) : (
                                    <div className="ml-auto flex flex-wrap justify-end gap-2">
                                        {!isPassed && showAnswers && (
                                            <button onClick={restartQuiz} className={secondaryButtonClass}>
                                                {isKtProfile ? ktCopy.restart : 'Пройти еще раз'}
                                            </button>
                                        )}
                                        <button
                                            className={primaryButtonClass}
                                            onClick={() => navigate(`/lesson/${lessonId}`)}
                                        >
                                            {isKtProfile ? ktCopy.lesson : 'Вернуться к уроку'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;
