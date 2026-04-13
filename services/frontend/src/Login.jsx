import { useState } from 'react';
import api from './api';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GoogleLogin } from '@react-oauth/google';
import TelegramLoginButton from 'react-telegram-login';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next'; 

function Login({ onLoginSuccess }) {
    const { t } = useTranslation(); 

    const [username, setUsername]         = useState('');
    const [password, setPassword]         = useState('');
    const [error, setError]               = useState('');
    const [loading, setLoading]           = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe]     = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const isNewUser = location.state?.isNewUser;

    // Стандартный логин по паролю
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post('users/login/', { username, password });
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            toast.success(isNewUser ? `${t('auth.welcomeNew')}, ${username}!` : `${t('auth.welcomeBack')}, ${username}!`);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            setError(t('auth.errorInvalid'));
        } finally {
            setLoading(false);
        }
    };

    //  Google
    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.post('users/google-login/', {
                credential: credentialResponse.credential
            });
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            toast.success(isNewUser ? `${t('auth.welcomeNew')}, ${response.data.username}!` : `${t('auth.welcomeBack')}, ${response.data.username}!`);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            console.error(err);
            setError(t('auth.errorGoogle'));
            toast.error(t('auth.errorGoogleToast'));
        } finally {
            setLoading(false);
        }
    };

    //   Telegram
    const handleTelegramResponse = async (tgData) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.post('users/telegram-auth/', tgData);
            
            localStorage.setItem('access', response.data.access);
            localStorage.setItem('refresh', response.data.refresh);
            
            toast.success(isNewUser ? `${t('auth.welcomeNew')}, ${response.data.user.username}!` : `${t('auth.welcomeBack')}, ${response.data.user.username}!`);
            onLoginSuccess();
            navigate('/courses');
        } catch (err) {
            console.error(err);
            setError(t('auth.errorTelegram'));
            toast.error(t('auth.errorTelegramToast'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                .auth-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #0f172a;
                    outline: none;
                    box-sizing: border-box;
                    font-family: inherit;
                    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
                }
                .auth-input::placeholder { color: #94a3b8; }
                .auth-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                    background: #fff;
                }
                .auth-input.has-error { border-color: #fca5a5; }

                [data-theme='dark'] .auth-page  { background-color: #111318 !important; }
                [data-theme='dark'] .auth-card  { background-color: #1e2028 !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: 0 24px 64px rgba(0,0,0,0.5) !important; }
                [data-theme='dark'] .auth-title { color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-sub   { color: #475569 !important; }
                [data-theme='dark'] .auth-label { color: #64748b !important; }
                [data-theme='dark'] .auth-input { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-input::placeholder { color: #475569 !important; }
                [data-theme='dark'] .auth-input:focus { border-color: #3b82f6 !important; background: rgba(255,255,255,0.09) !important; }
                [data-theme='dark'] .auth-sep   { background: rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .auth-sep-t { color: #334155 !important; }
                [data-theme='dark'] .auth-hint  { color: #475569 !important; }
                [data-theme='dark'] .auth-remember { color: #475569 !important; }
                [data-theme='dark'] .auth-version  { color: #1e293b !important; }
                
                /* 🔥 Магия для кнопки Telegram: делаем единый размер с Google 🔥 */
                .tg-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 348px; /* Ширина в точности как у Google кнопки */
                    min-height: 44px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px; /* У Google кнопки shape="rectangular" обычно радиус 4px */
                    padding: 4px 0;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .tg-wrapper:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }
                [data-theme='dark'] .tg-wrapper {
                    background: rgba(255,255,255,0.03) !important;
                    border-color: rgba(255,255,255,0.08) !important;
                }
            `}</style>

            <div className="auth-page" style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                padding: '24px 16px',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
                <div className="auth-card" style={{
                    width: '100%',
                    maxWidth: 420,
                    background: '#fff',
                    borderRadius: 24,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.07)',
                    padding: '40px 36px',
                }}>

                    {/* ── Header ── */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 className="auth-title" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                            {t('auth.loginTitle')}
                        </h1>
                        <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
                            {t('auth.loginSubtitle')}
                        </p>
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 12,
                            padding: '11px 14px',
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <span style={{ fontSize: 15 }}>⚠️</span>
                            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{error}</span>
                        </div>
                    )}

                    {/* ── Form ── */}
                    <form onSubmit={handleSubmit}>

                        {/* Username */}
                        <div style={{ marginBottom: 16 }}>
                            <label className="auth-label" style={{
                                display: 'block', fontSize: 11, fontWeight: 700,
                                color: '#475569', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: 7,
                            }}>
                                {t('auth.loginOrEmail')}
                            </label>
                            <input
                                type="text"
                                className={`auth-input${error ? ' has-error' : ''}`}
                                placeholder={t('auth.loginPlaceholder')}
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 10 }}>
                            <label className="auth-label" style={{
                                display: 'block', fontSize: 11, fontWeight: 700,
                                color: '#475569', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: 7,
                            }}>
                                {t('auth.password')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className={`auth-input${error ? ' has-error' : ''}`}
                                    placeholder="••••••••"
                                    style={{ paddingRight: 44 }}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(s => !s)}
                                    style={{
                                        position: 'absolute', right: 13, top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none', border: 'none',
                                        cursor: 'pointer', color: '#94a3b8',
                                        display: 'flex', alignItems: 'center',
                                        padding: 2, borderRadius: 6,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember + Forgot */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <label
                                className="auth-remember"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500, userSelect: 'none' }}
                                onClick={() => setRememberMe(r => !r)}
                            >
                                <div style={{
                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                    border: `2px solid ${rememberMe ? '#3b82f6' : '#cbd5e1'}`,
                                    background: rememberMe ? '#3b82f6' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                }}>
                                    {rememberMe && (
                                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                {t('auth.rememberMe')}
                            </label>
                            <Link
                                to="/forgot-password"
                                style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >
                                {t('auth.forgotPassword')}
                            </Link>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '13px',
                                background: loading ? '#93c5fd' : '#2563eb',
                                color: '#fff', border: 'none', borderRadius: 12,
                                fontSize: 14, fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                                boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                                fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8'; }}
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = loading ? '#93c5fd' : '#2563eb'; }}
                        >
                            {loading ? t('auth.loggingIn') : t('auth.loginBtn')}
                        </button>
                    </form>

                    {/* ── Divider ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
                        <div className="auth-sep" style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                        <span className="auth-sep-t" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('auth.or')}</span>
                        <div className="auth-sep" style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                    </div>

                    {/* ── Social Logins ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        {/* Google */}
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                                toast.error(t('auth.errorGoogleToast'));
                                setError(t('auth.errorGoogle'));
                            }}
                            useOneTap
                            shape="rectangular"
                            theme="outline"
                            text="continue_with"
                            size="large"
                            width="348"
                        />

                        {/* Telegram 🔥 */}
                        <div className="tg-wrapper">
                            <TelegramLoginButton 
                                dataOnauth={handleTelegramResponse} 
                                botName="saqbol_authorization_bot" 
                                buttonSize="large" 
                                cornerRadius={12}
                                usePic={true} 
                            />
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <p className="auth-hint" style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 36, marginBottom: 20, fontWeight: 500 }}>
                        {t('auth.noAccount')} {' '}
                        <Link
                            to="/register"
                            style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                            {t('auth.registerBtn')}
                        </Link>
                    </p>

                    <p className="auth-version" style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#cbd5e1', margin: 0 }}>
                        SAQBOL LMS V1.0
                    </p>

                </div>
            </div>
        </>
    );
}

export default Login;