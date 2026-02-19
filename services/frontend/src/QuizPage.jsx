import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function QuizPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();

    // Состояния данных
    const [quizzes, setQuizzes] = useState([]); // Список всех тестов урока
    const [userResults, setUserResults] = useState([]); // Результаты пользователя
    
    // Состояния UI
    const [activeQuizIndex, setActiveQuizIndex] = useState(0); // Какой тест сейчас открыт (индекс)
    const [loading, setLoading] = useState(true);

    // Состояния прохождения теста
    const [currentIndex, setCurrentIndex] = useState(0); // Номер вопроса внутри теста
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [currentResult, setCurrentResult] = useState(null); // Результат ТОЛЬКО ЧТО сданного теста

    // 1. Загружаем тесты и результаты при открытии страницы
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Параллельно грузим тесты урока и историю прохождений пользователя
                const [quizzesRes, resultsRes] = await Promise.all([
                    api.get(`quizzes/lesson/${lessonId}/`),
                    api.get(`quizzes/my-results/`)
                ]);

                // Обработка списка тестов
                // Бэкенд возвращает список тестов (ListAPIView)
                const quizList = Array.isArray(quizzesRes.data) ? quizzesRes.data : [quizzesRes.data];
                // Фильтруем пустые элементы и сортируем по ID (чтобы старые были слева)
                const sortedQuizzes = quizList
                    .filter(q => q && q.id)
                    .sort((a, b) => a.id - b.id);
                
                setQuizzes(sortedQuizzes);

                // Обработка результатов
                setUserResults(resultsRes.data || []);
            } catch (err) {
                console.error("Ошибка загрузки данных:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [lessonId]);

    // Сброс состояния при переключении теста (клике на квадратик)
    useEffect(() => {
        setCurrentIndex(0);
        setSelectedAnswers({});
        setCurrentResult(null);
    }, [activeQuizIndex]);

    // --- ЛОГИКА ОПРЕДЕЛЕНИЯ СТАТУСА ТЕСТА (Цвет квадратика) ---
    const getQuizStatus = (quizId) => {
        // Фильтруем результаты для конкретного ID теста
        const attempts = userResults.filter(r => r.quiz_id === quizId);
        
        if (attempts.length === 0) return 'neutral'; // Не проходил

        // Проверяем, есть ли хоть одна успешная попытка (>= 70%)
        const hasSuccess = attempts.some(r => r.score >= 70);
        return hasSuccess ? 'success' : 'error';
    };

    // --- ОБРАБОТЧИКИ ---
    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitQuiz = () => {
        const quiz = quizzes[activeQuizIndex];
        const answers = Object.entries(selectedAnswers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            choice_id: oId
        }));
        
        api.post(`quizzes/${quiz.id}/submit/`, { answers })
            .then(res => {
                setCurrentResult(res.data);
                // Обновляем локально список результатов, чтобы квадратик сразу окрасился
                // Добавляем новый результат в начало списка
                setUserResults(prev => [{ 
                    id: Date.now(), // Временный ID для UI
                    quiz_id: quiz.id,
                    quiz_title: quiz.title, 
                    score: res.data.score, 
                    completed_at: new Date().toISOString() 
                }, ...prev]);
            })
            .catch(err => alert("Ошибка при отправке ответов"));
    };

    // --- РЕНДЕРИНГ ---

    if (loading) return (
        <div className="flex justify-center mt-20"><span className="loading loading-ring loading-lg text-primary"></span></div>
    );

    if (quizzes.length === 0) return (
        <div className="max-w-md mx-auto text-center mt-20 p-6 card bg-base-100 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">😔 Тестов нет</h2>
            <p>Преподаватель еще не создал тесты для этого урока.</p>
            <button className="btn btn-primary mt-6" onClick={() => navigate(-1)}>Назад</button>
        </div>
    );

    const activeQuiz = quizzes[activeQuizIndex];
    const questions = activeQuiz.questions || [];
    const currentQuestion = questions[currentIndex];
    const choices = currentQuestion?.choices || []; 

    return (
        <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in">
            
            {/* 🟦 НАВИГАЦИЯ (STEPIK STYLE) */}
            <div className="mb-8">
                <h3 className="text-sm font-bold uppercase text-gray-400 mb-3 tracking-widest">
                    Выберите вариант теста:
                </h3>
                <div className="flex flex-wrap gap-3">
                    {quizzes.map((q, idx) => {
                        const status = getQuizStatus(q.id);
                        let btnClass = "btn-outline border-base-300 text-base-content/50"; // Серый по умолчанию
                        
                        if (status === 'success') btnClass = "btn-success text-white border-none shadow-md shadow-success/20";
                        if (status === 'error') btnClass = "btn-error text-white border-none shadow-md shadow-error/20";
                        
                        // Если активен - добавляем кольцо и делаем ярче
                        const isActive = idx === activeQuizIndex;
                        const activeClass = isActive ? 'ring-4 ring-primary ring-offset-2 scale-110 z-10' : 'hover:scale-105';
                        
                        // Если активен и нейтрален (еще не сдан), делаем его синим
                        if (isActive && status === 'neutral') {
                            btnClass = "btn-primary text-white border-none shadow-lg shadow-primary/30";
                        }

                        return (
                            <button
                                key={q.id}
                                onClick={() => setActiveQuizIndex(idx)}
                                className={`btn btn-square transition-all duration-200 ${btnClass} ${activeClass}`}
                                title={q.title}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ОСНОВНОЙ БЛОК ТЕСТА */}
            {!currentResult ? (
                <div className="card bg-base-100 shadow-2xl border border-base-200">
                    <div className="card-body p-6 md:p-10">
                        {/* Заголовок теста */}
                        <div className="flex justify-between items-start mb-6 border-b border-base-200 pb-4">
                            <div>
                                <h2 className="text-xs text-primary font-bold uppercase mb-1 tracking-wider opacity-70">
                                    Вариант №{activeQuizIndex + 1} • {activeQuiz.title}
                                </h2>
                                <h1 className="text-xl md:text-2xl font-black leading-tight">
                                    {currentQuestion?.text}
                                </h1>
                            </div>
                            <div className="badge badge-lg badge-ghost font-mono">
                                {currentIndex + 1} / {questions.length}
                            </div>
                        </div>

                        {/* Варианты ответов */}
                        <div className="grid gap-3">
                            {choices.map(choice => (
                                <label 
                                    key={choice.id} 
                                    className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.99] ${
                                        selectedAnswers[currentQuestion.id] === choice.id 
                                        ? 'border-primary bg-primary/5 shadow-inner ring-1 ring-primary' 
                                        : 'border-base-200 hover:border-primary/40 hover:bg-base-100'
                                    }`}
                                >
                                    <input 
                                        type="radio" 
                                        name={`q-${currentQuestion.id}`}
                                        className="radio radio-primary radio-sm mr-4"
                                        checked={selectedAnswers[currentQuestion.id] === choice.id}
                                        onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                    />
                                    <span className="font-medium text-lg">{choice.text}</span>
                                </label>
                            ))}
                        </div>

                        {/* Кнопки Назад / Далее */}
                        <div className="card-actions justify-between mt-10 pt-6 border-t border-base-200">
                            <button 
                                className="btn btn-ghost gap-2" 
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(v => v - 1)}
                            >
                                ← Назад
                            </button>
                            
                            {currentIndex < questions.length - 1 ? (
                                <button 
                                    className="btn btn-primary px-8 gap-2"
                                    disabled={!selectedAnswers[currentQuestion.id]}
                                    onClick={() => setCurrentIndex(v => v + 1)}
                                >
                                    Далее →
                                </button>
                            ) : (
                                <button 
                                    className="btn btn-success px-8 text-white shadow-lg shadow-success/30 gap-2"
                                    disabled={!selectedAnswers[currentQuestion.id]}
                                    onClick={submitQuiz}
                                >
                                    Отправить решение ✨
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ЭКРАН РЕЗУЛЬТАТА */
                <div className="card bg-base-100 shadow-xl border-t-8 border-primary animate-fade-in">
                    <div className="card-body items-center text-center py-10">
                        <div className="text-7xl mb-4 animate-bounce-short">
                            {currentResult.score >= 70 ? '🎉' : '🤔'}
                        </div>
                        <h2 className="text-3xl font-black mb-2">
                            {currentResult.score >= 70 ? 'Тест сдан!' : 'Попробуйте еще раз'}
                        </h2>
                        <div className="stat-value text-primary my-4">{currentResult.score}%</div>
                        <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                            {currentResult.score >= 70 
                                ? 'Отличный результат! Вы можете переходить к следующему уроку.' 
                                : 'К сожалению, этого недостаточно. Повторите материал и попробуйте снова.'}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                             {/* Кнопка Рестарт */}
                            <button 
                                className="btn btn-outline btn-wide" 
                                onClick={() => {
                                    setCurrentResult(null);
                                    setCurrentIndex(0);
                                    setSelectedAnswers({});
                                }}
                            >
                                🔄 Перепройти
                            </button>

                            {/* Если есть следующий тест, можно предложить перейти к нему */}
                            {activeQuizIndex < quizzes.length - 1 && (
                                <button 
                                    className="btn btn-primary btn-wide"
                                    onClick={() => setActiveQuizIndex(i => i + 1)}
                                >
                                    След. вариант →
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QuizPage;