import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
    const [error, setError]             = useState('');
    const [loading, setLoading]         = useState(false);
    const [showPassword, setShowPassword]         = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    // Сила пароля
    const getPasswordStrength = (pass) => {
        if (!pass) return null;
        if (pass.length < 6)                        return { label: 'Слабый',   color: '#f87171', width: '33%' };
        if (pass.length < 10 || !/\d/.test(pass))  return { label: 'Средний',  color: '#fb923c', width: '66%' };
        return                                             { label: 'Надёжный', color: '#34d399', width: '100%' };
    };
    const strength = getPasswordStrength(formData.password);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (formData.password.length < 6) { setError('Пароль должен содержать минимум 6 символов.'); return; }
        if (formData.password !== formData.confirmPassword) {
            setError('Пароли не совпадают!');
            toast.warn('⚠️ Пароли не совпадают');
            return;
        }
        setLoading(true);
        try {
            await api.post('users/register/', {
                username: formData.username,
                email: formData.email,
                password: formData.password,
            });
            toast.success('Отлично! Остался один шаг: проверьте почту.');
            navigate('/verify-email', { state: { email: formData.email } });
        } catch (err) {
            console.error(err);
            if (err.response?.data) {
                const msg = Object.values(err.response.data).flat().join(', ');
                setError(msg || 'Ошибка регистрации');
            } else {
                setError('Ошибка соединения с сервером');
            }
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (hasError) => ({
        base: `auth-input${hasError ? ' has-error' : ''}`,
    });

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
                [data-theme='dark'] .auth-sep   { background: rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .auth-hint  { color: #475569 !important; }
                [data-theme='dark'] .auth-strength-bg { background: rgba(255,255,255,0.08) !important; }
                [data-theme='dark'] .auth-version { color: #1e293b !important; }
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
                        <h1 className="auth-title" style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                            Создать аккаунт
                        </h1>
                        <p className="auth-sub" style={{ fontSize: 13, color: '#64748b', margin: 0, fontWeight: 500 }}>
                            Присоединитесь к SaqBol LMS
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '11px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15 }}>⚠️</span>
                            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>

                        {/* Username */}
                        <div style={{ marginBottom: 14 }}>
                            <label className="auth-label" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                                Логин <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <input type="text" name="username" className="auth-input" placeholder="Придумайте логин" onChange={handleChange} required />
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 14 }}>
                            <label className="auth-label" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                                Email <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <input type="email" name="email" className="auth-input" placeholder="example@mail.com" onChange={handleChange} required />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 14 }}>
                            <label className="auth-label" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                                Пароль <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input type={showPassword ? 'text' : 'password'} name="password" className="auth-input" placeholder="••••••••" style={{ paddingRight: 44 }} onChange={handleChange} required />
                                <button type="button" onClick={() => setShowPassword(s => !s)}
                                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 6 }}
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
                            <label className="auth-label" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
                                Повторите пароль <span style={{ color: '#f87171' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" className="auth-input" placeholder="••••••••" style={{ paddingRight: 44 }} onChange={handleChange} required />
                                <button type="button" onClick={() => setShowConfirmPassword(s => !s)}
                                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 6 }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loading}
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
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = loading ? '#93c5fd' : '#2563eb'; }}>
                            {loading ? 'Создаём...' : 'Создать аккаунт'}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="auth-hint" style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '20px 0 0', fontWeight: 500 }}>
                        Уже есть аккаунт?{' '}
                        <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                            Войти
                        </Link>
                    </p>

                </div>
            </div>
        </>
    );
};

export default Register;