import { useState } from 'react';
import api from './api';
import { useNavigate, Link } from 'react-router-dom'; // Добавил Link

function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post('users/login/', { username, password });
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            setError('Неверное имя пользователя или пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center mt-12">
            <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200">
                <div className="card-body">
                    <h2 className="card-title text-2xl font-bold text-center justify-center mb-4">
                        Вход в SaqBol
                    </h2>
                    
                    {error && (
                        <div className="alert alert-error mb-4 py-2">
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Логин</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Введите ваш логин"
                                className="input input-bordered focus:input-primary"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-semibold">Пароль</span>
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="input input-bordered focus:input-primary"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="card-actions mt-6">
                            <button 
                                type="submit" 
                                className={`btn btn-primary btn-block ${loading ? 'loading' : ''}`}
                                disabled={loading}
                            >
                                {loading ? 'Входим...' : 'Войти'}
                            </button>
                        </div>
                    </form>

                    {/* --- ДОБАВЛЕНА ССЫЛКА НА РЕГИСТРАЦИЮ --- */}
                    <div className="text-center mt-4">
                        <span className="text-gray-500 text-sm">Нет аккаунта? </span>
                        <Link to="/register" className="link link-primary link-hover font-bold text-sm">
                            Зарегистрироваться
                        </Link>
                    </div>

                    <div className="text-center mt-4">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                            LMS System v1.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;