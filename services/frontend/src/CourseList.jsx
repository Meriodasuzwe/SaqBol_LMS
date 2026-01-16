import { useEffect, useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function CourseList() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Загружаем курсы при открытии страницы
        api.get('courses/')
            .then(response => {
                setCourses(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Ошибка загрузки курсов:", error);
                setLoading(false);
            });
    }, []);

    if (loading) return <p>Загрузка курсов...</p>;

    return (
        <div style={{ marginTop: '20px' }}>
            <h2>📚 Доступные курсы</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {courses.map(course => (
                    <div key={course.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                        <h3>{course.title}</h3>
                        <p>{course.description}</p>
                        <button onClick={() => navigate(`/courses/${course.id}`)}>Открыть</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CourseList;