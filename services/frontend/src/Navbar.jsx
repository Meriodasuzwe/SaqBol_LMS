import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import api from './api';
import { toast } from 'react-toastify';
import {
    BookOpen, LayoutDashboard, User, LogOut, ChevronDown,
    Sun, Moon, GraduationCap, ExternalLink, X, Sparkles
} from 'lucide-react';

function Navbar({ isLoggedIn, userRole, onLogout }) {
    const isTeacher = userRole === 'teacher' || userRole === 'admin';
    const location  = useLocation();

    const [theme, setTheme]       = useState(localStorage.getItem('theme') || 'light');
    const [user, setUser]         = useState(null);
    const [dropOpen, setDropOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const dropRef = useRef(null);

    const [modalOpen, setModalOpen]    = useState(false);
    const [cvText, setCvText]          = useState('');
    const [portfolioUrl, setPortfolio] = useState('');
    const [submitting, setSubmitting]  = useState(false);

    const isDark = theme === 'dark';

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (isLoggedIn) api.get('users/me/').then(r => setUser(r.data)).catch(() => {});
        else setUser(null);
    }, [isLoggedIn]);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    useEffect(() => {
        const fn = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);

    useEffect(() => { setMobileOpen(false); setDropOpen(false); }, [location.pathname]);

    const getAvatarUrl = path => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return `http://localhost:8000${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const submitAuthor = async () => {
        if (!cvText) { toast.warning('Расскажите о своём опыте'); return; }
        setSubmitting(true);
        try {
            const r = await api.post('users/apply-teacher/', { cv_text: cvText, portfolio_url: portfolioUrl });
            toast.success('🎓 ' + r.data.message);
            setModalOpen(false); setCvText(''); setPortfolio('');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Ошибка при отправке заявки');
        } finally { setSubmitting(false); }
    };

    const isActive = path => location.pathname === path || location.pathname.startsWith(path + '/');

    const displayName = user?.first_name
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || 'Пользователь';
    const initials = displayName.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

    // Theme-aware inline style tokens — работают поверх DaisyUI
    const t = {
        nav:      isDark ? 'rgba(30,30,35,0.97)'  : 'rgba(255,255,255,0.97)',
        border:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        shadow:   isDark ? '0 1px 0 rgba(255,255,255,0.05)' : '0 1px 0 rgba(0,0,0,0.07)',
        text:     isDark ? '#f1f5f9' : '#0f172a',
        textMute: isDark ? '#94a3b8' : '#64748b',
        hover:    isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
        panel:    isDark ? '#1e1e24' : '#ffffff',
        panelBdr: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
        panelHdr: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
        itemHov:  isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
        iconBg:   isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
        input:    isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
        inputBdr: isDark ? 'rgba(255,255,255,0.1)'  : '#e2e8f0',
        divider:  isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
    };

    const NavLink = ({ to, icon, children }) => {
        const active = isActive(to);
        return (
            <Link to={to} style={{ color: active ? '#3b82f6' : t.textMute, fontFamily: 'inherit' }}
                className="relative flex items-center gap-1.5 px-1 py-1.5 text-sm font-semibold transition-colors duration-150 group hover:opacity-100"
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = t.text; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = t.textMute; }}>
                {icon}
                {children}
                <span style={{
                    position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
                    borderRadius: 9, background: '#3b82f6',
                    transform: active ? 'scaleX(1)' : 'scaleX(0)',
                    opacity: active ? 1 : 0,
                    transition: 'transform 0.2s, opacity 0.2s',
                }} />
            </Link>
        );
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                @keyframes dropIn {
                    from { opacity:0; transform:translateY(-6px) scale(0.97); }
                    to   { opacity:1; transform:none; }
                }
                .sq-drop  { animation: dropIn 0.15s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes slideD {
                    from { opacity:0; transform:translateY(-8px); }
                    to   { opacity:1; transform:none; }
                }
                .sq-slide { animation: slideD 0.2s cubic-bezier(0.16,1,0.3,1) both; }
            `}</style>

            {/* ── NAVBAR ── */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 40, width: '100%',
                background: t.nav,
                borderBottom: `1px solid ${t.border}`,
                boxShadow: scrolled ? (isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.06)') : 'none',
                backdropFilter: 'blur(16px)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: 'box-shadow 0.2s',
            }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', gap: 24 }}>

                    {/* Logo */}
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}>
                            <span style={{ color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: '-0.5px' }}>SQ</span>
                        </div>
                        <span style={{ fontWeight: 800, color: t.text, fontSize: 15, letterSpacing: '-0.3px' }}>
                            SaqBol <span style={{ fontWeight: 400, color: t.textMute }}>LMS</span>
                        </span>
                    </Link>

                    {/* Nav links */}
                    {isLoggedIn && (
                        <nav style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 8 }} className="hidden lg:flex">
                            <NavLink to="/courses" icon={<BookOpen size={14} style={{ opacity: 0.7 }} />}>Каталог курсов</NavLink>
                            {isTeacher && <NavLink to="/teacher" icon={<LayoutDashboard size={14} style={{ opacity: 0.7 }} />}>Панель управления</NavLink>}
                        </nav>
                    )}

                    {/* Right */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>

                        {/* Theme toggle */}
                        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMute, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = t.hover}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Сменить тему">
                            {isDark ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        {isLoggedIn ? (
                            /* User dropdown trigger */
                            <div style={{ position: 'relative' }} ref={dropRef}>
                                <button onClick={() => setDropOpen(o => !o)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 6px 6px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = t.hover}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#fff'}`, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}>
                                        {user?.avatar
                                            ? <img src={getAvatarUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb' }}>{initials}</span>
                                        }
                                    </div>
                                    <div className="hidden md:block" style={{ textAlign: 'left' }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: t.text, lineHeight: 1.2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                                        <p style={{ fontSize: 10, color: t.textMute, fontWeight: 500, textTransform: 'capitalize' }}>{userRole || 'студент'}</p>
                                    </div>
                                    <ChevronDown size={14} style={{ color: t.textMute, transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>

                                {dropOpen && (
                                    <div className="sq-drop" style={{
                                        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                                        width: 260, background: t.panel,
                                        border: `1px solid ${t.panelBdr}`,
                                        borderRadius: 18, overflow: 'hidden',
                                        boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.12)',
                                        zIndex: 50,
                                    }}>
                                        {/* Header */}
                                        <div style={{ padding: '16px', borderBottom: `1px solid ${t.divider}`, background: t.panelHdr }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {user?.avatar
                                                        ? <img src={getAvatarUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{initials}</span>
                                                    }
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                                                    <p style={{ fontSize: 11, color: t.textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <div style={{ padding: '6px' }}>
                                            {[
                                                { to: '/profile', icon: <User size={14} />, label: 'Личный кабинет', show: true },
                                                { to: '/teacher', icon: <LayoutDashboard size={14} />, label: 'Панель управления', show: isTeacher },
                                            ].filter(i => i.show).map(item => (
                                                <Link key={item.to} to={item.to} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, textDecoration: 'none', color: t.text, fontSize: 13, fontWeight: 500, transition: 'background 0.12s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = t.itemHov}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMute, flexShrink: 0 }}>
                                                        {item.icon}
                                                    </div>
                                                    {item.label}
                                                </Link>
                                            ))}

                                            {!isTeacher && (
                                                <button onClick={() => { setDropOpen(false); setModalOpen(true); }}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', color: t.text, fontSize: 13, fontWeight: 500, transition: 'background 0.12s', textAlign: 'left' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                                                        <Sparkles size={14} />
                                                    </div>
                                                    Стать автором
                                                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#3b82f6', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 6px', borderRadius: 99 }}>NEW</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Logout */}
                                        <div style={{ padding: '6px', borderTop: `1px solid ${t.divider}` }}>
                                            <button onClick={() => { setDropOpen(false); onLogout(); }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 500, transition: 'background 0.12s', textAlign: 'left' }}
                                                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                                                    <LogOut size={14} />
                                                </div>
                                                Выйти
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Link to="/login" className="hidden sm:block"
                                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: t.textMute, borderRadius: 10, textDecoration: 'none', transition: 'background 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = t.hover; e.currentTarget.style.color = t.text; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMute; }}>
                                    Войти
                                </Link>
                                <Link to="/register"
                                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, background: '#2563eb', color: '#fff', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                                    Регистрация
                                </Link>
                            </div>
                        )}

                        {/* Mobile burger */}
                        {isLoggedIn && (
                            <button onClick={() => setMobileOpen(o => !o)} className="lg:hidden"
                                style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                {[0,1,2].map(i => (
                                    <span key={i} style={{
                                        display: 'block', width: 16, height: 2, background: t.textMute, borderRadius: 2, transition: 'all 0.2s',
                                        transform: mobileOpen ? (i === 0 ? 'rotate(45deg) translate(5px,5px)' : i === 2 ? 'rotate(-45deg) translate(5px,-5px)' : 'scaleX(0)') : 'none',
                                        opacity: mobileOpen && i === 1 ? 0 : 1,
                                    }} />
                                ))}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileOpen && isLoggedIn && (
                    <div className="sq-slide lg:hidden" style={{ borderTop: `1px solid ${t.border}`, background: t.nav, padding: '8px 20px 16px' }}>
                        {[
                            { to: '/courses', icon: <BookOpen size={15} />, label: 'Каталог курсов', show: true },
                            { to: '/profile', icon: <User size={15} />, label: 'Личный кабинет', show: true },
                            { to: '/teacher', icon: <LayoutDashboard size={15} />, label: 'Панель управления', show: isTeacher },
                        ].filter(i => i.show).map(item => (
                            <Link key={item.to} to={item.to}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, textDecoration: 'none', marginBottom: 2, fontSize: 13, fontWeight: 600, color: isActive(item.to) ? '#3b82f6' : t.text, background: isActive(item.to) ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'transparent', transition: 'background 0.15s' }}
                                onMouseEnter={e => { if (!isActive(item.to)) e.currentTarget.style.background = t.hover; }}
                                onMouseLeave={e => { if (!isActive(item.to)) e.currentTarget.style.background = 'transparent'; }}>
                                {item.icon}{item.label}
                            </Link>
                        ))}
                        <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 8, paddingTop: 8 }}>
                            <button onClick={onLogout}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                                <LogOut size={15} /> Выйти
                            </button>
                        </div>
                    </div>
                )}
            </header>

            {/* ── MODAL ── */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <div style={{ position: 'absolute', inset: 0, background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }} onClick={() => setModalOpen(false)} />
                    <div className="sq-drop" style={{ position: 'relative', background: t.panel, border: `1px solid ${t.panelBdr}`, borderRadius: 20, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: isDark ? '0 25px 80px rgba(0,0,0,0.7)' : '0 25px 80px rgba(0,0,0,0.15)' }}>

                        {/* Header */}
                        <div style={{ padding: '20px 24px 18px', borderBottom: `1px solid ${t.divider}` }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <GraduationCap size={18} style={{ color: '#3b82f6' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 800, color: t.text, margin: 0 }}>Стать автором</h3>
                                        <p style={{ fontSize: 12, color: t.textMute, margin: 0 }}>Поделитесь знаниями со студентами</p>
                                    </div>
                                </div>
                                <button onClick={() => setModalOpen(false)}
                                    style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMute, transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = t.hover}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMute, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                                    О вас и вашем опыте <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea rows={4}
                                    placeholder="Расскажите о вашем опыте. Какие курсы планируете создать?"
                                    value={cvText} onChange={e => setCvText(e.target.value)}
                                    style={{ width: '100%', padding: '12px 14px', background: t.input, border: `1px solid ${t.inputBdr}`, borderRadius: 12, fontSize: 13, fontWeight: 500, color: t.text, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border 0.15s' }}
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={e => e.target.style.borderColor = t.inputBdr}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMute, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                                    Портфолио / LinkedIn
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <ExternalLink size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMute, pointerEvents: 'none' }} />
                                    <input type="url" placeholder="https://linkedin.com/in/ваше-имя"
                                        value={portfolioUrl} onChange={e => setPortfolio(e.target.value)}
                                        style={{ width: '100%', padding: '12px 14px 12px 36px', background: t.input, border: `1px solid ${t.inputBdr}`, borderRadius: 12, fontSize: 13, fontWeight: 500, color: t.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border 0.15s' }}
                                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={e => e.target.style.borderColor = t.inputBdr}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
                            <button onClick={() => setModalOpen(false)}
                                style={{ flex: 1, padding: '12px', border: `1px solid ${t.inputBdr}`, borderRadius: 12, fontSize: 13, fontWeight: 700, color: t.text, background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = t.hover}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                Отмена
                            </button>
                            <button onClick={submitAuthor} disabled={submitting || !cvText}
                                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', background: submitting || !cvText ? '#93c5fd' : '#2563eb', cursor: submitting || !cvText ? 'not-allowed' : 'pointer', transition: 'background 0.15s', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                                onMouseEnter={e => { if (!submitting && cvText) e.currentTarget.style.background = '#1d4ed8'; }}
                                onMouseLeave={e => { if (!submitting && cvText) e.currentTarget.style.background = '#2563eb'; }}>
                                {submitting ? 'Отправка...' : 'Отправить заявку'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;