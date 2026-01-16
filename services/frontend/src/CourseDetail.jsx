import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from './api';

function CourseDetail() {
    const { id } = useParams(); // Получаем ID курса из URL
    const [course, setCourse] = useState(null);

    useEffect(() => {
        api.get(`courses/${id}/`)
            .then(response => setCourse(response.data))
            .catch(error => console.error("Ошибка:", error));
    }, [id]);

    if (!course) return <p>Загрузка данных курса...</p>;

    return (
        <div>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
            <hr />
            <h3>📖 Уроки курса:</h3>
            {course.lessons && course.lessons.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {course.lessons.map(lesson => (
                        <li key={lesson.id} style={{ 
                            background: '#f4f4f4', 
                            margin: '10px 0', 
                            padding: '10px', 
                            borderRadius: '5px',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}>
                            <span>{lesson.title}</span>
                            {/* Ссылка на тест к этому уроку */}
                            <Link to={`/quiz/lesson/${lesson.id}`}>
                                <button style={{ cursor: 'pointer' }}>Пройти тест</button>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>В этом курсе пока нет уроков.</p>
            )}
            <br />
            <Link to="/courses">← Назад к списку</Link>
        </div>
    );
}

export default CourseDetail;