import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

const ResetPassword = () => {
    // Получаем параметры из URL
    const { uidb64, token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getPasswordStrength = (pass) => {
        if (!pass) return { width: 'w-0', color: 'bg-gray-200', text: '' };
        if (pass.length < 6) return { width: 'w-1/3', color: 'bg-error', text: 'Слабый' };
        if (pass.length < 10 || !/\d/.test(pass)) return { width: 'w-2/3', color: 'bg-warning', text: 'Средний' };
        return { width: 'w-full', color: 'bg-success', text: 'Надежный' };
    };

    const strength = getPasswordStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Пароль должен содержать минимум 6 символов.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Пароли не совпадают!');
            return;
        }

        setLoading(true);
        try {
            await api.post('users/password-reset-confirm/', {
                uidb64,
                token,
                password,
            });

            toast.success('Пароль успешно изменен! Теперь вы можете войти.');
            navigate('/login');
        } catch (err) {
            setError('Ссылка недействительна или устарела. Попробуйте запросить новую.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-base-200 py-12 px-4 sm:px-6 lg:px-8">
            <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
                <div className="card-body p-8">
                    <h2 className="text-3xl font-bold text-center text-primary mb-6">
                        Новый пароль
                    </h2>

                    {error && <div className="alert alert-error text-sm shadow-sm mb-4">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-control w-full">
                            <label className="label pt-0">
                                <span className="label-text font-semibold text-gray-600">Новый пароль</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input input-bordered w-full focus:input-primary bg-gray-50 pr-10"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-primary"
                                >
                                    {showPassword ? 'Скрыть' : 'Показать'}
                                </button>
                            </div>
                            {password && (
                                <div className="mt-2">
                                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
                                    </div>
                                    <p className="text-xs text-right mt-1 text-gray-500">{strength.text}</p>
                                </div>
                            )}
                        </div>

                        <div className="form-control w-full">
                            <label className="label pt-0">
                                <span className="label-text font-semibold text-gray-600">Повторите пароль</span>
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input input-bordered w-full focus:input-primary bg-gray-50"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={`btn btn-primary w-full text-lg mt-4 ${loading ? 'loading' : ''}`}
                            disabled={loading || !password || !confirmPassword}
                        >
                            {loading ? 'Сохранение...' : 'Сохранить пароль'}
                        </button>
                    </form>
                    
                    <div className="mt-4 text-center">
                        <Link to="/login" className="text-sm text-gray-500 hover:text-primary transition-colors">
                            Вернуться ко входу
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;