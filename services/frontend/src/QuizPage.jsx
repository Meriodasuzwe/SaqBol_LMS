import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti'; 

function QuizPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();

    // Данные
    const [quiz, setQuiz] = useState(null); 
    const [loading, setLoading] = useState(true);

    // Состояния прохождения
    const [currentIndex, setCurrentIndex] = useState(0); // Текущий ВОПРОС
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
                const quizzesRes = await api.get(`quizzes/lesson/${lessonId}/`);
                const quizList = Array.isArray(quizzesRes.data) ? quizzesRes.data : [quizzesRes.data];
                
                // Берем ПОСЛЕДНИЙ созданный тест для этого урока (чтобы избежать каши из "вариантов")
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
                    toast.error("🚨 ТЕСТ ЗАВЕРШЕН! Зафиксировано переключение вкладок (Списывание).", {
                        autoClose: false, // Ошибка висит, пока не закроют
                        theme: "colored"
                    });
                    submitQuiz(true);
                } else {
                    toast.warning(`⚠️ ПРЕДУПРЕЖДЕНИЕ (${currentWarnings}/3)\n\nНе переключайтесь на другие вкладки! Система фиксирует списывание.`, {
                        autoClose: 7000,
                        theme: "colored"
                    });
                }
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [currentResult, quiz]);

    // Обработка клика по варианту ответа
    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    // Отправка теста
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
                    // 👈 ЗАПУСКАЕМ СУЕТУ (КОНФЕТТИ)
                    confetti({
                        particleCount: 150, // Количество конфеттинок
                        spread: 80,         // Угол разброса
                        origin: { y: 0.6 }, // Откуда стрелять (чуть ниже центра экрана)
                        zIndex: 9999        // Чтобы было поверх всего
                    });
                    
                    toast.success(`🎉 Тест сдан! Ваш результат: ${res.data.score}%`);
                } else {
                    toast.error(`📚 Тест провален. Ваш результат: ${res.data.score}%`);
                }
            })
            .catch(err => {
                toast.error("Произошла ошибка при отправке ответов.");
                console.error(err);
            });
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    if (!quiz || !quiz.questions || quiz.questions.length === 0) return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20">
            <div className="max-w-md w-full text-center p-8 card bg-white shadow-sm border border-gray-200">
                <div className="text-6xl mb-4">📭</div>
                <h2 className="text-2xl font-bold mb-2">Тестов пока нет</h2>
                <p className="text-gray-500 mb-6">В этом шаге нет вопросов.</p>
                <button className="btn btn-primary" onClick={() => navigate(`/lesson/${lessonId}`)}>
                    ← Вернуться к уроку
                </button>
            </div>
        </div>
    );

    const questions = quiz.questions;
    const currentQuestion = questions[currentIndex];
    const choices = currentQuestion?.choices || []; 
    
    // Проверяем, на все ли вопросы дан ответ
    const isAllAnswered = questions.every(q => selectedAnswers[q.id]);

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 font-sans animate-fade-in">
            <div className="max-w-3xl mx-auto">
                
                {/* 🔝 ВЕРХНЯЯ ПАНЕЛЬ С КНОПКОЙ ВЫХОДА */}
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => navigate(`/lesson/${lessonId}`)} className="btn btn-sm btn-ghost text-gray-500 hover:text-gray-800 gap-2">
                        ← Вернуться к уроку
                    </button>
                    {cheatWarnings > 0 && !currentResult && (
                        <div className="badge badge-error gap-1 animate-pulse">⚠️ Предупреждений: {cheatWarnings}/3</div>
                    )}
                </div>

                {/* 🟦 КВАДРАТИКИ ВОПРОСОВ (Навигация) */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {questions.map((q, idx) => {
                            const isAnswered = !!selectedAnswers[q.id];
                            const isActive = idx === currentIndex;
                            
                            // Базовый стиль квадратика
                            let btnClass = "border-gray-300 text-gray-500 bg-white hover:border-primary hover:text-primary";
                            
                            // Если тест еще идет
                            if (!currentResult) {
                                if (isAnswered) btnClass = "bg-primary border-primary text-white"; // Закрашен синим
                                if (isActive) btnClass += " ring-4 ring-primary/30 ring-offset-1 scale-110 z-10"; // Обводка текущего
                            } 
                            // Если тест ЗАВЕРШЕН (Показываем результаты)
                            else {
                                const isPassed = currentResult.score >= 70;
                                btnClass = isPassed ? "bg-success border-success text-white" : "bg-error border-error text-white";
                                if (isActive) btnClass += " ring-4 ring-offset-1 scale-110 z-10 ring-gray-300";
                            }

                            return (
                                <button
                                    key={q.id}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg font-bold transition-all border-2 ${btnClass}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ОСНОВНОЙ БЛОК ВОПРОСА */}
                <div className="card bg-white shadow-sm border border-gray-200 overflow-hidden">
                    <div className="card-body p-6 md:p-10">
                        
                        {/* Заголовок вопроса */}
                        <div className="mb-8">
                            <h2 className="text-xs text-primary font-bold uppercase mb-2 tracking-wider">
                                Вопрос {currentIndex + 1} из {questions.length}
                            </h2>
                            <h1 className="text-xl md:text-2xl font-black text-gray-800 leading-snug">
                                {currentQuestion?.text}
                            </h1>
                        </div>

                        {/* Варианты ответов */}
                        <div className="grid gap-3">
                            {choices.map(choice => {
                                const isSelected = selectedAnswers[currentQuestion.id] === choice.id;
                                
                                // Стилизация во время теста
                                let labelClass = isSelected 
                                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' 
                                    : 'border-gray-200 text-gray-700 hover:border-primary/50 hover:bg-gray-50';

                                // Если тест завершен - блокируем выбор
                                if (currentResult) {
                                    labelClass = isSelected 
                                        ? 'border-gray-400 bg-gray-100 text-gray-600 opacity-70' 
                                        : 'border-gray-100 text-gray-400 opacity-50';
                                }

                                return (
                                    <label key={choice.id} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${labelClass}`}>
                                        <input 
                                            type="radio" 
                                            name={`q-${currentQuestion.id}`}
                                            className="radio radio-primary radio-sm mr-4"
                                            checked={isSelected}
                                            disabled={!!currentResult} // Блокируем после отправки
                                            onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                        />
                                        <span className="font-medium text-lg">{choice.text}</span>
                                    </label>
                                )
                            })}
                        </div>

                        {/* === КНОПКИ УПРАВЛЕНИЯ === */}
                        {!currentResult ? (
                            <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100">
                                {/* Кнопка Назад */}
                                <button 
                                    className={`btn btn-ghost text-gray-500 ${currentIndex === 0 ? 'invisible' : ''}`}
                                    onClick={() => setCurrentIndex(v => v - 1)}
                                >
                                    ← Назад
                                </button>
                                
                                {/* Кнопка Далее или Отправить */}
                                {currentIndex < questions.length - 1 ? (
                                    <button 
                                        className="btn btn-primary px-8"
                                        onClick={() => setCurrentIndex(v => v + 1)}
                                    >
                                        Далее →
                                    </button>
                                ) : (
                                    <button 
                                        className={`btn px-8 text-white shadow-md transition-all ${isAllAnswered ? 'btn-success hover:-translate-y-0.5' : 'btn-disabled bg-gray-300'}`}
                                        disabled={!isAllAnswered}
                                        onClick={() => submitQuiz(false)}
                                    >
                                        {isAllAnswered ? 'Отправить ответы ✔️' : 'Ответьте на все вопросы'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            // ПАНЕЛЬ РЕЗУЛЬТАТОВ (Показывается внизу после завершения)
                            <div className={`mt-8 p-6 rounded-2xl border-2 text-center animate-fade-in ${currentResult.score >= 70 ? 'bg-success/10 border-success' : 'bg-error/10 border-error'}`}>
                                <h3 className="text-2xl font-black mb-2">
                                    {currentResult.score >= 70 ? '🎉 Тест пройден!' : '📚 Тест не сдан'}
                                </h3>
                                <p className="text-lg mb-4">Ваш результат: <span className="font-bold">{currentResult.score}%</span></p>
                                
                                <div className="flex gap-4 justify-center">
                                    <button 
                                        className="btn btn-outline"
                                        onClick={() => {
                                            setCurrentResult(null);
                                            setCurrentIndex(0);
                                            setSelectedAnswers({});
                                            setCheatWarnings(0);
                                        }}
                                    >
                                        🔄 Пересдать
                                    </button>
                                    {currentResult.score >= 70 && (
                                        <button className="btn btn-primary" onClick={() => navigate(`/lesson/${lessonId}`)}>
                                            К уроку →
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