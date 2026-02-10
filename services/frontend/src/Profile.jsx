import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';

function Profile() {
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]); 
    const [myCourses, setMyCourses] = useState([]); 
    const [categories, setCategories] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Редактирование
    const [editData, setEditData] = useState({ first_name: '', last_name: '', age: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);

    // Модалка
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); 
    const [isCreating, setIsCreating] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userRes = await api.get('users/me/');
                setUser(userRes.data);
                setEditData({
                    first_name: userRes.data.first_name || '',
                    last_name: userRes.data.last_name || '',
                    age: userRes.data.age || '',
                });

                const resultsRes = await api.get('quizzes/my-results/'); 
                setResults(resultsRes.data);
                
                const catRes = await api.get('courses/categories/'); 
                setCategories(catRes.data);
                if (catRes.data.length > 0) setSelectedCategory(catRes.data[0].id);

                const coursesRes = await api.get('courses/my_courses/');
                setMyCourses(coursesRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };  
        fetchData();
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    // 🔥 ВАЖНО: Функция для починки URL аватарки после перезагрузки
    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        // Добавляем адрес бэкенда, если ссылка относительная
        return `http://localhost:8000${path}`;
    };

    const handleSaveProfile = async () => {
    setSaving(true);
    try {
        const formData = new FormData();
        formData.append('first_name', editData.first_name);
        formData.append('last_name', editData.last_name);
        formData.append('age', editData.age);
        if (selectedFile) formData.append('avatar', selectedFile);

        // УДАЛИЛИ ручную установку заголовка — axios сам добавит нужный Content-Type с boundary
        const res = await api.patch('users/me/', formData);

        setUser(res.data);
        alert("✅ Профиль обновлен!");
    } catch (err) {
        console.error(err);
        alert("Ошибка сохранения (проверьте консоль)");
    } finally {
        setSaving(false);
    }
};

    const handleCreateCourse = async () => {
        setIsCreating(true);
        try {
            const res = await api.post('courses/', {
                title: newCourseTitle,
                description: "Описание...",
                category: selectedCategory,
                price: 0
            });
            setIsModalOpen(false);
            navigate(`/teacher/course/${res.data.id}/builder`);
        } catch (err) {
            alert("Ошибка создания");
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const totalTests = results.length;
    const averageScore = totalTests > 0 ? Math.round(results.reduce((acc, c) => acc + c.score, 0) / totalTests) : 0;

    if (loading) return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in">
            
            {/* === БЛОК ПРОФИЛЯ === */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden mb-10 border border-base-200">
                {/* Цветной фон сверху */}
                <div className="h-40 bg-gradient-to-r from-blue-600 to-violet-600"></div>
                
                <div className="px-8 pb-8">
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        
                        {/* --- ЛЕВАЯ ЧАСТЬ: АВАТАР (ИСПРАВЛЕНО) --- */}
                        <div className="-mt-16 flex flex-col items-center shrink-0 z-10">
                            
                            {/* Контейнер аватара: Чистый Tailwind без DaisyUI конфликтов */}
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full ring-4 ring-base-100 ring-offset-2 shadow-2xl bg-neutral text-neutral-content overflow-hidden flex items-center justify-center shrink-0">
                                    {preview || user?.avatar ? (
                                        <img 
                                            // Используем getAvatarUrl чтобы ссылка всегда была правильной
                                            src={preview || getAvatarUrl(user?.avatar)} 
                                            alt="avatar" 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        // Центрируем букву с помощью flex и items-center
                                        <span className="text-5xl font-bold uppercase select-none">
                                            {user?.username?.[0] || 'U'}
                                        </span>
                                    )}
                                </div>

                                {/* Кнопка смены фото (появляется поверх аватара) */}
                                <label 
                                    htmlFor="avatar-upload" 
                                    className="absolute bottom-1 right-1 btn btn-circle btn-primary btn-sm border-2 border-base-100 shadow-md cursor-pointer hover:scale-110 transition-transform"
                                    title="Загрузить фото"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                    </svg>
                                </label>
                                
                                {/* Скрытый инпут файла */}
                                <input 
                                    type="file" 
                                    id="avatar-upload" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                />
                            </div>

                            <button onClick={handleLogout} className="btn btn-ghost btn-xs text-error mt-4 font-bold opacity-70 hover:opacity-100">
                                Выйти
                            </button>
                        </div>

                        {/* --- ЦЕНТРАЛЬНАЯ ЧАСТЬ: ИНФО И ФОРМА --- */}
                        <div className="flex-1 mt-2 w-full">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold flex items-center gap-3">
                                        {user?.username}
                                        <span className={`badge ${isTeacher ? 'badge-secondary' : 'badge-accent'} text-white border-none`}>
                                            {isTeacher ? 'Преподаватель' : 'Студент'}
                                        </span>
                                    </h1>
                                    <p className="text-gray-500 font-medium">{user?.email}</p>
                                    {user?.iin && <p className="text-xs text-gray-400 font-mono mt-1">ИИН: {user.iin}</p>}
                                </div>
                                
                                {/* Статистика (XP) */}
                                <div className="hidden sm:flex stats bg-base-200/50 shadow-sm border border-base-200">
                                    <div className="stat py-2 px-4 place-items-center">
                                        <div className="stat-title text-[10px] font-bold tracking-wider opacity-60">XP</div>
                                        <div className="stat-value text-lg text-primary">{Math.round(averageScore * totalTests * 10)}</div>
                                    </div>
                                    <div className="stat py-2 px-4 place-items-center">
                                        <div className="stat-title text-[10px] font-bold tracking-wider opacity-60">РЕЙТИНГ</div>
                                        <div className={`stat-value text-lg ${averageScore >= 80 ? 'text-success' : 'text-warning'}`}>{averageScore}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* ФОРМА РЕДАКТИРОВАНИЯ */}
                            <div className="bg-base-50 p-6 rounded-xl border border-base-200">
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Личные данные</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="form-control">
                                        <label className="label py-0 mb-1"><span className="label-text text-xs">Имя</span></label>
                                        <input type="text" className="input input-bordered w-full" value={editData.first_name} onChange={(e) => setEditData({...editData, first_name: e.target.value})} />
                                    </div>
                                    <div className="form-control">
                                        <label className="label py-0 mb-1"><span className="label-text text-xs">Фамилия</span></label>
                                        <input type="text" className="input input-bordered w-full" value={editData.last_name} onChange={(e) => setEditData({...editData, last_name: e.target.value})} />
                                    </div>
                                    <div className="form-control">
                                        <label className="label py-0 mb-1"><span className="label-text text-xs">Возраст</span></label>
                                        <input type="number" className="input input-bordered w-full" value={editData.age} onChange={(e) => setEditData({...editData, age: e.target.value})} />
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button 
                                        className={`btn btn-primary px-6 ${saving ? 'loading' : ''}`}
                                        onClick={handleSaveProfile}
                                    >
                                        {saving ? 'Сохранение...' : 'Сохранить изменения'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- СЕКЦИЯ КУРСОВ --- */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    {isTeacher ? '🎓 Ваши курсы' : '📚 Мое обучение'}
                </h2>
                {isTeacher && (
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm gap-2">
                        + Создать курс
                    </button>
                )}
            </div>

            {myCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {myCourses.map(course => (
                        <div key={course.id} className="card bg-base-100 shadow-sm hover:shadow-lg transition-all border border-base-200">
                            <div className="card-body p-5">
                                <div className="flex justify-between">
                                    <div className="badge badge-ghost text-xs mb-2">{course.category_title}</div>
                                </div>
                                <h3 className="font-bold text-lg mb-2">{course.title}</h3>
                                <div className="card-actions justify-between items-center mt-4 pt-4 border-t border-base-100">
                                    <Link to={`/courses/${course.id}`} className="text-primary font-bold text-sm hover:underline">
                                        {isTeacher ? 'Просмотр' : 'Продолжить'}
                                    </Link>
                                    {isTeacher && (
                                        <Link to={`/teacher/course/${course.id}/builder`} className="btn btn-xs btn-secondary text-white">
                                            🛠 Редактор
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-base-50 rounded-xl border-2 border-dashed border-base-200 mb-12">
                    <p className="text-gray-400 mb-4">Здесь пока пусто</p>
                    {!isTeacher && <Link to="/courses" className="btn btn-outline btn-sm">В каталог</Link>}
                </div>
            )}

             {/* --- ИСТОРИЯ ТЕСТОВ (ИСПРАВЛЕНО) --- */}
             <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6">
                 <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    📜 История тестов
                    <span className="badge badge-neutral badge-sm">{results.length}</span>
                 </h2>
                 {results.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">История пуста. Пройдите первый тест!</div>
                 ) : (
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            {/* ЗАГОЛОВОК ТАБЛИЦЫ */}
                            <thead>
                                <tr className="bg-base-200/50 text-base-content/70 uppercase text-xs tracking-wider">
                                    <th>Название теста</th>
                                    <th>Дата прохождения</th>
                                    <th className="text-center">Результат</th>
                                    <th className="text-center">Статус</th>
                                </tr>
                            </thead>
                            {/* ТЕЛО ТАБЛИЦЫ */}
                            <tbody>
                                {results.map(r => (
                                    <tr key={r.id} className="hover">
                                        <td>
                                            {/* Название теста */}
                                            <div className="font-bold text-base">{r.quiz_title || "Без названия"}</div>
                                            {/* Если появится курс, можно добавить сюда: */}
                                            {/* <div className="text-xs text-gray-500">{r.course_title}</div> */}
                                        </td>
                                        
                                        <td className="text-sm font-mono text-gray-500">
                                            {/* Теперь completed_at точно придет с бэкенда */}
                                            {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                                        </td>
                                        
                                        <td className="text-center font-bold text-lg">
                                            {r.score}%
                                        </td>
                                        
                                        <td className="text-center">
                                            <div className={`badge ${r.score >= 80 ? 'badge-success text-white' : r.score >= 50 ? 'badge-warning' : 'badge-error text-white'} badge-sm`}>
                                                {r.score >= 80 ? 'Отлично' : r.score >= 50 ? 'Хорошо' : 'Плохо'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 )}
            </div>

            {/* --- МОДАЛКА (Оставил без изменений) --- */}
            {isModalOpen && isTeacher && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Новый курс</h3>
                        <input type="text" placeholder="Название" className="input input-bordered w-full mb-4" value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} />
                        <select className="select select-bordered w-full mb-6" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
                        </select>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleCreateCourse}>Создать</button>
                        </div>
                    </div>
                </dialog>
            )}
        </div>
    );
}

export default Profile;