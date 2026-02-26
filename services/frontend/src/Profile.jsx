import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

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
                console.error("Ошибка загрузки профиля:", err);
                toast.error("Не удалось загрузить данные профиля");
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

    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const baseUrl = 'http://localhost:8000'; 
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('first_name', editData.first_name);
            formData.append('last_name', editData.last_name);
            formData.append('age', editData.age);
            
            if (selectedFile) formData.append('avatar', selectedFile);

            const res = await api.patch('users/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUser(res.data);
            setPreview(null);
            setSelectedFile(null);
            toast.success("Данные сохранены");
        } catch (err) {
            console.error(err);
            toast.error("Ошибка при сохранении");
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
            toast.error("Ошибка при создании курса");
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

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="loading loading-spinner text-base-content/30"></span>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-base-content">
            
            {/* --- ШАПКА ПРОФИЛЯ (СТРОГИЙ ВИД) --- */}
            {/* ИЗМЕНЕНИЕ: shadow-md и border-base-300 для лучшего контраста */}
            <div className="bg-base-100 rounded-2xl shadow-md border border-base-300 overflow-hidden mb-10">
                
                <div className="h-32 bg-base-200/80 border-b border-base-300"></div>
                
                <div className="px-8 pb-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end relative -mt-12">
                    {/* Аватар */}
                    <div className="relative group shrink-0">
                        {/* ИЗМЕНЕНИЕ: Тень для самой аватарки */}
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-base-100 shadow-sm bg-base-200 overflow-hidden flex items-center justify-center">
                            {preview || user?.avatar ? (
                                <img 
                                    src={preview || getAvatarUrl(user?.avatar)} 
                                    alt="avatar" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null; 
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = `<span class="text-4xl font-semibold uppercase text-base-content/40">${user?.username?.[0] || 'U'}</span>`;
                                    }}
                                />
                            ) : (
                                <span className="text-4xl font-semibold uppercase text-base-content/40">
                                    {user?.username?.[0] || 'U'}
                                </span>
                            )}
                        </div>
                        <label 
                            htmlFor="avatar-upload" 
                            className="absolute bottom-0 right-0 p-1.5 bg-base-100 border border-base-300 rounded-full cursor-pointer hover:bg-base-200 transition-colors shadow-sm text-base-content/70"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                            </svg>
                        </label>
                        <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 pb-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{user?.username}</h1>
                            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                {isTeacher ? 'Преподаватель' : 'Студент'}
                            </span>
                        </div>
                        <p className="text-sm text-base-content/60 mt-1">{user?.email}</p>
                    </div>

                    {/* Действия */}
                    <div className="pb-2 w-full sm:w-auto flex flex-col gap-2">
                        <button onClick={handleLogout} className="btn btn-outline btn-sm border-base-300 text-base-content/70 hover:bg-error hover:text-white hover:border-error transition-colors">
                            Выйти из системы
                        </button>
                    </div>
                </div>

                {/* --- ФОРМА РЕДАКТИРОВАНИЯ --- */}
                {/* ИЗМЕНЕНИЕ: bg-base-200/30 для контраста с белыми полями ввода */}
                <div className="border-t border-base-300 p-8 bg-base-200/30">
                    <h3 className="text-sm font-semibold mb-6">Личные данные</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="form-control">
                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Имя</span></label>
                            <input type="text" className="input input-sm input-bordered border-base-300 bg-base-100 w-full rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary" value={editData.first_name} onChange={(e) => setEditData({...editData, first_name: e.target.value})} />
                        </div>
                        <div className="form-control">
                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Фамилия</span></label>
                            <input type="text" className="input input-sm input-bordered border-base-300 bg-base-100 w-full rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary" value={editData.last_name} onChange={(e) => setEditData({...editData, last_name: e.target.value})} />
                        </div>
                        <div className="form-control">
                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Возраст</span></label>
                            <input type="number" className="input input-sm input-bordered border-base-300 bg-base-100 w-full rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary" value={editData.age} onChange={(e) => setEditData({...editData, age: e.target.value})} />
                        </div>
                    </div>
                    <div className="mt-6">
                        <button className={`btn btn-primary btn-sm rounded-md px-6 shadow-sm ${saving ? 'loading' : ''}`} onClick={handleSaveProfile} disabled={saving}>
                            {saving ? 'Сохранение...' : 'Сохранить изменения'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* --- ЛЕВАЯ КОЛОНКА: СТАТИСТИКА И ТЕСТЫ --- */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Статистика */}
                    <div className="bg-base-100 rounded-2xl shadow-md border border-base-300 p-6">
                        <h3 className="text-sm font-semibold mb-4">Успеваемость</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-base-200/50 border border-base-300 shadow-sm">
                                <div className="text-xs text-base-content/60 mb-1">Пройдено тестов</div>
                                <div className="text-2xl font-bold text-base-content">{totalTests}</div>
                            </div>
                            <div className="p-4 rounded-xl bg-base-200/50 border border-base-300 shadow-sm">
                                <div className="text-xs text-base-content/60 mb-1">Средний балл</div>
                                <div className="text-2xl font-bold text-primary">{averageScore}%</div>
                            </div>
                        </div>
                    </div>

                    {/* История тестов */}
                    <div className="bg-base-100 rounded-2xl shadow-md border border-base-300 p-6">
                        <h3 className="text-sm font-semibold mb-4">История тестов</h3>
                        {results.length === 0 ? (
                            <p className="text-sm text-base-content/50">Нет данных о пройденных тестах.</p>
                        ) : (
                            <div className="space-y-3">
                                {results.slice(0, 5).map(r => (
                                    <div key={r.id} className="flex justify-between items-center py-2 border-b border-base-200 last:border-0">
                                        <div>
                                            <p className="text-sm font-medium">{r.quiz_title || "Без названия"}</p>
                                            <p className="text-xs text-base-content/50">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</p>
                                        </div>
                                        <div className="font-semibold text-sm bg-base-200 px-2 py-1 rounded border border-base-300">{r.score}%</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- ПРАВАЯ КОЛОНКА: КУРСЫ --- */}
                <div className="lg:col-span-2">
                    <div className="bg-base-100 rounded-2xl shadow-md border border-base-300 p-6 sm:p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">
                                {isTeacher ? 'Управление курсами' : 'Мое обучение'}
                            </h3>
                            {isTeacher && (
                                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm rounded-md shadow-sm">
                                    + Создать курс
                                </button>
                            )}
                        </div>

                        {myCourses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {myCourses.map(course => (
                                    <div key={course.id} className="p-5 rounded-xl border border-base-300 bg-base-100 hover:shadow-md hover:border-primary/40 transition-all group">
                                        <div className="text-xs font-bold text-base-content/50 mb-2 uppercase tracking-wider">{course.category_title}</div>
                                        <h4 className="font-semibold mb-4 line-clamp-2 text-base-content group-hover:text-primary transition-colors">{course.title}</h4>
                                        <div className="flex justify-between items-center mt-auto pt-3 border-t border-base-200">
                                            <Link to={`/courses/${course.id}`} className="text-sm font-bold text-primary hover:underline">
                                                {isTeacher ? 'Просмотр' : 'Продолжить'}
                                            </Link>
                                            {isTeacher && (
                                                <Link to={`/teacher/course/${course.id}/builder`} className="text-xs font-semibold px-2.5 py-1.5 bg-base-200 rounded text-base-content/70 hover:bg-base-300 transition-colors">
                                                    Редактор
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border border-dashed border-base-300 rounded-xl bg-base-50/50">
                                <p className="text-sm font-medium text-base-content/50 mb-4">У вас пока нет активных курсов.</p>
                                {!isTeacher && <Link to="/courses" className="btn btn-outline border-base-300 btn-sm shadow-sm">Перейти в каталог</Link>}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* --- МОДАЛКА СОЗДАНИЯ КУРСА --- */}
            {isModalOpen && isTeacher && (
                <div className="fixed inset-0 bg-base-300/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl border border-base-300 w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4">Новый курс</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium">Название</span></label>
                                <input type="text" className="input input-sm input-bordered border-base-300 w-full rounded-md focus:border-primary focus:ring-1 focus:ring-primary" value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium">Категория</span></label>
                                <select className="select select-sm select-bordered border-base-300 w-full rounded-md focus:border-primary focus:ring-1 focus:ring-primary" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-sm btn-ghost rounded-md" onClick={() => setIsModalOpen(false)}>Отмена</button>
                            <button className={`btn btn-sm btn-primary rounded-md shadow-sm ${isCreating ? 'loading' : ''}`} onClick={handleCreateCourse} disabled={isCreating || !newCourseTitle}>
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;