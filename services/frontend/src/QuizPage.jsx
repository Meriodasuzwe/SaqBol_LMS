import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { 
    ChevronLeft, 
    AlertTriangle, 
    CheckCircle2, 
    XCircle, 
    ArrowRight, 
    RefreshCcw, 
    HelpCircle,
    EyeOff
} from 'lucide-react';

function QuizPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    
    const [searchParams] = useSearchParams();
    const targetQuizId = searchParams.get('quiz_id');

    const [quiz, setQuiz] = useState(null); 
    const [loading, setLoading] = useState(true);

    const [currentIndex, setCurrentIndex] = useState(0); 
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

    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitAnalytics = async (quizData, resultData, answersMap) => {
        try {
            const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
            const questions = quizData.questions || [];
            let correctCount = 0;
            const answersPayload = questions.map(q => {
                const choiceId = answersMap[q.id];
                const choice = q.choices?.find(c => c.id === choiceId);
                const isCorrect = choice?.is_correct || false;
                if (isCorrect) correctCount++;
                return {
                    question_id: q.id,
                    selected_choice_id: choiceId || null,
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
        const answers = Object.entries(answersToSubmit).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            choice_id: oId
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
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <div className="w-8 h-8 border-4 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
        <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center pt-10">
            <div className="max-w-md w-full text-center p-12 bg-base-100 shadow-sm border border-base-300 rounded-3xl">
                <HelpCircle size={48} className="text-base-content/20 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-base-content mb-2">Вопросы отсутствуют</h2>
                <button 
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 w-full mt-8" 
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
    const isAllAnswered = questions.every(q => selectedAnswers[q.id]);
    
    const isPassed = currentResult?.score >= 70;
    const showAnswers = isPassed || attempts >= 5; // Показывать ответы если сдал ИЛИ 5 попыток

    return (
        <div className="min-h-screen bg-base-200 py-10 px-6 font-sans text-base-content">
            <div className="max-w-3xl mx-auto">
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                    <button 
                        onClick={() => navigate(`/lesson/${lessonId}`)} 
                        className="text-[11px] font-black uppercase tracking-widest text-base-content/50 hover:text-base-content flex items-center gap-2"
                    >
                        <ChevronLeft size={16} /> Покинуть тест
                    </button>
                </div>

                {/* НАВИГАЦИЯ ВОПРОСОВ */}
                <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-300 mb-6">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {questions.map((q, idx) => {
                            const isAnswered = !!selectedAnswers[q.id];
                            const isActive = idx === currentIndex;
                            
                            let btnClass = "border-base-300 text-base-content/50 bg-base-100 hover:border-base-content/30";
                            
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-blue-600 border-blue-600 text-white"; 
                                if (isActive) btnClass += " ring-4 ring-blue-500/20 scale-110 z-10 border-blue-600 text-blue-600";
                                if (isActive && isAnswered) btnClass += " text-white";
                            } else {
                                if (isPassed) {
                                    btnClass = "bg-emerald-500 border-emerald-500 text-white";
                                } else if (showAnswers) {
                                    const userAnswerId = selectedAnswers[q.id];
                                    const userAnswer = q.choices?.find(c => c.id === userAnswerId);
                                    const isCorrect = userAnswer?.is_correct === true;
                                    btnClass = isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : "bg-red-500 border-red-500 text-white";
                                } else {
                                    // Нейтральный цвет, если завалил, но попыток < 5
                                    btnClass = "bg-base-300 border-base-400 text-base-content/60";
                                }
                                if (isActive) btnClass += " ring-4 ring-base-content/20 scale-110 z-10";
                            }

                            return (
                                <button key={q.id} onClick={() => setCurrentIndex(idx)} className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-sm font-bold transition-all border-2 ${btnClass}`}>
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ВЕРДИКТ ЕСЛИ ЗАВАЛИЛ И ПОПЫТОК < 5 */}
                {currentResult && !isPassed && !showAnswers && (
                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-6 text-center animate-in fade-in">
                        <EyeOff size={32} className="text-amber-500 mx-auto mb-3" />
                        <h3 className="text-lg font-black text-amber-900 mb-1">Вы набрали {currentResult.score}%. Нужно минимум 70%.</h3>
                        <p className="text-amber-800/80 text-sm mb-4">Правильные ответы скрыты, чтобы вы могли подумать сами. <br/> Они откроются после 5 попыток. (Использовано попыток: {attempts}/5)</p>
                        <button onClick={restartQuiz} className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold inline-flex items-center gap-2 hover:bg-amber-600">
                            <RefreshCcw size={16} /> Попробовать снова
                        </button>
                    </div>
                )}

                {/* ТЕЛО ВОПРОСА */}
                <div className="bg-base-100 rounded-3xl shadow-sm border border-base-300 overflow-hidden">
                    <div className="p-8 md:p-12">
                        <div className="mb-10">
                            <h1 className="text-2xl font-black text-base-content leading-tight">
                                {currentQuestion?.question || currentQuestion?.text}
                            </h1>
                        </div>

                        {/* ВАРИАНТЫ ОТВЕТОВ */}
                        <div className="grid gap-3">
                            {choices.map(choice => {
                                const isSelected = selectedAnswers[currentQuestion.id] === choice.id;
                                let labelClass = isSelected ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-base-300 bg-base-100 hover:border-base-content/40';

                                if (currentResult) {
                                    // Если сдал ИЛИ попыток >= 5 -> используем карту из бэкенда
                                    if (isPassed || showAnswers) {
                                        const correctChoiceId = currentResult.correct_answers_map ? currentResult.correct_answers_map[currentQuestion.id] : null;
                                        
                                        if (choice.id === correctChoiceId) {
                                            labelClass = 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-900 font-bold';
                                        } else if (isSelected && choice.id !== correctChoiceId) {
                                            labelClass = 'border-red-500 bg-red-50 ring-1 ring-red-500 text-red-900';
                                        } else {
                                            labelClass = 'border-base-200/50 text-base-content/40 opacity-50';
                                        }
                                    } else {
                                        // Если провалил и попыток < 5 - просто фиксируем выбранный вариант
                                        labelClass = isSelected ? 'border-base-400 bg-base-200 text-base-content/60 cursor-not-allowed' : 'border-base-200/50 text-base-content/40 opacity-50 cursor-not-allowed';
                                    }
                                }

                                return (
                                    <label key={choice.id} className={`flex items-center p-5 rounded-2xl border-2 transition-all ${currentResult ? 'cursor-not-allowed' : 'cursor-pointer'} ${labelClass}`}>
                                        <div className="relative flex items-center justify-center mr-4 shrink-0">
                                            <input 
                                                type="radio" 
                                                name={`q-${currentQuestion.id}`}
                                                className="peer appearance-none w-5 h-5 border-2 border-base-300 rounded-full checked:border-blue-600 checked:bg-blue-600 transition-all disabled:cursor-not-allowed"
                                                checked={isSelected}
                                                disabled={!!currentResult}
                                                onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                            />
                                            {isSelected && <div className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"></div>}
                                        </div>
                                        <span className="font-medium">{choice.text}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* ОБЪЯСНЕНИЕ (ПОКАЗЫВАЕТСЯ ТОЛЬКО ЕСЛИ СДАЛ ИЛИ 5 ПОПЫТОК) */}
                        {currentResult && showAnswers && (
                            <div className={`mt-6 p-6 rounded-2xl border ${isPassed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-base-200 border-base-300'}`}>
                                <h4 className="font-bold mb-2">Объяснение:</h4>
                                <p className="text-sm">{currentQuestion.explanation || 'Объяснение для этого вопроса отсутствует.'}</p>
                            </div>
                        )}

                        {/* КНОПКИ УПРАВЛЕНИЯ */}
                        {!currentResult ? (
                            <div className="flex justify-between items-center mt-12 gap-4">
                                <button className={`text-xs font-bold uppercase text-base-content/50 ${currentIndex === 0 ? 'invisible' : ''}`} onClick={() => setCurrentIndex(v => v - 1)}>Назад</button>
                                {currentIndex < questions.length - 1 ? (
                                    <button className="bg-base-200 px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-base-300" onClick={() => setCurrentIndex(v => v + 1)}>Далее <ArrowRight size={16} /></button>
                                ) : (
                                    <button 
                                        className={`px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 ${isAllAnswered ? 'bg-blue-600 text-white shadow-lg' : 'bg-base-200 text-base-content/40'}`}
                                        disabled={!isAllAnswered}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        Завершить тест
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="mt-10 pt-8 border-t border-base-300 flex justify-between items-center gap-4">
                                <button className={`text-xs font-bold uppercase text-base-content/50 ${currentIndex === 0 ? 'invisible' : ''}`} onClick={() => setCurrentIndex(v => v - 1)}>Назад</button>
                                {currentIndex < questions.length - 1 ? (
                                    <button className="bg-base-200 px-6 py-3 rounded-xl font-bold hover:bg-base-300" onClick={() => setCurrentIndex(v => v + 1)}>Следующий вопрос</button>
                                ) : (
                                    <div className="flex gap-4">
                                        {!isPassed && showAnswers && (
                                            <button onClick={restartQuiz} className="px-6 py-3 bg-base-200 text-base-content rounded-xl font-bold">Пройти еще раз</button>
                                        )}
                                        <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2" onClick={() => navigate(`/lesson/${lessonId}`)}>Вернуться к уроку</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;