import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';

function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            // Используем твой проверенный эндпоинт
            const response = await api.post('users/login/', { username, password });
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            
            onLoginSuccess(); // Обновляем состояние в App.jsx
            navigate('/courses'); // Перенаправляем на список курсов
        } catch (error) {
            const errorMsg = error.response?.data?.detail || "Ошибка входа";
            alert(errorMsg);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '10px', marginTop: '50px' }}>
            <h2>Вход в SaqBol LMS</h2>
            <form onSubmit={handleLogin}>
                <input 
                    type="text" 
                    placeholder="Логин" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)} 
                    style={{ marginBottom: '10px', padding: '8px', width: '100%' }}
                /><br />
                <input 
                    type="password" 
                    placeholder="Пароль" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                    style={{ marginBottom: '10px', padding: '8px', width: '100%' }}
                /><br />
                <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>Войти</button>
            </form>
        </div>
    );
}

export default Login;