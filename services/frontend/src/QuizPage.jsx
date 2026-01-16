import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function QuizPage() {
    const { lessonId } = useParams();
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [result, setResult] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Загружаем тест для конкретного урока
        api.get(`quizzes/lesson/${lessonId}/`)
            .then(res => setQuiz(res.data))
            .catch(err => console.error("Тест не найден", err));
    }, [lessonId]);

    const handleSelect = (questionId, choiceId) => {
        setAnswers(prev => {
            const filtered = prev.filter(a => a.question_id !== questionId);
            return [...filtered, { question_id: questionId, choice_id: choiceId }];
        });
    };

    const handleSubmit = async () => {
        try {
            const res = await api.post(`quizzes/${quiz.id}/submit/`, { answers });
            setResult(res.data);
        } catch (err) {
            alert("Ошибка при отправке теста");
        }
    };

    if (!quiz) return <p>Загрузка теста...</p>;
    
    if (result) return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2>Результат: {result.score}%</h2>
            <p>Статус: <strong>{result.status}</strong></p>
            <button onClick={() => navigate('/courses')}>К списку курсов</button>
        </div>
    );

    return (
        <div style={{ padding: '20px' }}>
            <h2>{quiz.title}</h2>
            {quiz.questions.map(q => (
                <div key={q.id} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
                    <p><strong>{q.text}</strong></p>
                    {q.choices.map(c => (
                        <label key={c.id} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name={`question-${q.id}`} 
                                onChange={() => handleSelect(q.id, c.id)} 
                            />
                            {c.text}
                        </label>
                    ))}
                </div>
            ))}
            <button onClick={handleSubmit} style={{ 
                marginTop: '20px', 
                padding: '10px 25px', 
                backgroundColor: '#2ecc71', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer' 
            }}>
                Отправить ответы
            </button>
        </div>
    );
}

export default QuizPage;