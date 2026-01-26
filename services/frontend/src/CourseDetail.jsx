import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';

function CourseDetail() {
    const { id } = useParams();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get(`courses/${id}/`)
            .then(response => {
                setCourse(response.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Ошибка загрузки курса", err);
                setLoading(false);
            });
    }, [id]);

    if (loading) return (
        <div className="flex justify-center mt-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );
    
    if (!course) return <div className="alert alert-error">Курс не найден</div>;

    return (
        <div className="flex flex-col lg:flex-row gap-8">
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

                        <h1 className="card-title text-4xl mb-4 tracking-tight">{course.title}</h1>
                        <p className="text-lg text-base-content/70 mb-8">{course.description}</p>
                        
                        <div className="alert alert-info bg-base-200/50 border-none">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Выберите урок из списка справа, чтобы начать обучение.</span>
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
                        <ul className="menu bg-base-200 w-full rounded-box gap-2 p-2">
                            {course.lessons?.map((lesson, index) => (
                                <li key={lesson.id}>
                                    <div 
                                        className="flex justify-between items-center py-3 hover:bg-base-300 transition-colors"
                                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                                    >
                                        <div className="flex gap-3 items-center">
                                            <span className="badge badge-primary badge-outline font-mono">{index + 1}</span>
                                            <span className="font-medium text-sm sm:text-base">{lesson.title}</span>
                                        </div>
                                        
                                        <button className="btn btn-circle btn-ghost btn-xs">
                                            {/* SVG иконка Play */}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                            </svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CourseDetail;