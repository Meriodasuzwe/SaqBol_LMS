import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Добавили переводы
import api from './api';
import { toast } from 'react-toastify';
import {
    Check, X, GraduationCap, BookOpen, User,
    AlertCircle, Send, ArrowRight, Eye,
} from 'lucide-react';

const AdminPanel = () => {
    const { t } = useTranslation(); // ✅ Инициализировали хук
    
    const [applications, setApplications] = useState([]);
    const [courses, setCourses] = useState([]);
    const [activeTab, setActiveTab] = useState('apps');
    const [loading, setLoading] = useState(true);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectData, setRejectData] = useState({ id: null, type: null, title: '' });
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const isDark = theme === 'dark';

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme) setTheme(currentTheme);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    // ✅ ФИКС: Переименовали t в themeColors, чтобы не конфликтовало с функцией перевода t()
    const themeColors = {
        bg:           isDark ? '#121216' : '#f8fafc',
        panel:        isDark ? '#1e1e24' : '#ffffff',
        panelBdr:     isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        text:         isDark ? '#f1f5f9' : '#0f172a',
        textMute:     isDark ? '#94a3b8' : '#64748b',
        hover:        isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
        divider:      isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
        activeTab:    isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff',
        activeText:   '#3b82f6',
        modalOverlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(15,23,42,0.4)',
    };

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'apps') {
                const res = await api.get('/users/admin/applications/pending/');
                setApplications(res.data);
            } else {
                const res = await api.get('/courses/admin/pending/');
                setCourses(res.data);
            }
        } catch (err) {
            toast.error(t('admin.toasts.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [activeTab]);

    const openRejectModal = (id, type, title) => {
        setRejectData({ id, type, title });
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectionReason.trim()) {
            toast.warning(t('admin.toasts.reasonRequired'));
            return;
        }
        setIsSubmitting(true);
        try {
            const endpoint = rejectData.type === 'app'
                ? `/users/admin/applications/${rejectData.id}/update/`
                : `/courses/admin/${rejectData.id}/reject/`;

            await api.patch(endpoint, {
                status: 'rejected',
                rejection_reason: rejectionReason
            });

            if (rejectData.type === 'app') setApplications(applications.filter(a => a.id !== rejectData.id));
            else setCourses(courses.filter(c => c.id !== rejectData.id));

            toast.info(t('admin.toasts.rejected'));
            setIsRejectModalOpen(false);
        } catch (err) {
            toast.error(t('admin.toasts.rejectError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprove = async (id, type) => {
        try {
            const endpoint = type === 'app'
                ? `/users/admin/applications/${id}/update/`
                : `/courses/admin/${id}/approve/`;

            await api.patch(endpoint, { status: type === 'app' ? 'accepted' : 'published' });

            if (type === 'app') setApplications(applications.filter(a => a.id !== id));
            else setCourses(courses.filter(c => c.id !== id));

            toast.success(t('admin.toasts.approved'));
        } catch (err) {
            toast.error(t('admin.toasts.approveError'));
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: themeColors.bg, padding: '40px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'background 0.3s' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>

                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: themeColors.text, margin: '0 0 8px 0' }}>{t('admin.title')}</h1>
                    <p style={{ color: themeColors.textMute, margin: 0, fontSize: 15 }}>{t('admin.subtitle')}</p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    {[
                        { key: 'apps',    icon: <GraduationCap size={18} />, label: t('admin.tabs.apps'), count: applications.length },
                        { key: 'courses', icon: <BookOpen size={18} />,      label: t('admin.tabs.courses'),  count: courses.length },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                            flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                            padding: '14px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 700,
                            background: activeTab === tab.key ? themeColors.activeTab : themeColors.panel,
                            color: activeTab === tab.key ? themeColors.activeText : themeColors.textMute,
                            boxShadow: activeTab === tab.key ? 'none' : '0 2px 10px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s', fontFamily: 'inherit',
                        }}>
                            {tab.icon} {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: themeColors.activeText }}>{t('admin.loading')}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {activeTab === 'apps' && applications.map(app => (
                            <div key={app.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 24, border: `1px solid ${themeColors.panelBdr}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: themeColors.activeTab, color: themeColors.activeText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div style={{ color: themeColors.text, fontWeight: 700 }}>{app.user_email}</div>
                                            <div style={{ color: themeColors.textMute, fontSize: 12 }}>{t('admin.app.role')}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => openRejectModal(app.id, 'app', app.user_email)}
                                            style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => handleApprove(app.id, 'app')}
                                            style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                                            <Check size={18} /> {t('admin.actions.approve')}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ background: themeColors.bg, padding: 16, borderRadius: 12, fontSize: 14, color: themeColors.text, lineHeight: 1.6 }}>
                                    <strong>{t('admin.app.about')}</strong> {app.cv_text}
                                    {app.portfolio_url && (
                                        <div style={{ marginTop: 8 }}>
                                            <a href={app.portfolio_url} target="_blank" rel="noreferrer" style={{ color: themeColors.activeText, textDecoration: 'none' }}>
                                                {t('admin.app.portfolio')} <ArrowRight size={12} style={{ display: 'inline' }} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {activeTab === 'courses' && courses.map(course => (
                            <div key={course.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 20, border: `1px solid ${themeColors.panelBdr}`, display: 'flex', alignItems: 'center', gap: 20 }}>
                                <div style={{ width: 80, height: 60, borderRadius: 12, background: themeColors.bg, overflow: 'hidden', flexShrink: 0 }}>
                                    {course.cover_image
                                        ? <img src={course.cover_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><BookOpen size={20} color={themeColors.textMute} /></div>
                                    }
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ margin: '0 0 4px 0', color: themeColors.text, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {course.title}
                                    </h3>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <p style={{ margin: 0, color: themeColors.textMute, fontSize: 12 }}>{course.teacher_name || t('admin.course.authorFallback')}</p>
                                        {course.lessons?.length > 0 && (
                                            <span style={{ fontSize: 11, color: themeColors.textMute }}>· {course.lessons.length} {t('admin.course.lessonsCount')}</span>
                                        )}
                                        {course.category_title && (
                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: themeColors.textMute }}>
                                                {course.category_title}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button
                                        onClick={() => window.open(`/courses/${course.id}`, '_blank')}
                                        style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                                        onMouseEnter={e => e.currentTarget.style.background = themeColors.hover}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <Eye size={16} /> {t('admin.actions.view')}
                                    </button>
                                    <button onClick={() => openRejectModal(course.id, 'course', course.title)}
                                        style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                        <X size={18} />
                                    </button>
                                    <button onClick={() => handleApprove(course.id, 'course')}
                                        style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: themeColors.activeText, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {t('admin.actions.publish')}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {(activeTab === 'apps' ? applications : courses).length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: themeColors.textMute, fontSize: 14 }}>
                                {t('admin.empty')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isRejectModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ position: 'absolute', inset: 0, background: themeColors.modalOverlay, backdropFilter: 'blur(4px)' }} onClick={() => setIsRejectModalOpen(false)} />
                    <div style={{ position: 'relative', background: themeColors.panel, width: '100%', maxWidth: 440, borderRadius: 24, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)', animation: 'dropIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, color: themeColors.text }}>{t('admin.modal.rejectTitle')}</h2>
                                <p style={{ margin: 0, fontSize: 13, color: themeColors.textMute }}>{t('admin.modal.object')} <strong>{rejectData.title}</strong></p>
                            </div>
                        </div>

                        <label style={{ fontSize: 12, fontWeight: 700, color: themeColors.textMute, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                            {t('admin.modal.reasonLabel')}
                        </label>
                        <textarea
                            rows={4}
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder={t('admin.modal.reasonPlaceholder')}
                            style={{ width: '100%', padding: 16, borderRadius: 16, border: `1px solid ${themeColors.divider}`, background: themeColors.bg, color: themeColors.text, fontSize: 14, outline: 'none', resize: 'none', marginBottom: 24, boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setIsRejectModalOpen(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {t('admin.actions.cancel')}
                            </button>
                            <button onClick={handleConfirmReject} disabled={isSubmitting}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                                {isSubmitting ? '...' : <><Send size={16} /> {t('admin.actions.send')}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes dropIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default AdminPanel;