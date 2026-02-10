import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api'; 

function QuizPage() {
    const { lessonId } = useParams();
    const [quiz, setQuiz] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [result, setResult] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get(`quizzes/lesson/${lessonId}/`)
            .then(res => {
                setQuiz(res.data);
            })
            .catch(err => console.error("Ошибка загрузки теста:", err));
    }, [lessonId]);

    // Скролл наверх при переключении вопроса (для удобства на мобильных)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentIndex]);

    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitQuiz = () => {
        const answers = Object.entries(selectedAnswers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            choice_id: oId 
        }));
        
        // 🔥 ИСПРАВЛЕНИЕ: Передаем название теста, чтобы в Истории не было "Без названия"
        const payload = {
            answers,
            quiz_title: quiz.title || "Тест по уроку" 
        };

        api.post(`quizzes/${quiz.id}/submit/`, payload)
            .then(res => setResult(res.data))
            .catch(err => {
                console.error(err);
                alert("Ошибка при отправке результата");
            });
    };

    // 1. Экран загрузки
    if (!quiz) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-ring loading-lg text-primary"></span>
        </div>
    );

    // 2. ЗАЩИТА ОТ ПУСТОГО ТЕСТА
    const questions = quiz.questions || [];
    
    if (questions.length === 0) {
        return (
            <div className="max-w-md mx-auto text-center mt-20 p-6 card bg-base-100 shadow-xl border border-base-200">
                <h2 className="text-2xl font-bold mb-4">😔 Пусто</h2>
                <p className="text-gray-500">В этом тесте пока нет вопросов.</p>
                <button className="btn btn-primary mt-6" onClick={() => navigate(-1)}>Назад</button>
            </div>
        );
    }

    // 3. Экран результата
    if (result) {
        const isSuccess = result.score >= 70;

        return (
            <div className="max-w-md mx-auto text-center py-10 px-4 animate-fade-in">
                <div className={`card bg-base-100 shadow-xl border-t-8 ${isSuccess ? 'border-success' : 'border-error'}`}>
                    <div className="card-body items-center">
                        <div className="text-7xl mb-4 animate-bounce-short">
                            {isSuccess ? '🏆' : '😕'}
                        </div>
                        
                        <h2 className="card-title text-2xl font-bold">
                            {isSuccess ? 'Поздравляем!' : 'Тест не сдан'}
                        </h2>
                        
                        <div className="stat place-items-center py-6">
                            <div className="stat-title uppercase font-bold text-xs tracking-wider">Ваш результат</div>
                            <div className={`stat-value text-5xl ${isSuccess ? 'text-success' : 'text-error'}`}>
                                {result.score}%
                            </div>
                        </div>
                        
                        <p className="text-base-content/60 px-4 mb-4">
                            {isSuccess 
                                ? 'Вы отлично справились! Результат сохранен в профиле.' 
                                : 'Не расстраивайтесь! Повторите материал урока и попробуйте снова.'}
                        </p>
                        
                        <div className="card-actions flex-col w-full gap-3">
                            <button className="btn btn-primary btn-wide" onClick={() => navigate('/profile')}>
                                В профиль (История)
                            </button>
                            <button className="btn btn-ghost btn-wide" onClick={() => navigate('/courses')}>
                                К курсам
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Текущий вопрос
    const currentQuestion = questions[currentIndex];
    const choices = currentQuestion.choices || []; 

    return (
        <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in">
            {/* Заголовок теста */}
            <h1 className="text-3xl font-bold text-center mb-2">{quiz.title}</h1>
            <p className="text-center text-gray-400 mb-8 text-sm">Проверьте свои знания</p>

            {/* Степпер прогресса */}
            <div className="mb-8">
                <div className="flex justify-between text-xs mb-2 font-bold text-gray-400 uppercase tracking-widest">
                    <span>Вопрос {currentIndex + 1}</span>
                    <span>из {questions.length}</span>
                </div>
                <progress className="progress progress-primary w-full" value={currentIndex + 1} max={questions.length}></progress>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-6 md:p-10">
                    <h2 className="text-xl md:text-2xl font-bold mb-8 leading-snug">{currentQuestion.text}</h2>
                    
                    <div className="grid gap-4">
                        {choices.map(choice => (
                            <label 
                                key={choice.id} 
                                className={`flex items-center p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all ${
                                    selectedAnswers[currentQuestion.id] === choice.id 
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                    : 'border-base-200 hover:border-primary/50 hover:bg-base-200/50'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name={`q-${currentQuestion.id}`}
                                    className="radio radio-primary mr-4"
                                    checked={selectedAnswers[currentQuestion.id] === choice.id}
                                    onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                />
                                <span className="font-medium text-base md:text-lg">{choice.text}</span>
                            </label>
                        ))}
                    </div>

                    <div className="card-actions justify-between mt-10 pt-6 border-t border-base-100">
                        <button 
                            className="btn btn-ghost" 
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(v => v - 1)}
                        >
                            ← Назад
                        </button>
                        
                        {currentIndex < questions.length - 1 ? (
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
                                Завершить тест ✨
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;