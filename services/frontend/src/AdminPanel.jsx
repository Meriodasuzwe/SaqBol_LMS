import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from './api';
import { toast } from 'react-toastify';
import {
    Check, X, GraduationCap, BookOpen, User,
    AlertCircle, Send, ArrowRight, Eye, Briefcase, Mail, Key, Trash2,Bug, ExternalLink, MessageSquare
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

    const [bugReports, setBugReports] = useState([]);
    const [bugFilter, setBugFilter] = useState('all');
    const [selectedBug, setSelectedBug] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [noteSubmitting, setNoteSubmitting] = useState(false);

    // Новое состояние для модалки удаления заявок
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, isBulk: false, title: '' });

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
            } else if (activeTab === 'bugs') {
     const res = await api.get('/bugs/list/');
     setBugReports(res.data);
        }
        } catch (err) {
            toast.error(t('admin.toasts.loadError', 'Ошибка загрузки данных'));
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
            toast.warning(t('admin.toasts.reasonRequired', 'Укажите причину'));
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

            toast.info(t('admin.toasts.rejected', 'Отклонено'));
            setIsRejectModalOpen(false);
        } catch (err) {
            toast.error(t('admin.toasts.rejectError', 'Ошибка при отклонении'));
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

            toast.success(t('admin.toasts.approved', 'Успешно одобрено'));
        } catch (err) {
            toast.error(t('admin.toasts.approveError', 'Ошибка при одобрении'));
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await api.patch(`courses/b2b/leads/${id}/update/`, { status: newStatus });
            setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));
            toast.success(t('admin.toasts.statusUpdated', 'Статус обновлен'));
        } catch (err) {
            toast.error(t('admin.toasts.statusError', 'Ошибка обновления статуса'));
        }
    };

    const handleGenerateCode = async (leadId) => {
        try {
            const res = await api.post(`courses/b2b/leads/${leadId}/generate-invite/`);
            setGeneratedCodes(prev => ({ ...prev, [leadId]: res.data.code }));
            setLeads(leads.map(l => l.id === leadId ? { ...l, status: 'closed' } : l));
            toast.success(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.error || t('admin.toasts.codeError', 'Ошибка генерации кода'));
        }
    };

    const handleSendEmailViaGmail = (email, inviteCode) => {
        const subject = encodeURIComponent(t('admin.email.subject', 'Доступ к корпоративному обучению SaqBol LMS'));
        const bodyText = inviteCode 
            ? t('admin.email.bodyWithCode', `Здравствуйте!\n\nВаша заявка одобрена. Ваш код доступа: ${inviteCode}`)
            : t('admin.email.bodyWithoutCode', 'Здравствуйте!\n\nМы получили вашу заявку на корпоративное обучение.');
        
        const body = encodeURIComponent(bodyText);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
    };

    // ФУНКЦИЯ: Выполнение удаления (одной или всех заявок)
    const executeDelete = async () => {
        setIsSubmitting(true);
        try {
            if (deleteConfirm.isBulk) {
                // Параллельно удаляем все заявки (если нет bulk эндпоинта)
                await Promise.all(leads.map(lead => api.delete(`courses/b2b/leads/${lead.id}/`)));
                setLeads([]);
                toast.success(t('admin.toasts.allLeadsDeleted', 'Все заявки успешно удалены'));
            } else {
                // Удаляем одну заявку
                await api.delete(`courses/b2b/leads/${deleteConfirm.id}/`);
                setLeads(leads.filter(l => l.id !== deleteConfirm.id));
                toast.success(t('admin.toasts.leadDeleted', 'Заявка удалена'));
            }
            setDeleteConfirm({ isOpen: false, id: null, isBulk: false, title: '' });
        } catch (err) {
            toast.error(t('admin.toasts.deleteError', 'Ошибка при удалении заявки'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(navigator.language || 'ru-RU', options);
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'new':      return { bg: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff',  color: '#3b82f6', border: '#bfdbfe' };
            case 'contacted':return { bg: isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7',  color: '#f59e0b', border: '#fde68a' };
            case 'closed':   return { bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5',  color: '#10b981', border: '#a7f3d0' };
            case 'rejected': return { bg: isDark ? 'rgba(239,68,68,0.1)'  : '#fee2e2',  color: '#ef4444', border: '#fecaca' };
            default:         return { bg: themeColors.bg, color: themeColors.textMute, border: themeColors.divider };
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: themeColors.bg, padding: '40px 20px', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'background 0.3s' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>

                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: themeColors.text, margin: '0 0 8px 0' }}>{t('admin.title', 'Панель администратора')}</h1>
                    <p style={{ color: themeColors.textMute, margin: 0, fontSize: 15 }}>{t('admin.subtitle', 'Управление заявками и платформой')}</p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: '4px' }}>
                    {[
                        { key: 'apps',    icon: <GraduationCap size={18} />, label: t('admin.tabs.apps', 'Заявки на авторов'),    count: applications.length },
                        { key: 'courses', icon: <BookOpen size={18} />,      label: t('admin.tabs.courses', 'Курсы на модерации'), count: courses.length },
                        { key: 'leads',   icon: <Briefcase size={18} />,     label: t('admin.tabs.leads', 'B2B Заявки'),   count: leads.length },
                        { key: 'bugs', icon: <Bug size={18} />, label: 'Bug-репорты', count: bugReports.filter(b => b.status === 'new').length },
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
                    <div style={{ textAlign: 'center', padding: '100px 0', color: themeColors.activeText }}>{t('admin.loading', 'Загрузка...')}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* КНОПКА: Очистить все заявки (только для вкладки B2B) */}
                        {activeTab === 'leads' && leads.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                <button
                                    onClick={() => setDeleteConfirm({ isOpen: true, id: null, isBulk: true, title: t('admin.actions.allLeads', 'Все B2B заявки') })}
                                    style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                                    onMouseLeave={e => e.currentTarget.style.opacity = 1}
                                >
                                    <Trash2 size={16} /> {t('admin.actions.clearAllLeads', 'Очистить все заявки')}
                                </button>
                            </div>
                        )}

                        {/* ── ЗАЯВКИ НА АВТОРА ── */}
                        {activeTab === 'apps' && applications.map(app => (
                            <div key={app.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 24, border: `1px solid ${themeColors.panelBdr}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: themeColors.activeTab, color: themeColors.activeText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div style={{ color: themeColors.text, fontWeight: 700 }}>{app.user_email}</div>
                                            <div style={{ color: themeColors.textMute, fontSize: 12 }}>{t('admin.app.role', 'Роль')}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => openRejectModal(app.id, 'app', app.user_email)}
                                            style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => handleApprove(app.id, 'app')}
                                            style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                                            <Check size={18} /> {t('admin.actions.approve', 'Одобрить')}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ background: themeColors.bg, padding: 16, borderRadius: 12, fontSize: 14, color: themeColors.text, lineHeight: 1.6 }}>
                                    <strong>{t('admin.app.about', 'О себе:')}</strong> {app.cv_text}
                                    {app.portfolio_url && (
                                        <div style={{ marginTop: 8 }}>
                                            <a href={app.portfolio_url} target="_blank" rel="noreferrer" style={{ color: themeColors.activeText, textDecoration: 'none' }}>
                                                {t('admin.app.portfolio', 'Портфолио')} <ArrowRight size={12} style={{ display: 'inline' }} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* ── КУРСЫ ── */}
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
                                        <p style={{ margin: 0, color: themeColors.textMute, fontSize: 12 }}>{course.teacher_name || t('admin.course.authorFallback', 'Автор')}</p>
                                        {course.lessons?.length > 0 && (
                                            <span style={{ fontSize: 11, color: themeColors.textMute }}>· {course.lessons.length} {t('admin.course.lessonsCount', 'уроков')}</span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button
                                        onClick={() => window.open(`/courses/${course.id}`, '_blank')}
                                        style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                                        onMouseEnter={e => e.currentTarget.style.background = themeColors.hover}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <Eye size={16} /> {t('admin.actions.view', 'Просмотр')}
                                    </button>
                                    <button onClick={() => openRejectModal(course.id, 'course', course.title)}
                                        style={{ padding: '10px', borderRadius: 12, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer' }}>
                                        <X size={18} />
                                    </button>
                                    <button onClick={() => handleApprove(course.id, 'course')}
                                        style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: themeColors.activeText, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {t('admin.actions.publish', 'Опубликовать')}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* ── B2B ЗАЯВКИ ── */}
                        {activeTab === 'leads' && leads.map(lead => {
                            const statusStyle = getStatusStyle(lead.status);
                            
                            return (
                                <div key={lead.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 20, border: `1px solid ${themeColors.panelBdr}`, display: 'flex', alignItems: 'center', gap: 20 }}>
                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Briefcase size={28} />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {lead.course_title ? (
                                            <div style={{ marginBottom: 8, display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: isDark ? 'rgba(99,102,241,0.1)' : '#e0e7ff', color: '#4f46e5', textTransform: 'uppercase' }}>
                                                 {t('admin.leads.courseLabel', 'Курс')}: {lead.course_title}
                                            </div>
                                        ) : (
                                            <div style={{ marginBottom: 8, display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: themeColors.bg, color: themeColors.textMute, textTransform: 'uppercase' }}>
                                                {t('admin.leads.noCourse', 'Курс не выбран')}
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
                                                {t('admin.leads.employees', 'Сотрудников')}: {lead.employees}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
                                        <span style={{ fontSize: 11, color: themeColors.textMute, fontWeight: 600 }}>
                                            {formatDate(lead.created_at)}
                                        </span>
                                        
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            
                                            {/* Статус */}
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
                                                <option value="new">{t('admin.leadStatuses.new', 'Новая')}</option>
                                                <option value="contacted">{t('admin.leadStatuses.contacted', 'Связались')}</option>
                                                <option value="closed">{t('admin.leadStatuses.closed', 'Закрыта')}</option>
                                                <option value="rejected">{t('admin.leadStatuses.rejected', 'Отклонена')}</option>
                                            </select>

                                            {/* КНОПКА: Удалить одну заявку */}
                                            <button
                                                onClick={() => setDeleteConfirm({ isOpen: true, id: lead.id, isBulk: false, title: lead.company })}
                                                title={t('admin.actions.delete', 'Удалить заявку')}
                                                style={{ padding: '8px', borderRadius: 10, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>

                                            {/* Выдать код */}
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
                                                        <Key size={14} /> {t('admin.leadActions.generateCode', 'Сгенерировать код')}
                                                    </button>
                                                )
                                            )}

                                            {/* Написать */}
                                            <button
                                                onClick={() => handleSendEmailViaGmail(lead.email, generatedCodes[lead.id])}
                                                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: themeColors.activeText, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
                                            >
                                                <Send size={14} /> {t('admin.leadActions.sendEmail', 'Написать')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {/* ── BUG РЕПОРТЫ ── */}
                        {activeTab === 'bugs' && (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {[
                                        { value: 'all', label: 'Все' },
                                        { value: 'new', label: '🔴 Новые' },
                                        { value: 'in_progress', label: '🟡 В работе' },
                                        { value: 'resolved', label: '🟢 Решены' },
                                        { value: 'closed', label: '⚫ Закрыты' },
                                    ].map(f => (
                                        <button key={f.value} onClick={() => setBugFilter(f.value)}
                                            style={{
                                                padding: '8px 16px', borderRadius: 12, border: `1px solid ${bugFilter === f.value ? themeColors.activeText : themeColors.divider}`,
                                                background: bugFilter === f.value ? themeColors.activeTab : 'transparent',
                                                color: bugFilter === f.value ? themeColors.activeText : themeColors.textMute,
                                                fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit'
                                            }}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {bugReports
                                    .filter(b => bugFilter === 'all' || b.status === bugFilter)
                                    .map(bug => {
                                        const STATUS_COLORS = {
                                            new:         { bg: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444' },
                                            in_progress: { bg: isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7', color: '#f59e0b' },
                                            resolved:    { bg: isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5', color: '#10b981' },
                                            closed:      { bg: isDark ? 'rgba(100,116,139,0.1)' : '#f1f5f9', color: '#64748b' },
                                        };
                                        const sc = STATUS_COLORS[bug.status] || STATUS_COLORS.new;

                                        return (
                                            <div key={bug.id} style={{ background: themeColors.panel, borderRadius: 20, padding: 20, border: `1px solid ${themeColors.panelBdr}` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>
                                                                {bug.status_display}
                                                            </span>
                                                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: themeColors.bg, color: themeColors.textMute, fontWeight: 600 }}>
                                                                {bug.category_display}
                                                            </span>
                                                            <span style={{ fontSize: 11, color: themeColors.textMute }}>{formatDate(bug.created_at)}</span>
                                                        </div>
                                                        <h3 style={{ margin: 0, color: themeColors.text, fontSize: 15, fontWeight: 700 }}>{bug.title}</h3>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                        <select
                                                            value={bug.status}
                                                            onChange={async (e) => {
                                                                try {
                                                                    await api.patch(`/bugs/${bug.id}/`, { status: e.target.value });
                                                                    setBugReports(prev => prev.map(b => b.id === bug.id ? { ...b, status: e.target.value, status_display: e.target.options[e.target.selectedIndex].text } : b));
                                                                    toast.success('Статус обновлён');
                                                                } catch { toast.error('Ошибка'); }
                                                            }}
                                                            style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${themeColors.divider}`, background: sc.bg, color: sc.color, fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                                                        >
                                                            <option value="new">Новый</option>
                                                            <option value="in_progress">В работе</option>
                                                            <option value="resolved">Решён</option>
                                                            <option value="closed">Закрыт</option>
                                                        </select>

                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm('Удалить репорт?')) return;
                                                                try {
                                                                    await api.delete(`/bugs/${bug.id}/`);
                                                                    setBugReports(prev => prev.filter(b => b.id !== bug.id));
                                                                    toast.success('Удалён');
                                                                } catch { toast.error('Ошибка'); }
                                                            }}
                                                            style={{ padding: '8px', borderRadius: 10, border: 'none', background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <p style={{ margin: '0 0 12px 0', color: themeColors.textMute, fontSize: 14, lineHeight: 1.6 }}>{bug.description}</p>

                                                {bug.page_url && (
                                                    <a href={bug.page_url} target="_blank" rel="noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: themeColors.activeText, textDecoration: 'none', marginBottom: 12 }}>
                                                        <ExternalLink size={12} /> {bug.page_url}
                                                    </a>
                                                )}

                                                {bug.screenshots?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                        {bug.screenshots.map(s => (
                                                            <a key={s.id} href={s.image_url} target="_blank" rel="noreferrer">
                                                                <img src={s.image_url} alt="screenshot"
                                                                    style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: `1px solid ${themeColors.divider}`, cursor: 'zoom-in' }} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ borderTop: `1px solid ${themeColors.divider}`, paddingTop: 12 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: themeColors.textMute, marginBottom: 6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <MessageSquare size={12} /> Заметка
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <input
                                                            type="text"
                                                            defaultValue={bug.admin_note}
                                                            placeholder="Заметка для себя..."
                                                            onKeyDown={async (e) => {
                                                                if (e.key !== 'Enter') return;
                                                                try {
                                                                    await api.patch(`/bugs/${bug.id}/`, { admin_note: e.target.value });
                                                                    setBugReports(prev => prev.map(b => b.id === bug.id ? { ...b, admin_note: e.target.value } : b));
                                                                    toast.success('Заметка сохранена');
                                                                } catch { toast.error('Ошибка'); }
                                                            }}
                                                            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1px solid ${themeColors.divider}`, background: themeColors.bg, color: themeColors.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                                                        />
                                                        <span style={{ fontSize: 11, color: themeColors.textMute, alignSelf: 'center', whiteSpace: 'nowrap' }}>Enter ↵</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                }

                                {bugReports.filter(b => bugFilter === 'all' || b.status === bugFilter).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '60px 0', color: themeColors.textMute, fontSize: 14 }}>
                                        Нет репортов
                                    </div>
                                )}
                            </>
                        )}
                        <div style={{ textAlign: 'center', padding: '60px 0', color: themeColors.textMute, fontSize: 14 }}>
                            {((activeTab === 'apps' && applications.length === 0) ||
                              (activeTab === 'courses' && courses.length === 0) ||
                              (activeTab === 'leads' && leads.length === 0)) && (
                                <div style={{ textAlign: 'center', padding: '60px 0', color: themeColors.textMute, fontSize: 14 }}>
                                    {t('admin.empty', 'Список пуст')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Модалка отказа (Существующая) ── */}
            {isRejectModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ position: 'absolute', inset: 0, background: themeColors.modalOverlay, backdropFilter: 'blur(4px)' }} onClick={() => setIsRejectModalOpen(false)} />
                    <div style={{ position: 'relative', background: themeColors.panel, width: '100%', maxWidth: 440, borderRadius: 24, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 4px 0', fontSize: 18, color: themeColors.text }}>{t('admin.modal.rejectTitle', 'Отклонить заявку')}</h2>
                                <p style={{ margin: 0, fontSize: 13, color: themeColors.textMute }}>{t('admin.modal.object', 'Объект:')} <strong>{rejectData.title}</strong></p>
                            </div>
                        </div>

                        <label style={{ fontSize: 12, fontWeight: 700, color: themeColors.textMute, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                            {t('admin.modal.reasonLabel', 'Причина отклонения')}
                        </label>
                        <textarea
                            rows={4}
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder={t('admin.modal.reasonPlaceholder', 'Укажите причину для пользователя...')}
                            style={{ width: '100%', padding: 16, borderRadius: 16, border: `1px solid ${themeColors.divider}`, background: themeColors.bg, color: themeColors.text, fontSize: 14, outline: 'none', resize: 'none', marginBottom: 24, boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setIsRejectModalOpen(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {t('admin.actions.cancel', 'Отмена')}
                            </button>
                            <button onClick={handleConfirmReject} disabled={isSubmitting}
                                style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                                {isSubmitting ? '...' : <><Send size={16} /> {t('admin.actions.send', 'Отправить')}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── НОВАЯ Модалка подтверждения удаления ── */}
            {deleteConfirm.isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ position: 'absolute', inset: 0, background: themeColors.modalOverlay, backdropFilter: 'blur(4px)' }} onClick={() => !isSubmitting && setDeleteConfirm({ isOpen: false, id: null, isBulk: false, title: '' })} />
                    <div style={{ position: 'relative', background: themeColors.panel, width: '100%', maxWidth: 400, borderRadius: 24, padding: 32, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 20, background: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                <Trash2 size={32} />
                            </div>
                            <h2 style={{ margin: '0 0 12px 0', fontSize: 20, color: themeColors.text, fontWeight: 800 }}>
                                {deleteConfirm.isBulk 
                                    ? t('admin.modal.deleteAllTitle', 'Удалить ВСЕ заявки?') 
                                    : t('admin.modal.deleteTitle', 'Удалить заявку?')}
                            </h2>
                            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: themeColors.textMute, lineHeight: 1.5 }}>
                                {deleteConfirm.isBulk 
                                    ? t('admin.modal.deleteAllDesc', 'Это действие навсегда удалит все B2B заявки из базы данных. Вы уверены?') 
                                    : t('admin.modal.deleteDesc', `Вы собираетесь безвозвратно удалить заявку от `)}
                                {!deleteConfirm.isBulk && <strong style={{ color: themeColors.text }}>{deleteConfirm.title}</strong>}
                            </p>

                            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                                <button onClick={() => setDeleteConfirm({ isOpen: false, id: null, isBulk: false, title: '' })} disabled={isSubmitting}
                                    style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1px solid ${themeColors.divider}`, background: 'transparent', color: themeColors.text, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    {t('admin.actions.cancel', 'Отмена')}
                                </button>
                                <button onClick={executeDelete} disabled={isSubmitting}
                                    style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                                    {isSubmitting ? '...' : <><Trash2 size={16} /> {t('admin.actions.confirmDelete', 'Удалить')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;