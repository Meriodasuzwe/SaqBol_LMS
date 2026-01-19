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
            .then(res => setQuiz(res.data))
            .catch(err => console.error(err));
    }, [lessonId]);

    const handleAnswer = (questionId, optionId) => {
        setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const submitQuiz = () => {
        const answers = Object.entries(selectedAnswers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            selected_option_id: oId
        }));
        
        api.post('quizzes/attempt/', { lesson_id: lessonId, answers })
            .then(res => setResult(res.data))
            .catch(err => alert("Ошибка при отправке"));
    };

    if (!quiz) return <div className="text-center mt-20"><span className="loading loading-ring loading-lg text-primary"></span></div>;

    if (result) {
        return (
            <div className="max-w-md mx-auto text-center py-10">
                <div className="card bg-base-100 shadow-xl border-t-8 border-success animate-bounce-short">
                    <div className="card-body items-center">
                        <div className="text-7xl mb-4">🏆</div>
                        <h2 className="card-title text-2xl">Поздравляем!</h2>
                        <div className="stat place-items-center">
                            <div className="stat-title">Ваш результат</div>
                            <div className="stat-value text-success">{result.score}%</div>
                        </div>
                        <p className="text-base-content/60 px-4">Вы отлично справились! Результаты сохранены в вашем профиле.</p>
                        <div className="card-actions mt-8">
                            <button className="btn btn-primary btn-wide" onClick={() => navigate('/courses')}>К списку курсов</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentQuestion = quiz.questions[currentIndex];

    return (
        <div className="max-w-2xl mx-auto">
            {/* Степпер прогресса */}
            <div className="mb-10 px-4">
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
                <div className="card-body p-8">
                    <h2 className="text-2xl font-bold mb-8 leading-tight">{currentQuestion.text}</h2>
                    
                    <div className="grid gap-4">
                        {currentQuestion.options.map(option => (
                            <label 
                                key={option.id} 
                                className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
                                    selectedAnswers[currentQuestion.id] === option.id 
                                    ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                                    : 'border-base-200 hover:border-primary/40 hover:bg-base-200'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name={`q-${currentQuestion.id}`}
                                    className="radio radio-primary radio-sm mr-4"
                                    checked={selectedAnswers[currentQuestion.id] === option.id}
                                    onChange={() => handleAnswer(currentQuestion.id, option.id)}
                                />
                                <span className="font-semibold text-lg">{option.text}</span>
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
                        
                        {currentIndex < quiz.questions.length - 1 ? (
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