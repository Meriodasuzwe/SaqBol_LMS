import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from './api';
import { 
    FileText, 
    PlayCircle, 
    ShieldCheck, 
    HelpCircle, 
    Code2, 
    ChevronRight, 
    CheckCircle2,
    Clock,
    Award
} from 'lucide-react';
import ReviewSection from './ReviewSection';

function CourseDetail({ isLoggedIn }) { 
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); 
    const [isEnrolled, setIsEnrolled] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); 

    // Состояние для зелёной кнопки
    const [buttonSuccess, setButtonSuccess] = useState(false);

    // Очищаем URL, если юзер вернулся после оплаты (CloudPayments/Stripe)
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
        const iconProps = { size: 18, className: "text-base-content/50 group-hover:text-blue-500 transition-colors" };
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
                // Платный курс: редирект на оплату
                const response = await api.post(`courses/${id}/create-checkout-session/`);
                window.location.href = response.data.checkout_url; 
            } else {
                // Бесплатный курс: моментальная запись без перезагрузки
                await api.post(`courses/${id}/enroll/`);
                
                // Подгружаем уроки в фоне
                const lessonsRes = await api.get(`courses/${id}/lessons/`);
                setLessons(lessonsRes.data.sort((a, b) => a.id - b.id));
                
                // Выключаем лоадер, включаем зеленую кнопку успеха
                setEnrollLoading(false);
                setButtonSuccess(true);

                // Ждем 1.5 секунды, чтобы юзер увидел "Успешно!", и затем открываем программу курса
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

    if (loading) return (
        <div className="min-h-[70vh] flex items-center justify-center bg-base-200">
            <div className="w-6 h-6 border-2 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-100 font-sans text-base-content pb-20 relative transition-colors duration-200">
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

                        {course.progress === 100 && (
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 transform transition-all hover:scale-[1.01]">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/30">
                                        <CheckCircle2 size={36} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black mb-1">Выпускник курса! 🎉</h2>
                                        <p className="text-emerald-50 text-sm opacity-90">Вы изучили все материалы и сдали финальные тесты.</p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
                                    <button 
                                        onClick={() => navigate('/profile')} 
                                        className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 shadow-lg px-8 rounded-xl font-bold py-3 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Award size={18} /> Смотреть достижения
                                    </button>
                                </div>
                            </div>
                        )}

                        <div 
                            className="prose prose-sm sm:prose-base max-w-none text-base-content/80 mb-12 leading-relaxed dark:prose-invert prose-a:text-blue-600 hover:prose-a:text-blue-500"
                            dangerouslySetInnerHTML={{ __html: course.description }}
                        />

                        <div className="flex items-center gap-6 py-8 border-t border-base-300">
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
                    </div>

                    {/* ── Правая колонка (sticky) ── */}
                    <div className="w-full lg:w-[400px] sticky top-24">
                        {!isEnrolled ? (
                            <div className="bg-base-100 border border-base-300 rounded-2xl p-8 shadow-xl shadow-base-300/30 animate-in fade-in duration-300">
                                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50 mb-2">
                                    Стоимость доступа
                                </p>
                                <div className="text-4xl font-black text-base-content mb-8">
                                    {parseFloat(course.price) > 0
                                        ? `${new Intl.NumberFormat('ru-RU').format(course.price)} ₸`
                                        : <span className="text-emerald-600 dark:text-emerald-400">Бесплатно</span>
                                    }
                                </div>

                                {/* 🔥 Магическая кнопка 🔥 */}
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
                                            <span className="animate-in fade-in slide-in-from-right-2 duration-300">Успешно!</span>
                                        </>
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
                            <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-lg shadow-base-300/30 animate-in flip-in-y duration-500">
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

                                            <div className="flex flex-col relative py-2">
                                                {lesson.steps?.map((step, sIdx) => {
                                                    const { icon, label } = getStepStyle(step.step_type);
                                                    const isPassed = step.is_completed;

                                                    return (
                                                        <button 
                                                            key={step.id}
                                                            onClick={() => navigate(`/lesson/${lesson.id}?step=${step.id}`)}
                                                            className="w-full group flex items-center px-6 py-4 hover:bg-base-200/50 transition-all text-left relative"
                                                        >
                                                            <div className="absolute left-[43px] top-0 bottom-0 w-[2px] bg-base-200 dark:bg-base-300 group-first:top-1/2 group-last:bottom-1/2 z-0"></div>
                                                            
                                                            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all mr-4 shadow-sm border-2 ${
                                                                isPassed 
                                                                ? "bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/30" 
                                                                : "bg-base-100 border-base-300 text-base-content/40 group-hover:border-blue-400 group-hover:text-blue-500 group-hover:scale-105"
                                                            }`}>
                                                                {isPassed ? <CheckCircle2 size={20} strokeWidth={2.5} /> : icon}
                                                            </div>
                                                            
                                                            <div className="flex-1 min-w-0">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest leading-none block mb-1.5 ${
                                                                    isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-base-content/40"
                                                                }`}>
                                                                    {isPassed ? "Пройдено" : label}
                                                                </span>
                                                                <h4 className={`text-sm font-bold transition-colors leading-snug ${
                                                                    isPassed ? "text-base-content" : "text-base-content/60 group-hover:text-base-content"
                                                                }`}>
                                                                    {step.title || `Шаг ${sIdx + 1}`}
                                                                </h4>
                                                            </div>
                                                            
                                                            <ChevronRight size={16} className="text-base-content/20 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all ml-2" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-base-200 border-t border-base-300">
                                    {course.progress === 100 ? (
                                        <button 
                                            onClick={() => navigate('/profile')}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                        >
                                            <Award size={16} /> Ваши сертификаты
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => navigate(`/lesson/${lessons[0]?.id}`)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                                        >
                                            {course.progress > 0 ? "Продолжить обучение" : "Начать обучение"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

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