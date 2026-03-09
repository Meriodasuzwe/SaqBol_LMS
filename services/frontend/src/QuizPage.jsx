import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

    // Данные
    const [quiz, setQuiz] = useState(null); 
    const [loading, setLoading] = useState(true);

    // Состояния прохождения
    const [currentIndex, setCurrentIndex] = useState(0); 
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [currentResult, setCurrentResult] = useState(null); 

    // Анти-чит
    const [cheatWarnings, setCheatWarnings] = useState(0);
    const cheatWarningsRef = useRef(cheatWarnings);
    const selectedAnswersRef = useRef(selectedAnswers);
    
    useEffect(() => { cheatWarningsRef.current = cheatWarnings; }, [cheatWarnings]);
    useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);

    // 1. Загрузка данных
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Добавляем timestamp, чтобы сбросить жесткий кэш браузера (если он есть)
                const quizzesRes = await api.get(`quizzes/lesson/${lessonId}/?t=${new Date().getTime()}`);
                const quizList = Array.isArray(quizzesRes.data) ? quizzesRes.data : [quizzesRes.data];
                
                // Берем ПОСЛЕДНИЙ созданный тест
                const validQuizzes = quizList.filter(q => q && q.id).sort((a, b) => b.id - a.id);
                
                if (validQuizzes.length > 0) {
                    setQuiz(validQuizzes[0]);
                }
            } catch (err) {
                console.error("Ошибка загрузки данных:", err);
                toast.error("Не удалось загрузить тест.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [lessonId]);

    // 2. Анти-чит (Отслеживание вкладок)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && !currentResult && quiz) {
                const currentWarnings = cheatWarningsRef.current + 1;
                setCheatWarnings(currentWarnings);

                if (currentWarnings >= 3) {
                    toast.error("ТЕСТ ЗАВЕРШЕН: Зафиксировано переключение вкладок.", {
                        autoClose: false,
                        theme: "colored"
                    });
                    submitQuiz(true);
                } else {
                    toast.warning(`ПРЕДУПРЕЖДЕНИЕ (${currentWarnings}/3): Не покидайте вкладку с тестом! Система фиксирует нарушения.`, {
                        autoClose: 7000,
                        theme: "colored"
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
                if (res.data.score >= 70) {
                    confetti({
                        particleCount: 150,
                        spread: 80,
                        origin: { y: 0.6 },
                        zIndex: 9999,
                        colors: ['#10B981', '#047857', '#059669'] // Строгие изумрудные цвета конфетти
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
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
        </div>
    );

    if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center pt-10">
            <div className="max-w-md w-full text-center p-12 bg-white shadow-sm border border-slate-200 rounded-3xl">
                <HelpCircle size={48} className="text-slate-200 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-slate-900 mb-2">Вопросы отсутствуют</h2>
                <p className="text-slate-500 mb-8 font-medium">В этом модуле пока нет доступных тестов.</p>
                <button 
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 w-full hover:bg-black transition-colors" 
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

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-6 font-sans text-slate-900">
            <div className="max-w-3xl mx-auto">
                
                {/* 🔝 ВЕРХНЯЯ ПАНЕЛЬ */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                    <button 
                        onClick={() => navigate(`/lesson/${lessonId}`)} 
                        className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors w-fit"
                    >
                        <ChevronLeft size={16} /> Покинуть тест
                    </button>
                    {cheatWarnings > 0 && !currentResult && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold animate-pulse">
                            <AlertTriangle size={14} /> Предупреждений: {cheatWarnings}/3
                        </div>
                    )}
                </div>

                {/* 🟦 НАВИГАЦИЯ ПО ВОПРОСАМ */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {questions.map((q, idx) => {
                            const isAnswered = !!selectedAnswers[q.id];
                            const isActive = idx === currentIndex;
                            
                            let btnClass = "border-slate-200 text-slate-400 bg-white hover:border-slate-900 hover:text-slate-900";
                            
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-slate-900 border-slate-900 text-white"; 
                                if (isActive) btnClass += " ring-4 ring-slate-900/10 scale-110 z-10"; 
                            } else {
                                const isPassed = currentResult.score >= 70;
                                btnClass = isPassed ? "bg-emerald-500 border-emerald-500 text-white" : "bg-red-500 border-red-500 text-white";
                                if (isActive) btnClass += " ring-4 ring-slate-200 scale-110 z-10";
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

                {/* ОСНОВНОЙ БЛОК ВОПРОСА */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-8 md:p-12">
                        
                        {/* Заголовок вопроса */}
                        <div className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Вопрос {currentIndex + 1} из {questions.length}</span>
                                <div className="h-px flex-1 bg-slate-100"></div>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                                {currentQuestion?.text}
                            </h1>
                        </div>

                        {/* Варианты ответов */}
                        <div className="grid gap-3">
                            {choices.map(choice => {
                                const isSelected = selectedAnswers[currentQuestion.id] === choice.id;
                                
                                let labelClass = isSelected 
                                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' 
                                    : 'border-slate-200 bg-white hover:border-slate-400';

                                if (currentResult) {
                                    labelClass = isSelected 
                                        ? 'border-slate-300 bg-slate-100 text-slate-500 opacity-70' 
                                        : 'border-slate-100 text-slate-300 opacity-50';
                                }

                                return (
                                    <label key={choice.id} className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all ${labelClass}`}>
                                        <div className="relative flex items-center justify-center mr-4 shrink-0">
                                            <input 
                                                type="radio" 
                                                name={`q-${currentQuestion.id}`}
                                                className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-full checked:border-slate-900 checked:bg-slate-900 transition-all cursor-pointer disabled:cursor-not-allowed"
                                                checked={isSelected}
                                                disabled={!!currentResult}
                                                onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                            />
                                            {isSelected && <div className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"></div>}
                                        </div>
                                        <span className={`font-medium ${isSelected ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                                            {choice.text}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>

                        {/* === КНОПКИ УПРАВЛЕНИЯ === */}
                        {!currentResult ? (
                            <div className="flex flex-col-reverse sm:flex-row justify-between items-center mt-12 gap-4">
                                <button 
                                    className={`text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    <ChevronLeft size={16} /> Назад
                                </button>
                                
                                {currentIndex < questions.length - 1 ? (
                                    <button 
                                        className="w-full sm:w-auto bg-slate-100 text-slate-900 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Далее <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <button 
                                        className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm
                                            ${isAllAnswered ? 'bg-slate-900 text-white hover:bg-black hover:-translate-y-0.5' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                        disabled={!isAllAnswered}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        {isAllAnswered ? 'Завершить тест' : 'Ответьте на все вопросы'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            // ПАНЕЛЬ РЕЗУЛЬТАТОВ
                            <div className={`mt-12 p-8 rounded-2xl border-2 text-center animate-in fade-in slide-in-from-bottom-4 ${currentResult.score >= 70 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                <div className="flex justify-center mb-4">
                                    {currentResult.score >= 70 
                                        ? <CheckCircle2 size={48} className="text-emerald-500" />
                                        : <XCircle size={48} className="text-red-500" />
                                    }
                                </div>
                                <h3 className={`text-2xl font-black mb-2 ${currentResult.score >= 70 ? 'text-emerald-900' : 'text-red-900'}`}>
                                    {currentResult.score >= 70 ? 'Аттестация пройдена!' : 'Аттестация не пройдена'}
                                </h3>
                                <p className={`text-sm mb-8 font-medium ${currentResult.score >= 70 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    Итоговый балл: <span className="text-2xl font-black ml-2">{currentResult.score}%</span>
                                </p>
                                
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button 
                                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                                        onClick={() => {
                                            setCurrentResult(null);
                                            setCurrentIndex(0);
                                            setSelectedAnswers({});
                                            setCheatWarnings(0);
                                        }}
                                    >
                                        <RefreshCcw size={16} /> Попробовать снова
                                    </button>
                                    {currentResult.score >= 70 && (
                                        <button 
                                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors shadow-sm"
                                            onClick={() => navigate(`/lesson/${lessonId}`)}
                                        >
                                            Продолжить обучение <ArrowRight size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;