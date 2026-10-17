import React, { useEffect, useState, useMemo, useId } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import OnboardingTour from './OnboardingTour';
import { useTranslation } from 'react-i18next';
import { Search, BookOpen, PlayCircle, Clock, Users, Star, ChevronDown, X, CheckCircle, ArrowRight, SlidersHorizontal } from 'lucide-react';
import './CourseCatalog.css';

const stripHtml = (html) => html ? html.replace(/<[^>]+>/g, '') : '';
const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

function CourseCover({ imageUrl, title }) {
    const [failedUrl, setFailedUrl] = useState(null);
    return (
        <div className="catalog-cover">
            {imageUrl && failedUrl !== imageUrl ? (
                <img src={imageUrl} alt={title} loading="lazy" onError={() => setFailedUrl(imageUrl)} />
            ) : (
                <div className="catalog-cover-fallback" aria-hidden="true">
                    <BookOpen size={40} strokeWidth={1.25} />
                    <span>SAQBol</span>
                </div>
            )}
        </div>
    );
}

function CourseCard({ course, compact = false }) {
    const { t, i18n } = useTranslation();
    const imageUrl = course.image || course.cover_image || course.image_url;
    const price = parseFloat(course.price);
    const isFree = price === 0;
    const progress = course.progress || 0;
    const isEnrolled = course.is_enrolled === true;
    const isCompleted = progress === 100;
    const hasProgress = hasNumber(course.progress) && Number(course.progress) <= 100;
    const hasRating = hasNumber(course.average_rating) && Number(course.average_rating) > 0;
    const number = value => new Intl.NumberFormat(i18n.resolvedLanguage).format(Number(value));

    return (
        <Link to={`/courses/${course.id}`} className={`catalog-card ${compact ? 'catalog-card--learning' : ''}`}>
            <CourseCover imageUrl={imageUrl} title={course.title} />
            <div className="catalog-card-body">
                <h3>{course.title}</h3>
                {course.category_title && <p className="catalog-category">{t(`categories.${course.category_title}`, { defaultValue: course.category_title })}</p>}
                {!compact && stripHtml(course.description) && <p className="catalog-description">{stripHtml(course.description)}</p>}
                {!compact && (hasRating || hasNumber(course.students_count) || hasNumber(course.duration)) && (
                    <div className="catalog-meta">
                        {hasRating && <span><Star size={14} aria-hidden="true" />{Number(course.average_rating).toFixed(1)}
                            {hasNumber(course.reviews_count) && <span>({number(course.reviews_count)} {t('courseList.reviewsText')})</span>}
                        </span>}
                        {hasNumber(course.students_count) && <span><Users size={14} aria-hidden="true" />{number(course.students_count)}</span>}
                        {hasNumber(course.duration) && <span><Clock size={14} aria-hidden="true" />{new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'unit', unit: 'hour', unitDisplay: 'short' }).format(Number(course.duration))}</span>}
                    </div>
                )}
                <div className="catalog-card-bottom">
                    {isEnrolled && <div className="catalog-progress">
                        <div><span>{isCompleted ? t('courseList.completedStatus') : t('courseList.myLearning')}</span>{hasProgress && <span>{progress}%</span>}</div>
                        {hasProgress && <progress value={progress} max="100" aria-label={t('courseList.currentProgress')} />}
                    </div>}
                    <div className="catalog-card-action">
                        {!isEnrolled && Number.isFinite(price) && <span className={`catalog-price ${isFree ? 'catalog-price--free' : ''}`}>{isFree ? t('courseList.free') : `${number(price)} ₸`}</span>}
                        <span className={`catalog-open ${isEnrolled ? 'catalog-open--enrolled' : ''}`}>
                            {isEnrolled ? isCompleted ? <><CheckCircle size={16} />{t('courseList.completedBtn')}</> : progress > 0 ? <><PlayCircle size={16} />{t('courseList.continueBtn')}</> : <><PlayCircle size={16} />{t('courseList.startBtn')}</> : <>{t('courseList.openBtn')}<ArrowRight size={16} /></>}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function FilterBlock({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const id = useId();
    return <section className="catalog-filter-block">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={id}>
            {title}<ChevronDown size={16} className={open ? 'catalog-chevron-open' : ''} aria-hidden="true" />
        </button>
        {open && <div id={id} className="catalog-filter-options">{children}</div>}
    </section>;
}

function PromoBanner() {
    const { t } = useTranslation();
    const [slots, setSlots] = useState(null);
    useEffect(() => {
        api.get('courses/promo-slots/')
            .then(res => setSlots(res.data.remaining))
            .catch(() => setSlots(null));
    }, []);
    return <div className="catalog-promo">
        <div><span>{t('courseDetail.b2bTitle')}</span>{hasNumber(slots) && <p>{t('courseList.promoSlots', { count: slots })}</p>}</div>
        <Link to="/corporate">{t('courseList.openBtn')}<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>;
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
            <div className="catalog-filter-heading">
                <h2>{t('courseList.filters')}</h2>
                {activeFilters > 0 && <button onClick={clearAll} className="catalog-text-button"><X size={14} aria-hidden="true" />{t('courseList.reset')}</button>}
            </div>
            <FilterBlock title={t('courseList.direction')}>
                <button onClick={() => setSelectedCategory('')} aria-pressed={selectedCategory === ''} className="catalog-category-filter">{t('courseList.allDirections')}</button>
                {categories.map(cat => <button key={cat.id} onClick={() => setSelectedCategory(p => p === String(cat.id) ? '' : String(cat.id))} aria-pressed={selectedCategory === String(cat.id)} className="catalog-category-filter">
                    {t(`categories.${cat.title}`, { defaultValue: cat.title })}
                </button>)}
            </FilterBlock>
            <FilterBlock title={t('courseList.level')}>
                {LEVEL_OPTIONS.map(l => <label key={l.id} className="catalog-checkbox">
                    <input type="checkbox" checked={selectedLevels.includes(l.id)} onChange={() => toggleLevel(l.id)} /><span>{l.label}</span>
                </label>)}
            </FilterBlock>
            <FilterBlock title={t('courseList.cost')}>
                <label className="catalog-checkbox"><input type="checkbox" checked={onlyFree} onChange={() => setOnlyFree(f => !f)} /><span>{t('courseList.onlyFree')}</span></label>
            </FilterBlock>
            <FilterBlock title={t('courseList.duration')} defaultOpen={false}>
                {DURATION_OPTIONS.map(d => <div key={d.id} className="catalog-duration-option"><span aria-hidden="true" />{d.label}</div>)}
            </FilterBlock>
        </>
    );

    return (
        <>
            <OnboardingTour />
            <div className="saqbol-catalog">
                <header className="catalog-header">
                    <h1>{t('courseList.courseCatalog')}</h1>
                    <div className="catalog-search">
                        <Search size={20} aria-hidden="true" />
                        <input type="search" aria-label={t('courseList.searchPlaceholder')} placeholder={t('courseList.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {searchTerm && <button onClick={() => setSearchTerm('')} aria-label={t('courseList.clearSearch')}><X size={18} aria-hidden="true" /></button>}
                    </div>
                </header>
                <div className="catalog-layout">
                    <aside className="catalog-sidebar"><SidebarContent /></aside>
                    <div className="catalog-results">
                        <div className="catalog-toolbar">
                            <p className="catalog-count" role="status">{loading ? t('courseList.searching') : `${filtered.length} ${filtered.length === 1 ? t('courseList.courseSingle') : t('courseList.coursePlural')}`}</p>
                            <button onClick={() => setOnlyFree(f => !f)} aria-pressed={onlyFree} className="catalog-free-toggle"><CheckCircle size={16} aria-hidden="true" />{t('courseList.onlyFree')}</button>
                            <div className="catalog-sort"><select aria-label={t('courseList.sortLabel')} value={sortBy} onChange={e => setSortBy(e.target.value)}>{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div>
                            <button onClick={() => setMobileSidebar(true)} className="catalog-mobile-filter"><SlidersHorizontal size={18} aria-hidden="true" />{t('courseList.filters')}{activeFilters > 0 && <span>{activeFilters}</span>}</button>
                        </div>
                        {activeFilters > 0 && <div className="catalog-chips">
                            {selectedCategory && categories.find(c => String(c.id) === selectedCategory) && <button onClick={() => setSelectedCategory('')}>
                                {t(`categories.${categories.find(c => String(c.id) === selectedCategory)?.title}`, { defaultValue: categories.find(c => String(c.id) === selectedCategory)?.title })}<X size={16} aria-hidden="true" />
                            </button>}
                            {onlyFree && <button onClick={() => setOnlyFree(false)}>{t('courseList.free')}<X size={16} aria-hidden="true" /></button>}
                            {selectedLevels.map(lId => <button key={lId} onClick={() => toggleLevel(lId)}>{LEVEL_OPTIONS.find(lo => lo.id === lId)?.label}<X size={16} aria-hidden="true" /></button>)}
                        </div>}
                        {loading ? <div className="catalog-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="catalog-skeleton"><div /><span /><span /></div>)}</div> : filtered.length > 0 ? (
                            <>
                                {myLearning.length > 0 && !debouncedSearch && !selectedCategory && <section className="catalog-learning">
                                    <h2>{t('courseList.continueLearningTitle')}</h2>
                                    <div className="catalog-learning-grid">{myLearning.map(c => <CourseCard key={c.id} course={c} compact />)}</div>
                                </section>}
                                {myLearning.length > 0 && !debouncedSearch && !selectedCategory && <h2 className="catalog-section-title">{t('courseList.courseCatalog')}</h2>}
                                <div className="catalog-grid">
                                    {filtered.filter(c => {
                                        if (!debouncedSearch && !selectedCategory) return !(c.is_enrolled === true && (c.progress || 0) < 100);
                                        return true;
                                    }).map(c => <CourseCard key={c.id} course={c} />)}
                                </div>
                            </>
                        ) : <div className="catalog-empty">
                            <Search size={36} strokeWidth={1.5} aria-hidden="true" />
                            <h2>{t('courseList.notFoundTitle')}</h2><p>{t('courseList.notFoundDesc')}</p>
                            <button onClick={clearAll} className="catalog-primary-button">{t('courseList.resetFilters')}</button>
                        </div>}
                        {!searchTerm && !selectedCategory && !onlyFree && !selectedLevels.length && <PromoBanner />}
                    </div>
                </div>
                {mobileSidebar && <div className="catalog-mobile-overlay" onKeyDown={e => { if (e.key === 'Escape') setMobileSidebar(false); }}>
                    <div className="catalog-mobile-backdrop" onClick={() => setMobileSidebar(false)} />
                    <div className="catalog-mobile-panel" role="dialog" aria-modal="true" aria-label={t('courseList.filters')}>
                        <div className="catalog-mobile-panel-header"><span>{t('courseList.filters')}</span><button autoFocus onClick={() => setMobileSidebar(false)} aria-label={t('courseList.closeFilters')}><X size={22} aria-hidden="true" /></button></div>
                        <div className="catalog-mobile-panel-content"><SidebarContent /></div>
                        <div className="catalog-mobile-panel-footer"><button onClick={() => setMobileSidebar(false)} className="catalog-primary-button">{t('courseList.showCourses')}</button></div>
                    </div>
                </div>}
            </div>
        </>
    );
}
