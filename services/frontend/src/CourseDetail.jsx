import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';
import { 
    FileText, 
    PlayCircle, 
    ShieldCheck, 
    HelpCircle, 
    Code2, 
    ChevronRight, 
    CheckCircle2,
    Clock
} from 'lucide-react';
// 🔥 Импорт секции отзывов
import ReviewSection from './ReviewSection';

function CourseDetail({ isLoggedIn }) { 
    const { id } = useParams();
    const navigate = useNavigate();

    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); 
    const [isEnrolled, setIsEnrolled] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); 

    const [showSuccessToast, setShowSuccessToast] = useState(() => {
        return new URLSearchParams(window.location.search).get('success') === 'true';
    });

    useEffect(() => {
        if (showSuccessToast) {
            window.history.replaceState(null, '', window.location.pathname);
            const timer = setTimeout(() => setShowSuccessToast(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessToast]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const courseRes = await api.get(`courses/${id}/`);
                setCourse(courseRes.data);

                if (isLoggedIn) {
                    try {
                        const myCoursesRes = await api.get(`courses/my_courses/`);
                        const isUserEnrolled = myCoursesRes.data.some(c => c.id === parseInt(id));
                        if (isUserEnrolled) {
                            const lessonsRes = await api.get(`courses/${id}/lessons/`);
                            setLessons(lessonsRes.data.sort((a, b) => a.id - b.id));
                            setIsEnrolled(true); 
                        } else {
                            setIsEnrolled(false);
                        }
                    } catch {
                        setIsEnrolled(false);
                    }
                } else {
                    setIsEnrolled(false);
                }
            } catch (err) {
                console.error("Ошибка загрузки курса", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isLoggedIn]);

    const getStepStyle = (type) => {
        const iconProps = { size: 18, className: "text-base-content/70 group-hover:text-blue-600 transition-colors" };
        switch (type) {
            case 'simulation_chat':  return { icon: <ShieldCheck {...iconProps} />, label: 'Интерактив' };
            case 'simulation_email': return { icon: <ShieldCheck {...iconProps} />, label: 'Фишинг' };
            case 'video_url':        return { icon: <PlayCircle {...iconProps} />,  label: 'Видео' };
            case 'quiz':             return { icon: <HelpCircle {...iconProps} />,  label: 'Тест' };
            case 'interactive_code': return { icon: <Code2 {...iconProps} />,       label: 'Код' };
            default:                 return { icon: <FileText {...iconProps} />,    label: 'Теория' };
        }
    };

    const handleEnrollClick = async () => {
        if (!isLoggedIn) { navigate('/login'); return; }
        setEnrollLoading(true);
        try {
            if (course.price && parseFloat(course.price) > 0) {
                const response = await api.post(`courses/${id}/create-checkout-session/`);
                window.location.href = response.data.checkout_url; 
            } else {
                await api.post(`courses/${id}/enroll/`);
                window.location.href = `/course/${id}?success=true`; 
            }
        } catch {
            setEnrollLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-[70vh] flex items-center justify-center bg-base-200">
            <div className="w-6 h-6 border-2 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-100 font-sans text-base-content pb-20 relative transition-colors duration-200">

            {showSuccessToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
                    <div className="bg-blue-600 text-white p-4 rounded-xl shadow-2xl shadow-blue-900/20 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <CheckCircle2 className="text-white/80 flex-shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Доступ открыт</p>
                            <p className="text-xs text-blue-200">Курс успешно добавлен в ваше обучение</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-6 pt-12">
                <div className="flex flex-col lg:flex-row gap-16 items-start">

                    {/* ── Левая колонка ── */}
                    <div className="flex-1 lg:max-w-2xl">
                        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-base-content/50 mb-6">
                            <button onClick={() => navigate('/courses')} className="hover:text-base-content transition-colors">
                                Библиотека
                            </button>
                            <ChevronRight size={12} />
                            <span className="text-base-content">{course.title}</span>
                        </nav>

                        <h1 className="text-4xl font-black tracking-tight text-base-content mb-8 leading-tight">
                            {course.title}
                        </h1>

                        <div 
                            className="prose prose-sm sm:prose-base max-w-none text-base-content/80 mb-12 leading-relaxed dark:prose-invert prose-a:text-blue-600 hover:prose-a:text-blue-500"
                            dangerouslySetInnerHTML={{ __html: course.description }}
                        />

                        <div className="flex items-center gap-6 py-8 border-t border-b border-base-300">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                    {course.teacher_name?.[0] || 'S'}
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-base-content/50">Инструктор</p>
                                    <p className="text-sm font-bold text-base-content">{course.teacher_name || "SaqBol Team"}</p>
                                </div>
                            </div>
                        </div>

                        {/* 🔥 СЕКЦИЯ ОТЗЫВОВ ПРЯМО ЗДЕСЬ 🔥 */}
                        <ReviewSection 
                            courseId={course.id} 
                            isEnrolled={isEnrolled} 
                            progress={course.progress || 0} 
                        />

                    </div>

                    {/* ── Правая колонка (sticky) ── */}
                    <div className="w-full lg:w-[400px] sticky top-24">
                        {!isEnrolled ? (
                            <div className="bg-base-100 border border-base-300 rounded-2xl p-8 shadow-xl shadow-base-300/30">
                                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50 mb-2">
                                    Стоимость доступа
                                </p>
                                <div className="text-4xl font-black text-base-content mb-8">
                                    {parseFloat(course.price) > 0
                                        ? `${new Intl.NumberFormat('ru-RU').format(course.price)} ₸`
                                        : <span className="text-emerald-600 dark:text-emerald-400">Бесплатно</span>
                                    }
                                </div>

                                <button 
                                    onClick={handleEnrollClick} 
                                    disabled={enrollLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 group shadow-lg shadow-blue-900/20"
                                >
                                    {enrollLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            {isLoggedIn ? 'Записаться на курс' : 'Войти и начать'}
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                                
                                <div className="mt-8 pt-8 border-t border-base-300 space-y-4">
                                    <div className="flex gap-4 text-xs text-base-content/80 font-medium leading-tight">
                                        <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={12} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span>Полный доступ ко всем интерактивным модулям</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-base-content/80 font-medium leading-tight">
                                        <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0">
                                            <Clock size={12} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span>Обучение в собственном темпе</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-lg shadow-base-300/30">
                                <div className="px-6 py-5 bg-base-200 border-b border-base-300">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-base-content flex items-center gap-2">
                                        <FileText size={14} /> Программа обучения
                                    </h3>
                                </div>

                                <div className="max-h-[65vh] overflow-y-auto">
                                    {lessons.map((lesson, lIdx) => (
                                        <div key={lesson.id} className="bg-base-100">
                                            <div className="px-6 py-4 bg-base-200/50 border-b border-base-300 flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-base-content/50 uppercase tracking-widest mb-0.5">
                                                        Раздел {lIdx + 1}
                                                    </p>
                                                    <p className="text-sm font-black text-base-content truncate">{lesson.title}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col relative">
                                                {lesson.steps?.map((step, sIdx) => {
                                                    const { icon, label } = getStepStyle(step.step_type);
                                                    return (
                                                        <button 
                                                            key={step.id}
                                                            onClick={() => navigate(`/lesson/${lesson.id}?step=${step.id}`)}
                                                            className="w-full group flex items-start gap-4 px-6 py-5 hover:bg-base-200 transition-all text-left relative"
                                                        >
                                                            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-base-300 group-first:top-1/2 group-last:bottom-1/2"></div>
                                                            <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-xl bg-base-100 border border-base-300 shadow-sm flex items-center justify-center group-hover:border-blue-300/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all">
                                                                {icon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest leading-none block mb-1">
                                                                    {label}
                                                                </span>
                                                                <h4 className="text-[13px] font-bold text-base-content/80 group-hover:text-base-content transition-colors leading-snug">
                                                                    {step.title || `Шаг ${sIdx + 1}`}
                                                                </h4>
                                                            </div>
                                                            <ChevronRight size={14} className="text-base-content/30 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all mt-3" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-base-200 border-t border-base-300">
                                    <button 
                                        onClick={() => navigate(`/lesson/${lessons[0]?.id}`)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        Начать обучение
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CourseDetail;