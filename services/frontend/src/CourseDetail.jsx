import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from './api';

function CourseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    // --- СОСТОЯНИЯ ---
    const [course, setCourse] = useState(null);
    const [lessons, setLessons] = useState([]); // Храним уроки отдельно
    const [isEnrolled, setIsEnrolled] = useState(false); // Главный переключатель
    const [loading, setLoading] = useState(true);
    const [enrollLoading, setEnrollLoading] = useState(false); // Анимация кнопки записи

    // --- ЗАГРУЗКА ДАННЫХ ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Грузим инфо о курсе (доступно всем)
                const courseRes = await api.get(`courses/${id}/`);
                setCourse(courseRes.data);

                // 2. Пытаемся загрузить уроки (доступно только записанным)
                try {
                    const lessonsRes = await api.get(`courses/${id}/lessons/`);
                    setLessons(lessonsRes.data);
                    setIsEnrolled(true); // Успех! Мы записаны
                } catch (error) {
                    // Если ошибка 403, значит сервер не пустил к урокам -> мы не записаны
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

    // --- ФУНКЦИЯ ЗАПИСИ ---
    const handleEnroll = async () => {
        setEnrollLoading(true);
        try {
            await api.post(`courses/${id}/enroll/`);
            // После записи перезагружаем страницу, чтобы подтянулись права и уроки
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
            <div className="hero min-h-[70vh] bg-base-100">
                <div className="hero-content flex-col lg:flex-row-reverse gap-12">
                    {/* Карточка с ценой и кнопкой */}
                    <div className="card flex-shrink-0 w-full max-w-sm shadow-2xl bg-base-100 border border-base-200">
                        <div className="card-body">
                            <h2 className="text-3xl font-bold text-primary mb-2">Бесплатно</h2>
                            <button 
                                onClick={handleEnroll} 
                                className={`btn btn-primary btn-lg w-full ${enrollLoading ? 'loading' : ''}`}
                            >
                                {enrollLoading ? 'Записываем...' : 'Записаться на курс'}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-4">
                                Нажимая кнопку, вы получаете полный доступ к материалам курса.
                            </p>
                            <div className="divider"></div>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li className="flex items-center gap-2">✅ Доступ к видеоурокам</li>
                                <li className="flex items-center gap-2">✅ Практические тесты</li>
                                <li className="flex items-center gap-2">✅ Личный прогресс</li>
                            </ul>
                        </div>
                    </div>

                    {/* Описание курса */}
                    <div className="text-center lg:text-left max-w-2xl">
                        <div className="badge badge-secondary mb-4 p-3">{course.category_title || "Курс"}</div>
                        <h1 className="text-5xl font-bold leading-tight mb-6">{course.title}</h1>
                        <p className="py-2 text-lg text-gray-600 leading-relaxed">
                            {course.description || "Автор пока не добавил описание, но курс обещает быть интересным!"}
                        </p>
                        
                        <div className="mt-8 flex items-center justify-center lg:justify-start gap-4">
                            <div className="avatar placeholder">
                                <div className="bg-neutral text-neutral-content rounded-full w-12">
                                    <span className="text-xl">{course.teacher_name?.[0]?.toUpperCase() || "T"}</span>
                                </div>
                            </div>
                            <div>
                                <p className="font-bold text-lg">{course.teacher_name || "Преподаватель"}</p>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Автор курса</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // ВАРИАНТ 2: ПЛЕЕР УРОКОВ (Если ЗАПИСАН) - Твой код
    // ============================================================
    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
            {/* ЛЕВАЯ ЧАСТЬ: Информация о курсе */}
            <div className="flex-1 order-2 lg:order-1">
                <div className="card bg-base-100 shadow-sm border border-base-200">
                    <div className="card-body">
                        {/* Хлебные крошки */}
                        <div className="text-sm breadcrumbs mb-4">
                            <ul>
                                <li><button onClick={() => navigate('/courses')}>Курсы</button></li>
                                <li>{course.title}</li>
                            </ul>
                        </div>

                        <div className="flex justify-between items-start">
                            <h1 className="card-title text-4xl mb-4 tracking-tight">{course.title}</h1>
                            <div className="badge badge-success text-white p-3 font-bold">Вы студент курса</div>
                        </div>

                        <p className="text-lg text-base-content/70 mb-8">{course.description}</p>
                        
                        <div className="alert alert-info bg-base-200/50 border-none">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Выберите урок из списка справа, чтобы продолжить обучение.</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: Список уроков (Sidebar) */}
            <div className="w-full lg:w-96 order-1 lg:order-2">
                <div className="card bg-base-100 shadow-md border border-base-200 sticky top-24">
                    <div className="card-body p-4">
                        <h3 className="font-bold text-lg mb-4 px-2 flex items-center gap-2">
                             📚 Программа курса
                        </h3>
                        <ul className="menu bg-base-200 w-full rounded-box gap-2 p-2 max-h-[70vh] overflow-y-auto">
                            {lessons.map((lesson, index) => (
                                <li key={lesson.id}>
                                    <div 
                                        className="flex justify-between items-center py-3 hover:bg-base-300 transition-colors"
                                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                                    >
                                        <div className="flex gap-3 items-center">
                                            <span className="badge badge-primary badge-outline font-mono">{index + 1}</span>
                                            <span className="font-medium text-sm sm:text-base truncate max-w-[150px]">{lesson.title}</span>
                                        </div>
                                        
                                        <button className="btn btn-circle btn-ghost btn-xs">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                            </svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {lessons.length === 0 && (
                                <div className="text-center py-4 text-gray-400 text-sm">
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