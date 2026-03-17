import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

const VerifyEmail = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const initialEmail = location.state?.email || '';

    const [email, setEmail]         = useState(initialEmail);
    const [code, setCode]           = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [timeLeft, setTimeLeft]   = useState(60);
    const [isResending, setIsResending] = useState(false);

    // Таймер обратного отсчёта
    useEffect(() => {
        if (timeLeft > 0) {
            const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
            return () => clearTimeout(id);
        }
    }, [timeLeft]);

    // Проверка кода
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (code.length !== 6) { setError('Код должен состоять ровно из 6 цифр'); return; }
        setLoading(true);
        try {
            await api.post('users/verify-email/', { email, code });
            toast.success('🎉 Аккаунт успешно подтверждён! Добро пожаловать.');
            navigate('/login');
        } catch (err) {
            console.error(err);
            if (err.response?.data) {
                const msg = Object.values(err.response.data).flat().join(', ');
                setError(msg || 'Неверный код или срок его действия истёк.');
            } else {
                setError('Ошибка соединения с сервером');
            }
        } finally {
            setLoading(false);
        }
    };

    // Повторная отправка кода
    const handleResendCode = async () => {
        if (!email) { setError('Пожалуйста, укажите email для отправки кода.'); return; }
        setIsResending(true);
        setError('');
        try {
            await api.post('users/resend-verification/', { email });
            toast.info('🚀 Новый код летит к вам на почту!');
            setTimeLeft(60);
        } catch (err) {
            setError(err.response?.data?.error || 'Не удалось отправить код. Попробуйте позже.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                .auth-input {
                    width: 100%; padding: 12px 16px;
                    background: #f8fafc; border: 1.5px solid #e2e8f0;
                    border-radius: 12px; font-size: 14px; font-weight: 500;
                    color: #0f172a; outline: none; box-sizing: border-box;
                    font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
                }
                .auth-input::placeholder { color: #94a3b8; }
                .auth-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); background: #fff; }
                .auth-input.has-error { border-color: #fca5a5; }

                .code-input {
                    width: 100%; padding: 16px;
                    background: #f8fafc; border: 1.5px solid #e2e8f0;
                    border-radius: 16px; font-size: 28px; font-weight: 700;
                    color: #0f172a; outline: none; box-sizing: border-box;
                    text-align: center; letter-spacing: 0.5em;
                    font-family: 'Courier New', monospace;
                    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
                }
                .code-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); background: #fff; }
                .code-input.has-error { border-color: #fca5a5; }

                [data-theme='dark'] .auth-page   { background-color: #111318 !important; }
                [data-theme='dark'] .auth-card   { background-color: #1e2028 !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: 0 24px 64px rgba(0,0,0,0.5) !important; }
                [data-theme='dark'] .auth-title  { color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-sub    { color: #475569 !important; }
                [data-theme='dark'] .auth-label  { color: #64748b !important; }
                [data-theme='dark'] .auth-input  { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-input::placeholder { color: #475569 !important; }
                [data-theme='dark'] .auth-input:focus { border-color: #3b82f6 !important; background: rgba(255,255,255,0.09) !important; }
                [data-theme='dark'] .code-input  { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #f1f5f9 !important; }
                [data-theme='dark'] .code-input:focus { border-color: #3b82f6 !important; background: rgba(255,255,255,0.09) !important; }
                [data-theme='dark'] .auth-hint   { color: #475569 !important; }
                [data-theme='dark'] .auth-sep    { background: rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .auth-timer  { color: #334155 !important; }
                [data-theme='dark'] .auth-timer span { color: #64748b !important; }
            `}</style>

            <div className="auth-page" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#f1f5f9',
                padding: '24px 16px', fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
                <div className="auth-card" style={{
                    width: '100%', maxWidth: 420,
                    background: '#fff', borderRadius: 24,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.07)',
                    padding: '40px 36px',
                }}>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <h1 className="auth-title" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                            Проверьте почту
                        </h1>
                        <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
                            Мы отправили 6-значный код на{' '}
                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{email || 'ваш email'}</span>
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca',
                            borderRadius: 12, padding: '11px 14px',
                            marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <span style={{ fontSize: 15 }}>⚠️</span>
                            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>

                        {/* Email (только если не передан через state) */}
                        {!initialEmail && (
                            <div style={{ marginBottom: 16 }}>
                                <label className="auth-label" style={{
                                    display: 'block', fontSize: 11, fontWeight: 700,
                                    color: '#475569', textTransform: 'uppercase',
                                    letterSpacing: '0.07em', marginBottom: 7,
                                }}>
                                    Ваш Email
                                </label>
                                <input
                                    type="email"
                                    className="auth-input"
                                    placeholder="example@mail.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        {/* Code input */}
                        <div style={{ marginBottom: 24 }}>
                            <label className="auth-label" style={{
                                display: 'block', fontSize: 11, fontWeight: 700,
                                color: '#475569', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: 10, textAlign: 'center',
                            }}>
                                Код подтверждения
                            </label>
                            <input
                                type="text"
                                className={`code-input${error ? ' has-error' : ''}`}
                                maxLength="6"
                                placeholder="· · · · · ·"
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                required
                                autoFocus
                            />
                            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8, fontWeight: 500 }}>
                                Введите 6 цифр из письма
                            </p>
                        </div>

                        {/* Submit */}
                        <button type="submit"
                            disabled={loading || code.length !== 6 || !email}
                            style={{
                                width: '100%', padding: '13px',
                                background: loading || code.length !== 6 || !email ? '#93c5fd' : '#2563eb',
                                color: '#fff', border: 'none', borderRadius: 12,
                                fontSize: 14, fontWeight: 700,
                                cursor: loading || code.length !== 6 || !email ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                                boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                                fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => { if (!loading && code.length === 6 && email) e.currentTarget.style.background = '#1d4ed8'; }}
                            onMouseLeave={e => { if (!loading && code.length === 6 && email) e.currentTarget.style.background = '#2563eb'; }}>
                            {loading ? 'Проверка...' : 'Подтвердить'}
                        </button>
                    </form>

                    {/* Resend block */}
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <p className="auth-hint" style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 500 }}>
                            Код не пришёл или истёк срок действия?
                        </p>

                        {timeLeft > 0 ? (
                            <p className="auth-timer" style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                                Отправить повторно через{' '}
                                <span style={{ fontWeight: 700, color: '#64748b' }}>{timeLeft} сек</span>
                            </p>
                        ) : (
                            <button
                                onClick={handleResendCode}
                                disabled={isResending}
                                style={{
                                    background: 'none', border: 'none', cursor: isResending ? 'not-allowed' : 'pointer',
                                    fontSize: 13, fontWeight: 700, color: '#2563eb',
                                    padding: '6px 12px', borderRadius: 8, transition: 'background 0.15s',
                                    opacity: isResending ? 0.6 : 1, fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => { if (!isResending) e.currentTarget.style.background = '#eff6ff'; }}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                {isResending ? 'Отправляем...' : 'Отправить код повторно'}
                            </button>
                        )}

                        <div style={{ marginTop: 12 }}>
                            <Link to="/register"
                                className="auth-hint"
                                style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                                Зарегистрироваться с другим email
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default VerifyEmail;