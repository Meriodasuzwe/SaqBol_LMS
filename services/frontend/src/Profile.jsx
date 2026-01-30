import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';

function Profile() {
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]); 
    const [myCourses, setMyCourses] = useState([]); 
    const [categories, setCategories] = useState([]); // <-- Храним список категорий
    const [loading, setLoading] = useState(true);
    
    // Состояния для Модального окна
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); // <-- Выбранная категория
    const [isCreating, setIsCreating] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        // Внутри Profile.jsx найди функцию fetchData
    const fetchData = async () => {
        try {
            const userRes = await api.get('users/me/');
            setUser(userRes.data);

            const resultsRes = await api.get('quizzes/my-results/'); 
            setResults(resultsRes.data);
            
            // --- ИСПРАВЛЕННЫЙ ПУТЬ ТУТ ---
            const catRes = await api.get('courses/categories/'); // Добавили courses/
            console.log("Категории получены:", catRes.data); // Добавь лог, чтобы видеть данные в F12
            setCategories(catRes.data);

            if (catRes.data.length > 0) {
                setSelectedCategory(catRes.data[0].id);
            }

            // Загрузка курсов
            const coursesRes = await api.get('courses/');
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
                category: selectedCategory, // Убрали _id, теперь совпадает с сериализатором
                price: 0
            });
            
            setIsModalOpen(false);
            setNewCourseTitle("");
            navigate(`/teacher/course/${res.data.id}/builder`);
        } catch (err) {
            console.error(err.response?.data); // Выводим точную ошибку от сервера в консоль
            alert("Ошибка создания курса. Проверь консоль браузера.");
        } finally {
            setIsCreating(false);
        }
    };
    
    // ... (Код вычисления статистики results/averageScore без изменений) ...
    const totalTests = results.length;
    const averageScore = totalTests > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / totalTests) : 0;
    const getScoreColor = (score) => { if (score >= 80) return 'text-success'; if (score >= 50) return 'text-warning'; return 'text-error'; };

    if (loading) return <div className="text-center mt-20"><span className="loading loading-dots loading-lg text-primary"></span></div>;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            
            {/* ... (Блок Профиля без изменений) ... */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden mb-8 border border-base-200">
                <div className="h-32 bg-gradient-to-r from-primary to-accent relative"></div>
                <div className="px-8 pb-8">
                    <div className="relative -mt-12 mb-6 flex justify-between items-end">
                        <div className="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                            <div className="bg-neutral text-neutral-content rounded-full w-24">
                                <span className="text-3xl uppercase font-bold">{user?.username?.[0]}</span>
                            </div>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold">{user?.username}</h1>
                    <p className="text-base-content/60 mb-6">{user?.email}</p>
                    {/* Статистика */}
                     <div className="stats shadow w-full bg-base-200/50 border border-base-200">
                        <div className="stat">
                            <div className="stat-title">Тестов сдано</div>
                            <div className="stat-value">{totalTests}</div>
                        </div>
                        <div className="stat">
                            <div className="stat-title">Средний балл</div>
                            <div className="stat-value text-primary">{averageScore}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ЗОНА УЧИТЕЛЯ */}
            <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">🎓 Мои Курсы</h2>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">+ Создать курс</button>
                </div>

                {myCourses.length > 0 ? (
                    <div className="grid gap-3">
                        {myCourses.map(course => (
                            <div key={course.id} className="alert bg-base-100 shadow-sm border border-base-200 flex justify-between">
                                <div>
                                    <h3 className="font-bold">{course.title}</h3>
                                    <span className="text-xs text-gray-500">ID: {course.id}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Link to={`/courses/${course.id}`} className="btn btn-sm btn-ghost">Просмотр</Link>
                                    <Link to={`/teacher/course/${course.id}/builder`} className="btn btn-sm btn-secondary text-white">🛠 Конструктор</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed border-base-300 rounded-xl text-gray-400">Нет курсов.</div>
                )}
            </div>
            
            {/* История (код таблицы без изменений, сокращаю для удобства копирования) */}
             <h2 className="text-2xl font-bold mb-4">📜 История обучения</h2>
             {results.length === 0 ? <div className="alert"><span>Пусто.</span></div> : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-sm border border-base-200">
                    <table className="table table-zebra w-full">
                         {/* ... table content ... */}
                         <tbody>{results.map(r => <tr key={r.id}><td>{r.course_title}</td><td>{new Date(r.completed_at).toLocaleDateString()}</td><td>{r.score}%</td></tr>)}</tbody>
                    </table>
                </div>
             )}

            {/* --- МОДАЛЬНОЕ ОКНО (ОБНОВЛЕННОЕ) --- */}
            {isModalOpen && (
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

                        {/* ВЫБОР КАТЕГОРИИ */}
                        <div className="form-control w-full mb-6">
                            <label className="label"><span className="label-text font-bold">Категория</span></label>
                            <select 
                                className="select select-bordered"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.length === 0 && <option disabled>Нет категорий (создайте в админке)</option>}
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
                                disabled={isCreating || !selectedCategory}
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