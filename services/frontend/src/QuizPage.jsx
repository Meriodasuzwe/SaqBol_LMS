import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api'; // Убедись, что путь к api правильный

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
                console.log("Quiz Data:", res.data); // Для отладки
                setQuiz(res.data);
            })
            .catch(err => console.error("Ошибка загрузки теста:", err));
    }, [lessonId]);

    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitQuiz = () => {
        const answers = Object.entries(selectedAnswers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            choice_id: oId // Исправлено под твой Serializer (там choice_id)
        }));
        
        api.post(`quizzes/${quiz.id}/submit/`, { answers }) // Проверь URL submit'а в urls.py
            .then(res => setResult(res.data))
            .catch(err => alert("Ошибка при отправке"));
    };

    // 1. Экран загрузки
    if (!quiz) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-ring loading-lg text-primary"></span>
        </div>
    );

    // 2. ЗАЩИТА ОТ ПУСТОГО ТЕСТА (Чтобы не было белого экрана)
    const questions = quiz.questions || [];
    
    if (questions.length === 0) {
        return (
            <div className="max-w-md mx-auto text-center mt-20 p-6 card bg-base-100 shadow-xl">
                <h2 className="text-2xl font-bold mb-4">😔 Пусто</h2>
                <p>В этом тесте пока нет вопросов. Попробуйте сгенерировать их через AI или добавьте вручную.</p>
                <button className="btn btn-primary mt-6" onClick={() => navigate(-1)}>Назад</button>
            </div>
        );
    }

    
    // 3. Экран результата (Обновленный)
    if (result) {
        // Определяем, сдал ли студент (порог 70%)
        const isSuccess = result.score >= 70;

        return (
            <div className="max-w-md mx-auto text-center py-10">
                <div className={`card bg-base-100 shadow-xl border-t-8 ${isSuccess ? 'border-success' : 'border-error'} animate-bounce-short`}>
                    <div className="card-body items-center">
                        {/* Иконка меняется в зависимости от успеха */}
                        <div className="text-7xl mb-4">
                            {isSuccess ? '🏆' : '😕'}
                        </div>
                        
                        <h2 className="card-title text-2xl">
                            {isSuccess ? 'Поздравляем!' : 'Тест не сдан'}
                        </h2>
                        
                        <div className="stat place-items-center">
                            <div className="stat-title">Ваш результат</div>
                            {/* Цвет цифры тоже меняется */}
                            <div className={`stat-value ${isSuccess ? 'text-success' : 'text-error'}`}>
                                {result.score}%
                            </div>
                        </div>
                        
                        <p className="text-base-content/60 px-4 mt-2">
                            {isSuccess 
                                ? 'Вы отлично справились! Результат сохранен.' 
                                : 'Не расстраивайтесь! Повторите материал урока и попробуйте снова.'}
                        </p>
                        
                        <div className="card-actions mt-8 flex-col w-full gap-3">
                            <button className="btn btn-primary btn-wide" onClick={() => navigate('/courses')}>
                                К списку курсов
                            </button>
                            
                            {/* Если не сдал - можно добавить кнопку рестарта (опционально) */}
                            {!isSuccess && (
                                <button className="btn btn-ghost btn-wide" onClick={() => window.location.reload()}>
                                    Попробовать еще раз
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Текущий вопрос
    const currentQuestion = questions[currentIndex];
    
    // ВАЖНО: В Serializer поле называется 'choices', а не 'options'
    const choices = currentQuestion.choices || []; 

    return (
        <div className="max-w-2xl mx-auto py-10">
            {/* Степпер прогресса */}
            <div className="mb-10 px-4">
                <ul className="steps w-full">
                    {questions.map((_, i) => (
                        <li key={i} className={`step ${i <= currentIndex ? 'step-primary' : ''}`}></li>
                    ))}
                </ul>
                <div className="flex justify-between text-xs mt-4 font-bold text-base-content/40 uppercase tracking-widest">
                    <span>Вопрос {currentIndex + 1}</span>
                    <span>Всего {questions.length}</span>
                </div>
            </div>

            <div className="card bg-base-100 shadow-2xl border border-base-200">
                <div className="card-body p-8">
                    <h2 className="text-2xl font-bold mb-8 leading-tight">{currentQuestion.text}</h2>
                    
                    <div className="grid gap-4">
                        {choices.map(choice => (
                            <label 
                                key={choice.id} 
                                className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                                    selectedAnswers[currentQuestion.id] === choice.id 
                                    ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                                    : 'border-base-200 hover:border-primary/40 hover:bg-base-200'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name={`q-${currentQuestion.id}`}
                                    className="radio radio-primary radio-sm mr-4"
                                    checked={selectedAnswers[currentQuestion.id] === choice.id}
                                    onChange={() => handleAnswer(currentQuestion.id, choice.id)}
                                />
                                <span className="font-semibold text-lg">{choice.text}</span>
                            </label>
                        ))}
                    </div>

                    <div className="card-actions justify-between mt-12">
                        <button 
                            className="btn btn-ghost" 
                            disabled={currentIndex === 0}
                            onClick={() => setCurrentIndex(v => v - 1)}
                        >
                            Назад
                        </button>
                        
                        {currentIndex < questions.length - 1 ? (
                            <button 
                                className="btn btn-primary px-10"
                                disabled={!selectedAnswers[currentQuestion.id]}
                                onClick={() => setCurrentIndex(v => v + 1)}
                            >
                                Далее
                            </button>
                        ) : (
                            <button 
                                className="btn btn-success px-10 text-white"
                                disabled={!selectedAnswers[currentQuestion.id]}
                                onClick={submitQuiz}
                            >
                                Завершить
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default QuizPage;