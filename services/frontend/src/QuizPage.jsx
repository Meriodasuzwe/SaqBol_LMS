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
    HelpCircle 
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

    const startTimeRef = useRef(Date.now());

    const [cheatWarnings, setCheatWarnings] = useState(0);
    const cheatWarningsRef = useRef(cheatWarnings);
    const selectedAnswersRef = useRef(selectedAnswers);
    
    useEffect(() => { cheatWarningsRef.current = cheatWarnings; }, [cheatWarnings]);
    useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const quizzesRes = await api.get(`quizzes/lesson/${lessonId}/?t=${new Date().getTime()}`);
                const quizList = Array.isArray(quizzesRes.data) ? quizzesRes.data : [quizzesRes.data];
                const validQuizzes = quizList.filter(q => q && q.id).sort((a, b) => b.id - a.id);
                
                if (validQuizzes.length > 0) {
                    if (targetQuizId) {
                        const specificQuiz = validQuizzes.find(q => String(q.id) === String(targetQuizId));
                        setQuiz(specificQuiz || validQuizzes[0]);
                    } else {
                        setQuiz(validQuizzes[0]);
                    }
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

                if (res.data.score >= 70) {
                    confetti({
                        particleCount: 150, spread: 80,
                        origin: { y: 0.6 }, zIndex: 9999,
                        colors: ['#10B981', '#047857', '#059669'] 
                    });
                    toast.success(`Тест успешно сдан! Результат: ${res.data.score}%`);
                } else {
                    toast.error(`Тест не пройден. Результат: ${res.data.score}%`);
                }
            })
            .catch(err => {
                toast.error("Произошла ошибка при отправке ответов.");
                console.error(err);
            });
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <div className="w-8 h-8 border-4 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
        <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center pt-10 transition-colors duration-200">
            <div className="max-w-md w-full text-center p-12 bg-base-100 shadow-sm border border-base-300 rounded-3xl transition-colors duration-200">
                <HelpCircle size={48} className="text-base-content/20 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-base-content mb-2">Вопросы отсутствуют</h2>
                <p className="text-base-content/60 mb-8 font-medium">В этом модуле пока нет доступных тестов.</p>
                <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 w-full transition-colors shadow-lg shadow-blue-900/20" 
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
    
    // Проверяем, правильно ли юзер ответил на текущий вопрос (нужно для блока объяснения)
    const userSelectedChoice = choices.find(c => c.id === selectedAnswers[currentQuestion.id]);
    const isCurrentAnswerCorrect = userSelectedChoice?.is_correct === true;

    return (
        <div className="min-h-screen bg-base-200 py-10 px-6 font-sans text-base-content transition-colors duration-200">
            <div className="max-w-3xl mx-auto">
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                    <button 
                        onClick={() => navigate(`/lesson/${lessonId}`)} 
                        className="text-[11px] font-black uppercase tracking-widest text-base-content/50 hover:text-base-content flex items-center gap-2 transition-colors w-fit group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Покинуть тест
                    </button>
                    {cheatWarnings > 0 && !currentResult && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold animate-pulse">
                            <AlertTriangle size={14} /> Предупреждений: {cheatWarnings}/3
                        </div>
                    )}
                </div>

                {/* ── НАВИГАЦИОННЫЕ КНОПКИ (ЦИФРЫ ВОПРОСОВ) ── */}
                <div className="bg-base-100 p-6 rounded-2xl shadow-sm border border-base-300 mb-6 transition-colors duration-200">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {questions.map((q, idx) => {
                            const isAnswered = !!selectedAnswers[q.id];
                            const isActive = idx === currentIndex;
                            
                            let btnClass = "border-base-300 text-base-content/50 bg-base-100 hover:border-base-content/30 hover:text-base-content/80";
                            
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-blue-600 border-blue-600 text-white shadow-sm"; 
                                if (isActive) btnClass += " ring-4 ring-blue-500/20 scale-110 z-10 border-blue-600 text-blue-600 dark:text-blue-400";
                                if (isActive && isAnswered) btnClass += " text-white";
                            } else {
                                // 🔥 ПРОВЕРКА ПРАВИЛЬНОСТИ КОНКРЕТНОГО ВОПРОСА 🔥
                                const userAnswerId = selectedAnswers[q.id];
                                const userAnswer = q.choices?.find(c => c.id === userAnswerId);
                                const isCorrect = userAnswer?.is_correct === true;

                                btnClass = isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : "bg-red-500 border-red-500 text-white";
                                if (isActive) btnClass += " ring-4 ring-base-content/20 scale-110 z-10";
                            }

                            return (
                                <button
                                    key={q.id}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-sm font-bold transition-all border-2 ${btnClass}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── ТЕЛО ВОПРОСА ── */}
                <div className="bg-base-100 rounded-3xl shadow-sm border border-base-300 overflow-hidden transition-colors duration-200">
                    <div className="p-8 md:p-12">
                        
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/50">Вопрос {currentIndex + 1} из {questions.length}</span>
                                <div className="h-px flex-1 bg-base-300"></div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-base-content leading-tight">
                                {currentQuestion?.question || currentQuestion?.text}
                            </h1>
                        </div>

                        {/* ── ВАРИАНТЫ ОТВЕТОВ ── */}
                        <div className="grid gap-3">
                            {choices.map(choice => {
                                const isSelected = selectedAnswers[currentQuestion.id] === choice.id;
                                
                                let labelClass = isSelected 
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600' 
                                    : 'border-base-300 bg-base-100 hover:border-base-content/40';

                                // 🔥 ЦВЕТОВЫЕ МАРКЕРЫ ДЛЯ ОТВЕТОВ ПОСЛЕ СДАЧИ 🔥
                                if (currentResult) {
                                    if (choice.is_correct) {
                                        // Правильный ответ всегда горит зеленым
                                        labelClass = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-300';
                                    } else if (isSelected && !choice.is_correct) {
                                        // Твой неверный ответ горит красным
                                        labelClass = 'border-red-500 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500 text-red-900 dark:text-red-300';
                                    } else {
                                        // Остальные неверные ответы просто тускнеют
                                        labelClass = 'border-base-200/50 text-base-content/40 opacity-50';
                                    }
                                }

                                return (
                                    <label key={choice.id} className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all ${labelClass}`}>
                                        <div className="relative flex items-center justify-center mr-4 shrink-0">
                                            <input 
                                                type="radio" 
                                                name={`q-${currentQuestion.id}`}
                                                className="peer appearance-none w-5 h-5 border-2 border-base-300 rounded-full checked:border-blue-600 checked:bg-blue-600 transition-all cursor-pointer disabled:cursor-not-allowed disabled:checked:bg-current disabled:checked:border-current"
                                                checked={isSelected}
                                                disabled={!!currentResult}
                                                onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                            />
                                            {isSelected && <div className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"></div>}
                                        </div>
                                        <span className={`font-medium ${isSelected && !currentResult ? 'text-blue-900 dark:text-blue-300 font-bold' : ''}`}>
                                            {choice.text}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* 🔥 БЛОК С ОБЪЯСНЕНИЕМ (ПОЯВЛЯЕТСЯ ТОЛЬКО ПОСЛЕ СДАЧИ) 🔥 */}
                        {currentResult && (
                            <div className={`mt-6 p-6 rounded-2xl border ${isCurrentAnswerCorrect ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30' : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-800/30'} animate-in fade-in slide-in-from-top-4`}>
                                <h4 className="font-bold flex items-center gap-2 mb-2 text-base-content">
                                    {isCurrentAnswerCorrect 
                                        ? <><CheckCircle2 size={18} className="text-emerald-500"/> Верный выбор</> 
                                        : <><XCircle size={18} className="text-red-500"/> Ошибка</>}
                                </h4>
                                <p className="text-sm text-base-content/80 leading-relaxed">
                                    {currentQuestion.explanation || 'Объяснение для этого вопроса отсутствует.'}
                                </p>
                            </div>
                        )}

                        {!currentResult ? (
                            <div className="flex flex-col-reverse sm:flex-row justify-between items-center mt-12 gap-4">
                                <button 
                                    className={`text-xs font-bold uppercase tracking-widest text-base-content/50 hover:text-base-content flex items-center gap-2 transition-colors ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    <ChevronLeft size={16} /> Назад
                                </button>
                                
                                {currentIndex < questions.length - 1 ? (
                                    <button 
                                        className="w-full sm:w-auto bg-base-200 text-base-content px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-base-300 transition-all"
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Далее <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <button 
                                        className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm
                                            ${isAllAnswered ? 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-lg shadow-blue-900/20' : 'bg-base-200 text-base-content/40 cursor-not-allowed'}`}
                                        disabled={!isAllAnswered}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        {isAllAnswered ? 'Завершить тест' : 'Ответьте на все вопросы'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="mt-10 pt-8 border-t border-base-300 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <button 
                                    className={`text-xs font-bold uppercase tracking-widest text-base-content/50 hover:text-base-content flex items-center gap-2 transition-colors ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    <ChevronLeft size={16} /> Предыдущий вопрос
                                </button>

                                {currentIndex < questions.length - 1 ? (
                                    <button 
                                        className="w-full sm:w-auto bg-base-200 text-base-content px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-base-300 transition-all"
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Следующий вопрос <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <button 
                                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
                                        onClick={() => navigate(`/lesson/${lessonId}`)}
                                    >
                                        Вернуться к уроку <ArrowRight size={16} />
                                    </button>
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