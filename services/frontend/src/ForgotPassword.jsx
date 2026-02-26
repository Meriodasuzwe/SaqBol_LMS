import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Этот эндпоинт мы скоро создадим на бэкенде
            await api.post('users/password-reset/', { email });
            setIsSent(true);
            toast.success('Ссылка для восстановления отправлена на почту!');
        } catch (err) {
            setError('Не удалось отправить ссылку. Проверьте правильность email.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-base-200 py-12 px-4 sm:px-6 lg:px-8">
            <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-8">
                    <h2 className="text-3xl font-bold text-center text-primary mb-2">
                        Забыли пароль?
                    </h2>
                    <p className="text-center text-gray-500 mb-6 text-sm">
                        Введите email, привязанный к вашему аккаунту, и мы отправим вам инструкции по восстановлению.
                    </p>

                    {error && <div className="alert alert-error text-sm shadow-sm mb-4">{error}</div>}

                    {isSent ? (
                        <div className="text-center space-y-4">
                            <div className="alert alert-success shadow-sm text-sm">
                                <span>Письмо успешно отправлено! Проверьте вашу почту (и папку "Спам").</span>
                            </div>
                            <Link to="/login" className="btn btn-outline btn-primary w-full">
                                Вернуться ко входу
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="form-control w-full">
                                <label className="label pt-0">
                                    <span className="label-text font-semibold text-gray-600">Email</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="example@mail.com"
                                    className="input input-bordered w-full focus:input-primary bg-gray-50"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className={`btn btn-primary w-full text-lg mt-4 ${loading ? 'loading' : ''}`}
                                disabled={loading || !email}
                            >
                                {loading ? 'Отправка...' : 'Отправить ссылку'}
                            </button>
                        </form>
                    )}

                    {!isSent && (
                        <>
                            <div className="divider my-6">ИЛИ</div>
                            <p className="text-center text-sm text-gray-600">
                                Вспомнили пароль?{' '}
                                <Link to="/login" className="link link-primary font-bold hover:text-primary-focus transition-colors">
                                    Войти
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;