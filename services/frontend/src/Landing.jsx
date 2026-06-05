import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight, ShieldCheck, Award, CheckCircle, 
    ChevronRight, Users, BookOpen, PlayCircle
} from 'lucide-react';
import api from './api'; // Проверь правильность пути до твоего файла api.js

// Компонент визуализации (оставляем, он красивый и не мешает)
function HeroVisual() {
    const { t } = useTranslation();
    const MODULES = [
        { title: t('landing.heroVisual.mod1', { defaultValue: 'Введение' }), done: true },
        { title: t('landing.heroVisual.mod2', { defaultValue: 'Базовые понятия' }), done: true },
        { title: t('landing.heroVisual.mod3', { defaultValue: 'Практика' }), done: false, active: true },
        { title: t('landing.heroVisual.mod4', { defaultValue: 'Тестирование' }), done: false },
    ];

    return (
        <div className="relative w-full max-w-md" style={{ paddingTop: 16, paddingRight: 20, paddingBottom: 20 }}>
            <div className="lms-hero-card bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/70 p-6 relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('landing.heroVisual.progress', { defaultValue: 'Прогресс' })}</p>
                        <p className="text-base font-extrabold text-slate-900">{t('landing.heroVisual.course', { defaultValue: 'Основы IT' })}</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                </div>
                <div className="mb-5">
                    <div className="flex justify-between text-xs font-semibold mb-2">
                        <span className="text-slate-500">{t('landing.heroVisual.module', { defaultValue: 'Модуль 3 из 4' })}</span>
                        <span className="text-blue-600 font-bold">75%</span>
                    </div>
                    <div className="lms-hero-progress-bg h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-[75%] bg-blue-600 rounded-full"></div>
                    </div>
                </div>
                <div className="space-y-2">
                    {MODULES.map((m, i) => (
                        <div key={i} className={`lms-hero-module${m.active ? '-active' : ''} flex items-center gap-3 p-3 rounded-xl ${m.active ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? 'bg-emerald-500' : m.active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                {m.done ? <CheckCircle size={13} className="text-white" /> : <span className="w-2 h-2 rounded-full bg-white"></span>}
                            </div>
                            <span className={`text-sm font-semibold flex-1 ${m.active ? 'text-blue-700' : m.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {m.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="lms-float-card absolute -bottom-2 -left-4 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 flex items-center gap-3 z-20">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Users size={16} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 font-semibold">{t('landing.heroVisual.onlineLabel', { defaultValue: 'Сейчас на платформе' })}</p>
                    <p className="text-sm font-extrabold text-slate-900">12 {t('landing.heroVisual.onlineCount', { defaultValue: 'студентов' })}</p>
                </div>
            </div>
        </div>
    );
}

export default function Landing() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    
    // Стейты для реальных данных
    const [stats, setStats] = useState({ users: 0, courses: 0, certificates: 0 });
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Подтягиваем статистику и популярные курсы при загрузке
    useEffect(() => {
        Promise.all([
            api.get('courses/system-stats/').catch(() => ({ data: { total_users: 12, total_courses: 3, total_certificates: 5 }})),
            // Запрашиваем 4 курса для главной страницы
            api.get('courses/?limit=4').catch(() => ({ data: [] }))
        ]).then(([statsRes, coursesRes]) => {
            setStats({
                users: statsRes.data.total_users || 0,
                courses: statsRes.data.total_courses || 0,
                certificates: statsRes.data.total_certificates || 0
            });
            // У Django DRF данные обычно лежат в results, если есть пагинация
            setCourses(coursesRes.data.results || coursesRes.data || []);
            setLoading(false);
        });
    }, []);

    // Динамический массив статистики
    const DYNAMIC_STATS = [
        { value: stats.users, label: t('landing.stats.users', { defaultValue: 'Активных студентов' }) },
        { value: stats.courses, label: t('landing.stats.courses', { defaultValue: 'Доступных курсов' }) },
        { value: stats.certificates, label: t('landing.stats.certs', { defaultValue: 'Выдано сертификатов' }) },
        { value: '4.9 ★', label: t('landing.stats.rating', { defaultValue: 'Средняя оценка' }) },
    ];

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .lms-fade    { animation: lmsFade 0.7s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d1 { animation: lmsFade 0.7s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d2 { animation: lmsFade 0.7s 0.22s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes lmsFade { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
                
                /* Оставляем только нужные стили для Dark Mode */
                [data-theme='dark'] .lms-root { background-color:#111318; color:#e2e8f0; }
                [data-theme='dark'] .lms-section-white { background-color:#111318 !important; }
                [data-theme='dark'] .lms-hero { background:linear-gradient(to bottom,#16181f,#111318) !important; }
                [data-theme='dark'] .lms-root h1, [data-theme='dark'] .lms-root h2 { color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-root p { color:#64748b; }
                [data-theme='dark'] .lms-stat-val { color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-card { background-color:#1e2028 !important; border-color:rgba(255,255,255,0.08) !important; }
                [data-theme='dark'] .lms-card:hover { border-color:rgba(59,130,246,0.5) !important; }
                [data-theme='dark'] .lms-hero-card, [data-theme='dark'] .lms-float-card { background-color:#1e2028 !important; border-color:rgba(255,255,255,0.08) !important; }
                [data-theme='dark'] .lms-hero-module { background-color:rgba(255,255,255,0.05) !important; }
                [data-theme='dark'] .lms-hero-module-active { background-color:rgba(59,130,246,0.15) !important; border-color:rgba(59,130,246,0.3) !important; }
                [data-theme='dark'] .lms-border-t { border-color:rgba(255,255,255,0.07) !important; }
            `}</style>

            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="lms-root -mx-4 lg:-mx-8 -mt-4 lg:-mt-8">

                {/* ── HERO ── */}
                <section className="lms-hero lms-section-white pt-20 pb-28 px-6 md:px-10 bg-gradient-to-b from-slate-50/70 to-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center" style={{ overflow: "visible" }}>
                            <div className="lms-fade">
                                <h1 className="text-4xl md:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5 text-slate-900">
                                    {t('landing.hero.title1', { defaultValue: 'Обучайся новому' })}<br />
                                    <span className="text-blue-600">{t('landing.hero.title2', { defaultValue: 'вместе с SaqBol' })}</span>
                                </h1>
                                <p className="text-lg text-slate-500 font-medium leading-relaxed mb-8 max-w-md">
                                    {t('landing.hero.desc', { defaultValue: 'Современная платформа для прохождения курсов, тестирования и получения сертификатов.' })}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 mb-9">
                                    <Link to="/courses" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-blue-200">
                                        {t('landing.hero.btnCatalog', { defaultValue: 'Смотреть курсы' })} <ArrowRight size={16} />
                                    </Link>
                                    <Link to="/corporate" className="lms-btn-outline inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border-2 border-slate-200 hover:border-blue-300 text-slate-800 font-bold rounded-xl transition-colors text-sm">
                                        {t('landing.hero.btnCorporate', { defaultValue: 'Корпоративный сектор' })}
                                    </Link>
                                </div>
                            </div>
                            <div className="lms-fade-d2 hidden lg:flex justify-end items-center" style={{ paddingTop: 16, paddingRight: 20 }}>
                                <HeroVisual />
                            </div>
                        </div>

                        {/* ── ДИНАМИЧЕСКАЯ СТАТИСТИКА ── */}
                        <div className="lms-border-t mt-16 pt-10 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-8 lms-fade-d1">
                            {DYNAMIC_STATS.map((s, i) => (
                                <div key={i}>
                                    <p className="lms-stat-val text-3xl font-extrabold text-slate-900 mb-1">
                                        {loading ? <span className="loading loading-dots loading-sm"></span> : s.value}
                                    </p>
                                    <p className="lms-mute text-sm text-slate-500 font-medium">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── РЕАЛЬНЫЕ КУРСЫ ── */}
                <section className="lms-section-white py-20 px-6 md:px-10 bg-slate-50 dark:bg-[#16181f]">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t('landing.courses.sub', { defaultValue: 'Обучение' })}</p>
                                <h2 className="text-3xl font-extrabold tracking-tight">{t('landing.courses.title', { defaultValue: 'Популярные курсы' })}</h2>
                            </div>
                            <Link to="/courses" className="hidden md:flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                {t('landing.courses.all', { defaultValue: 'Все курсы' })} <ChevronRight size={16} />
                            </Link>
                        </div>
                        
                        {loading ? (
                            <div className="flex justify-center py-10"><span className="loading loading-spinner text-blue-600 w-10"></span></div>
                        ) : courses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {courses.map((course) => {
                                    // Умная проверка картинки (как бы она ни называлась на бэкенде)
                                    const imgSource = course.image || course.image_url || course.thumbnail || course.cover_image;
                                    
                                    return (
                                        <Link to={`/courses/${course.id}`} key={course.id} className="lms-card bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col">
                                            <div className="aspect-video bg-slate-100 overflow-hidden relative">
                                                {imgSource ? (
                                                    <img src={imgSource} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-200"><PlayCircle size={32} /></div>
                                                )}
                                            </div>
                                            <div className="p-5 flex flex-col flex-1">
                                                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{course.title}</h3>
                                                <div className="mt-auto flex items-center justify-between text-xs text-slate-500 font-medium pt-4 border-t border-slate-100">
                                                    <span className="flex items-center gap-1"><BookOpen size={14} /> Модулей: {course.modules_count || 0}</span>
                                                    <span className="flex items-center gap-1"><Users size={14} /> {course.students_count || 0}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                                <p className="text-slate-500 font-medium">Курсы скоро появятся!</p>
                            </div>
                        )}
                        
                        <div className="mt-8 flex justify-center md:hidden">
                            <Link to="/courses" className="btn btn-outline border-slate-300 text-slate-700 w-full rounded-xl">
                                {t('landing.courses.all', { defaultValue: 'Все курсы' })}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── CTA (ОСТАВЛЯЕМ, ЧТОБЫ БЫЛ КРАСИВЫЙ ФИНАЛ) ── */}
                <section className="py-24 px-6 md:px-10 bg-blue-600">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">
                            {t('landing.cta.title', { defaultValue: 'Готовы начать обучение?' })}
                        </h2>
                        <p className="text-blue-200 font-medium mb-10 text-lg">
                            {t('landing.cta.desc', { defaultValue: 'Присоединяйтесь к платформе и получайте новые знания уже сегодня.' })}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder={t('landing.cta.placeholder', { defaultValue: 'Ваш Email' })}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="lms-cta-input flex-1 px-5 py-4 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-white"
                            />
                            <Link to={`/register?email=${email}`} className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                                {t('landing.cta.btn', { defaultValue: 'Создать аккаунт' })}
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}