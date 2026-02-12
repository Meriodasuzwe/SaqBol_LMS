import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function QuizPage() {
    const { lessonId } = useParams();
    const [quiz, setQuiz] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Загружаем тесты для урока
        api.get(`quizzes/lesson/${lessonId}/`)
            .then(res => {
                console.log("Данные с сервера:", res.data);
                
                // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ 🔥
                // Бэкенд возвращает МАССИВ тестов (ListAPIView).
                // Нам нужно взять первый тест из списка (если он есть).
                if (Array.isArray(res.data) && res.data.length > 0) {
                    setQuiz(res.data[0]);
                } else if (res.data && !Array.isArray(res.data)) {
                    // На случай, если бэкенд вернет один объект
                    setQuiz(res.data);
                } else {
                    setQuiz(null);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Ошибка загрузки теста:", err);
                setLoading(false);
            });
    }, [lessonId]);

    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitQuiz = () => {
        if (!quiz) return;
        
        const answers = Object.entries(selectedAnswers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            choice_id: oId
        }));
        
        api.post(`quizzes/${quiz.id}/submit/`, { answers })
            .then(res => setResult(res.data))
            .catch(err => alert("Ошибка при отправке ответов"));
    };

    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-ring loading-lg text-primary"></span>
        </div>
    );

    // Если тест не найден
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        return (
            <div className="max-w-md mx-auto text-center mt-20 p-6 card bg-base-100 shadow-xl">
                <h2 className="text-2xl font-bold mb-4">😔 Тест не найден</h2>
                <p>Для этого урока еще нет активных тестов. <br/>Попросите преподавателя создать их в "Лаборатории".</p>
                <button className="btn btn-primary mt-6" onClick={() => navigate(-1)}>Назад</button>
            </div>
        );
    }
    
    // ЭКРАН РЕЗУЛЬТАТА (без изменений)
    if (result) {
        const isSuccess = result.score >= 70;
        return (
            <div className="max-w-md mx-auto text-center py-10 animate-fade-in">
                <div className={`card bg-base-100 shadow-xl border-t-8 ${isSuccess ? 'border-success' : 'border-error'}`}>
                    <div className="card-body items-center">
                        <div className="text-7xl mb-4 animate-bounce-short">
                            {isSuccess ? '🏆' : '📚'}
                        </div>
                        <h2 className="card-title text-2xl">
                            {isSuccess ? 'Отличная работа!' : 'Нужно повторить'}
                        </h2>
                        <div className="stat place-items-center my-4">
                            <div className="stat-title">Результат</div>
                            <div className={`stat-value ${isSuccess ? 'text-success' : 'text-error'}`}>
                                {result.score}%
                            </div>
                        </div>
                        <div className="card-actions mt-8 flex-col w-full gap-3">
                            <button className="btn btn-primary btn-wide" onClick={() => navigate('/courses')}>
                                К списку курсов
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ЭКРАН ТЕСТИРОВАНИЯ (без изменений)
    const currentQuestion = quiz.questions[currentIndex];
    const choices = currentQuestion.choices || []; 

    return (
        <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
            <div className="mb-10">
                <ul className="steps w-full">
                    {quiz.questions.map((_, i) => (
                        <li key={i} className={`step ${i <= currentIndex ? 'step-primary' : ''}`}></li>
                    ))}
                </ul>
                <div className="flex justify-between text-xs mt-4 font-bold text-base-content/40 uppercase tracking-widest">
                    <span>Вопрос {currentIndex + 1}</span>
                    <span>Всего {quiz.questions.length}</span>
                </div>
            </div>

            <div className="card bg-base-100 shadow-2xl border border-base-200">
                <div className="card-body p-6 md:p-10">
                    <h2 className="text-2xl font-bold mb-8 leading-snug">{currentQuestion.text}</h2>
                    <div className="grid gap-4">
                        {choices.map(choice => (
                            <label 
                                key={choice.id} 
                                className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                                    selectedAnswers[currentQuestion.id] === choice.id 
                                    ? 'border-primary bg-primary/5 shadow-inner' 
                                    : 'border-base-200 hover:border-primary/50 hover:bg-base-100'
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

                    <div className="card-actions justify-between mt-10 pt-6 border-t border-base-200">
                        <button 
                            className="btn btn-ghost" 
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(v => v - 1)}
                        >
                            ← Назад
                        </button>
                        
                        {currentIndex < quiz.questions.length - 1 ? (
                            <button 
                                className="btn btn-primary px-8"
                                disabled={!selectedAnswers[currentQuestion.id]}
                                onClick={() => setCurrentIndex(v => v + 1)}
                            >
                                Далее →
                            </button>
                        ) : (
                            <button 
                                className="btn btn-success px-8 text-white shadow-lg shadow-success/30"
                                disabled={!selectedAnswers[currentQuestion.id]}
                                onClick={submitQuiz}
                            >
                                Завершить ✨
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;