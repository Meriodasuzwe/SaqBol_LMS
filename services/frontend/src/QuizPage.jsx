import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from './api';
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
    const navigate = useNavigate();
    
    const [searchParams] = useSearchParams();
    const targetQuizId = searchParams.get('quiz_id');

    const [quiz, setQuiz] = useState(null); 
    const [loading, setLoading] = useState(true);

    const [currentIndex, setCurrentIndex] = useState(0); 
    // selectedAnswers теперь хранит массивы ID: { [questionId]: [choiceId1, choiceId2, ...] }
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [currentResult, setCurrentResult] = useState(null); 
    
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
    }, [lessonId, targetQuizId]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && !currentResult && quiz) {
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

    // Обновлённый handleAnswer: переключает выбор в массиве для конкретного вопроса
    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => {
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

    const submitAnalytics = async (quizData, resultData, answersMap) => {
    try {
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        const questions = quizData.questions || [];
        let correctCount = 0;

        const answersPayload = questions.map(q => {
            const choiceIds = answersMap[q.id] || [];
            // Аналитика ждёт одно число — берём первый выбранный вариант
            const firstChoiceId = choiceIds[0] || null;

            // Для is_correct проверяем через correct_answers_ids из результата
            const correctIds = resultData.correct_answers_ids?.[q.id] || [];
            const isCorrect = correctIds.length > 0 &&
                choiceIds.length > 0 &&
                choiceIds.every(id => correctIds.includes(id)) &&
                correctIds.every(id => choiceIds.includes(id));

            if (isCorrect) correctCount++;

            return {
                question_id: q.id,
                selected_choice_id: firstChoiceId,  // аналитика ждёт одно число
                is_correct: isCorrect,
            };
        });

        await api.post('analytics/quiz-attempt/', {
            quiz_id: quizData.id,
            result_id: resultData?.id || null,
            score: resultData.score,
            total_questions: questions.length,
            correct_answers: correctCount,
            time_spent_seconds: timeSpent,
            answers: answersPayload,
        });
    } catch (err) {
        console.warn('Analytics submit failed:', err);
    }
};

    const submitQuiz = (isForced = false) => {
        if (!quiz) return;
        
        const answersToSubmit = isForced ? selectedAnswersRef.current : selectedAnswers;

        // Отправляем массив choice_ids для каждого вопроса
        const answers = Object.entries(answersToSubmit).map(([qId, oIds]) => ({
            question_id: parseInt(qId),
            choice_ids: Array.isArray(oIds) ? oIds : [oIds] // на случай старых данных
        }));
        
        api.post(`quizzes/${quiz.id}/submit/`, { answers })
            .then(res => {
                setCurrentResult(res.data);
                submitAnalytics(quiz, res.data, answersToSubmit);

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
                toast.error("Произошла ошибка при отправке ответов.");
                console.error(err);
            });
    };

    const restartQuiz = () => {
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
    
    const isPassed = currentResult?.score >= 70;
    const showAnswers = isPassed || attempts >= 5; // Показывать ответы если сдал ИЛИ 5 попыток
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
                    </div>
                    <button 
                        onClick={() => navigate(`/lesson/${lessonId}`)} 
                        className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-base-content/65 hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        <ChevronLeft size={18} aria-hidden="true" /> Покинуть тест
                    </button>
                </header>

            <div className="grid items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
                {/* НАВИГАЦИЯ ВОПРОСОВ */}
                <aside className="min-w-0 border-b border-base-300 pb-5 lg:sticky lg:top-6 lg:border-0 lg:pb-0" aria-label="Навигация по тесту">
                    <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                        <h2 className="font-semibold">Вопросы</h2>
                        <span className="tabular-nums text-base-content/65">
                            {currentResult ? `Результат: ${currentResult.score}%` : `Отвечено ${answeredCount} из ${questions.length}`}
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
                    <nav className="grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5 lg:gap-1.5" aria-label="Вопросы теста">
                        {questions.map((q, idx) => {
                            const isAnswered = (selectedAnswers[q.id] || []).length > 0;
                            const isActive = idx === currentIndex;
                            
                            let btnClass = "border-base-300 text-base-content/65 bg-base-100 hover:border-blue-500/60";
                            
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-blue-500/10 border-blue-500/40 text-blue-700";
                                if (isActive) btnClass = "bg-blue-600 border-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 ring-offset-base-100 z-10";
                            } else {
                                if (isPassed) {
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
                                    onClick={() => setCurrentIndex(idx)}
                                    aria-label={`Вопрос ${idx + 1}${isAnswered ? ', ответ выбран' : ''}`}
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
                            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" aria-hidden="true" />Текущий</span>
                            <span className="flex items-center gap-2"><Check size={13} className="text-blue-700" aria-hidden="true" />Ответ выбран</span>
                        </div>
                    )}
                </aside>

                <div className="min-w-0">
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
                            <h2 id="quiz-question" className="mb-4 text-sm font-semibold tabular-nums text-blue-600">Вопрос {currentIndex + 1} из {questions.length}</h2>
                            <div id="quiz-question-text" className="max-w-[70ch] text-lg leading-8 text-base-content sm:text-xl sm:leading-8">
                                <QuizText>{currentQuestion?.question || currentQuestion?.text}</QuizText>
                            </div>
                        </div>

                        {/* ВАРИАНТЫ ОТВЕТОВ */}
                        <fieldset className="grid min-w-0 gap-3" aria-describedby="quiz-question-text">
                            <legend className="mb-3 text-sm font-semibold text-base-content/70">Варианты ответа</legend>
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
                                        className={`flex min-h-16 items-start gap-3 rounded-xl border p-4 motion-safe:transition-colors motion-safe:duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-blue-700 sm:gap-4 sm:px-5 ${currentResult ? 'cursor-not-allowed' : 'cursor-pointer'} ${labelClass}`}
                                    >
                                        <span className="relative mt-0.5 flex shrink-0 items-center justify-center">
                                            <input 
                                                type="checkbox"
                                                className="h-5 w-5 appearance-none rounded border-2 border-base-content/50 checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-none disabled:cursor-not-allowed"
                                                checked={isSelected}
                                                disabled={!!currentResult}
                                                onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                            />
                                            {isSelected && (
                                                <Check size={14} strokeWidth={3} className="pointer-events-none absolute text-white" aria-hidden="true" />
                                            )}
                                        </span>
                                        <span className="min-w-0 text-base leading-7"><QuizText>{choice.text}</QuizText></span>
                                    </label>
                                );
                            })}
                        </fieldset>

                        {/* ОБЪЯСНЕНИЕ (ПОКАЗЫВАЕТСЯ ТОЛЬКО ЕСЛИ СДАЛ ИЛИ 5 ПОПЫТОК) */}
                        {currentResult && showAnswers && (
                            <div className={`mt-6 rounded-xl border p-4 sm:p-5 ${isPassed ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-base-200 border-base-300'}`}>
                                <h2 className="mb-2 text-sm font-semibold">Объяснение:</h2>
                                <div className="text-base leading-7 text-base-content/80"><QuizText>{currentQuestion.explanation || 'Объяснение для этого вопроса отсутствует.'}</QuizText></div>
                            </div>
                        )}

                        {/* КНОПКИ УПРАВЛЕНИЯ */}
                        {!currentResult ? (
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-5 sm:mt-8">
                                <button
                                    className={`${secondaryButtonClass} ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    <ChevronLeft size={16} aria-hidden="true" /> Назад
                                </button>
                                {currentIndex < questions.length - 1 ? (
                                    <button
                                        className={primaryButtonClass}
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Далее <ArrowRight size={16} aria-hidden="true" />
                                    </button>
                                ) : (
                                    <button 
                                        className={primaryButtonClass}
                                        disabled={!isAllAnswered}
                                        aria-describedby={!isAllAnswered ? 'quiz-submit-hint' : undefined}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        Завершить тест
                                    </button>
                                )}
                                {currentIndex === questions.length - 1 && !isAllAnswered && (
                                    <p id="quiz-submit-hint" className="mt-2 basis-full text-sm leading-relaxed text-base-content/65">
                                        Для завершения выберите ответы во всех вопросах.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-5 sm:mt-8">
                                <button
                                    className={`${secondaryButtonClass} ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    <ChevronLeft size={16} aria-hidden="true" /> Назад
                                </button>
                                {currentIndex < questions.length - 1 ? (
                                    <button
                                        className={primaryButtonClass}
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Следующий вопрос
                                    </button>
                                ) : (
                                    <div className="ml-auto flex flex-wrap justify-end gap-2">
                                        {!isPassed && showAnswers && (
                                            <button onClick={restartQuiz} className={secondaryButtonClass}>
                                                Пройти еще раз
                                            </button>
                                        )}
                                        <button
                                            className={primaryButtonClass}
                                            onClick={() => navigate(`/lesson/${lessonId}`)}
                                        >
                                            Вернуться к уроку
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
