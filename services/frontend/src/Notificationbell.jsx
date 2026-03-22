import { useState, useEffect, useRef, useCallback } from 'react';
import api from './api';
import { Bell } from 'lucide-react';

// ─── ИКОНКИ ПО ТИПУ ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
    course_approved: { color: '#059669', bg: '#F0FDF4', label: '✓' },
    course_rejected: { color: '#DC2626', bg: '#FEF2F2', label: '✕' },
    app_approved:    { color: '#2563EB', bg: '#EFF6FF', label: '✓' },
    app_rejected:    { color: '#DC2626', bg: '#FEF2F2', label: '✕' },
};

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)    return 'только что';
    if (diff < 3600)  return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return `${Math.floor(diff / 86400)} дн назад`;
}

export default function NotificationBell({ isDark, t }) {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread]               = useState(0);
    const [open, setOpen]                   = useState(false);
    const dropRef                           = useRef(null);

    // Закрытие по клику вне
    useEffect(() => {
        const fn = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);

    // Поллинг счётчика непрочитанных каждые 30 сек
    const fetchUnread = useCallback(async () => {
        try {
            const res = await api.get('notifications/unread-count/');
            setUnread(res.data.unread_count);
        } catch {}
    }, []);

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    // Загрузка уведомлений при открытии + пометка прочитанными
    const handleOpen = async () => {
        if (open) { setOpen(false); return; }
        setOpen(true);
        try {
            const res = await api.get('notifications/');
            setNotifications(res.data);
            if (unread > 0) {
                await api.patch('notifications/mark-read/');
                setUnread(0);
            }
        } catch {}
    };

    const cfg = (type) => TYPE_CONFIG[type] || { color: '#64748B', bg: '#F8FAFC', label: '•' };

    return (
        <div style={{ position: 'relative' }} ref={dropRef}>
            {/* Кнопка колокольчика */}
            <button
                onClick={handleOpen}
                style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    background: open
                        ? (isDark ? 'rgba(255,255,255,0.08)' : '#EFF6FF')
                        : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: t.textMute, position: 'relative', transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!open) e.currentTarget.style.background = t.hover; }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
                title="Уведомления"
            >
                <Bell size={17} />
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: 4, right: 4,
                        minWidth: 16, height: 16, borderRadius: 99,
                        background: '#EF4444', color: '#fff',
                        fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px',
                        boxShadow: '0 0 0 2px ' + (isDark ? '#121216' : '#fff'),
                    }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Дропдаун */}
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: 340, background: t.panel,
                    border: `1px solid ${t.panelBdr}`,
                    borderRadius: 18, overflow: 'hidden',
                    boxShadow: isDark
                        ? '0 20px 60px rgba(0,0,0,0.6)'
                        : '0 20px 60px rgba(0,0,0,0.12)',
                    zIndex: 50,
                    animation: 'dropIn 0.15s cubic-bezier(0.16,1,0.3,1) both',
                }}>
                    {/* Заголовок */}
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${t.divider}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                            Уведомления
                        </span>
                        {notifications.length > 0 && (
                            <span style={{ fontSize: 11, color: t.textMute }}>
                                {notifications.filter(n => !n.is_read).length === 0
                                    ? 'Всё прочитано'
                                    : `${notifications.filter(n => !n.is_read).length} новых`
                                }
                            </span>
                        )}
                    </div>

                    {/* Список */}
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{
                                padding: '40px 20px', textAlign: 'center',
                                color: t.textMute, fontSize: 13,
                            }}>
                                Уведомлений пока нет
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const c = cfg(n.notification_type);
                                return (
                                    <div key={n.id} style={{
                                        display: 'flex', gap: 12,
                                        padding: '12px 16px',
                                        borderBottom: `1px solid ${t.divider}`,
                                        background: !n.is_read
                                            ? (isDark ? 'rgba(37,99,235,0.06)' : '#FAFBFF')
                                            : 'transparent',
                                        transition: 'background .15s',
                                    }}>
                                        {/* Иконка */}
                                        <div style={{
                                            minWidth: 32, height: 32, borderRadius: 8,
                                            background: c.bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13, fontWeight: 800, color: c.color,
                                            flexShrink: 0,
                                        }}>
                                            {c.label}
                                        </div>

                                        {/* Текст */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                fontSize: 13, fontWeight: 600,
                                                color: t.text, margin: '0 0 3px',
                                                display: 'flex', alignItems: 'center', gap: 6,
                                            }}>
                                                {n.title}
                                                {!n.is_read && (
                                                    <span style={{
                                                        width: 6, height: 6, borderRadius: '50%',
                                                        background: '#2563EB', flexShrink: 0,
                                                    }} />
                                                )}
                                            </p>
                                            <p style={{
                                                fontSize: 12, color: t.textMute,
                                                margin: '0 0 4px', lineHeight: 1.5,
                                                // Показываем первые 2 строки
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}>
                                                {n.message}
                                            </p>
                                            <p style={{ fontSize: 11, color: t.textMute, margin: 0 }}>
                                                {timeAgo(n.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}