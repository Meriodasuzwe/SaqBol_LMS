import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function LessonPage() {
    const { lessonId } = useParams();
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true); // Добавили состояние загрузки
    const [error, setError] = useState(null);     // Добавили состояние ошибки
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        // Загружаем данные урока
        api.get(`courses/lessons/${lessonId}/`) 
            .then(res => {
                setLesson(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Не удалось загрузить урок. Возможно, его не существует или ошибка соединения.");
                setLoading(false);
            });
    }, [lessonId]);

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // 1. Показываем спиннер только пока loading === true
    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    // 2. Если ошибка - показываем её
    if (error || !lesson) return (
        <div className="max-w-md mx-auto mt-20 alert alert-warning shadow-lg">
            <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{error || "Урок не найден"}</span>
            </div>
            <button className="btn btn-sm" onClick={() => navigate(-1)}>Назад</button>
        </div>
    );

    const videoId = getYoutubeId(lesson.video_url);

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="text-sm breadcrumbs mb-6">
                <ul>
                    <li><a onClick={() => navigate('/courses')}>Курсы</a></li>
                    <li>{lesson.title}</li>
                </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-4">{lesson.title}</h1>
                        <div className="flex items-center gap-2 text-base-content/60">
                            <span className="font-bold text-primary">📖 Теория</span>
                        </div>
                    </div>

                    {videoId && (
                        <div className="rounded-xl overflow-hidden shadow-lg border border-base-200">
                            <iframe 
                                width="100%" 
                                height="400" 
                                src={`https://www.youtube.com/embed/${videoId}`} 
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                        </div>
                    )}

                    <div className="prose prose-lg max-w-none bg-base-100 p-6 rounded-xl shadow-sm border border-base-100">
                        <p className="whitespace-pre-line">{lesson.content}</p>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="card bg-base-100 shadow-xl border border-base-200 sticky top-10">
                        <div className="card-body">
                            <h3 className="card-title text-lg">Готовы к практике?</h3>
                            <p className="text-sm text-base-content/70 mb-4">
                                Пройдите тест, чтобы закрепить материал.
                            </p>
                            
                            <button 
                                className="btn btn-primary w-full"
                                onClick={() => navigate(`/quiz/lesson/${lesson.id}`)}
                            >
                                ▶ Пройти тест
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LessonPage;