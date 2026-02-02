import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';

function Profile() {
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]); 
    const [myCourses, setMyCourses] = useState([]); 
    const [categories, setCategories] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Состояния для Модального окна
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); 
    const [isCreating, setIsCreating] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Получаем данные о юзере
                const userRes = await api.get('users/me/');
                setUser(userRes.data);

                // 2. Получаем результаты тестов
                const resultsRes = await api.get('quizzes/my-results/'); 
                setResults(resultsRes.data);
                
                // 3. Получаем категории (для создания курсов)
                const catRes = await api.get('courses/categories/'); 
                setCategories(catRes.data);

                if (catRes.data.length > 0) {
                    setSelectedCategory(catRes.data[0].id);
                }

                // 4. ВАЖНО: Получаем ТОЛЬКО "Мои курсы"
                // (Студент получит подписки, Учитель — свои курсы)
                const coursesRes = await api.get('courses/my_courses/');
                setMyCourses(coursesRes.data);

            } catch (err) {
                console.error("Ошибка загрузки данных", err);
            } finally {
                setLoading(false);
            }
        };  

        fetchData();
    }, []);

    const handleCreateCourse = async () => {
        if (!newCourseTitle.trim()) return alert("Введите название курса!");
        if (!selectedCategory) return alert("Выберите категорию курса!");

        setIsCreating(true);
        try {
            const res = await api.post('courses/', {
                title: newCourseTitle,
                description: "Описание курса...",
                category: selectedCategory,
                price: 0
            });
            
            setIsModalOpen(false);
            setNewCourseTitle("");
            // Сразу перекидываем учителя в конструктор
            navigate(`/teacher/course/${res.data.id}/builder`);
        } catch (err) {
            console.error(err.response?.data);
            alert("Ошибка создания курса. Проверь консоль.");
        } finally {
            setIsCreating(false);
        }
    };
    
    // Подсчет статистики
    const totalTests = results.length;
    const averageScore = totalTests > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / totalTests) : 0;

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    if (loading) return <div className="text-center mt-20"><span className="loading loading-dots loading-lg text-primary"></span></div>;

    // Определяем роль для скрытия кнопок
    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
            
            {/* --- БЛОК ПРОФИЛЯ --- */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden mb-8 border border-base-200">
                <div className="h-32 bg-gradient-to-r from-primary to-secondary relative"></div>
                <div className="px-8 pb-8">
                    <div className="relative -mt-12 mb-6 flex justify-between items-end">
                        <div className="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                            <div className="bg-neutral text-neutral-content rounded-full w-24">
                                <span className="text-3xl uppercase font-bold">{user?.username?.[0]}</span>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-sm btn-outline btn-error">Выйти</button>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                {user?.username}
                                <span className="badge badge-ghost text-xs uppercase tracking-wide">
                                    {isTeacher ? 'Преподаватель' : 'Студент'}
                                </span>
                            </h1>
                            <p className="text-base-content/60">{user?.email}</p>
                            {user?.iin && <p className="text-xs text-base-content/40 font-mono mt-1">ИИН: {user.iin}</p>}
                        </div>

                        {/* Статистика */}
                        <div className="stats shadow bg-base-200/50 border border-base-200">
                            <div className="stat place-items-center px-6">
                                <div className="stat-title text-xs uppercase font-bold">Тестов</div>
                                <div className="stat-value text-2xl">{totalTests}</div>
                            </div>
                            <div className="stat place-items-center px-6">
                                <div className="stat-title text-xs uppercase font-bold">Ср. балл</div>
                                <div className={`stat-value text-2xl ${averageScore >= 80 ? 'text-success' : averageScore >= 50 ? 'text-warning' : 'text-error'}`}>
                                    {averageScore}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- БЛОК КУРСОВ --- */}
            <div className="mb-10">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {isTeacher ? '🎓 Созданные курсы' : '📚 Мои подписки'}
                    </h2>
                    
                    {/* КНОПКА ВИДНА ТОЛЬКО УЧИТЕЛЮ */}
                    {isTeacher && (
                        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm gap-2 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            Создать курс
                        </button>
                    )}
                </div>

                {myCourses.length > 0 ? (
                    <div className="grid gap-4">
                        {myCourses.map(course => (
                            <div key={course.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-all border border-base-200">
                                <div className="card-body flex-row items-center p-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{course.title}</h3>
                                        <span className="text-xs text-gray-400">ID: {course.id} • {course.category_title || 'Без категории'}</span>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Link to={`/courses/${course.id}`} className="btn btn-sm btn-ghost">
                                            {isTeacher ? 'Просмотр' : 'Учиться'}
                                        </Link>
                                        
                                        {/* КНОПКА КОНСТРУКТОРА ВИДНА ТОЛЬКО УЧИТЕЛЮ */}
                                        {isTeacher && (
                                            <Link to={`/teacher/course/${course.id}/builder`} className="btn btn-sm btn-secondary text-white">
                                                🛠 Конструктор
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed border-base-300 rounded-xl bg-base-100/50">
                        <p className="text-gray-500 mb-2">
                            {isTeacher ? 'Вы еще не создали курсов.' : 'Вы пока не записаны на курсы.'}
                        </p>
                        {!isTeacher && (
                            <Link to="/courses" className="btn btn-link btn-sm">Перейти в каталог →</Link>
                        )}
                    </div>
                )}
            </div>
            
            {/* --- ИСТОРИЯ ТЕСТОВ --- */}
             <h2 className="text-2xl font-bold mb-4">📜 История обучения</h2>
             {results.length === 0 ? (
                <div className="alert bg-base-100 border border-base-200"><span>Вы еще не проходили тесты.</span></div>
             ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-sm border border-base-200">
                    <table className="table w-full">
                        <thead>
                            <tr className="bg-base-200/50">
                                <th>Курс</th>
                                <th>Тест</th>
                                <th>Дата</th>
                                <th>Результат</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(r => (
                                <tr key={r.id} className="hover">
                                    <td className="font-bold text-sm">{r.course_title || 'N/A'}</td>
                                    <td className="text-sm">{r.quiz_title}</td>
                                    <td className="text-sm text-gray-500">{new Date(r.completed_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className={`badge ${r.score >= 80 ? 'badge-success text-white' : r.score >= 50 ? 'badge-warning' : 'badge-error text-white'}`}>
                                            {r.score}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}

            {/* --- МОДАЛЬНОЕ ОКНО (Только для учителей) --- */}
            {isModalOpen && isTeacher && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Создание нового курса</h3>
                        
                        <div className="form-control w-full mb-4">
                            <label className="label"><span className="label-text font-bold">Название курса</span></label>
                            <input 
                                type="text" 
                                placeholder="Например: Продвинутый Python" 
                                className="input input-bordered w-full" 
                                value={newCourseTitle}
                                onChange={(e) => setNewCourseTitle(e.target.value)}
                            />
                        </div>

                        <div className="form-control w-full mb-6">
                            <label className="label"><span className="label-text font-bold">Категория</span></label>
                            <select 
                                className="select select-bordered"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.length === 0 && <option disabled>Нет категорий</option>}
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.title}</option>
                                ))}
                            </select>
                        </div>

                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsModalOpen(false)} disabled={isCreating}>Отмена</button>
                            <button 
                                className={`btn btn-primary ${isCreating ? 'loading' : ''}`} 
                                onClick={handleCreateCourse}
                                disabled={isCreating || !selectedCategory || !newCourseTitle}
                            >
                                {isCreating ? 'Создаем...' : 'Создать'}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
                </dialog>
            )}
        </div>
    );
}

export default Profile;