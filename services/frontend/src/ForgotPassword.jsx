import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import { Mail, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next'; 

const ForgotPassword = () => {
    const { t } = useTranslation(); 

    const [email, setEmail]     = useState('');
    const [loading, setLoading] = useState(false);
    const [isSent, setIsSent]   = useState(false);
    const [error, setError]     = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await api.post('users/password-reset/', { email });
            setIsSent(true);
            toast.success(t('auth.successForgotSend'));
        } catch (err) {
            setError(t('auth.errForgotSend'));
        } finally {
            setLoading(false);
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

                [data-theme='dark'] .auth-page  { background-color: #111318 !important; }
                [data-theme='dark'] .auth-card  { background-color: #1e2028 !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: 0 24px 64px rgba(0,0,0,0.5) !important; }
                [data-theme='dark'] .auth-title { color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-sub   { color: #475569 !important; }
                [data-theme='dark'] .auth-label { color: #64748b !important; }
                [data-theme='dark'] .auth-input { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; color: #f1f5f9 !important; }
                [data-theme='dark'] .auth-input::placeholder { color: #475569 !important; }
                [data-theme='dark'] .auth-input:focus { border-color: #3b82f6 !important; background: rgba(255,255,255,0.09) !important; }
                [data-theme='dark'] .auth-hint  { color: #475569 !important; }
                [data-theme='dark'] .auth-sep   { background: rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .auth-success-box { background: rgba(52,211,153,0.1) !important; border-color: rgba(52,211,153,0.25) !important; }
                [data-theme='dark'] .auth-success-text { color: #6ee7b7 !important; }
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

                    {isSent ? (
                        /* ── Success state ── */
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 56, height: 56, borderRadius: 18,
                                background: '#f0fdf4', marginBottom: 20,
                            }}>
                                <CheckCircle size={28} color="#22c55e" />
                            </div>
                            <h1 className="auth-title" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                                {t('auth.forgotSuccessTitle')}
                            </h1>
                            <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                                {t('auth.forgotSuccessDescPrefix')} <strong>{email}</strong>{t('auth.forgotSuccessDescSuffix')}
                            </p>
                            <Link to="/login"
                                style={{
                                    display: 'block', width: '100%', padding: '13px',
                                    background: '#2563eb', color: '#fff',
                                    borderRadius: 12, fontSize: 14, fontWeight: 700,
                                    textDecoration: 'none', textAlign: 'center',
                                    boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                                onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                                {t('auth.backToLogin')}
                            </Link>
                        </div>
                    ) : (
                        /* ── Form state ── */
                        <>
                            {/* Header */}
                            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                                <h1 className="auth-title" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                                    {t('auth.forgotTitle')}
                                </h1>
                                <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
                                    {t('auth.forgotSubtitle')}
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
                                <div style={{ marginBottom: 20 }}>
                                    <label className="auth-label" style={{
                                        display: 'block', fontSize: 11, fontWeight: 700,
                                        color: '#475569', textTransform: 'uppercase',
                                        letterSpacing: '0.07em', marginBottom: 7,
                                    }}>
                                        {t('auth.forgotEmailLabel')}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                                        <input
                                            type="email"
                                            className={`auth-input${error ? ' has-error' : ''}`}
                                            placeholder="example@mail.com"
                                            style={{ paddingLeft: 38 }}
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading || !email}
                                    style={{
                                        width: '100%', padding: '13px',
                                        background: loading || !email ? '#93c5fd' : '#2563eb',
                                        color: '#fff', border: 'none', borderRadius: 12,
                                        fontSize: 14, fontWeight: 700,
                                        cursor: loading || !email ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.15s',
                                        boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                                        fontFamily: 'inherit',
                                    }}
                                    onMouseEnter={e => { if (!loading && email) e.currentTarget.style.background = '#1d4ed8'; }}
                                    onMouseLeave={e => { if (!loading && email) e.currentTarget.style.background = '#2563eb'; }}>
                                    {loading ? t('auth.forgotSendingBtn') : t('auth.forgotSendBtn')}
                                </button>
                            </form>

                            {/* Divider + back */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
                                <div className="auth-sep" style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('auth.or')}</span>
                                <div className="auth-sep" style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                            </div>

                            <p className="auth-hint" style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
                                {t('auth.forgotRemembered')}{' '}
                                <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                                    {t('auth.loginBtn')}
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default ForgotPassword;