import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function CourseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- СОСТОЯНИЯ ---
    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); 
    const [isEnrolled, setIsEnrolled] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); 

    // --- ЗАГРУЗКА ДАННЫХ ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Грузим инфо о курсе
                const courseRes = await api.get(`courses/${id}/`);
                setCourse(courseRes.data);

                // 2. Пытаемся загрузить уроки
                try {
                    const lessonsRes = await api.get(`courses/${id}/lessons/`);
                    // Сортировка уроков по ID (или order)
                    const sortedLessons = lessonsRes.data.sort((a, b) => a.id - b.id);
                    setLessons(sortedLessons);
                    setIsEnrolled(true); 
                } catch (error) {
                    if (error.response && error.response.status === 403) {
                        setIsEnrolled(false);
                    }
                }
            } catch (err) {
                console.error("Ошибка загрузки курса", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    // --- ХЕЛПЕР: ОПРЕДЕЛЕНИЕ ТИПА УРОКА ---
    const getLessonStyle = (type) => {
        switch (type) {
            case 'simulation_chat':
                return { 
                    icon: '💬', 
                    label: 'Чат-квест', 
                    color: 'text-success', 
                    badge: 'badge-success' 
                };
            case 'simulation_email':
                return { 
                    icon: '📧', 
                    label: 'Фишинг', 
                    color: 'text-warning', 
                    badge: 'badge-warning' 
                };
            default: // text
                return { 
                    icon: '📄', 
                    label: 'Лекция', 
                    color: 'text-base-content', 
                    badge: 'badge-ghost' 
                };
        }
    };

    // --- ФУНКЦИЯ ЗАПИСИ ---
    const handleEnroll = async () => {
        setEnrollLoading(true);
        try {
            await api.post(`courses/${id}/enroll/`);
            window.location.reload(); 
        } catch (err) {
            alert("Не удалось записаться на курс");
            setEnrollLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );
    
    if (!course) return <div className="alert alert-error mt-10">Курс не найден</div>;

    // ============================================================
    // ВАРИАНТ 1: ЛЕНДИНГ (Если НЕ записан)
    // ============================================================
    if (!isEnrolled) {
        return (
            <div className="min-h-screen bg-base-100">
                {/* Hero секция */}
                <div className="hero py-20 bg-base-200">
                    <div className="hero-content flex-col lg:flex-row-reverse gap-12 max-w-5xl">
                        
                        {/* Карточка записи */}
                        <div className="card flex-shrink-0 w-full max-w-sm shadow-2xl bg-base-100 border border-base-200">
                            <div className="card-body">
                                <div className="badge badge-secondary mb-2">Открытый курс</div>
                                <h2 className="text-3xl font-bold text-primary mb-2">Бесплатно</h2>
                                <button 
                                    onClick={handleEnroll} 
                                    className={`btn btn-primary btn-lg w-full ${enrollLoading ? 'loading' : ''}`}
                                >
                                    {enrollLoading ? 'Записываем...' : 'Начать обучение 🚀'}
                                </button>
                                <p className="text-xs text-center text-gray-500 mt-4">
                                    Мгновенный доступ ко всем материалам
                                </p>
                                <div className="divider"></div>
                                <ul className="space-y-3 text-sm text-gray-600">
                                    <li className="flex items-center gap-2">✅ <strong>Теория:</strong> Видео и конспекты</li>
                                    <li className="flex items-center gap-2">✅ <strong>Практика:</strong> Симуляции атак</li>
                                    <li className="flex items-center gap-2">✅ <strong>Сертификат:</strong> При завершении</li>
                                </ul>
                            </div>
                        </div>

                        {/* Описание курса */}
                        <div className="text-center lg:text-left">
                            <h1 className="text-5xl font-black leading-tight mb-6">{course.title}</h1>
                            <p className="py-2 text-lg text-gray-600 leading-relaxed mb-8">
                                {course.description || "Описание курса пока отсутствует, но мы уверены, что материал будет полезен!"}
                            </p>
                            
                            {/* Блок автора */}
                            <div className="flex items-center justify-center lg:justify-start gap-4 p-4 bg-base-100 rounded-xl shadow-sm w-fit border border-base-200">
                                <div className="avatar placeholder">
                                    <div className="bg-neutral text-neutral-content rounded-full w-12">
                                        <span className="text-xl">{course.teacher_name?.[0]?.toUpperCase() || "T"}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Автор курса</p>
                                    <p className="text-md">{course.teacher_name || "Преподаватель"}</p>
                                </div>
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
        <div className="flex flex-col lg:flex-row gap-8 p-6 max-w-7xl mx-auto animate-fade-in">
            {/* ЛЕВАЯ ЧАСТЬ: Информация о курсе */}
            <div className="flex-1 order-2 lg:order-1">
                <div className="card bg-base-100 shadow-sm border border-base-200 h-full">
                    <div className="card-body">
                        {/* Хлебные крошки */}
                        <div className="text-sm breadcrumbs mb-4">
                            <ul>
                                <li><button onClick={() => navigate('/courses')}>Курсы</button></li>
                                <li>{course.title}</li>
                            </ul>
                        </div>

                        <div className="flex justify-between items-start mb-6">
                            <h1 className="card-title text-4xl tracking-tight">{course.title}</h1>
                            <div className="badge badge-success text-white p-3 font-bold">Вы студент</div>
                        </div>

                        <p className="text-lg text-base-content/70 mb-8 leading-relaxed">
                            {course.description}
                        </p>
                        
                        <div className="alert alert-info bg-blue-50 border-blue-100">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6 text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span className="text-blue-900">Выберите урок из списка справа, чтобы продолжить обучение.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: Программа курса (Sidebar) */}
            <div className="w-full lg:w-96 order-1 lg:order-2 shrink-0">
                <div className="card bg-base-100 shadow-md border border-base-200 sticky top-24 max-h-[85vh] flex flex-col">
                    <div className="p-4 border-b border-base-200 bg-base-50 rounded-t-2xl">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                             📚 Программа курса
                             <span className="badge badge-sm badge-outline">{lessons.length} уроков</span>
                        </h3>
                    </div>
                    
                    <div className="overflow-y-auto p-2">
                        <ul className="flex flex-col gap-2">
                            {lessons.map((lesson, index) => {
                                const style = getLessonStyle(lesson.lesson_type);
                                
                                return (
                                    <li key={lesson.id}>
                                        <div 
                                            className="group flex items-center p-3 rounded-xl hover:bg-base-200 transition-all cursor-pointer border border-transparent hover:border-base-300"
                                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                                        >
                                            {/* Иконка типа */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-base-100 border border-base-200 shadow-sm mr-3 text-xl group-hover:scale-110 transition-transform`}>
                                                {style.icon}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
                                                    <span className={`badge badge-xs ${style.badge} uppercase font-bold text-[10px]`}>
                                                        {style.label}
                                                    </span>
                                                </div>
                                                <h4 className="font-semibold text-sm truncate text-gray-700 group-hover:text-primary transition-colors">
                                                    {lesson.title}
                                                </h4>
                                            </div>

                                            <div className="text-gray-300 group-hover:text-primary">
                                                ➔
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}

                            {lessons.length === 0 && (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    Уроков пока нет
                                </div>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CourseDetail;