import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import { toast } from 'react-toastify';
import {
    Check, X, GraduationCap, BookOpen, User,
    AlertCircle, Send, ArrowRight, Eye, Briefcase, Mail, Key
} from 'lucide-react';

const AdminPanel = () => {
    const { t } = useTranslation();
    
    const [applications, setApplications] = useState([]);
    const [courses, setCourses] = useState([]);
    const [leads, setLeads] = useState([]); 
    
    const [activeTab, setActiveTab] = useState('apps');
    const [loading, setLoading] = useState(true);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectData, setRejectData] = useState({ id: null, type: null, title: '' });
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [generatedCodes, setGeneratedCodes] = useState({});

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
            } else if (activeTab === 'courses') {
                const res = await api.get('/courses/admin/pending/');
                setCourses(res.data);
            } else if (activeTab === 'leads') {
                const res = await api.get('courses/b2b/leads/');
                setLeads(res.data);
            }
        } catch (err) {
            toast.error(t('admin.toasts.loadError') || "Ошибка загрузки данных");
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
            toast.warning(t('admin.toasts.reasonRequired') || "Укажите причину");
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

            toast.info(t('admin.toasts.rejected') || "Отклонено");
            setIsRejectModalOpen(false);
        } catch (err) {
            toast.error(t('admin.toasts.rejectError') || "Ошибка");
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

            toast.success(t('admin.toasts.approved') || "Одобрено");
        } catch (err) {
            toast.error(t('admin.toasts.approveError') || "Ошибка");
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.patch(`courses/b2b/leads/${id}/update/`, { status: newStatus });
            setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
            toast.success("Статус успешно обновлен");
        } catch (err) {
            toast.error("Ошибка при обновлении статуса");
        }
    };

    const handleGenerateCode = async (leadId) => {
        try {
            const res = await api.post(`courses/b2b/leads/${leadId}/generate-invite/`);
            setGeneratedCodes(prev => ({ ...prev, [leadId]: res.data.code }));
            setLeads(leads.map(l => l.id === leadId ? { ...l, status: 'closed' } : l));
            toast.success(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.error || "Ошибка генерации кода");
        }
    };

    // 🔥 Функция для открытия Gmail в новой вкладке 🔥
    const handleSendEmailViaGmail = (email, inviteCode) => {
        const subject = encodeURIComponent("Доступ к платформе корпоративного обучения");
        const bodyText = inviteCode 
            ? `Здравствуйте!\n\nВаш корпоративный код доступа: ${inviteCode}\n\nПожалуйста, передайте его вашим сотрудникам.` 
            : `Здравствуйте!\n\nМы получили вашу заявку на корпоративное обучение.`;
        
        const body = encodeURIComponent(bodyText);
        
        // Ссылка, которая открывает страницу создания письма в Gmail
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        
        window.open(gmailUrl, '_blank');
    };

    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(navigator.language || 'ru-RU', options);
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'new': return { bg: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', color: '#3b82f6', border: '#bfdbfe' }; // Синий
            case 'contacted': return { bg: isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7', color: '#f59e0b', border: '#fde68a' }; // Желтый
            case 'closed': return { bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5', color: '#10b981', border: '#a7f3d0' }; // Зеленый
            // 🔥 Добавили стиль для статуса "Отклонена" 🔥
            case 'rejected': return { bg: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', border: '#fecaca' }; // Красный
            default: return { bg: themeColors.bg, color: themeColors.textMute, border: themeColors.divider };
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: themeColors.bg, padding: '40px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'background 0.3s' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>

                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: themeColors.text, margin: '0 0 8px 0' }}>{t('admin.title') || 'Панель управления'}</h1>
                    <p style={{ color: themeColors.textMute, margin: 0, fontSize: 15 }}>{t('admin.subtitle') || 'Управление заявками и курсами'}</p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: '4px' }}>
                    {[
                        { key: 'apps',    icon: <GraduationCap size={18} />, label: t('admin.tabs.apps') || 'Заявки', count: applications.length },
                        { key: 'courses', icon: <BookOpen size={18} />,      label: t('admin.tabs.courses') || 'Курсы',  count: courses.length },
                        { key: 'leads',   icon: <Briefcase size={18} />,     label: t('admin.tabs.leads') || 'B2B Заявки', count: leads.length },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                            flex: 1, minWidth: 'max-content', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                            padding: '14px 20px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 700,
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
                    <div style={{ textAlign: 'center', padding: '100px 0', color: themeColors.activeText }}>{t('admin.loading') || 'Загрузка...'}</div>
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
                                            <div style={{ color: themeColors.textMute, fontSize: 12 }}>{t('admin.app.role') || 'Пользователь'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => openRejectModal(app.id, 'app', app.user_email)}
                                            style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => handleApprove(app.id, 'app')}
                                            style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                                            <Check size={18} /> {t('admin.actions.approve') || 'Одобрить'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ background: themeColors.bg, padding: 16, borderRadius: 12, fontSize: 14, color: themeColors.text, lineHeight: 1.6 }}>
                                    <strong>{t('admin.app.about') || 'О себе:'}</strong> {app.cv_text}
                                    {app.portfolio_url && (
                                        <div style={{ marginTop: 8 }}>
                                            <a href={app.portfolio_url} target="_blank" rel="noreferrer" style={{ color: themeColors.activeText, textDecoration: 'none' }}>
                                                {t('admin.app.portfolio') || 'Портфолио'} <ArrowRight size={12} style={{ display: 'inline' }} />
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
                                            <span style={{ fontSize: 11, color: themeColors.textMute }}>· {course.lessons.length} {t('admin.course.lessonsCount') || 'уроков'}</span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button
                                        onClick={() => window.open(`/courses/${course.id}`, '_blank')}
                                        style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                                        onMouseEnter={e => e.currentTarget.style.background = themeColors.hover}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <Eye size={16} /> {t('admin.actions.view') || 'Смотреть'}
                                    </button>
                                    <button onClick={() => openRejectModal(course.id, 'course', course.title)}
                                        style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                        <X size={18} />
                                    </button>
                                    <button onClick={() => handleApprove(course.id, 'course')}
                                        style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: themeColors.activeText, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {t('admin.actions.publish') || 'Опубликовать'}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {activeTab === 'leads' && leads.map(lead => {
                            const statusStyle = getStatusStyle(lead.status);
                            
                            return (
                                <div key={lead.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 20, border: `1px solid ${themeColors.panelBdr}`, display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Briefcase size={28} />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {lead.course_title ? (
                                            <div style={{ marginBottom: 8, display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: isDark ? 'rgba(99,102,241,0.1)' : '#e0e7ff', color: '#4f46e5', textTransform: 'uppercase', tracking: 'widest' }}>
                                                🎯 Курс: {lead.course_title}
                                            </div>
                                        ) : (
                                            <div style={{ marginBottom: 8, display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: themeColors.bg, color: themeColors.textMute, textTransform: 'uppercase', tracking: 'widest' }}>
                                                Без привязки к курсу
                                            </div>
                                        )}
                                        
                                        <h3 style={{ margin: '0 0 6px 0', color: themeColors.text, fontSize: 16, fontWeight: 800 }}>
                                            {lead.company}
                                        </h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                            <div style={{ color: themeColors.textMute, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <User size={14} /> <strong>{lead.name}</strong>
                                            </div>
                                            <div style={{ color: themeColors.textMute, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Mail size={14} /> {lead.email}
                                            </div>
                                            <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: themeColors.bg, color: themeColors.textMute }}>
                                                {t('admin.leads.employees') || 'Штат'}: {lead.employees}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
                                        <span style={{ fontSize: 11, color: themeColors.textMute, fontWeight: 600 }}>
                                            {formatDate(lead.created_at)}
                                        </span>
                                        
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            
                                            {/* 🔥 Выпадающий список со статусом "Отклонена" 🔥 */}
                                            <select
                                                value={lead.status || 'new'}
                                                onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                                style={{ 
                                                    padding: '8px 12px', 
                                                    borderRadius: '10px', 
                                                    border: `1px solid ${statusStyle.border}`, 
                                                    background: statusStyle.bg, 
                                                    color: statusStyle.color, 
                                                    fontSize: '13px', 
                                                    fontWeight: 700, 
                                                    outline: 'none', 
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <option value="new">Новая</option>
                                                <option value="contacted">В работе</option>
                                                <option value="closed">Завершена</option>
                                                <option value="rejected">Отклонена</option>
                                            </select>

                                            {/* 🔥 Скрываем кнопку "Выдать код", если заявка Отклонена 🔥 */}
                                            {lead.course_title && lead.status !== 'rejected' && (
                                                generatedCodes[lead.id] ? (
                                                    <div style={{ padding: '8px 12px', borderRadius: 10, background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0' }}>
                                                        <Key size={14} /> {generatedCodes[lead.id]}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleGenerateCode(lead.id)}
                                                        style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${themeColors.activeText}`, background: 'transparent', color: themeColors.activeText, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s' }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = themeColors.activeText; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = themeColors.activeText; }}
                                                    >
                                                        <Key size={14} /> Выдать код
                                                    </button>
                                                )
                                            )}

                                            {/* 🔥 Кнопка "Написать" теперь открывает Gmail 🔥 */}
                                            <button
                                                onClick={() => handleSendEmailViaGmail(lead.email, generatedCodes[lead.id])}
                                                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: themeColors.activeText, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
                                            >
                                                <Send size={14} /> Написать
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {((activeTab === 'apps' && applications.length === 0) || 
                          (activeTab === 'courses' && courses.length === 0) || 
                          (activeTab === 'leads' && leads.length === 0)) && (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: themeColors.textMute, fontSize: 14 }}>
                                {t('admin.empty') || 'Список пуст'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Модалка отказа */}
            {isRejectModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ position: 'absolute', inset: 0, background: themeColors.modalOverlay, backdropFilter: 'blur(4px)' }} onClick={() => setIsRejectModalOpen(false)} />
                    <div style={{ position: 'relative', background: themeColors.panel, width: '100%', maxWidth: 440, borderRadius: 24, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, color: themeColors.text }}>{t('admin.modal.rejectTitle') || 'Отклонить'}</h2>
                                <p style={{ margin: 0, fontSize: 13, color: themeColors.textMute }}>{t('admin.modal.object') || 'Объект'} <strong>{rejectData.title}</strong></p>
                            </div>
                        </div>

                        <label style={{ fontSize: 12, fontWeight: 700, color: themeColors.textMute, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                            {t('admin.modal.reasonLabel') || 'Причина'}
                        </label>
                        <textarea
                            rows={4}
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder={t('admin.modal.reasonPlaceholder') || 'Опишите причину...'}
                            style={{ width: '100%', padding: 16, borderRadius: 16, border: `1px solid ${themeColors.divider}`, background: themeColors.bg, color: themeColors.text, fontSize: 14, outline: 'none', resize: 'none', marginBottom: 24, boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setIsRejectModalOpen(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {t('admin.actions.cancel') || 'Отмена'}
                            </button>
                            <button onClick={handleConfirmReject} disabled={isSubmitting}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                                {isSubmitting ? '...' : <><Send size={16} /> {t('admin.actions.send') || 'Отправить'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;