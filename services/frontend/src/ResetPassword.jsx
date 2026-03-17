import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
    const { uidb64, token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword]       = useState(false);
    const [loading, setLoading]                 = useState(false);
    const [error, setError]                     = useState('');

    const getPasswordStrength = (pass) => {
        if (!pass) return null;
        if (pass.length < 6)                       return { label: 'Слабый',   color: '#f87171', width: '33%' };
        if (pass.length < 10 || !/\d/.test(pass)) return { label: 'Средний',  color: '#fb923c', width: '66%' };
        return                                            { label: 'Надёжный', color: '#34d399', width: '100%' };
    };

    const strength = getPasswordStrength(password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) { setError('Пароль должен содержать минимум 6 символов.'); return; }
        if (password !== confirmPassword) { setError('Пароли не совпадают!'); return; }

        setLoading(true);
        try {
            await api.post('users/password-reset-confirm/', { uidb64, token, password });
            toast.success('Пароль успешно изменён! Теперь вы можете войти.');
            navigate('/login');
        } catch (err) {
            setError('Ссылка недействительна или устарела. Попробуйте запросить новую.');
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
                [data-theme='dark'] .auth-strength-bg { background: rgba(255,255,255,0.08) !important; }
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
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 className="auth-title" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                            Новый пароль
                        </h1>
                        <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
                            Придумайте надёжный пароль для вашего аккаунта
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

                        {/* New password */}
                        <div style={{ marginBottom: 16 }}>
                            <label className="auth-label" style={{
                                display: 'block', fontSize: 11, fontWeight: 700,
                                color: '#475569', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: 7,
                            }}>
                                Новый пароль
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
                                <button type="button" onClick={() => setShowPassword(s => !s)}
                                    style={{
                                        position: 'absolute', right: 13, top: '50%',
                                        transform: 'translateY(-50%)', background: 'none',
                                        border: 'none', cursor: 'pointer', color: '#94a3b8',
                                        display: 'flex', alignItems: 'center', padding: 2, borderRadius: 6,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Strength bar */}
                            {strength && (
                                <div style={{ marginTop: 8 }}>
                                    <div className="auth-strength-bg" style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: 99, transition: 'width 0.3s, background 0.3s' }} />
                                    </div>
                                    <p style={{ fontSize: 11, color: strength.color, fontWeight: 600, textAlign: 'right', marginTop: 4, marginBottom: 0 }}>{strength.label}</p>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div style={{ marginBottom: 24 }}>
                            <label className="auth-label" style={{
                                display: 'block', fontSize: 11, fontWeight: 700,
                                color: '#475569', textTransform: 'uppercase',
                                letterSpacing: '0.07em', marginBottom: 7,
                            }}>
                                Повторите пароль
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`auth-input${error && !password ? ' has-error' : ''}`}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        {/* Submit */}
                        <button type="submit"
                            disabled={loading || !password || !confirmPassword}
                            style={{
                                width: '100%', padding: '13px',
                                background: loading || !password || !confirmPassword ? '#93c5fd' : '#2563eb',
                                color: '#fff', border: 'none', borderRadius: 12,
                                fontSize: 14, fontWeight: 700,
                                cursor: loading || !password || !confirmPassword ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                                boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                                fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => { if (!loading && password && confirmPassword) e.currentTarget.style.background = '#1d4ed8'; }}
                            onMouseLeave={e => { if (!loading && password && confirmPassword) e.currentTarget.style.background = '#2563eb'; }}>
                            {loading ? 'Сохранение...' : 'Сохранить пароль'}
                        </button>
                    </form>

                    {/* Back to login */}
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <Link to="/login"
                            className="auth-hint"
                            style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 500 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                            ← Вернуться ко входу
                        </Link>
                    </div>

                </div>
            </div>
        </>
    );
};

export default ResetPassword;