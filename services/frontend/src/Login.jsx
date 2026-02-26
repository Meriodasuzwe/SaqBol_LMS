import { useState } from 'react';
import api from './api';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
// НОВОЕ: Импортируем компонент кнопки Google
import { GoogleLogin } from '@react-oauth/google';

function Login({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    
    const navigate = useNavigate();

    // Стандартный логин по паролю
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
            setError('Неверный логин, email или пароль');
        } finally {
            setLoading(false);
        }
    };

    // НОВОЕ: Логин через Google
    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            // Отправляем Google-токен на наш бэкенд
            const response = await api.post('users/google-login/', { 
                credential: credentialResponse.credential 
            });
            
            // Бэкенд проверил токен и вернул НАШИ токены системы SaqBol
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            
            toast.success(`👋 Привет, ${response.data.username}!`);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            console.error(err);
            setError('Ошибка авторизации через Google. Попробуйте снова.');
            toast.error('Сбой при входе через Google');
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
                                <span className="label-text font-semibold text-gray-600">Логин или Email</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Введите логин или почту"
                                className="input input-bordered w-full focus:input-primary bg-gray-50"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-control w-full relative">
                            <label className="label pt-0">
                                <span className="label-text font-semibold text-gray-600">Пароль</span>
                            </label>
                            
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="input input-bordered w-full focus:input-primary bg-gray-50 pr-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-primary transition-colors"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            <div className="flex justify-between items-center mt-3 px-1">
                                <label className="cursor-pointer flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe}
                                        onChange={() => setRememberMe(!rememberMe)}
                                        className="checkbox checkbox-xs checkbox-primary rounded-sm" 
                                    />
                                    <span className="text-xs text-gray-600 font-medium">Запомнить меня</span>
                                </label>
                                <Link to="/forgot-password" className="text-xs text-primary font-bold hover:underline">
                                    Забыли пароль?
                                </Link>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className={`btn btn-primary w-full text-lg mt-6 shadow-md ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? 'Входим...' : 'Войти'}
                        </button>
                    </form>

                    {/* НОВОЕ: Секция входа через Google */}
                    <div className="divider my-6 text-gray-400 text-sm">ИЛИ</div>

                    <div className="flex justify-center mb-6">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                                toast.error('Сбой при входе через Google');
                                setError('Не удалось связаться с Google');
                            }}
                            useOneTap
                            shape="rectangular"
                            theme="outline"
                            text="continue_with"
                            size="large"
                            width="100%"
                        />
                    </div>

                    <p className="text-center text-sm text-gray-600 mt-2">
                        Нет аккаунта?{' '}
                        <Link to="/register" className="link link-primary font-bold hover:text-primary-focus transition-colors">
                            Зарегистрироваться
                        </Link>
                    </p>

                    <div className="text-center mt-6">
                        <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">
                            SaqBol LMS v1.0
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;