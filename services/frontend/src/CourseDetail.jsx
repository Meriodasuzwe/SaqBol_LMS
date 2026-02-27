import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from './api';

function CourseDetail({ isLoggedIn }) { 
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // --- СОСТОЯНИЯ ---
    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); 
    const [isEnrolled, setIsEnrolled] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); 
    const [showSuccessToast, setShowSuccessToast] = useState(false);

    // --- ПРОВЕРКА УСПЕШНОЙ ОПЛАТЫ ---
    useEffect(() => {
        if (searchParams.get('success') === 'true') {
            setShowSuccessToast(true);
            
            // Очищаем URL, чтобы при обновлении страницы уведомление не вылезало снова
            searchParams.delete('success');
            setSearchParams(searchParams);
            
            // Прячем уведомление через 5 секунд
            setTimeout(() => {
                setShowSuccessToast(false);
            }, 5000);
        }
    }, [searchParams, setSearchParams]);

    // --- ЗАГРУЗКА ДАННЫХ ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const courseRes = await api.get(`courses/${id}/`);
                setCourse(courseRes.data);

                if (isLoggedIn) {
                    try {
                        const lessonsRes = await api.get(`courses/${id}/lessons/`);
                        const sortedLessons = lessonsRes.data.sort((a, b) => a.id - b.id);
                        setLessons(sortedLessons);
                        setIsEnrolled(true); 
                    } catch (error) {
                        if (error.response && error.response.status === 403) {
                            setIsEnrolled(false);
                        }
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

    // --- ХЕЛПЕР: СТРОГИЙ B2B ДИЗАЙН УРОКОВ ---
    const getLessonStyle = (type) => {
        switch (type) {
            case 'simulation_chat':
                return { icon: '⌘', label: 'Интерактив', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'simulation_email':
                return { icon: '✉', label: 'Фишинг', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
            default: 
                return { icon: '📄', label: 'Теория', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
        }
    };

    // --- ФУНКЦИЯ ЗАПИСИ ИЛИ ОПЛАТЫ (STRIPE) ---
    const handleEnrollClick = async () => {
        if (!isLoggedIn) {
            navigate('/login');
            return;
        }

        setEnrollLoading(true);
        try {
            // Если курс ПЛАТНЫЙ
            if (course.price && parseFloat(course.price) > 0) {
                const response = await api.post(`courses/${id}/create-checkout-session/`);
                window.location.href = response.data.checkout_url; 
            } else {
                // Если курс БЕСПЛАТНЫЙ
                await api.post(`courses/${id}/enroll/`);
                window.location.reload(); 
            }
        } catch (err) {
            console.error("Ошибка при записи/оплате:", err);
            alert("Произошла ошибка. Пожалуйста, попробуйте позже.");
            setEnrollLoading(false);
        }
    };

    // --- ФОРМАТИРОВАНИЕ ЦЕНЫ ---
    const formatPrice = (price) => {
        const num = parseFloat(price);
        if (isNaN(num) || num <= 0) return 'Бесплатно';
        return new Intl.NumberFormat('ru-RU').format(num) + ' ₸';
    };

    // --- ЛОАДЕР ---
    if (loading) return (
        <div className="min-h-[70vh] flex items-center justify-center bg-slate-50">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
    );
    
    if (!course) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center text-slate-500 font-medium">Курс не найден</div>
        </div>
    );

    const isPaid = course.price && parseFloat(course.price) > 0;

    // ============================================================
    // ВАРИАНТ 1: ЛЕНДИНГ ПРОДАЖ (Если НЕ записан или Гость)
    // ============================================================
    if (!isEnrolled) {
        return (
            <div className="min-h-screen bg-slate-50 pt-16 pb-24 font-sans text-slate-900">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col lg:flex-row gap-16 items-start">
                    
                    {/* ЛЕВАЯ ЧАСТЬ: ОПИСАНИЕ */}
                    <div className="flex-1 lg:max-w-2xl">
                        <div className="mb-8">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-200 text-slate-800 mb-4 border border-slate-300">
                                {isPaid ? 'Премиум программа' : 'Открытый доступ'}
                            </span>
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.15]">
                                {course.title}
                            </h1>
                            <p className="text-lg text-slate-600 leading-relaxed mb-10">
                                {course.description || "Подробное описание курса формируется. Но вы уже можете получить доступ к эксклюзивным материалам и практическим заданиям."}
                            </p>
                        </div>

                        {/* Блок автора */}
                        <div className="flex items-center gap-4 py-6 border-y border-slate-200">
                            <div className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                                {course.teacher_name?.[0]?.toUpperCase() || "T"}
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-0.5">Автор курса</p>
                                <p className="text-base font-medium text-slate-900">{course.teacher_name || "Преподаватель SaqBol"}</p>
                            </div>
                        </div>
                    </div>

                    {/* ПРАВАЯ ЧАСТЬ: КАРТОЧКА ПОКУПКИ (Липкая) */}
                    <div className="w-full lg:w-[400px] sticky top-24 shrink-0">
                        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
                            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Стоимость участия</h3>
                            <div className="text-4xl font-extrabold text-slate-900 mb-6">
                                {formatPrice(course.price)}
                            </div>

                            <button 
                                onClick={handleEnrollClick} 
                                disabled={enrollLoading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white transition-all duration-200 py-4 px-6 rounded-xl font-semibold text-lg flex justify-center items-center shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                                {enrollLoading ? (
                                    <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    !isLoggedIn ? 'Войти для доступа' : 
                                    (isPaid ? 'Оплатить курс' : 'Начать обучение')
                                )}
                            </button>
                            
                            <p className="text-xs text-center text-slate-400 mt-4 font-medium">
                                {isPaid ? 'Безопасная оплата через Stripe' : 'Мгновенный доступ ко всем материалам'}
                            </p>

                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <p className="text-sm font-semibold text-slate-900 mb-4">Что включает программа:</p>
                                <ul className="space-y-3">
                                    {['Доступ ко всем лекциям', 'Интерактивные симуляции атак', 'Оценка прогресса и аналитика', 'Сертификат по завершении'].map((item, i) => (
                                        <li key={i} className="flex items-start text-sm text-slate-600">
                                            <svg className="w-5 h-5 text-slate-800 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // ============================================================
    // ВАРИАНТ 2: ПЛЕЕР УРОКОВ (Если ЗАПИСАН)
    // ============================================================
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 py-10 relative">
            
            {/* --- ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ О ПОКУПКЕ --- */}
            {showSuccessToast && (
                <div className="toast toast-top toast-center z-[100] animate-bounce mt-4">
                    <div className="alert alert-success text-white shadow-xl flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-500 border-none">
                        <span className="text-2xl">🎉</span>
                        <div>
                            <h3 className="font-bold text-lg">Оплата прошла успешно!</h3>
                            <div className="text-sm opacity-90">Доступ к материалам курса открыт.</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8">
                
                {/* ЛЕВАЯ ЧАСТЬ: ИНФО О КУРСЕ */}
                <div className="flex-1 order-2 lg:order-1">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
                        <div className="p-8 sm:p-10">
                            {/* Хлебные крошки */}
                            <nav className="flex text-sm text-slate-500 mb-8 font-medium">
                                <button onClick={() => navigate('/courses')} className="hover:text-slate-900 transition-colors">Курсы</button>
                                <span className="mx-3 text-slate-300">/</span>
                                <span className="text-slate-900 truncate max-w-[200px]">{course.title}</span>
                            </nav>

                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
                                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                                    {course.title}
                                </h1>
                                <span className="inline-flex shrink-0 items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900 text-white">
                                    Вы записаны
                                </span>
                            </div>

                            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed mb-10">
                                {course.description}
                            </div>
                            
                            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 flex items-start gap-4">
                                <div className="text-2xl mt-0.5">ℹ️</div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-1">Как проходить курс?</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Выберите урок из программы справа. Ваш прогресс сохраняется автоматически. Рекомендуем проходить уроки последовательно.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ПРАВАЯ ЧАСТЬ: САЙДБАР (ПРОГРАММА) */}
                <div className="w-full lg:w-[400px] order-1 lg:order-2 shrink-0">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                        
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-lg">Программа</h3>
                            <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-500">
                                {lessons.length} уроков
                            </span>
                        </div>
                        
                        <div className="overflow-y-auto p-3">
                            {lessons.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-sm">Программа формируется...</div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {lessons.map((lesson, index) => {
                                        const style = getLessonStyle(lesson.lesson_type);
                                        return (
                                            <button 
                                                key={lesson.id}
                                                onClick={() => navigate(`/lesson/${lesson.id}`)}
                                                className="group flex items-start text-left p-3 rounded-xl hover:bg-slate-50 transition-all duration-200 w-full"
                                            >
                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-sm mr-4 mt-0.5 group-hover:border-slate-300 transition-colors">
                                                    {style.icon}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Урок {index + 1}</span>
                                                        <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border ${style.bg}`}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-semibold text-sm text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">
                                                        {lesson.title}
                                                    </h4>
                                                </div>
                                                <div className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CourseDetail;