import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight, GraduationCap, CheckCircle,
    ChevronRight, Users, BookOpen, PlayCircle,
    Zap, Clock, TrendingUp, Target, ListChecks
} from 'lucide-react';
import api from './api';

function HeroVisual() {
    const { t } = useTranslation();
    const MODULES = [
        { title: t('landing.heroVisual.mod1', { defaultValue: 'Читательская грамотность' }), done: true },
        { title: t('landing.heroVisual.mod2', { defaultValue: 'Критическое мышление' }), done: true },
        { title: t('landing.heroVisual.mod3', { defaultValue: 'Профильный предмет' }), done: false, active: true },
        { title: t('landing.heroVisual.mod4', { defaultValue: 'Пробный КТА' }), done: false },
    ];

    return (
        <div className="relative w-full max-w-md" style={{ paddingTop: 16, paddingRight: 20, paddingBottom: 20 }}>
            <div className="lms-hero-card rounded-3xl border border-base-200 shadow-2xl p-6 relative z-10 bg-base-100">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-wider mb-0.5">
                            {t('landing.heroVisual.progress', { defaultValue: 'Ваш прогресс' })}
                        </p>
                        <p className="text-base font-extrabold text-base-content">
                            {t('landing.heroVisual.course', { defaultValue: 'Подготовка к КТА' })}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <GraduationCap size={18} className="text-white" />
                    </div>
                </div>
                <div className="mb-5">
                    <div className="flex justify-between text-xs font-semibold mb-2">
                        <span className="text-base-content/50">{t('landing.heroVisual.module', { defaultValue: 'Раздел 3 из 4' })}</span>
                        <span className="text-blue-600 font-bold">75%</span>
                    </div>
                    <div className="h-2 bg-base-200 rounded-full overflow-hidden">
                        <div className="h-full w-[75%] bg-blue-600 rounded-full"></div>
                    </div>
                </div>
                <div className="space-y-2">
                    {MODULES.map((m, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${m.active ? 'bg-blue-50 border border-blue-100' : 'bg-base-200/50'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.done ? 'bg-emerald-500' : m.active ? 'bg-blue-600' : 'bg-base-300'}`}>
                                {m.done ? <CheckCircle size={13} className="text-white" /> : <span className="w-2 h-2 rounded-full bg-white"></span>}
                            </div>
                            <span className={`text-sm font-semibold flex-1 ${m.active ? 'text-blue-700' : m.done ? 'text-base-content/30 line-through' : 'text-base-content/70'}`}>
                                {m.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="absolute -bottom-2 -left-4 bg-base-100 border border-base-200 rounded-2xl shadow-xl p-3.5 flex items-center gap-3 z-20">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <TrendingUp size={16} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-[10px] text-base-content/40 font-semibold">
                        {t('landing.heroVisual.forecastLabel', { defaultValue: 'После каждого пробника' })}
                    </p>
                    <p className="text-sm font-extrabold text-base-content">
                        {t('landing.heroVisual.forecastValue', { defaultValue: 'Прогноз балла' })}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function Landing() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('courses/?limit=4')
            .then(res => setCourses(res.data.results || res.data || []))
            .catch(() => setCourses([]))
            .finally(() => setLoading(false));
    }, []);

    const PLATFORM_ITEMS = [
        { icon: <BookOpen size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', label: t('landing.platform.courses', { defaultValue: 'Курсы по темам' }) },
        { icon: <ListChecks size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50', label: t('landing.platform.tests', { defaultValue: 'Тесты по темам' }) },
        { icon: <Clock size={20} />, color: 'text-amber-600', bg: 'bg-amber-50', label: t('landing.platform.mock', { defaultValue: 'Пробный КТА' }) },
        { icon: <TrendingUp size={20} />, color: 'text-purple-600', bg: 'bg-purple-50', label: t('landing.platform.forecast', { defaultValue: 'Прогноз балла' }) },
    ];

    const getModulesCount = (course) => {
        return course.lessons_count ?? course.modules_count ?? course.lessons?.length ?? course.sections_count ?? 0;
    };

    const getImageSrc = (course) => {
        return course.cover_image || course.image || course.image_url || course.thumbnail || null;
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .lms-fade    { animation: lmsFade 0.7s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d1 { animation: lmsFade 0.7s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d2 { animation: lmsFade 0.7s 0.22s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes lmsFade { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
            `}</style>

            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="-mx-4 lg:-mx-8 -mt-4 lg:-mt-8">

                {/* ── HERO ── */}
                <section className="pt-20 pb-16 px-6 md:px-10 bg-base-200/40">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
                            <div className="lms-fade">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-6 border border-blue-100">
                                    <Zap size={12} /> {t('landing.hero.badge', { defaultValue: 'Платформа подготовки к КТА' })}
                                </div>
                                <h1 className="text-4xl md:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5 text-base-content">
                                    {t('landing.hero.title1', { defaultValue: 'Готовьтесь к КТА' })}<br />
                                    <span className="text-blue-600">{t('landing.hero.title2', { defaultValue: 'на магистратуру' })}</span>
                                </h1>
                                <p className="text-lg text-base-content/60 font-medium leading-relaxed mb-8 max-w-md">
                                    {t('landing.hero.desc', { defaultValue: 'Курсы по темам, тесты по каждому разделу, пробный КТА в реальном формате и прогноз балла — всё, что нужно для системной подготовки к поступлению.' })}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Link to="/courses" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-blue-200">
                                        {t('landing.hero.btnCatalog', { defaultValue: 'Смотреть курсы' })} <ArrowRight size={16} />
                                    </Link>
                                    <a href="#features" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-base-100 border-2 border-base-300 hover:border-blue-300 text-base-content font-bold rounded-xl transition-colors text-sm">
                                        {t('landing.hero.btnHow', { defaultValue: 'Как это устроено' })}
                                    </a>
                                </div>
                            </div>

                            <div className="lms-fade-d2 hidden lg:flex justify-end items-center">
                                <HeroVisual />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── ЧТО ВХОДИТ В ПЛАТФОРМУ ── */}
                <section className="py-12 px-6 md:px-10 bg-base-100 border-y border-base-200">
                    <div className="max-w-7xl mx-auto">
                        <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-6 text-center lms-fade-d1">
                            {t('landing.platform.sub', { defaultValue: 'Что входит в платформу' })}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lms-fade-d1">
                            {PLATFORM_ITEMS.map((s, i) => (
                                <div key={i} className="flex items-center gap-4 p-5 rounded-2xl bg-base-200/50 border border-base-200">
                                    <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center ${s.color} shrink-0`}>
                                        {s.icon}
                                    </div>
                                    <p className="text-sm font-bold text-base-content leading-snug">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── КУРСЫ ── */}
                <section className="py-20 px-6 md:px-10 bg-base-200/40">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                                    {t('landing.courses.sub', { defaultValue: 'Обучение' })}
                                </p>
                                <h2 className="text-3xl font-extrabold tracking-tight text-base-content">
                                    {t('landing.courses.title', { defaultValue: 'Курсы по темам' })}
                                </h2>
                            </div>
                            <Link to="/courses" className="hidden md:flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                {t('landing.courses.all', { defaultValue: 'Все курсы' })} <ChevronRight size={16} />
                            </Link>
                        </div>
                        
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <span className="loading loading-spinner text-blue-600 w-10"></span>
                            </div>
                        ) : courses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                {courses.slice(0, 4).map((course) => {
                                    const imgSrc = getImageSrc(course);
                                    const modulesCount = getModulesCount(course);

                                    return (
                                        <Link 
                                            to={`/courses/${course.id}`} 
                                            key={course.id} 
                                            className="group flex flex-col bg-base-100 border border-base-200 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-base-300/60 hover:-translate-y-1 transition-all duration-300"
                                        >
                                            <div className="aspect-video bg-base-200 overflow-hidden relative">
                                                {imgSrc ? (
                                                    <img 
                                                        src={imgSrc} 
                                                        alt={course.title} 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-base-content/20">
                                                        <PlayCircle size={32} />
                                                        <span className="text-xs font-semibold">{t('landing.courses.noCover', { defaultValue: 'Нет обложки' })}</span>
                                                    </div>
                                                )}
                                                {course.price === 0 || course.price === '0.00' || !course.price ? (
                                                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-lg shadow-sm">
                                                        {t('landing.courses.free', { defaultValue: 'Бесплатно' })}
                                                    </span>
                                                ) : (
                                                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg shadow-sm">
                                                        {course.price} ₸
                                                    </span>
                                                )}
                                            </div>

                                            <div className="p-5 flex flex-col flex-1">
                                                <h3 className="font-bold text-base-content mb-3 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                                    {course.title}
                                                </h3>
                                                
                                                {course.description && (
                                                    <p className="text-xs text-base-content/50 line-clamp-2 mb-3 leading-relaxed">
                                                        {course.description}
                                                    </p>
                                                )}

                                                <div className="mt-auto flex items-center justify-between pt-4 border-t border-base-200">
                                                    <span className="flex items-center gap-1.5 text-xs text-base-content/50 font-semibold">
                                                        <BookOpen size={13} className="text-base-content/30" />
                                                        {modulesCount} {modulesCount === 1 ? 'раздел' : modulesCount < 5 ? 'раздела' : 'разделов'}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-xs text-base-content/50 font-semibold">
                                                        <Users size={13} className="text-base-content/30" />
                                                        {course.students_count || course.enrolled_count || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-base-100 rounded-2xl border border-base-200">
                                <BookOpen size={32} className="text-base-content/20 mx-auto mb-3" />
                                <p className="text-base-content/50 font-medium">{t('landing.courses.empty', { defaultValue: 'Курсы скоро появятся!' })}</p>
                            </div>
                        )}

                        <div className="mt-8 flex justify-center md:hidden">
                            <Link to="/courses" className="btn btn-outline border-base-300 text-base-content w-full rounded-xl">
                                {t('landing.courses.all', { defaultValue: 'Все курсы' })}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── КАК ПРОХОДИТ ПОДГОТОВКА ── */}
                <section className="py-20 px-6 md:px-10 bg-base-100">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                                {t('landing.howItWorks.sub', { defaultValue: 'Как это устроено' })}
                            </p>
                            <h2 className="text-3xl font-extrabold text-base-content">
                                {t('landing.howItWorks.title', { defaultValue: 'От темы до пробного экзамена' })}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[
                                { step: '01', icon: <BookOpen size={22} />, title: t('landing.howItWorks.s1title', { defaultValue: 'Проходите курс по теме' }), desc: t('landing.howItWorks.s1desc', { defaultValue: 'Разбираете материал раздел за разделом, в своём темпе' }) },
                                { step: '02', icon: <ListChecks size={22} />, title: t('landing.howItWorks.s2title', { defaultValue: 'Закрепляете тестом' }), desc: t('landing.howItWorks.s2desc', { defaultValue: 'Проверяете себя по каждой теме отдельно и видите ошибки' }) },
                                { step: '03', icon: <Clock size={22} />, title: t('landing.howItWorks.s3title', { defaultValue: 'Сдаёте пробный КТА' }), desc: t('landing.howItWorks.s3desc', { defaultValue: 'Полный пробный экзамен в формате и таймингах настоящего теста' }) },
                                { step: '04', icon: <TrendingUp size={22} />, title: t('landing.howItWorks.s4title', { defaultValue: 'Смотрите прогноз балла' }), desc: t('landing.howItWorks.s4desc', { defaultValue: 'Понимаете текущий уровень и слабые темы, над которыми стоит поработать' }) },
                            ].map((s, i) => (
                                <div key={i} className="relative p-6 rounded-2xl border border-base-200 bg-base-200/30 hover:shadow-lg transition-all">
                                    <span className="absolute top-5 right-5 text-2xl font-black text-base-content/10">{s.step}</span>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                                        {s.icon}
                                    </div>
                                    <h3 className="font-bold text-base-content mb-2">{s.title}</h3>
                                    <p className="text-sm text-base-content/50 leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── ВОЗМОЖНОСТИ ── */}
                <section id="features" className="py-20 px-6 md:px-10 bg-base-200/40 scroll-mt-20">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                                {t('landing.features.sub', { defaultValue: 'Почему SaqBol' })}
                            </p>
                            <h2 className="text-3xl font-extrabold text-base-content">
                                {t('landing.features.title', { defaultValue: 'Всё, что нужно для подготовки к КТА' })}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { icon: <Target size={24} />, color: 'text-blue-600', bg: 'bg-blue-50', title: t('landing.features.f1title', { defaultValue: 'Тесты по каждой теме' }), desc: t('landing.features.f1desc', { defaultValue: 'Тренируетесь точечно по разделам и сразу видите разбор ошибок' }) },
                                { icon: <Clock size={24} />, color: 'text-amber-600', bg: 'bg-amber-50', title: t('landing.features.f2title', { defaultValue: 'Пробный КТА в реальном формате' }), desc: t('landing.features.f2desc', { defaultValue: 'Структура, тайминг и правила как на настоящем экзамене' }) },
                                { icon: <TrendingUp size={24} />, color: 'text-emerald-600', bg: 'bg-emerald-50', title: t('landing.features.f3title', { defaultValue: 'Прогноз балла' }), desc: t('landing.features.f3desc', { defaultValue: 'Отслеживаете прогресс и понимаете, сколько баллов принесёт текущий уровень подготовки' }) },
                            ].map((f, i) => (
                                <div key={i} className="p-6 rounded-2xl border border-base-200 bg-base-100 hover:shadow-lg transition-all">
                                    <div className={`w-12 h-12 rounded-2xl ${f.bg} ${f.color} flex items-center justify-center mb-4`}>
                                        {f.icon}
                                    </div>
                                    <h3 className="font-bold text-base-content mb-2">{f.title}</h3>
                                    <p className="text-sm text-base-content/50 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ── */}
                <section className="py-24 px-6 md:px-10 bg-blue-600">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">
                            {t('landing.cta.title', { defaultValue: 'Готовы начать подготовку?' })}
                        </h2>
                        <p className="text-blue-200 font-medium mb-10 text-lg">
                            {t('landing.cta.desc', { defaultValue: 'Присоединяйтесь к платформе и начните готовиться к КТА по темам, тестам и пробным экзаменам уже сегодня.' })}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder={t('landing.cta.placeholder', { defaultValue: 'Ваш Email' })}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="flex-1 px-5 py-4 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-white"
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