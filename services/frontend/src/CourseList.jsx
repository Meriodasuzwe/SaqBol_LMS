import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';

function CourseList() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]); 
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");

    useEffect(() => {
        api.get('courses/categories/')
            .then(res => setCategories(res.data))
            .catch(err => console.error("Ошибка загрузки категорий", err));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (selectedCategory) params.append('category', selectedCategory);

        api.get(`courses/?${params.toString()}`)
            .then(response => {
                setCourses(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Ошибка загрузки курсов:", error);
                setLoading(false);
            });
    }, [searchTerm, selectedCategory]);

    return (
        <div className="container mx-auto py-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    📚 Каталог курсов
                </h1>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="🔍 Найти курс..." 
                        className="input input-bordered w-full sm:w-64 focus:input-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select 
                        className="select select-bordered w-full sm:w-48 focus:select-primary"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">Все категории</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center mt-20">
                    <span className="loading loading-dots loading-lg text-primary"></span>
                </div>
            ) : (
                <>
                    {courses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map(course => (
                                <Link 
                                    to={`/courses/${course.id}`} 
                                    key={course.id} 
                                    className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 border border-base-200 group"
                                >
                                    <figure className="h-48 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center relative overflow-hidden">
                                        <span className="text-6xl group-hover:scale-110 transition-transform duration-300">🎓</span>
                                        <div className="absolute top-4 right-4 badge badge-primary badge-outline bg-base-100">
                                            {course.category_title || 'Курс'}
                                        </div>
                                    </figure>
                                    
                                    <div className="card-body">
                                        <h2 className="card-title text-xl font-bold group-hover:text-primary transition-colors">
                                            {course.title}
                                        </h2>
                                        <p className="text-sm text-gray-500 line-clamp-2">
                                            {course.description || "Описание отсутствует..."}
                                        </p>
                                        
                                        {/* 👇 ВОТ ЭТОТ БЛОК ТЫ ПРОПУСТИЛ 👇 */}
                                        {course.progress > 0 && (
                                            <div className="mt-4 mb-2">
                                                <div className="flex justify-between text-xs mb-1 font-semibold">
                                                    <span className="text-success">Ваш прогресс</span>
                                                    <span>{course.progress}%</span>
                                                </div>
                                                <progress 
                                                    className="progress progress-success w-full h-2" 
                                                    value={course.progress} 
                                                    max="100"
                                                ></progress>
                                            </div>
                                        )}
                                        {/* 👆👆👆 */}

                                        <div className="card-actions justify-between items-center mt-4">
                                            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                                                <div className="avatar placeholder">
                                                    <div className="bg-neutral-focus text-neutral-content rounded-full w-6">
                                                        <span>{course.teacher_name?.[0] || 'T'}</span>
                                                    </div>
                                                </div>
                                                {course.teacher_name}
                                            </div>
                                            <button className={`btn btn-sm ${course.progress > 0 ? 'btn-success text-white' : 'btn-primary'}`}>
                                                {course.progress > 0 ? 'Продолжить' : 'Открыть'}
                                            </button>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <h3 className="text-2xl font-bold text-gray-400">Ничего не найдено 😔</h3>
                            <p className="text-gray-500">Попробуйте изменить параметры поиска.</p>
                            <button 
                                className="btn btn-link mt-2"
                                onClick={() => { setSearchTerm(""); setSelectedCategory(""); }}
                            >
                                Сбросить фильтры
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default CourseList;