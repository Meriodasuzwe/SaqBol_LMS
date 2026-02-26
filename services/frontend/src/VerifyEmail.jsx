import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

const VerifyEmail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    const initialEmail = location.state?.email || '';

    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // НОВОЕ: Стейты для повторной отправки кода (Senior UX 🔥)
    const [timeLeft, setTimeLeft] = useState(60); 
    const [isResending, setIsResending] = useState(false);

    // Таймер обратного отсчета
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [timeLeft]);

    // Функция проверки кода
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (code.length !== 6) {
            setError('Код должен состоять ровно из 6 цифр');
            return;
        }

        setLoading(true);

        try {
            await api.post('users/verify-email/', { email, code });
            toast.success('🎉 Аккаунт успешно подтвержден! Добро пожаловать.');
            navigate('/login');
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data) {
                const errorMsg = Object.values(err.response.data).flat().join(', ');
                setError(errorMsg || 'Неверный код или срок его действия истек.');
            } else {
                setError('Ошибка соединения с сервером');
            }
        } finally {
            setLoading(false);
        }
    };

    // Функция повторной отправки кода
    const handleResendCode = async () => {
        if (!email) {
            setError('Пожалуйста, укажите email для отправки кода.');
            return;
        }

        setIsResending(true);
        setError('');

        try {
            // ВАЖНО: Этот эндпоинт мы сейчас напишем на бэкенде!
            await api.post('users/resend-verification/', { email });
            toast.info('🚀 Новый код летит к вам на почту!');
            setTimeLeft(60); // Сбрасываем таймер снова на 60 секунд
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Не удалось отправить код. Попробуйте позже.');
            }
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-base-200 py-12 px-4 sm:px-6 lg:px-8 transition-all duration-300">
            <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-200/50">
                <div className="card-body p-8 sm:p-10">
                    <div className="text-center mb-6 animate-fade-in-down">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4 ring-4 ring-primary/5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-base-content tracking-tight mb-2">Проверьте почту</h2>
                        <p className="text-sm text-base-content/70">
                            Мы отправили 6-значный код на <br />
                            <span className="font-bold text-primary">{email || 'ваш email'}</span>
                        </p>
                    </div>

                    {error && (
                        <div className="alert alert-error text-sm shadow-sm mb-6 animate-pulse">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!initialEmail && (
                            <div className="form-control w-full">
                                <label className="label pt-0 pb-1">
                                    <span className="label-text font-semibold text-base-content/80">Ваш Email</span>
                                </label>
                                <input
                                    type="email"
                                    className="input input-bordered w-full focus:input-primary bg-base-200/50 transition-colors"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-control w-full">
                            <label className="label pt-0 pb-1 justify-center">
                                <span className="label-text font-bold text-base-content/80 tracking-wide uppercase text-xs">Код подтверждения</span>
                            </label>
                            <input
                                type="text"
                                maxLength="6"
                                placeholder="• • • • • •"
                                className="input input-bordered w-full text-center text-3xl tracking-[0.5em] font-mono focus:input-primary focus:ring-2 focus:ring-primary/20 bg-base-200/50 transition-all h-16"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary w-full text-lg mt-2 ${loading ? 'loading' : ''} shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all`}
                            disabled={loading || code.length !== 6 || !email}
                        >
                            {loading ? 'Проверка...' : 'Подтвердить'}
                        </button>
                    </form>

                    {/* Блок повторной отправки */}
                    <div className="mt-8 text-center border-t border-base-200 pt-6">
                        <p className="text-sm text-base-content/70 mb-2">
                            Код не пришел или истек срок действия?
                        </p>
                        
                        {timeLeft > 0 ? (
                            <p className="text-sm font-medium text-base-content/50 cursor-not-allowed">
                                Отправить повторно через <span className="font-bold text-base-content/80">{timeLeft} сек</span>
                            </p>
                        ) : (
                            <button 
                                onClick={handleResendCode}
                                disabled={isResending}
                                className={`btn btn-ghost btn-sm text-primary hover:bg-primary/10 transition-colors ${isResending ? 'loading' : ''}`}
                            >
                                {isResending ? 'Отправляем...' : 'Отправить код повторно'}
                            </button>
                        )}
                        
                        <div className="mt-4">
                            <Link to="/register" className="text-xs link link-hover text-base-content/50 hover:text-primary transition-colors">
                                Зарегистрироваться с другим email
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;