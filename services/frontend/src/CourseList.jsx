import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import OnboardingTour from './OnboardingTour'; // ✅ Импортируем отдельный компонент
import {
    Search, BookOpen, PlayCircle, Clock, Users, Star,
    ChevronDown, X, CheckCircle, ArrowRight, Zap, Shield, TrendingUp
} from 'lucide-react';

const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '');
};

const seeded = (id, min, max) => {
    const x = Math.sin(id * 9301 + 49297) * 233280;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
};

const SORT_OPTIONS = [
    { value: 'popular',    label: 'По популярности' },
    { value: 'new',        label: 'Сначала новые' },
    { value: 'rating',     label: 'По рейтингу' },
    { value: 'price_asc',  label: 'Сначала дешевле' },
    { value: 'price_desc', label: 'Сначала дороже' },
];

const LEVEL_OPTIONS  = ['Начинающий', 'Средний', 'Продвинутый'];
const DURATION_OPTIONS = ['< 2 часов', '2–5 часов', '5–10 часов', '> 10 часов'];

const CARD_ACCENTS = [
    'from-blue-500 to-blue-700',
    'from-violet-500 to-violet-700',
    'from-emerald-500 to-emerald-700',
    'from-orange-500 to-orange-700',
    'from-rose-500 to-rose-700',
    'from-sky-500 to-sky-700',
];

// Функция для отрисовки звезд рейтинга
const renderStars = (rating) => {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    size={11}
                    className={star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-base-content/20"}
                />
            ))}
        </div>
    );
};

// ─── Compact Course Card (Responsive) ──────────────────────────────────────
function CourseCard({ course }) {
    const imageUrl   = course.image || course.cover_image || course.image_url;
    const price      = parseFloat(course.price);
    const isFree     = price === 0;
    const hasProgress = course.progress > 0;
    
    const ratingNum  = parseFloat(course.average_rating || 0);
    const ratingStr  = ratingNum > 0 ? ratingNum.toFixed(1) : '0.0';
    const reviews    = course.reviews_count || 0;

    const students   = course.students_count || seeded(course.id, 80, 4200);
    const hours      = course.duration || seeded(course.id, 2, 20);
    const accent     = CARD_ACCENTS[course.id % CARD_ACCENTS.length];

    return (
        <Link
            to={`/courses/${course.id}`}
            className="group flex flex-col-reverse sm:flex-row gap-4 bg-base-100 border border-base-200 rounded-2xl p-4 hover:border-base-300 hover:shadow-lg hover:shadow-base-200/50 transition-all duration-200"
        >
            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                    {course.category_title && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5 block">
                            {course.category_title}
                        </span>
                    )}
                    <h3 className="font-bold text-base-content text-sm sm:text-base leading-snug mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {course.title}
                    </h3>
                    <p className="text-xs text-base-content/70 line-clamp-2 sm:line-clamp-1 leading-relaxed">
                        {stripHtml(course.description) || 'Описание скоро появится'}
                    </p>
                </div>

                <div className="mt-4 sm:mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[11px] text-base-content/50">
                        <div className="flex items-center gap-1.5" title={`${reviews} отзывов`}>
                            {renderStars(ratingNum)}
                            <span className="font-bold text-amber-500">{ratingStr}</span>
                            <span className="text-base-content/40">({reviews})</span>
                        </div>

                        <span className="flex items-center gap-1">
                            <Users size={10} />{students.toLocaleString('ru-RU')}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={10} />{hours}ч
                        </span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                        <span className="font-extrabold text-sm text-base-content">
                            {isFree
                                ? <span className="text-emerald-600 dark:text-emerald-400">Бесплатно</span>
                                : `${new Intl.NumberFormat('ru-RU').format(price)} ₸`
                            }
                        </span>
                        <span className={`flex items-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-[11px] font-bold transition-all whitespace-nowrap
                            ${hasProgress ? 'bg-blue-600 text-white' : 'bg-base-200 text-base-content/70 group-hover:bg-blue-600 group-hover:text-white'}`}>
                            {hasProgress ? <><PlayCircle size={12} />Продолжить</> : <>Открыть <ArrowRight size={12} /></>}
                        </span>
                    </div>
                </div>

                {hasProgress && (
                    <div className="mt-3.5 sm:mt-2.5">
                        <div className="flex justify-between text-[10px] font-semibold mb-1">
                            <span className="text-base-content/50">Прогресс</span>
                            <span className="text-blue-600 dark:text-blue-400">{course.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${course.progress}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 w-full h-40 sm:w-28 sm:h-28 rounded-xl overflow-hidden relative">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${accent} flex items-center justify-center`}>
                        <BookOpen size={32} className="text-white/80 sm:w-7 sm:h-7" strokeWidth={1.5} />
                    </div>
                )}
                {isFree && (
                    <div className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5">
                        <span className="px-2 py-1 sm:px-1.5 sm:py-0.5 bg-emerald-500 text-white text-[10px] sm:text-[9px] font-bold rounded-full shadow-sm">Free</span>
                    </div>
                )}
            </div>
        </Link>
    );
}

// ─── Sidebar collapse block ───────────────────────────────────────────────────
function FilterBlock({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="py-5 border-b border-base-200 last:border-0">
            <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left mb-0">
                <span className="text-sm font-bold text-base-content">{title}</span>
                <ChevronDown size={14} className={`text-base-content/50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="mt-3">{children}</div>}
        </div>
    );
}

// ─── Promo Banner ─────────────────────────────────────────────────────────────
function PromoBanner() {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-6 mb-8 flex items-center justify-between gap-6">
            <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-white/5"></div>
            <div className="absolute bottom-0 right-24 w-24 h-24 rounded-full bg-white/5"></div>

            <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-3">
                    <Zap size={10} className="text-yellow-300" /> Новинка
                </div>
                <h3 className="text-white font-extrabold text-lg leading-snug mb-1.5 max-w-xs">
                    Защитите команду от фишинга за 2 часа
                </h3>
                <p className="text-blue-200 text-sm font-medium max-w-xs">
                    Интерактивный тренажёр с реальными сценариями атак. Бесплатно для первых 100 команд.
                </p>
                <Link
                    to="/courses"
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-white text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                >
                    Начать бесплатно <ArrowRight size={14} />
                </Link>
            </div>

            <div className="relative z-10 hidden lg:flex flex-col gap-2 flex-shrink-0">
                {[
                    { icon: <Shield size={14} className="text-blue-400" />, label: 'Фишинг-симулятор', color: 'bg-blue-50 dark:bg-blue-900/30' },
                    { icon: <TrendingUp size={14} className="text-emerald-500" />, label: '+70% осведомлённость', color: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { icon: <Star size={14} className="text-amber-400 fill-amber-400" />, label: 'Рейтинг 4.9', color: 'bg-amber-50 dark:bg-amber-900/30' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-base-100/95 backdrop-blur-sm rounded-xl px-3.5 py-2.5 shadow-lg">
                        <div className={`w-7 h-7 ${item.color} rounded-lg flex items-center justify-center`}>
                            {item.icon}
                        </div>
                        <span className="text-xs font-bold text-base-content whitespace-nowrap">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main CourseList ──────────────────────────────────────────────────────────
export default function CourseList() {
    const [courses, setCourses]       = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading]       = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState(''); 

    const [selectedCategory, setSelectedCategory] = useState('');
    const [sortBy, setSortBy]         = useState('popular');
    const [selectedLevels, setSelectedLevels] = useState([]);
    const [onlyFree, setOnlyFree]     = useState(false);
    const [mobileSidebar, setMobileSidebar] = useState(false);

    useEffect(() => {
        api.get('courses/categories/')
            .then(res => setCategories(res.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (selectedCategory) params.append('category', selectedCategory);
        
        api.get(`courses/?${params.toString()}`)
            .then(res => { 
                const publishedCourses = res.data.filter(c => c.status === 'published');
                setCourses(publishedCourses); 
                setLoading(false); 
            })
            .catch(() => setLoading(false));
    }, [debouncedSearch, selectedCategory]);

    const filtered = useMemo(() => {
        let r = [...courses];
        if (onlyFree) r = r.filter(c => parseFloat(c.price) === 0);
        return r;
    }, [courses, onlyFree]);

    const inProgress = filtered.filter(c => c.progress > 0 && c.progress < 100);
    const activeFilters = [selectedCategory, onlyFree, ...selectedLevels].filter(Boolean).length;

    const clearAll = () => {
        setSelectedCategory(''); setOnlyFree(false);
        setSelectedLevels([]); setSearchTerm(''); setDebouncedSearch('');
    };
    const toggleLevel = l => setSelectedLevels(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);

    const SidebarContent = () => (
        <>
            <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-sm font-extrabold text-base-content">Фильтры</span>
                {activeFilters > 0 && (
                    <button onClick={clearAll} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1">
                        <X size={11} /> Сбросить
                    </button>
                )}
            </div>

            <FilterBlock title="Направление">
                <div className="space-y-0.5">
                    <button
                        onClick={() => setSelectedCategory('')}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium
                            ${selectedCategory === '' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                    >
                        Все направления
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(p => p === String(cat.id) ? '' : String(cat.id))}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium
                                ${selectedCategory === String(cat.id) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                        >
                            {cat.title}
                        </button>
                    ))}
                </div>
            </FilterBlock>

            <FilterBlock title="Уровень">
                <div className="space-y-2.5">
                    {LEVEL_OPTIONS.map(l => (
                        <label key={l} onClick={() => toggleLevel(l)} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                                ${selectedLevels.includes(l) ? 'bg-blue-600 border-blue-600' : 'border-base-300 group-hover:border-blue-400'}`}>
                                {selectedLevels.includes(l) && <CheckCircle size={10} className="text-white" />}
                            </div>
                            <span className="text-sm text-base-content/70 font-medium">{l}</span>
                        </label>
                    ))}
                </div>
            </FilterBlock>

            <FilterBlock title="Стоимость">
                <label onClick={() => setOnlyFree(f => !f)} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                        ${onlyFree ? 'bg-blue-600 border-blue-600' : 'border-base-300 group-hover:border-blue-400'}`}>
                        {onlyFree && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <span className="text-sm text-base-content/70 font-medium">Только бесплатные</span>
                </label>
            </FilterBlock>

            <FilterBlock title="Длительность" defaultOpen={false}>
                <div className="space-y-2.5">
                    {DURATION_OPTIONS.map(d => (
                        <label key={d} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border-2 border-base-300 group-hover:border-blue-400 flex-shrink-0 transition-colors"></div>
                            <span className="text-sm text-base-content/70 font-medium">{d}</span>
                        </label>
                    ))}
                </div>
            </FilterBlock>
        </>
    );

    return (
        <>
            {/* 🚀 Онбординг вызывается здесь */}
            <OnboardingTour />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            `}</style>

            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="min-h-screen bg-base-100 text-base-content">

                {/* ── TOP BAR ── */}
                <div className="bg-base-100 border-b border-base-200 sticky top-16 z-30">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        {/* Search */}
                        <div className="relative flex-1 max-w-xl">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Название курса, навык, тема..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-9 py-2.5 bg-base-200 border border-base-300 rounded-xl text-sm font-medium placeholder:text-base-content/50 text-base-content outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50/20 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content">
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Quick filter chips */}
                        <div className="hidden lg:flex items-center gap-2">
                            <button
                                onClick={() => setOnlyFree(f => !f)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all
                                    ${onlyFree ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-base-100 text-base-content/70 border-base-300 hover:border-base-content/20'}`}
                            >
                                <CheckCircle size={11} className={onlyFree ? 'text-emerald-500' : 'text-base-content/30'} />
                                Бесплатные
                            </button>
                        </div>

                        {/* Sort + mobile filter */}
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="relative hidden sm:block">
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="pl-3 pr-7 py-2.5 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content appearance-none outline-none focus:border-blue-400 cursor-pointer"
                                >
                                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setMobileSidebar(true)}
                                className="lg:hidden relative flex items-center gap-1.5 px-3.5 py-2.5 bg-base-100 border border-base-300 rounded-xl text-xs font-bold text-base-content"
                            >
                                Фильтры
                                {activeFilters > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 flex gap-7">

                    {/* ── SIDEBAR ── */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="bg-base-100 rounded-2xl border border-base-200 px-5 py-4 sticky top-32">
                            <SidebarContent />
                        </div>
                    </aside>

                    {/* ── MAIN ── */}
                    <div className="flex-1 min-w-0">

                        {/* Promo banner */}
                        {!searchTerm && !selectedCategory && !onlyFree && !selectedLevels.length && (
                            <PromoBanner />
                        )}

                        {/* Active filter chips */}
                        {activeFilters > 0 && (
                            <div className="flex flex-wrap gap-2 mb-5">
                                {selectedCategory && categories.find(c => String(c.id) === selectedCategory) && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800">
                                        {categories.find(c => String(c.id) === selectedCategory)?.title}
                                        <button onClick={() => setSelectedCategory('')}><X size={10} /></button>
                                    </span>
                                )}
                                {onlyFree && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                                        Бесплатные <button onClick={() => setOnlyFree(false)}><X size={10} /></button>
                                    </span>
                                )}
                                {selectedLevels.map(l => (
                                    <span key={l} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-bold border border-violet-100 dark:border-violet-800">
                                        {l} <button onClick={() => toggleLevel(l)}><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Count */}
                        <p className="text-xs text-base-content/50 font-medium mb-4">
                            {loading ? 'Ищем курсы...' : `${filtered.length} ${filtered.length === 1 ? 'курс' : 'курсов'}`}
                        </p>

                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row gap-4 bg-base-100 rounded-2xl border border-base-200 p-4 animate-pulse">
                                        <div className="w-full h-40 sm:w-28 sm:h-28 bg-base-300 rounded-xl flex-shrink-0"></div>
                                        <div className="flex-1 space-y-3 mt-2 sm:mt-0">
                                            <div className="h-3 bg-base-300 rounded w-1/5"></div>
                                            <div className="h-4 bg-base-300 rounded w-3/4"></div>
                                            <div className="h-3 bg-base-300 rounded w-2/3"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filtered.length > 0 ? (
                            <>
                                {/* In progress */}
                                {inProgress.length > 0 && !debouncedSearch && !selectedCategory && (
                                    <div className="mb-8">
                                        <h2 className="text-sm font-extrabold text-base-content mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                            Продолжить обучение
                                        </h2>
                                        <div className="flex flex-col gap-3">
                                            {inProgress.map(c => <CourseCard key={`ip-${c.id}`} course={c} />)}
                                        </div>
                                        <div className="flex items-center gap-3 my-7">
                                            <div className="flex-1 h-px bg-base-200"></div>
                                            <span className="text-[11px] text-base-content/50 font-semibold uppercase tracking-wider">Все курсы</span>
                                            <div className="flex-1 h-px bg-base-200"></div>
                                        </div>
                                    </div>
                                )}

                                {/* Course list */}
                                <div className="flex flex-col gap-3">
                                    {filtered.map(c => <CourseCard key={c.id} course={c} />)}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
                                    <Search size={24} className="text-base-content/50" />
                                </div>
                                <h3 className="text-base font-bold text-base-content mb-1.5">Ничего не найдено</h3>
                                <p className="text-sm text-base-content/50 max-w-xs mb-5 leading-relaxed">
                                    Попробуйте другой запрос или сбросьте фильтры.
                                </p>
                                <button onClick={clearAll} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
                                    Сбросить фильтры
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── MOBILE DRAWER ── */}
                {mobileSidebar && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileSidebar(false)}></div>
                        <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-base-100 shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-base-200 sticky top-0 bg-base-100/95 backdrop-blur z-10">
                                <span className="font-extrabold text-base-content">Фильтры</span>
                                <button onClick={() => setMobileSidebar(false)} className="p-2 -mr-2 rounded-xl hover:bg-base-200 transition-colors">
                                    <X size={18} className="text-base-content/50" />
                                </button>
                            </div>
                            <div className="p-5"><SidebarContent /></div>
                            <div className="sticky bottom-0 p-5 bg-base-100 border-t border-base-200">
                                <button onClick={() => setMobileSidebar(false)} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
                                    Показать курсы
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}