import { useState } from 'react';
import api from './api';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

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
            toast.success(`👋 С возвращением, ${username}!`);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            setError('Неверное имя пользователя или пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-base-200 py-12 px-4 sm:px-6 lg:px-8">
            <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-8">
                    <h2 className="text-3xl font-bold text-center text-primary mb-6">
                        Вход в SaqBol
                    </h2>
                    
                    {error && (
                        <div className="alert alert-error mb-4 text-sm shadow-sm">
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-control w-full">
                            <label className="label pt-0">
                                <span className="label-text font-semibold text-gray-600">Логин</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ваш логин"
                                className="input input-bordered w-full focus:input-primary bg-gray-50"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-control w-full">
                            <label className="label pt-0">
                                <span className="label-text font-semibold text-gray-600">Пароль</span>
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="input input-bordered w-full focus:input-primary bg-gray-50"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            className={`btn btn-primary w-full text-lg mt-4 ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Входим...' : 'Войти'}
                        </button>
                    </form>

                    <div className="divider my-6">ИЛИ</div>

                    <p className="text-center text-sm text-gray-600">
                        Нет аккаунта?{' '}
                        <Link to="/register" className="link link-primary font-bold hover:text-primary-focus transition-colors">
                            Зарегистрироваться
                        </Link>
                    </p>

                    <div className="text-center mt-6">
                        <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">
                            LMS System v1.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;