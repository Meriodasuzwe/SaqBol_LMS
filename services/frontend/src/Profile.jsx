import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

function Profile() {
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]); 
    const [myCourses, setMyCourses] = useState([]); 
    const [categories, setCategories] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Настройки
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editData, setEditData] = useState({ first_name: '', last_name: '', age: '' });
    const [saving, setSaving] = useState(false);

    // Модалка курса
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(""); 
    const [isCreating, setIsCreating] = useState(false);

    // Фильтр активности
    const [activityYear, setActivityYear] = useState(2026);

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

    // АВТО-СОХРАНЕНИЕ АВАТАРКИ ПРИ КЛИКЕ НА КАМЕРУ
    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        // Чтобы моментально обновить картинку визуально до ответа сервера
        const tempUrl = URL.createObjectURL(file);
        setUser(prev => ({ ...prev, avatar: tempUrl }));

        try {
            const res = await api.patch('users/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUser(res.data);
            toast.success("Аватарка успешно обновлена");
        } catch (err) {
            console.error(err);
            toast.error("Ошибка при обновлении аватарки");
        }
    };

    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('blob:')) return path;
        const baseUrl = 'http://localhost:8000'; 
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await api.patch('users/me/', editData);
            setUser(res.data);
            toast.success("Личные данные сохранены");
            setIsSettingsOpen(false);
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

    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const totalTests = results.length;
    const averageScore = totalTests > 0 ? Math.round(results.reduce((acc, c) => acc + c.score, 0) / totalTests) : 0;

    // --- МАГИЯ GITHUB КВАДРАТИКОВ (С фильтром по годам) ---
    const activityMap = useMemo(() => {
        const days = [];
        const map = {};
        
        results.forEach(r => {
            if(r.completed_at) {
                const date = new Date(r.completed_at).toISOString().split('T')[0];
                map[date] = (map[date] || 0) + 1;
            }
        });

        // Берем конец выбранного года
        const endDate = new Date(activityYear, 11, 31); 
        // 52 недели * 7 дней = 364 дня (примерно год)
        for (let i = 364; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({
                date: dateStr,
                count: map[dateStr] || 0
            });
        }
        return days;
    }, [results, activityYear]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="loading loading-spinner text-primary"></span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-base-content animate-fade-in">
            
            {/* --- ШАПКА ПРОФИЛЯ --- */}
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden mb-6">
                <div className="h-32 bg-base-200/50 border-b border-base-200"></div>
                
                <div className="px-8 pb-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end relative -mt-12">
                    
                    {/* АВАТАРКА (КРУГЛАЯ С КНОПКОЙ ЗАГРУЗКИ) */}
                    <div className="relative shrink-0 group">
                        <div className="w-28 h-28 rounded-full border-4 border-base-100 shadow-sm bg-base-200 overflow-hidden flex items-center justify-center">
                            {user?.avatar ? (
                                <img 
                                    src={getAvatarUrl(user?.avatar)} 
                                    alt="avatar" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-4xl font-semibold uppercase text-base-content/40">
                                    {user?.username?.[0] || 'U'}
                                </span>
                            )}
                        </div>
                        {/* Кнопка загрузки аватара */}
                        <label 
                            htmlFor="avatar-upload" 
                            className="absolute bottom-1 right-1 p-2 bg-base-100 border border-base-300 rounded-full cursor-pointer hover:bg-base-200 transition-colors shadow-sm text-base-content/70 z-10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                            </svg>
                        </label>
                        <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 pb-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-base-content">{editData.first_name || user?.username} {editData.last_name}</h1>
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                {isTeacher ? 'Преподаватель' : 'Студент'}
                            </span>
                        </div>
                        <p className="text-sm text-base-content/50 mt-1">{user?.email}</p>
                    </div>

                    {/* Кнопка настроек */}
                    <div className="pb-2">
                        <button 
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                            className="btn btn-sm btn-outline border-base-300 text-base-content/80 font-medium"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Настройки
                        </button>
                    </div>
                </div>

                {/* НАСТРОЙКИ */}
                {isSettingsOpen && (
                    <div className="px-8 py-6 bg-base-200/30 border-t border-base-200 animate-fade-in">
                        <h3 className="text-xs font-bold mb-4 uppercase tracking-widest text-base-content/50">Редактирование профиля</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                            <div className="form-control">
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Имя</span></label>
                                <input type="text" className="input input-sm input-bordered border-base-300 bg-base-100 shadow-sm" value={editData.first_name} onChange={(e) => setEditData({...editData, first_name: e.target.value})} />
                            </div>
                            <div className="form-control">
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Фамилия</span></label>
                                <input type="text" className="input input-sm input-bordered border-base-300 bg-base-100 shadow-sm" value={editData.last_name} onChange={(e) => setEditData({...editData, last_name: e.target.value})} />
                            </div>
                            <div className="form-control">
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Возраст</span></label>
                                <input type="number" className="input input-sm input-bordered border-base-300 bg-base-100 shadow-sm" value={editData.age} onChange={(e) => setEditData({...editData, age: e.target.value})} />
                            </div>
                        </div>
                        <button className={`btn btn-primary btn-sm px-6 shadow-sm ${saving ? 'loading' : ''}`} onClick={handleSaveProfile} disabled={saving}>
                            Сохранить изменения
                        </button>
                    </div>
                )}
            </div>

            {/* --- БЛОК АКТИВНОСТИ (Органичный GITHUB STYLE) --- */}
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 mb-8 flex flex-col md:flex-row gap-8">
                <div className="flex-1 overflow-x-auto">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        Активность обучения
                        <span className="text-xs font-normal text-base-content/50 border border-base-300 rounded px-2 py-0.5">{totalTests} тестов за год</span>
                    </h3>
                    <div className="pb-2 min-w-max">
                        {/* Сетка квадратиков (7 строк) */}
                        <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                            {activityMap.map((day, idx) => {
                                // Серые квадратики теперь лучше видно благодаря bg-gray-200
                                let bg = "bg-gray-200 dark:bg-base-300"; 
                                if (day.count === 1) bg = "bg-emerald-300 dark:bg-emerald-800";
                                if (day.count === 2) bg = "bg-emerald-400 dark:bg-emerald-600";
                                if (day.count >= 3) bg = "bg-emerald-500 dark:bg-emerald-500";

                                return (
                                    <div 
                                        key={idx} 
                                        className={`w-[11px] h-[11px] rounded-[2px] transition-colors cursor-pointer hover:ring-1 hover:ring-base-content/30 ${bg}`}
                                        title={`${day.date}: Пройдено тестов - ${day.count}`}
                                    ></div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Легенда цветов */}
                    <div className="flex justify-end items-center gap-1.5 mt-3 text-[11px] text-base-content/50">
                        <span>Меньше</span>
                        <div className="w-[11px] h-[11px] rounded-[2px] bg-gray-200 dark:bg-base-300"></div>
                        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-300 dark:bg-emerald-800"></div>
                        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400 dark:bg-emerald-600"></div>
                        <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500 dark:bg-emerald-500"></div>
                        <span>Больше</span>
                    </div>
                </div>

                {/* Выбор года */}
                <div className="w-full md:w-32 flex flex-row md:flex-col gap-1">
                    {[2026, 2025, 2024].map(year => (
                        <button 
                            key={year}
                            onClick={() => setActivityYear(year)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors text-left ${activityYear === year ? 'bg-primary/10 text-primary' : 'text-base-content/60 hover:bg-base-200'}`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* --- ЛЕВАЯ КОЛОНКА: СТАТИСТИКА --- */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
                        <h3 className="text-sm font-semibold mb-4">Успеваемость</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-base-200 bg-base-50/50">
                                <div className="text-xs text-base-content/50 mb-1">Всего тестов</div>
                                <div className="text-2xl font-bold">{totalTests}</div>
                            </div>
                            <div className="p-4 rounded-xl border border-base-200 bg-base-50/50">
                                <div className="text-xs text-base-content/50 mb-1">Средний балл</div>
                                <div className="text-2xl font-bold text-primary">{averageScore}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
                        <h3 className="text-sm font-semibold mb-4">Последние результаты</h3>
                        {results.length === 0 ? (
                            <p className="text-sm text-base-content/50">Нет данных.</p>
                        ) : (
                            <div className="space-y-1">
                                {results.slice(0, 5).map(r => (
                                    <div key={r.id} className="flex justify-between items-center py-2.5 border-b border-base-100 last:border-0 hover:bg-base-50 px-2 -mx-2 rounded-lg transition-colors">
                                        <div className="truncate pr-4">
                                            <p className="text-sm font-medium truncate">{r.quiz_title || "Без названия"}</p>
                                            <p className="text-[11px] text-base-content/50 mt-0.5">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}</p>
                                        </div>
                                        <div className={`shrink-0 font-bold text-xs px-2 py-1 rounded border ${r.score >= 70 ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'}`}>
                                            {r.score}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- ПРАВАЯ КОЛОНКА: КУРСЫ --- */}
                <div className="xl:col-span-2">
                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 sm:p-8 min-h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">
                                {isTeacher ? 'Управление курсами' : 'Мое обучение'}
                            </h3>
                            {isTeacher && (
                                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm rounded-md shadow-sm">
                                    Создать курс
                                </button>
                            )}
                        </div>

                        {myCourses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {myCourses.map(course => (
                                    <div key={course.id} className="p-5 rounded-xl border border-base-200 bg-base-50/50 hover:bg-base-100 hover:shadow-md hover:border-primary/30 transition-all group flex flex-col">
                                        <div className="text-[10px] font-bold text-base-content/40 mb-2 uppercase tracking-widest">{course.category_title}</div>
                                        <h4 className="font-semibold mb-4 line-clamp-2 text-sm group-hover:text-primary transition-colors">{course.title}</h4>
                                        <div className="flex justify-between items-center mt-auto pt-4 border-t border-base-200">
                                            <Link to={`/courses/${course.id}`} className="text-xs font-bold text-primary hover:underline">
                                                {isTeacher ? 'Просмотр курса' : 'Продолжить'}
                                            </Link>
                                            {isTeacher && (
                                                <Link to={`/teacher/course/${course.id}/builder`} className="text-xs font-semibold px-2.5 py-1.5 border border-base-300 rounded text-base-content/70 hover:bg-base-200 transition-colors">
                                                    Редактор
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 border border-dashed border-base-300 rounded-xl bg-base-50/50">
                                <p className="text-sm font-medium text-base-content/50 mb-4">У вас пока нет активных курсов.</p>
                                {!isTeacher && <Link to="/courses" className="btn btn-outline border-base-300 btn-sm shadow-sm">Перейти в каталог</Link>}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Модалка создания курса */}
            {isModalOpen && isTeacher && (
                <div className="fixed inset-0 bg-base-300/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl border border-base-200 w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4">Новый курс</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Название</span></label>
                                <input type="text" className="input input-sm input-bordered border-base-300 w-full shadow-sm" value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Категория</span></label>
                                <select className="select select-sm select-bordered border-base-300 w-full shadow-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-sm btn-ghost" onClick={() => setIsModalOpen(false)}>Отмена</button>
                            <button className={`btn btn-sm btn-primary shadow-sm ${isCreating ? 'loading' : ''}`} onClick={handleCreateCourse} disabled={isCreating || !newCourseTitle}>
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