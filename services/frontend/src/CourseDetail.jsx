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
    Lock,
    Clock
} from 'lucide-react';

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
                            const sortedLessons = lessonsRes.data.sort((a, b) => a.id - b.id);
                            setLessons(sortedLessons);
                            setIsEnrolled(true); 
                        } else {
                            setIsEnrolled(false);
                        }
                    } catch (error) {
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
        const iconProps = { size: 18, className: "group-hover:text-slate-900 transition-colors" };
        switch (type) {
            case 'simulation_chat': return { icon: <ShieldCheck {...iconProps} />, label: 'Интерактив' };
            case 'simulation_email': return { icon: <ShieldCheck {...iconProps} />, label: 'Фишинг' };
            case 'video_url': return { icon: <PlayCircle {...iconProps} />, label: 'Видео' };
            case 'quiz': return { icon: <HelpCircle {...iconProps} />, label: 'Тест' };
            case 'interactive_code': return { icon: <Code2 {...iconProps} />, label: 'Код' };
            default: return { icon: <FileText {...iconProps} />, label: 'Теория' };
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
        } catch (err) {
            setEnrollLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-[70vh] flex items-center justify-center bg-white">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 pb-20 relative">
            {showSuccessToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                        <CheckCircle2 className="text-emerald-400" />
                        <div>
                            <p className="font-bold text-sm">Доступ открыт</p>
                            <p className="text-xs text-slate-400">Курс успешно добавлен в ваше обучение</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-6 pt-12">
                <div className="flex flex-col lg:flex-row gap-16 items-start">
                    
                    {/* ЛЕВАЯ КОЛОНКА */}
                    <div className="flex-1 lg:max-w-2xl">
                        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
                            <button onClick={() => navigate('/courses')} className="hover:text-slate-900 transition-colors">Библиотека</button>
                            <ChevronRight size={12} />
                            <span className="text-slate-900">{course.title}</span>
                        </nav>

                        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-8 leading-tight">
                            {course.title}
                        </h1>

                        <div 
                            className="prose prose-slate prose-sm sm:prose-base max-w-none text-slate-600 mb-12 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: course.description }}
                        />

                        <div className="flex items-center gap-6 py-8 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 border border-slate-200">
                                    {course.teacher_name?.[0] || 'S'}
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Инструктор</p>
                                    <p className="text-sm font-bold text-slate-900">{course.teacher_name || "SaqBol Team"}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ПРАВАЯ КОЛОНКА */}
                    <div className="w-full lg:w-[400px] sticky top-24">
                        {!isEnrolled ? (
                            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Стоимость доступа</p>
                                <div className="text-4xl font-black text-slate-900 mb-8">
                                    {parseFloat(course.price) > 0 ? `${new Intl.NumberFormat('ru-RU').format(course.price)} ₸` : 'Бесплатно'}
                                </div>

                                <button 
                                    onClick={handleEnrollClick} 
                                    disabled={enrollLoading}
                                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all disabled:bg-slate-200 flex justify-center items-center gap-2 group"
                                >
                                    {enrollLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                        <>
                                            {isLoggedIn ? 'Записаться на курс' : 'Войти и начать'}
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                                
                                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                                    <div className="flex gap-4 text-xs text-slate-600 font-medium leading-tight">
                                        <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={12} className="text-slate-900" />
                                        </div>
                                        <span>Полный доступ ко всем интерактивным модулям</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-600 font-medium leading-tight">
                                        <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                            <Clock size={12} className="text-slate-900" />
                                        </div>
                                        <span>Обучение в собственном темпе</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                        <FileText size={14} /> Программа обучения
                                    </h3>
                                </div>

                                <div className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                                    {lessons.map((lesson, lIdx) => (
                                        <div key={lesson.id} className="bg-white">
                                            {/* Заголовок Модуля */}
                                            <div className="px-6 py-4 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between group cursor-default">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Раздел {lIdx + 1}</p>
                                                    <p className="text-sm font-black text-slate-800 truncate">{lesson.title}</p>
                                                </div>
                                            </div>

                                            {/* Список Шагов с Timeline */}
                                            <div className="flex flex-col relative">
                                                {lesson.steps?.map((step, sIdx) => {
                                                    const { icon, label } = getStepStyle(step.step_type);
                                                    return (
                                                        <button 
                                                            key={step.id}
                                                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                                                            className="group flex items-start gap-4 px-6 py-5 hover:bg-slate-50 transition-all text-left relative"
                                                        >
                                                            {/* Вертикальная линия Timeline */}
                                                            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-slate-100 group-first:top-1/2 group-last:bottom-1/2"></div>
                                                            
                                                            {/* Контейнер иконки */}
                                                            <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:border-slate-300 group-hover:bg-slate-50 transition-all">
                                                                {icon}
                                                            </div>

                                                            {/* Текстовый контент */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                                        {label}
                                                                    </span>
                                                                </div>
                                                                <h4 className="text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors leading-snug">
                                                                    {step.title || `Шаг ${sIdx + 1}`}
                                                                </h4>
                                                            </div>

                                                            {/* Иконка перехода */}
                                                            <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all mt-3" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-slate-50 border-t border-slate-200">
                                    <button 
                                        onClick={() => navigate(`/lesson/${lessons[0]?.id}`)}
                                        className="w-full bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-lg hover:bg-black transition-colors"
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