import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; //  ИМПОРТ ПЕРЕВОДОВ
import {
    ArrowRight, ShieldCheck, Terminal, BrainCircuit,
    Layers3, Award, CheckCircle, Star,
    ChevronRight, Database, Eye, Network, Users, BarChart3
} from 'lucide-react';

// Компонент визуализации вынесен, чтобы использовать хук локализации
function HeroVisual() {
    const { t } = useTranslation();

    const MODULES = [
        { title: t('landing.heroVisual.mod1'), done: true },
        { title: t('landing.heroVisual.mod2'), done: true },
        { title: t('landing.heroVisual.mod3'), done: false, active: true },
        { title: t('landing.heroVisual.mod4'), done: false },
    ];

    return (
        <div className="relative w-full max-w-md" style={{ paddingTop: 16, paddingRight: 20, paddingBottom: 20 }}>
            <div className="lms-hero-card bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/70 p-6 relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t('landing.heroVisual.progress')}</p>
                        <p className="text-base font-extrabold text-slate-900">{t('landing.heroVisual.course')}</p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <ShieldCheck size={18} className="text-white" />
                    </div>
                </div>
                <div className="mb-5">
                    <div className="flex justify-between text-xs font-semibold mb-2">
                        <span className="text-slate-500">{t('landing.heroVisual.module')}</span>
                        <span className="text-blue-600 font-bold">38%</span>
                    </div>
                    <div className="lms-hero-progress-bg h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-[38%] bg-blue-600 rounded-full"></div>
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
                            {m.active && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{t('landing.heroVisual.active')}</span>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="lms-float-card absolute -bottom-2 -left-4 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 flex items-center gap-3 z-20">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Users size={16} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 font-semibold">{t('landing.heroVisual.onlineLabel')}</p>
                    <p className="text-sm font-extrabold text-slate-900">{t('landing.heroVisual.onlineCount')}</p>
                </div>
            </div>
            <div className="lms-float-card absolute -top-2 -right-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 flex items-center gap-3 z-20">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Award size={16} className="text-amber-500" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t('landing.heroVisual.certLabel')}</p>
                    <p className="text-sm font-extrabold text-emerald-600">{t('landing.heroVisual.certStatus')}</p>
                </div>
            </div>
        </div>
    );
}

export default function Landing() {
    const { t } = useTranslation(); //  ПОДКЛЮЧАЕМ ПЕРЕВОДЫ
    const [email, setEmail] = useState('');

    // Массивы вынесены внутрь компонента, чтобы t() работал реактивно
    const STATS = [
        { value: '47 000+', label: t('landing.stats.s1') },
        { value: '200+',    label: t('landing.stats.s2') },
        { value: '98%',     label: t('landing.stats.s3') },
        { value: '4.9 ★',  label: t('landing.stats.s4') },
    ];

    const FEATURES = [
        { icon: <ShieldCheck size={20} className="text-blue-600" />,    bg: 'bg-blue-50',    title: t('landing.features.f1Title'), desc: t('landing.features.f1Desc') },
        { icon: <BrainCircuit size={20} className="text-violet-600" />, bg: 'bg-violet-50',  title: t('landing.features.f2Title'), desc: t('landing.features.f2Desc') },
        { icon: <Terminal size={20} className="text-emerald-600" />,    bg: 'bg-emerald-50', title: t('landing.features.f3Title'), desc: t('landing.features.f3Desc') },
        { icon: <BarChart3 size={20} className="text-orange-500" />,    bg: 'bg-orange-50',  title: t('landing.features.f4Title'), desc: t('landing.features.f4Desc') },
        { icon: <Award size={20} className="text-rose-500" />,          bg: 'bg-rose-50',    title: t('landing.features.f5Title'), desc: t('landing.features.f5Desc') },
        { icon: <Layers3 size={20} className="text-sky-600" />,         bg: 'bg-sky-50',     title: t('landing.features.f6Title'), desc: t('landing.features.f6Desc') },
    ];

    const TRACKS = [
        { icon: <ShieldCheck size={20} className="text-blue-600" />,    title: t('landing.tracks.t1'), count: 24, color: 'text-blue-700',    ring: 'ring-blue-100',    bg: 'bg-blue-50'    },
        { icon: <Terminal size={20} className="text-emerald-600" />,    title: t('landing.tracks.t2'), count: 18, color: 'text-emerald-700', ring: 'ring-emerald-100', bg: 'bg-emerald-50' },
        { icon: <BrainCircuit size={20} className="text-violet-600" />, title: t('landing.tracks.t3'), count: 15, color: 'text-violet-700',  ring: 'ring-violet-100',  bg: 'bg-violet-50'  },
        { icon: <Database size={20} className="text-orange-500" />,     title: t('landing.tracks.t4'), count: 20, color: 'text-orange-700',  ring: 'ring-orange-100',  bg: 'bg-orange-50'  },
        { icon: <Eye size={20} className="text-rose-500" />,            title: t('landing.tracks.t5'), count: 12, color: 'text-rose-700',    ring: 'ring-rose-100',    bg: 'bg-rose-50'    },
        { icon: <Network size={20} className="text-slate-600" />,       title: t('landing.tracks.t6'), count: 16, color: 'text-slate-700',   ring: 'ring-slate-200',   bg: 'bg-slate-100'  },
    ];

    const REVIEWS = [
        { name: t('landing.reviews.r1Name'), role: t('landing.reviews.r1Role'), text: t('landing.reviews.r1Text'), rating: 5 },
        { name: t('landing.reviews.r2Name'), role: t('landing.reviews.r2Role'), text: t('landing.reviews.r2Text'), rating: 5 },
        { name: t('landing.reviews.r3Name'), role: t('landing.reviews.r3Role'), text: t('landing.reviews.r3Text'), rating: 5 },
    ];

    const HOW_IT_WORKS = [
        { n: '01', title: t('landing.howItWorks.s1Title'), desc: t('landing.howItWorks.s1Desc') },
        { n: '02', title: t('landing.howItWorks.s2Title'), desc: t('landing.howItWorks.s2Desc') },
        { n: '03', title: t('landing.howItWorks.s3Title'), desc: t('landing.howItWorks.s3Desc') },
        { n: '04', title: t('landing.howItWorks.s4Title'), desc: t('landing.howItWorks.s4Desc') },
    ];

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                .lms-fade    { animation: lmsFade 0.7s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d1 { animation: lmsFade 0.7s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
                .lms-fade-d2 { animation: lmsFade 0.7s 0.22s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes lmsFade { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }

                /* ── DARK MODE ── */
                [data-theme='dark'] .lms-root { background-color:#111318; color:#e2e8f0; }
                [data-theme='dark'] .lms-section-white { background-color:#111318 !important; }
                [data-theme='dark'] .lms-section-gray  { background-color:#16181f !important; }
                [data-theme='dark'] .lms-hero { background:linear-gradient(to bottom,#16181f,#111318) !important; }
                [data-theme='dark'] .lms-root h1, [data-theme='dark'] .lms-root h2, [data-theme='dark'] .lms-root h3 { color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-root p { color:#64748b; }
                [data-theme='dark'] .lms-mute { color:#475569 !important; }
                [data-theme='dark'] .lms-stat-val { color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-card { background-color:#1e2028 !important; border-color:rgba(255,255,255,0.08) !important; }
                [data-theme='dark'] .lms-card:hover { box-shadow:0 8px 24px rgba(0,0,0,0.4) !important; border-color:rgba(255,255,255,0.13) !important; }
                [data-theme='dark'] .lms-card p { color:#64748b !important; }
                [data-theme='dark'] .lms-card h3 { color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-hero-card { background-color:#1e2028 !important; border-color:rgba(255,255,255,0.08) !important; box-shadow:0 20px 60px rgba(0,0,0,0.5) !important; }
                [data-theme='dark'] .lms-hero-module { background-color:rgba(255,255,255,0.05) !important; }
                [data-theme='dark'] .lms-hero-module-active { background-color:rgba(59,130,246,0.15) !important; border-color:rgba(59,130,246,0.3) !important; }
                [data-theme='dark'] .lms-hero-module span { color:#94a3b8 !important; }
                [data-theme='dark'] .lms-hero-progress-bg { background-color:rgba(255,255,255,0.08) !important; }
                [data-theme='dark'] .lms-float-card { background-color:#1e2028 !important; border-color:rgba(255,255,255,0.08) !important; box-shadow:0 8px 24px rgba(0,0,0,0.45) !important; }
                [data-theme='dark'] .lms-border-t { border-color:rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .lms-step-line { background-color:rgba(255,255,255,0.07) !important; }
                [data-theme='dark'] .lms-btn-outline { background-color:rgba(255,255,255,0.06) !important; border-color:rgba(255,255,255,0.12) !important; color:#e2e8f0 !important; }
                [data-theme='dark'] .lms-trust { color:#475569 !important; }
                [data-theme='dark'] .lms-review-text { color:#94a3b8 !important; }
                [data-theme='dark'] .lms-cta-input { background-color:rgba(255,255,255,0.12) !important; color:#f1f5f9 !important; }
                [data-theme='dark'] .lms-cta-input::placeholder { color:rgba(241,245,249,0.4) !important; }
            `}</style>

            <div
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                className="lms-root -mx-4 lg:-mx-8 -mt-4 lg:-mt-8"
            >

                {/* ── HERO ── */}
                <section className="lms-hero lms-section-white pt-20 pb-28 px-6 md:px-10 bg-gradient-to-b from-slate-50/70 to-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center" style={{ overflow: "visible" }}>
                            <div className="lms-fade">
                                <h1 className="text-4xl md:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5 text-slate-900">
                                    {t('landing.hero.title1')}<br />
                                    <span className="text-blue-600">{t('landing.hero.title2')}</span>
                                </h1>
                                <p className="text-lg text-slate-500 font-medium leading-relaxed mb-8 max-w-md">
                                    {t('landing.hero.desc')}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 mb-9">
                                    <Link to="/courses"
                                        className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm shadow-lg shadow-blue-200">
                                        {t('landing.hero.btnCatalog')} <ArrowRight size={16} />
                                    </Link>
                                    <Link to="/register"
                                        className="lms-btn-outline inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border-2 border-slate-200 hover:border-blue-300 text-slate-800 font-bold rounded-xl transition-colors text-sm">
                                        {t('landing.hero.btnDemo')}
                                    </Link>
                                </div>
                                <div className="flex flex-wrap gap-5">
                                    {[t('landing.hero.trust1'), t('landing.hero.trust2'), t('landing.hero.trust3')].map((text, i) => (
                                        <span key={i} className="lms-trust flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                                            <CheckCircle size={13} className="text-emerald-500" /> {text}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="lms-fade-d2 hidden lg:flex justify-end items-center" style={{ paddingTop: 16, paddingRight: 20 }}>
                                <HeroVisual />
                            </div>
                        </div>
                        <div className="lms-border-t mt-16 pt-10 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-8 lms-fade-d1">
                            {STATS.map((s, i) => (
                                <div key={i}>
                                    <p className="lms-stat-val text-3xl font-extrabold text-slate-900 mb-1">{s.value}</p>
                                    <p className="lms-mute text-sm text-slate-500 font-medium">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── TRACKS ── */}
                <section id="tracks" className="lms-section-white py-20 px-6 md:px-10 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t('landing.tracks.sub')}</p>
                                <h2 className="text-3xl font-extrabold tracking-tight">{t('landing.tracks.title')}</h2>
                            </div>
                            <Link to="/courses" className="hidden md:flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                {t('landing.tracks.all')} <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {TRACKS.map((track, i) => (
                                <Link to="/courses" key={i}
                                    className={`lms-card group flex flex-col items-center text-center p-5 rounded-2xl ${track.bg} ring-1 ${track.ring} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-white shadow-sm">
                                        {track.icon}
                                    </div>
                                    <p className={`text-sm font-bold leading-snug ${track.color} mb-1`}>{track.title}</p>
                                    <p className="text-xs text-slate-400 font-medium">{track.count} {t('landing.tracks.courses')}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FEATURES ── */}
                <section id="features" className="lms-section-gray py-20 px-6 md:px-10 bg-slate-50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-14">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t('landing.features.sub')}</p>
                            <h2 className="text-3xl font-extrabold tracking-tight mb-3">{t('landing.features.title')}</h2>
                            <p className="text-slate-500 font-medium max-w-md mx-auto">{t('landing.features.desc')}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="lms-card bg-white p-7 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-200">
                                    <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-5`}>
                                        {f.icon}
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section className="lms-section-white py-20 px-6 md:px-10 bg-white">
                    <div className="max-w-4xl mx-auto text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t('landing.howItWorks.sub')}</p>
                        <h2 className="text-3xl font-extrabold tracking-tight mb-14">{t('landing.howItWorks.title')}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                            <div className="lms-step-line hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-slate-100 z-0"></div>
                            {HOW_IT_WORKS.map((s, i) => (
                                <div key={i} className="flex flex-col items-center text-center relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm mb-4 shadow-lg shadow-blue-200">
                                        {s.n}
                                    </div>
                                    <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── REVIEWS ── */}
                <section id="reviews" className="lms-section-gray py-20 px-6 md:px-10 bg-slate-50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">{t('landing.reviews.sub')}</p>
                            <h2 className="text-3xl font-extrabold tracking-tight">{t('landing.reviews.title')}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {REVIEWS.map((r, i) => (
                                <div key={i} className="lms-card bg-white p-7 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex gap-0.5 mb-4">
                                        {[...Array(r.rating)].map((_, j) => (
                                            <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                                        ))}
                                    </div>
                                    <p className="lms-review-text text-slate-700 text-sm leading-relaxed mb-5 font-medium">"{r.text}"</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                            {r.name.split(' ').map(w => w[0]).join('')}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{r.name}</p>
                                            <p className="text-xs text-slate-400">{r.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ── */}
                <section className="py-24 px-6 md:px-10 bg-blue-600">
                    <div className="max-w-2xl mx-auto text-center">
                        <h2 className="text-4xl font-extrabold text-white tracking-tight mb-4">
                            {t('landing.cta.title')}
                        </h2>
                        <p className="text-blue-200 font-medium mb-10 text-lg">
                            {t('landing.cta.desc')}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder={t('landing.cta.placeholder')}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="lms-cta-input flex-1 px-5 py-4 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none bg-white"
                            />
                            <Link to={`/register?email=${email}`}
                                className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm whitespace-nowrap transition-colors">
                                {t('landing.cta.btn')}
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-blue-200 text-xs font-semibold">
                            {[t('landing.cta.trust1'), t('landing.cta.trust2'), t('landing.cta.trust3')].map((text, i) => (
                                <span key={i} className="flex items-center gap-1.5">
                                    <CheckCircle size={13} /> {text}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}