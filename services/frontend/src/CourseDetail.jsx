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
            {/* Основной контент */}
            <div className="flex-1 order-2 lg:order-1">
                <div className="card bg-base-100 shadow-sm border border-base-200">
                    <div className="card-body">
                        <div className="text-sm breadcrumbs mb-4">
                            <ul>
                                <li><button onClick={() => navigate('/courses')}>Курсы</button></li>
                                <li>{course.title}</li>
                            </ul>
                        </div>
                        <h1 className="card-title text-4xl mb-4 tracking-tight">{course.title}</h1>
                        <p className="text-lg text-base-content/70 mb-8">{course.description}</p>
                        
                        <div className="prose max-w-none bg-base-200/30 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-4">Описание курса</h3>
                            <p>Здесь можно вывести подробные материалы урока. DaisyUI поддерживает плагин Typography, который делает такие тексты очень читаемыми.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Боковая панель с уроками */}
            <div className="w-full lg:w-80 order-1 lg:order-2">
                <div className="card bg-base-100 shadow-md border border-base-200 sticky top-4">
                    <div className="card-body p-4">
                        <h3 className="font-bold text-lg mb-4 px-2">Уроки курса</h3>
                        <ul className="menu bg-base-200 w-full rounded-box gap-1 p-2">
                            {course.lessons?.map((lesson, index) => (
                                <li key={lesson.id}>
                                    <div className="flex justify-between items-center group active:bg-primary">
                                        <span className="flex gap-3 items-center">
                                            <span className="badge badge-sm badge-ghost">{index + 1}</span>
                                            <span className="font-medium">{lesson.title}</span>
                                        </span>
                                        <button 
                                            className="btn btn-xs btn-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => navigate(`/quiz/lesson/${lesson.id}`)}
                                        >
                                            Тест
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