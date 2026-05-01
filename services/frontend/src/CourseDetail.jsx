import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from './api';
import { 
    FileText, PlayCircle, ShieldCheck, HelpCircle, 
    Code2, ChevronRight, CheckCircle2, Clock, 
    Award, Lock, Briefcase 
} from 'lucide-react';
import ReviewSection from './ReviewSection';

function CourseDetail({ isLoggedIn }) { 
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); 
    const [isEnrolled, setIsEnrolled] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); 
    const [buttonSuccess, setButtonSuccess] = useState(false);

    // 🔥 Новые состояния для инвайт-кода
    const [inviteCode, setInviteCode] = useState('');
    const [isApplyingCode, setIsApplyingCode] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('success') === 'true') {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [location]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const courseRes = await api.get(`courses/${id}/`);
                setCourse(courseRes.data);

                const lessonsRes = await api.get(`courses/${id}/lessons/`);
                setLessons(lessonsRes.data.sort((a, b) => a.id - b.id));

                const token = localStorage.getItem('access');
                const userIsActuallyLoggedIn = isLoggedIn || !!token;

                if (userIsActuallyLoggedIn) {
                    try {
                        const myCoursesRes = await api.get(`courses/my_courses/`, {
                            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
                        });
                        
                        const isUserEnrolled = myCoursesRes.data.some(c => c.id === parseInt(id));
                        setIsEnrolled(isUserEnrolled); 
                    } catch (err) {
                        console.error("Ошибка при запросе моих курсов:", err);
                        setIsEnrolled(false);
                    }
                } else {
                    setIsEnrolled(false);
                }
            } catch (err) {
                console.error("Ошибка загрузки курса", err);
                if (err.response?.status === 401) {
                    toast.error("Пожалуйста, войдите в систему");
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isLoggedIn]);

    const getStepStyle = (type) => {
        const iconProps = { size: 18, className: "text-base-content/50 group-hover:text-blue-500 transition-colors" };
        switch (type) {
            case 'simulation_chat':  return { icon: <ShieldCheck {...iconProps} />, label: t('courseDetail.stepTypes.interactive') || 'Интерактив' };
            case 'simulation_email': return { icon: <ShieldCheck {...iconProps} />, label: t('courseDetail.stepTypes.phishing') || 'Фишинг' };
            case 'video_url':        return { icon: <PlayCircle {...iconProps} />,  label: t('courseDetail.stepTypes.video') || 'Видео' };
            case 'quiz':             return { icon: <HelpCircle {...iconProps} />,  label: t('courseDetail.stepTypes.quiz') || 'Тест' };
            case 'interactive_code': return { icon: <Code2 {...iconProps} />,       label: t('courseDetail.stepTypes.code') || 'Код' };
            default:                 return { icon: <FileText {...iconProps} />,    label: t('courseDetail.stepTypes.theory') || 'Теория' };
        }
    };

    const handleEnrollClick = async () => {
        const token = localStorage.getItem('access');
        if (!isLoggedIn && !token) { 
            navigate('/login'); 
            return; 
        }
        setEnrollLoading(true);
        try {
            if (course.price && parseFloat(course.price) > 0) {
                const response = await api.post(`courses/${id}/create-checkout-session/`);
                window.location.href = response.data.checkout_url; 
            } else {
                await api.post(`courses/${id}/enroll/`);
                
                const lessonsRes = await api.get(`courses/${id}/lessons/`);
                setLessons(lessonsRes.data.sort((a, b) => a.id - b.id));
                
                setEnrollLoading(false);
                setButtonSuccess(true);

                setTimeout(() => {
                    setButtonSuccess(false);
                    setIsEnrolled(true);
                }, 1500);
            }
        } catch (error) {
            console.error("Ошибка при записи", error);
            setEnrollLoading(false);
        }
    };

    // 🔥 Функция активации инвайт-кода
    const handleApplyInvite = async () => {
        const token = localStorage.getItem('access');
        if (!isLoggedIn && !token) {
            toast.info("Пожалуйста, войдите в систему, чтобы использовать код");
            navigate('/login');
            return;
        }

        if (!inviteCode.trim()) return toast.warning("Введите корпоративный код");
        
        setIsApplyingCode(true);
        try {
            const res = await api.post(`/courses/${id}/activate-invite/`, { code: inviteCode });
            toast.success(res.data.message || "Код активирован! Доступ открыт 🎉");
            setInviteCode('');
            
            // Сразу обновляем интерфейс, как будто пользователь купил курс
            setIsEnrolled(true);
            
            // Перезапрашиваем уроки, чтобы с них снялись "замочки" блокировки
            const lessonsRes = await api.get(`courses/${id}/lessons/`);
            setLessons(lessonsRes.data.sort((a, b) => a.id - b.id));
            
        } catch (error) {
            toast.error(error.response?.data?.error || "Ошибка активации кода. Проверьте правильность.");
        } finally {
            setIsApplyingCode(false);
        }
    };

    const handleStepClick = (lessonId, stepId) => {
        if (!isEnrolled) {
            toast.info(t('courseDetail.enrollToUnlock'));
            return;
        }
        navigate(`/lesson/${lessonId}?step=${stepId}`);
    };

    if (loading) return (
        <div className="min-h-[70vh] flex items-center justify-center bg-base-200">
            <div className="w-6 h-6 border-2 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );
    if (!course) return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center bg-base-200 text-base-content/50">
            <h2 className="text-xl font-bold mb-2">Курс не найден</h2>
            <p>Возможно, у вас нет доступа, или нужно авторизоваться.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-100 font-sans text-base-content pb-20 relative transition-colors duration-200">
            <div className="max-w-6xl mx-auto px-6 pt-12">
                <div className="flex flex-col lg:flex-row gap-16 items-start">

                    {/* ── Левая колонка (Контент) ── */}
                    <div className="flex-1 lg:max-w-2xl">
                        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-base-content/50 mb-6">
                            <button onClick={() => navigate('/courses')} className="hover:text-base-content transition-colors">
                                {t('courseDetail.library')}
                            </button>
                            <ChevronRight size={12} />
                            <span className="text-base-content truncate">{course.title}</span>
                        </nav>

                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-base-content mb-8 leading-tight">
                            {course.title}
                        </h1>

                        {course.cover_image && (
                            <div className="w-full h-64 md:h-[400px] rounded-3xl overflow-hidden mb-10 shadow-lg shadow-base-300/20 border border-base-200">
                                <img 
                                    src={course.cover_image} 
                                    alt={course.title} 
                                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" 
                                />
                            </div>
                        )}

                        {course.progress === 100 && isEnrolled && (
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 transform transition-all hover:scale-[1.01]">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/30">
                                        <CheckCircle2 size={36} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black mb-1">{t('courseDetail.graduateTitle')}</h2>
                                        <p className="text-emerald-50 text-sm opacity-90">{t('courseDetail.graduateDesc')}</p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
                                    <button 
                                        onClick={() => navigate('/profile')} 
                                        className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 shadow-lg px-8 rounded-xl font-bold py-3 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Award size={18} /> {t('courseDetail.viewAchievements')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Описание */}
                        <div 
                            className="prose prose-sm sm:prose-base max-w-none text-base-content/80 mb-12 leading-relaxed dark:prose-invert prose-a:text-blue-600 hover:prose-a:text-blue-500"
                            dangerouslySetInnerHTML={{ __html: course.description }}
                        />

                        {/* Программа курса */}
                        <div className="mb-16">
                            <h2 className="text-2xl font-black text-base-content mb-6 flex items-center gap-3">
                                <FileText className="text-blue-600" size={24} /> 
                                {t('courseDetail.syllabus')}
                            </h2>
                            
                            <div className="bg-base-100 border border-base-300 rounded-3xl overflow-hidden shadow-sm">
                                {lessons.map((lesson, lIdx) => (
                                    <div key={lesson.id} className="bg-base-100">
                                        <div className="px-6 py-5 bg-base-200/50 border-b border-base-300">
                                            <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1">
                                                {t('courseDetail.section')} {lIdx + 1}
                                            </p>
                                            <p className="text-base font-bold text-base-content">{lesson.title}</p>
                                        </div>

                                        <div className="flex flex-col relative py-2">
                                            {lesson.steps?.map((step, sIdx) => {
                                                const { icon, label } = getStepStyle(step.step_type);
                                                const isPassed = step.is_completed;
                                                const isLocked = !isEnrolled;

                                                return (
                                                    <button 
                                                        key={step.id}
                                                        onClick={() => handleStepClick(lesson.id, step.id)}
                                                        className={`w-full group flex items-center px-6 py-4 transition-all text-left relative ${isLocked ? 'cursor-not-allowed hover:bg-base-100' : 'cursor-pointer hover:bg-base-200/50'}`}
                                                    >
                                                        <div className="absolute left-[43px] top-0 bottom-0 w-[2px] bg-base-200 dark:bg-base-300 group-first:top-1/2 group-last:bottom-1/2 z-0"></div>
                                                        
                                                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all mr-5 shadow-sm border-2 ${
                                                            isLocked ? "bg-base-200 border-base-300 text-base-content/30" :
                                                            isPassed ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30" : 
                                                            "bg-base-100 border-base-300 text-base-content/50 group-hover:border-blue-400 group-hover:text-blue-500"
                                                        }`}>
                                                            {isLocked ? <Lock size={16} strokeWidth={2.5} /> : isPassed ? <CheckCircle2 size={20} strokeWidth={2.5} /> : icon}
                                                        </div>
                                                        
                                                        <div className={`flex-1 min-w-0 ${isLocked ? 'opacity-60' : ''}`}>
                                                            <span className={`text-[10px] font-black uppercase tracking-widest leading-none block mb-1.5 ${
                                                                isLocked ? "text-base-content/30" :
                                                                isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600/70"
                                                            }`}>
                                                                {isLocked ? t('courseDetail.locked') : isPassed ? t('courseDetail.passed') : label}
                                                            </span>
                                                            <h4 className={`text-sm font-bold transition-colors leading-snug ${
                                                                isLocked ? "text-base-content/60" :
                                                                isPassed ? "text-base-content" : "text-base-content/80 group-hover:text-base-content"
                                                            }`}>
                                                                {step.title || `${t('courseDetail.stepFallback')} ${sIdx + 1}`}
                                                            </h4>
                                                        </div>
                                                        
                                                        {!isLocked && (
                                                            <ChevronRight size={18} className="text-base-content/20 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all ml-4" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Инструктор */}
                        <div className="flex items-center gap-6 py-8 border-t border-base-300 mb-12">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xl font-black text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm">
                                    {course.teacher_name?.[0] || 'S'}
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-base-content/40 mb-0.5">{t('courseDetail.instructor')}</p>
                                    <p className="text-base font-bold text-base-content">{course.teacher_name || t('courseDetail.instructorFallback')}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* ── Правая колонка (Плашка записи/прогресса) ── */}
                    <div className="w-full lg:w-[400px] sticky top-24 z-10">
                        <div className="bg-base-100 border border-base-300 rounded-3xl p-8 shadow-2xl shadow-base-300/30 animate-in fade-in duration-300">
                            
                            {!isEnrolled ? (
                                <>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">
                                        {t('courseDetail.priceLabel')}
                                    </p>
                                    <div className="text-4xl font-black text-base-content mb-8">
                                        {parseFloat(course.price) > 0
                                            ? `${new Intl.NumberFormat('ru-RU').format(course.price)} ₸`
                                            : <span className="text-emerald-600 dark:text-emerald-400">{t('courseDetail.free')}</span>
                                        }
                                    </div>

                                    <button 
                                        onClick={handleEnrollClick} 
                                        disabled={enrollLoading || buttonSuccess}
                                        className={`w-full py-4 rounded-xl font-bold transition-all duration-300 flex justify-center items-center gap-2 shadow-lg ${
                                            buttonSuccess 
                                                ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20 group disabled:opacity-50 disabled:cursor-not-allowed'
                                        }`}
                                    >
                                        {enrollLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : buttonSuccess ? (
                                            <>
                                                <CheckCircle2 size={20} className="animate-in zoom-in duration-300" />
                                                <span className="animate-in fade-in slide-in-from-right-2 duration-300">{t('courseDetail.success')}</span>
                                            </>
                                        ) : (
                                            <>
                                                {(isLoggedIn || localStorage.getItem('access')) ? t('courseDetail.enrollBtn') : t('courseDetail.loginToEnroll')}
                                                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>

                                    {/* 🔥 Блок активации корпоративного инвайта 🔥 */}
                                    <div className="mt-6 p-5 bg-base-200/50 rounded-2xl border border-base-300">
                                        <p className="text-[11px] font-black text-base-content/50 uppercase tracking-widest mb-3">
                                            {t('courseDetail.corporateAccess') || 'Доступ от работодателя?'}
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="XXXX-XXXX-XXXX"
                                                value={inviteCode}
                                                onChange={(e) => setInviteCode(e.target.value)}
                                                className="flex-1 w-full bg-base-100 border border-base-300 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors uppercase placeholder:normal-case"
                                            />
                                            <button
                                                onClick={handleApplyInvite}
                                                disabled={isApplyingCode || !inviteCode.trim()}
                                                className="bg-base-content text-base-100 hover:bg-base-content/80 px-4 sm:px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isApplyingCode ? "..." : (t('courseDetail.apply') || "Применить")}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-center mb-6">
                                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-base-100 shadow-md">
                                            <span className="text-xl font-black">{course.progress || 0}%</span>
                                        </div>
                                        <h3 className="font-bold text-base-content">Ваш прогресс</h3>
                                    </div>
                                    <div className="w-full bg-base-200 rounded-full h-2.5 mb-8 overflow-hidden">
                                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${course.progress || 0}%` }}></div>
                                    </div>

                                    {course.progress === 100 ? (
                                        <button 
                                            onClick={() => navigate('/profile')}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                        >
                                            <Award size={18} /> {t('courseDetail.certificates')}
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => navigate(`/lesson/${lessons[0]?.id}`)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-900/20 flex justify-center items-center gap-2 group"
                                        >
                                            {course.progress > 0 ? t('courseDetail.continue') : t('courseDetail.start')}
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    )}
                                </>
                            )}
                            
                            <div className="mt-8 pt-8 border-t border-base-300 space-y-4">
                                <div className="flex gap-4 text-xs text-base-content/80 font-medium leading-relaxed">
                                    <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={12} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span>{t('courseDetail.fullAccess')}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-base-content/80 font-medium leading-relaxed">
                                    <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0">
                                        <Clock size={12} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span>{t('courseDetail.selfPaced')}</span>
                                </div>
                            </div>

                            {/* 🔥 КОРПОРАТИВНЫЙ БЛОК (B2B) 🔥 */}
                            <div className="mt-6 pt-6 border-t border-base-300">
                                <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0">
                                            <Briefcase size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-base-content leading-tight">
                                                {t('courseDetail.b2bTitle')}
                                            </h4>
                                        </div>
                                    </div>
                                    <p className="text-xs text-base-content/70 leading-relaxed">
                                        {t('courseDetail.b2bDesc')}
                                    </p>
                                    <button 
                                        // 🔥 Здесь добавлена передача данных курса! 🔥
                                        onClick={() => navigate('/corporate', { state: { courseId: course.id, courseTitle: course.title } })}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors flex items-center gap-1 mt-1 w-max"
                                    >
                                        {t('courseDetail.b2bBtn')} <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

                {/* Отзывы */}
                <div className="mt-20 pt-16 border-t border-base-300">
                    <div className="max-w-4xl mx-auto">
                        <ReviewSection 
                            courseId={course.id} 
                            isEnrolled={isEnrolled} 
                            progress={course.progress || 0} 
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

export default CourseDetail;