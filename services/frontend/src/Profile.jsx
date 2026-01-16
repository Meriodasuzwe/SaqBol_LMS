import { useEffect, useState } from 'react';
import api from './api';

function Profile() {
    const [userData, setUserData] = useState(null);
    const [results, setResults] = useState([]);

    useEffect(() => {
        // 1. Получаем данные профиля (нужен эндпоинт на бэкенде)
        api.get('users/me/')
            .then(res => setUserData(res.data))
            .catch(err => console.error("Ошибка загрузки профиля", err));

        // 2. Получаем историю тестов
        api.get('quizzes/my-results/')
            .then(res => setResults(res.data))
            .catch(err => console.error("Ошибка загрузки результатов", err));
    }, []);

    if (!userData) return <p>Загрузка профиля...</p>;

    return (
        <div style={{ padding: '20px' }}>
            <h2>Личный кабинет</h2>
            <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <p><strong>Логин:</strong> {userData.username}</p>
                <p><strong>Email:</strong> {userData.email || 'не указан'}</p>
                <p><strong>Роль:</strong> Студент</p>
            </div>

            <h3>📊 Мои результаты тестов:</h3>
            {results.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd' }}>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Тест</th>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Балл</th>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Дата</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map(res => (
                            <tr key={res.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '10px' }}>{res.quiz_title}</td>
                                <td style={{ padding: '10px', color: res.score >= 50 ? 'green' : 'red' }}>
                                    {res.score}%
                                </td>
                                <td style={{ padding: '10px' }}>{new Date(res.completed_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>Вы еще не проходили тесты.</p>
            )}
        </div>
    );
}

export default Profile;