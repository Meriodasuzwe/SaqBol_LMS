import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import OnboardingTour from './OnboardingTour';
import { useTranslation } from 'react-i18next'; 
import {
    Search, BookOpen, PlayCircle, Clock, Users, Star,
    ChevronDown, X, CheckCircle, ArrowRight, Zap, Shield, TrendingUp, BookOpenCheck
} from 'lucide-react';

const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '');
};

const seeded = (id, min, max) => {
    const x = Math.sin(id * 9301 + 49297) * 233280;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
};

const CARD_ACCENTS = [
    'from-blue-500 to-blue-700',
    'from-violet-500 to-violet-700',
    'from-emerald-500 to-emerald-700',
    'from-orange-500 to-orange-700',
    'from-rose-500 to-rose-700',
    'from-sky-500 to-sky-700',
];

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

function CourseCard({ course }) {
    const { t } = useTranslation();

    const imageUrl   = course.image || course.cover_image || course.image_url;
    const price      = parseFloat(course.price);
    const isFree     = price === 0;
    const progress   = course.progress || 0;
    
    // 🔥 Теперь проверка строгая - только если бэкенд сказал True
    const isEnrolled = course.is_enrolled === true;
    const isCompleted = progress === 100; 
    
    const ratingNum  = parseFloat(course.average_rating || 0);
    const ratingStr  = ratingNum > 0 ? ratingNum.toFixed(1) : '0.0';
    const reviews    = course.reviews_count || 0;

    const students   = course.students_count || seeded(course.id, 80, 4200);
    const hours      = course.duration || seeded(course.id, 2, 20);
    const accent     = CARD_ACCENTS[course.id % CARD_ACCENTS.length];

    const cardClasses = isEnrolled
        ? isCompleted
            ? "group flex flex-col-reverse sm:flex-row gap-4 bg-emerald-50/40 dark:bg-emerald-900/10 border-2 border-emerald-300 dark:border-emerald-800/60 rounded-2xl p-4 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200"
            : "group flex flex-col-reverse sm:flex-row gap-4 bg-blue-50/40 dark:bg-blue-900/10 border-2 border-blue-300 dark:border-blue-800/60 rounded-2xl p-4 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-200"
        : "group flex flex-col-reverse sm:flex-row gap-4 bg-base-100 border border-base-200 rounded-2xl p-4 hover:border-base-300 hover:shadow-lg hover:shadow-base-200/50 transition-all duration-200";

    return (
        <Link to={`/courses/${course.id}`} className={cardClasses}>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                    {course.category_title && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5 block">
                            {t(`categories.${course.category_title}`, { defaultValue: course.category_title })}
                        </span>
                    )}
                    <h3 className="font-bold text-base-content text-sm sm:text-base leading-snug mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {course.title}
                    </h3>
                    <p className="text-xs text-base-content/70 line-clamp-2 sm:line-clamp-1 leading-relaxed">
                        {stripHtml(course.description) || t('courseList.noDesc')}
                    </p>
                </div>

                <div className="mt-4 sm:mt-3 flex flex-wrap items-end sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[11px] text-base-content/50">
                        <div className="flex items-center gap-1.5" title={`${reviews} ${t('courseList.reviewsText')}`}>
                            {renderStars(ratingNum)}
                            <span className="font-bold text-amber-500">{ratingStr}</span>
                            <span className="text-base-content/40">({reviews})</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <Users size={10} />{students.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={10} />{hours}ч
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:items-end w-full sm:w-auto mt-2 sm:mt-0 gap-2">
                        {isEnrolled ? (
                            <div className="flex flex-col w-full sm:w-48 gap-1.5">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-bold flex items-center gap-1 ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        <BookOpenCheck size={12} /> {isCompleted ? t('courseList.completedStatus', { defaultValue: 'Завершен' }) : t('courseList.myLearning')}
                                    </span>
                                    <span className="text-[11px] font-bold text-base-content">{progress}%</span>
                                </div>
                                <div className={`h-2 w-full rounded-full overflow-hidden ${isCompleted ? 'bg-emerald-200 dark:bg-emerald-900/50' : 'bg-blue-200 dark:bg-blue-900/50'}`}>
                                    <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <span className="font-extrabold text-sm text-base-content">
                                {isFree
                                    ? <span className="text-emerald-600 dark:text-emerald-400">{t('courseList.free')}</span>
                                    : `${new Intl.NumberFormat().format(price)} ₸`
                                }
                            </span>
                        )}

                        <span className={`flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg text-[11px] font-bold transition-all w-full sm:w-auto
                            ${isEnrolled 
                                ? isCompleted
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700'
                                    : 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700' 
                                : 'bg-base-200 text-base-content/70 group-hover:bg-blue-600 group-hover:text-white'}`}>
                            {isEnrolled 
                                ? isCompleted 
                                    ? <><CheckCircle size={12} />{t('courseList.completedBtn', { defaultValue: 'Пройден' })}</>
                                    : progress > 0 
                                        ? <><PlayCircle size={12} />{t('courseList.continueBtn')}</> 
                                        : <><PlayCircle size={12} />{t('courseList.startBtn')}</>
                                : <>{t('courseList.openBtn')} <ArrowRight size={12} /></>}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 w-full h-40 sm:w-32 sm:h-auto rounded-xl overflow-hidden relative">
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
                
                <div className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 flex flex-col gap-1">
                    {isEnrolled ? (
                        <span className={`px-2 py-1 text-white text-[10px] sm:text-[9px] font-bold rounded-full shadow-md border ${
                            isCompleted ? 'bg-emerald-500 border-emerald-400/30' : 
                            progress > 0 ? 'bg-blue-600 border-blue-400/30' : 'bg-violet-600 border-violet-400/30'
                        }`}>
                            {isCompleted ? t('courseList.completedBadge', { defaultValue: 'Пройден' }) : 
                             progress > 0 ? t('courseList.inProgressBadge') : t('courseList.enrolledBadge')}
                        </span>
                    ) : isFree ? (
                        <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] sm:text-[9px] font-bold rounded-full shadow-sm">
                            {t('courseList.freeBadge')}
                        </span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

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

function PromoBanner() {
    const { t } = useTranslation();
    const [slots, setSlots] = useState(null);

    useEffect(() => {
        api.get('courses/promo-slots/')
            .then(res => setSlots(res.data.remaining))
            .catch(() => setSlots(63));
    }, []);

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 p-6 mb-8 flex items-center justify-between gap-6">
            <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full bg-white/5"></div>
            <div className="absolute bottom-0 right-24 w-24 h-24 rounded-full bg-white/5"></div>

            <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-3">
                    <Zap size={10} className="text-yellow-300" /> {t('courseList.promoNew')}
                </div>
                <h3 className="text-white font-extrabold text-lg leading-snug mb-1.5 max-w-xs">
                    {t('courseList.promoTitle')}
                </h3>
                <p className="text-blue-200 text-sm font-medium max-w-xs">
                    {t('courseList.promoDesc')}
                </p>

                {/* 👇 счётчик мест */}
                {slots !== null && (
                    <div className="flex items-center gap-1.5 mt-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-300 flex-shrink-0" />
                        <span className="text-blue-100 text-xs font-semibold">
                            {t('courseList.promoSlots', { count: slots })}
                        </span>
                    </div>
                )}

                <Link
                    to="/corporate"
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-white text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-blue-900/20"
                >
                    {t('courseList.promoBtn')} <ArrowRight size={14} />
                </Link>
            </div>

            <div className="relative z-10 hidden lg:flex flex-col gap-2 flex-shrink-0">
                {[
                    { icon: <Shield size={14} className="text-blue-400" />, label: t('courseList.promoF1'), color: 'bg-blue-50 dark:bg-blue-900/30' },
                    { icon: <TrendingUp size={14} className="text-emerald-500" />, label: t('courseList.promoF2'), color: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { icon: <Star size={14} className="text-amber-400 fill-amber-400" />, label: t('courseList.promoF3'), color: 'bg-amber-50 dark:bg-amber-900/30' },
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

export default function CourseList() {
    const { t } = useTranslation();

    const SORT_OPTIONS = [
        { value: 'popular',    label: t('courseList.sortPopular') },
        { value: 'new',        label: t('courseList.sortNew') },
        { value: 'rating',     label: t('courseList.sortRating') },
        { value: 'price_asc',  label: t('courseList.sortPriceAsc') },
        { value: 'price_desc', label: t('courseList.sortPriceDesc') },
    ];

    const LEVEL_OPTIONS  = [
        { id: 'beginner', label: t('courseList.levelBeginner') },
        { id: 'intermediate', label: t('courseList.levelIntermediate') },
        { id: 'advanced', label: t('courseList.levelAdvanced') }
    ];
    const DURATION_OPTIONS = [
        { id: 'lt2', label: t('courseList.durLt2') },
        { id: '2-5', label: t('courseList.dur2to5') },
        { id: '5-10', label: t('courseList.dur5to10') },
        { id: 'gt10', label: t('courseList.durGt10') }
    ];

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

    // 🔥 Только реально купленные курсы попадают в этот блок
    const myLearning = filtered.filter(c => c.is_enrolled === true && (c.progress || 0) < 100);

    const activeFilters = [selectedCategory, onlyFree, ...selectedLevels].filter(Boolean).length;

    const clearAll = () => {
        setSelectedCategory(''); setOnlyFree(false);
        setSelectedLevels([]); setSearchTerm(''); setDebouncedSearch('');
    };
    const toggleLevel = id => setSelectedLevels(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const SidebarContent = () => (
        <>
            <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-sm font-extrabold text-base-content">{t('courseList.filters')}</span>
                {activeFilters > 0 && (
                    <button onClick={clearAll} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1">
                        <X size={11} /> {t('courseList.reset')}
                    </button>
                )}
            </div>

            <FilterBlock title={t('courseList.direction')}>
                <div className="space-y-0.5">
                    <button
                        onClick={() => setSelectedCategory('')}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium
                            ${selectedCategory === '' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                    >
                        {t('courseList.allDirections')}
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(p => p === String(cat.id) ? '' : String(cat.id))}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium
                                ${selectedCategory === String(cat.id) ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-base-content/70 hover:bg-base-200'}`}
                        >
                            {t(`categories.${cat.title}`, { defaultValue: cat.title })}
                        </button>
                    ))}
                </div>
            </FilterBlock>

            <FilterBlock title={t('courseList.level')}>
                <div className="space-y-2.5">
                    {LEVEL_OPTIONS.map(l => (
                        <label key={l.id} onClick={() => toggleLevel(l.id)} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                                ${selectedLevels.includes(l.id) ? 'bg-blue-600 border-blue-600' : 'border-base-300 group-hover:border-blue-400'}`}>
                                {selectedLevels.includes(l.id) && <CheckCircle size={10} className="text-white" />}
                            </div>
                            <span className="text-sm text-base-content/70 font-medium">{l.label}</span>
                        </label>
                    ))}
                </div>
            </FilterBlock>

            <FilterBlock title={t('courseList.cost')}>
                <label onClick={() => setOnlyFree(f => !f)} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                        ${onlyFree ? 'bg-blue-600 border-blue-600' : 'border-base-300 group-hover:border-blue-400'}`}>
                        {onlyFree && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <span className="text-sm text-base-content/70 font-medium">{t('courseList.onlyFree')}</span>
                </label>
            </FilterBlock>

            <FilterBlock title={t('courseList.duration')} defaultOpen={false}>
                <div className="space-y-2.5">
                    {DURATION_OPTIONS.map(d => (
                        <label key={d.id} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border-2 border-base-300 group-hover:border-blue-400 flex-shrink-0 transition-colors"></div>
                            <span className="text-sm text-base-content/70 font-medium">{d.label}</span>
                        </label>
                    ))}
                </div>
            </FilterBlock>
        </>
    );

    return (
        <>
            <OnboardingTour />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            `}</style>

            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="min-h-screen bg-base-100 text-base-content">

                <div className="bg-base-100 border-b border-base-200 sticky top-16 z-30">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        <div className="relative flex-1 max-w-xl">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50 pointer-events-none" />
                            <input
                                type="text"
                                placeholder={t('courseList.searchPlaceholder')}
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

                        <div className="hidden lg:flex items-center gap-2">
                            <button
                                onClick={() => setOnlyFree(f => !f)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all
                                    ${onlyFree ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-base-100 text-base-content/70 border-base-300 hover:border-base-content/20'}`}
                            >
                                <CheckCircle size={11} className={onlyFree ? 'text-emerald-500' : 'text-base-content/30'} />
                                {t('courseList.onlyFree')}
                            </button>
                        </div>

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
                                {t('courseList.filters')}
                                {activeFilters > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16 flex gap-7">
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="bg-base-100 rounded-2xl border border-base-200 px-5 py-4 sticky top-32">
                            <SidebarContent />
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0">
                        {!searchTerm && !selectedCategory && !onlyFree && !selectedLevels.length && (
                            <PromoBanner />
                        )}

                        {activeFilters > 0 && (
                            <div className="flex flex-wrap gap-2 mb-5">
                                {selectedCategory && categories.find(c => String(c.id) === selectedCategory) && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800">
                                        {t(`categories.${categories.find(c => String(c.id) === selectedCategory)?.title}`, { defaultValue: categories.find(c => String(c.id) === selectedCategory)?.title })}
                                        <button onClick={() => setSelectedCategory('')}><X size={10} /></button>
                                    </span>
                                )}
                                {onlyFree && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                                        {t('courseList.free')} <button onClick={() => setOnlyFree(false)}><X size={10} /></button>
                                    </span>
                                )}
                                {selectedLevels.map(lId => (
                                    <span key={lId} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-bold border border-violet-100 dark:border-violet-800">
                                        {LEVEL_OPTIONS.find(lo => lo.id === lId)?.label} <button onClick={() => toggleLevel(lId)}><X size={10} /></button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <p className="text-xs text-base-content/50 font-medium mb-4">
                            {loading ? t('courseList.searching') : `${filtered.length} ${filtered.length === 1 ? t('courseList.courseSingle') : t('courseList.coursePlural')}`}
                        </p>

                        {loading ? (
                            <div className="flex flex-col gap-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row gap-4 bg-base-100 rounded-2xl border border-base-200 p-4 animate-pulse">
                                        <div className="w-full h-40 sm:w-32 bg-base-300 rounded-xl flex-shrink-0"></div>
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
                                {myLearning.length > 0 && !debouncedSearch && !selectedCategory && (
                                    <div className="mb-10 bg-blue-50/30 dark:bg-blue-900/10 p-5 sm:p-6 rounded-3xl border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                                        
                                        <div className="flex items-center gap-3 mb-5 relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                                                <BookOpenCheck size={20} />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-extrabold text-base-content leading-tight">{t('courseList.continueLearningTitle')}</h2>
                                                <p className="text-xs text-base-content/60 font-medium">{t('courseList.currentProgress')}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 relative z-10">
                                            {myLearning.map(c => <CourseCard key={`ml-${c.id}`} course={c} />)}
                                        </div>
                                    </div>
                                )}

                                {myLearning.length > 0 && !debouncedSearch && !selectedCategory && (
                                    <div className="flex items-center gap-4 mb-6">
                                        <h2 className="text-lg font-extrabold text-base-content flex-shrink-0">{t('courseList.courseCatalog')}</h2>
                                        <div className="flex-1 h-px bg-base-200"></div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    {filtered
                                        .filter(c => {
                                            if (!debouncedSearch && !selectedCategory) {
                                                // 🔥 Прямая проверка: скрываем из общего списка только если реально записан и не прошел до конца
                                                return !(c.is_enrolled === true && (c.progress || 0) < 100);
                                            }
                                            return true;
                                        })
                                        .map(c => <CourseCard key={c.id} course={c} />)
                                    }
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
                                    <Search size={24} className="text-base-content/50" />
                                </div>
                                <h3 className="text-base font-bold text-base-content mb-1.5">{t('courseList.notFoundTitle')}</h3>
                                <p className="text-sm text-base-content/50 max-w-xs mb-5 leading-relaxed">
                                    {t('courseList.notFoundDesc')}
                                </p>
                                <button onClick={clearAll} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
                                    {t('courseList.resetFilters')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {mobileSidebar && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileSidebar(false)}></div>
                        <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-base-100 shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200">
                            <div className="flex items-center justify-between p-5 border-b border-base-200 sticky top-0 bg-base-100/95 backdrop-blur z-10">
                                <span className="font-extrabold text-base-content">{t('courseList.filters')}</span>
                                <button onClick={() => setMobileSidebar(false)} className="p-2 -mr-2 rounded-xl hover:bg-base-200 transition-colors">
                                    <X size={18} className="text-base-content/50" />
                                </button>
                            </div>
                            <div className="p-5"><SidebarContent /></div>
                            <div className="sticky bottom-0 p-5 bg-base-100 border-t border-base-200">
                                <button onClick={() => setMobileSidebar(false)} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
                                    {t('courseList.showCourses')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}