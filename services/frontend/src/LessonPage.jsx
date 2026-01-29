import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown'; // <-- Импортируем библиотеку
import api from './api';

function LessonPage() {
    const { lessonId } = useParams();
    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);
        api.get(`courses/lessons/${lessonId}/`) 
            .then(res => {
                setLesson(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError("Не удалось загрузить урок. Возможно, его не существует.");
                setLoading(false);
            });
    }, [lessonId]);

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    if (error || !lesson) return (
        <div className="max-w-md mx-auto mt-20 alert alert-warning shadow-lg">
            <span>{error || "Урок не найден"}</span>
            <button className="btn btn-sm" onClick={() => navigate(-1)}>Назад</button>
        </div>
    );

    const videoId = getYoutubeId(lesson.video_url);

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="text-sm breadcrumbs mb-6">
                <ul>
                    <li><button onClick={() => navigate('/courses')}>Курсы</button></li>
                    <li>{lesson.title}</li>
                </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ЛЕВАЯ КОЛОНКА */}
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

                    {/* БЛОК С ТЕОРИЕЙ (MARKDOWN) */}
                    <div className="prose prose-lg max-w-none bg-base-100 p-8 rounded-xl shadow-sm border border-base-200">
                        {/* ReactMarkdown превращает # Заголовок в <h1> и **жирный** в <b> */}
                        <ReactMarkdown>
                            {lesson.content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА */}
                <div className="lg:col-span-1">
                    <div className="card bg-base-100 shadow-xl border border-base-200 sticky top-10">
                        <div className="card-body">
                            <h3 className="card-title text-lg">Готовы к практике?</h3>
                            <p className="text-sm text-base-content/70 mb-4">
                                Закрепите материал тестом.
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