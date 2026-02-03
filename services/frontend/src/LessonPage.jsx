import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from './api';
import FakeMessenger from './FakeMessenger';
import FakeEmail from './FakeEmail'; // Импорт компонента Email

function LessonPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    
    const [lesson, setLesson] = useState(null);
    const [courseLessons, setCourseLessons] = useState([]);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);

    // Функция для видео (YouTube)
    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes("embed")) return url;
        let videoId = "";
        if (url.includes("youtu.be")) {
            videoId = url.split("/").pop();
        } else if (url.includes("v=")) {
            videoId = url.split("v=")[1].split("&")[0];
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };

    useEffect(() => {
        const fetchLessonData = async () => {
            setLoading(true);
            try {
                // 1. Грузим сам урок
                const lessonRes = await api.get(`courses/lessons/${lessonId}/`);
                setLesson(lessonRes.data);

                // 2. Грузим список всех уроков курса для навигации
                const allLessonsRes = await api.get(`courses/${lessonRes.data.course}/lessons/`);
                setCourseLessons(allLessonsRes.data);

                // 3. Грузим инфо о курсе (для прогресс-бара)
                const courseRes = await api.get(`courses/${lessonRes.data.course}/`);
                setCourse(courseRes.data);

            } catch (err) {
                console.error("Ошибка загрузки урока", err);
            } finally {
                setLoading(false);
            }
        };

        if (lessonId) fetchLessonData();
    }, [lessonId]);

    // Функция завершения: принимает очки (score)
    const handleComplete = async (score = 10) => {
        try {
            // Отправляем на сервер ID урока и заработанные очки
            await api.post(`courses/lessons/${lessonId}/complete/`, { score });
            
            // Логика перехода
            if (nextLesson) {
                navigate(`/lesson/${nextLesson.id}`);
            } else {
                alert("Поздравляем! Вы успешно завершили курс! 🎉");
                navigate(`/courses/${lesson?.course}`);
            }
        } catch (err) {
            console.error("Ошибка завершения урока", err);
        }
    };

    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    if (!lesson) return <div className="alert alert-error mt-10">Урок не найден</div>;

    // Вычисляем соседей
    const currentIndex = courseLessons.findIndex(l => l.id === lesson.id);
    const prevLesson = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;

    const embedUrl = getYoutubeEmbedUrl(lesson.video_url);

    // Определяем, является ли урок ЛЮБОЙ симуляцией (чтобы скрыть лишние кнопки)
    const isSimulation = ['simulation_chat', 'simulation_email'].includes(lesson.lesson_type);

    return (
        <div className="min-h-screen bg-base-200 py-8 animate-fade-in">
            <div className="container mx-auto max-w-4xl px-4">
                
                {/* --- ХЛЕБНЫЕ КРОШКИ --- */}
                <div className="text-sm breadcrumbs mb-4">
                    <ul>
                        <li><Link to="/courses">Курсы</Link></li>
                        <li><Link to={`/courses/${lesson.course}`}>{course?.title || 'Курс'}</Link></li>
                        <li className="font-bold text-primary">Урок {currentIndex + 1}</li>
                    </ul>
                </div>

                {/* --- ПРОГРЕСС БАР КУРСА --- */}
                {course && course.progress !== undefined && (
                    <div className="mb-6 px-1">
                        <div className="flex justify-between text-sm mb-1 font-semibold">
                             <span>Прогресс курса</span>
                             <span className="text-success">{course.progress}%</span>
                        </div>
                        <progress className="progress progress-success w-full h-2" value={course.progress} max="100"></progress>
                    </div>
                )}

                {/* --- ГЛАВНАЯ КАРТОЧКА --- */}
                <div className="card bg-base-100 shadow-xl overflow-hidden border border-base-300">
                    
                    {/* ЗАГОЛОВОК УРОКА */}
                    <div className="card-body pb-4 border-b border-base-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                                    {isSimulation && <span>🎮</span>} 
                                    {lesson.title}
                                </h1>
                                <p className="text-sm text-gray-500 uppercase tracking-wide">
                                    {isSimulation ? "Интерактивная тренировка" : `Урок ${currentIndex + 1} из ${courseLessons.length}`}
                                </p>
                            </div>
                            {/* Скрываем кнопку теста для симуляций */}
                            {!isSimulation && (
                                <Link to={`/quiz/lesson/${lesson.id}`} className="btn btn-primary btn-sm gap-2">
                                    Тест к уроку
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* === ЛОГИКА ОТОБРАЖЕНИЯ КОНТЕНТА === */}
                    
                    {/* 1. СИМУЛЯТОР ЧАТА */}
                    {lesson.lesson_type === 'simulation_chat' ? (
                        <div className="bg-base-200 py-8 flex flex-col items-center justify-center">
                            <div className="text-center mb-6 max-w-lg px-4">
                                <p className="text-gray-600">
                                    Пройдите диалог до конца, выбирая правильные ответы.
                                </p>
                            </div>
                            <FakeMessenger 
                                scenario={lesson.scenario_data} 
                                onComplete={(score) => handleComplete(score)} 
                            />
                        </div>

                    /* 2. СИМУЛЯТОР EMAIL (НОВОЕ!) */
                    ) : lesson.lesson_type === 'simulation_email' ? (
                        <div className="bg-base-200 py-8 px-4 flex flex-col items-center justify-center">
                             <div className="text-center mb-4 text-gray-600">
                                Внимательно изучите письмо. Если заметите признаки мошенничества — жмите "Это фишинг".
                            </div>
                            <FakeEmail
                                scenario={lesson.scenario_data}
                                onComplete={(score) => handleComplete(score)}
                            />
                        </div>

                    /* 3. ОБЫЧНЫЙ УРОК (Видео + Текст) */
                    ) : (
                        <>
                            {embedUrl ? (
                                <div className="w-full bg-black aspect-video relative group">
                                    <iframe 
                                        src={embedUrl} 
                                        title={lesson.title}
                                        className="w-full h-full absolute top-0 left-0"
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <div className="w-full h-48 bg-base-200 flex items-center justify-center text-gray-400 border-b border-base-200">
                                    <span>📹 Видео отсутствует</span>
                                </div>
                            )}

                            <div className="card-body">
                                <div className="prose max-w-none prose-lg prose-headings:text-primary prose-a:text-blue-600">
                                    {lesson.content ? (
                                        <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
                                    ) : (
                                        <p className="text-gray-500 italic">Текстовое описание отсутствует.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* --- ПОДВАЛ (КНОПКИ НАВИГАЦИИ) --- */}
                    <div className="card-body border-t border-base-200 bg-base-50">
                        <div className="flex justify-between items-center">
                            {/* Кнопка НАЗАД */}
                            {prevLesson ? (
                                <button 
                                    onClick={() => navigate(`/lesson/${prevLesson.id}`)}
                                    className="btn btn-ghost gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                                    <div className="hidden sm:block">
                                        <div className="text-xs text-left text-gray-400 font-normal">Предыдущий</div>
                                        <div className="text-sm font-bold max-w-[150px] truncate">{prevLesson.title}</div>
                                    </div>
                                </button>
                            ) : (
                                <div className="w-24"></div>
                            )}

                            {/* Кнопка ВПЕРЕД / ЗАВЕРШИТЬ */}
                            {/* Скрываем её для ЛЮБОЙ симуляции, чтобы пользователь не пропустил игру. */}
                            {!isSimulation && (
                                <button 
                                    onClick={() => handleComplete(10)}
                                    className="btn btn-primary gap-2"
                                >
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs text-primary-content/70 font-normal">
                                            {nextLesson ? 'Завершить и далее' : 'Завершить курс'}
                                        </div>
                                        <div className="text-sm font-bold max-w-[150px] truncate">
                                            {nextLesson ? nextLesson.title : 'Финиш 🏁'}
                                        </div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LessonPage;