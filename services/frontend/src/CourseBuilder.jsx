import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactQuill from 'react-quill-new'; // Импорт редактора
import 'react-quill-new/dist/quill.snow.css'; // Импорт стилей редактора
import api from './api';
import TeacherPanel from './TeacherPanel';

function CourseBuilder() {
    const { courseId } = useParams();
    const [lessons, setLessons] = useState([]);
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeTab, setActiveTab] = useState('content'); // 'content' (Теория) или 'quiz' (Тест)
    const [loading, setLoading] = useState(true);

    // Состояния для МОДАЛЬНОГО ОКНА
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // --- НАСТРОЙКИ РЕДАКТОРА (TOOLBAR) ---
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }], // Заголовки H1, H2, H3
            ['bold', 'italic', 'underline', 'strike'], // Жирный, Курсив...
            [{ 'color': [] }, { 'background': [] }], // Цвет текста и фона
            [{ 'list': 'ordered'}, {'list': 'bullet'}], // Списки
            [{ 'align': [] }], // Выравнивание
            ['link', 'image', 'video'], // Вставка картинок и видео
            ['clean'] // Очистить форматирование
        ],
    };

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'color', 'background',
        'list', 'bullet',
        'align',
        'link', 'image', 'video'
    ];

    // Загрузка уроков
    useEffect(() => {
        fetchLessons();
    }, [courseId]);

    const fetchLessons = async () => {
        try {
            const res = await api.get(`courses/${courseId}/lessons/`);
            // Сортируем уроки по ID (в порядке создания)
            const sorted = res.data.sort((a, b) => a.id - b.id);
            setLessons(sorted);
            
            // Если уроки есть, и ни один не выбран — выбираем первый
            if (sorted.length > 0 && !activeLesson) {
                setActiveLesson(sorted[0]);
            }
        } catch (err) {
            console.error("Ошибка загрузки уроков:", err);
        } finally {
            setLoading(false);
        }
    };

    // СОЗДАНИЕ УРОКА
    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        setIsCreating(true);

        try {
            // Создаем урок с пустыми полями, чтобы избежать 400 Bad Request
            const res = await api.post(`courses/${courseId}/lessons/`, {
                title: newLessonTitle,
                content: "",    
                video_url: "",  
                order: lessons.length + 1
            });

            const updatedLessons = [...lessons, res.data];
            setLessons(updatedLessons);
            
            setActiveLesson(res.data);
            setActiveTab('content');
            
            setIsModalOpen(false);
            setNewLessonTitle("");

        } catch (err) {
            console.error(err);
            alert(`Ошибка создания: ${err.response?.statusText || "Не удалось создать урок"}`);
        } finally {
            setIsCreating(false);
        }
    };

    // СОХРАНЕНИЕ ИЗМЕНЕНИЙ
    const handleSaveContent = async () => {
        if (!activeLesson) return;
        try {
            // Отправляем HTML-контент из редактора на сервер
            await api.patch(`courses/lessons/${activeLesson.id}/`, {
                title: activeLesson.title,
                content: activeLesson.content,
                video_url: activeLesson.video_url
            });
            
            setLessons(lessons.map(l => l.id === activeLesson.id ? activeLesson : l));
            
            // Анимация кнопки "Сохранено"
            const btn = document.getElementById('save-btn');
            if(btn) {
                const originalText = btn.innerText;
                btn.innerText = "✅ Сохранено!";
                btn.classList.add('btn-success', 'text-white');
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('btn-success', 'text-white');
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            alert("Ошибка сохранения! Проверьте консоль.");
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="flex h-[calc(100vh-64px)] bg-base-100 overflow-hidden"> 
            
            {/* --- 1. ЛЕВАЯ КОЛОНКА (САЙДБАР) --- */}
            <div className="w-72 bg-base-200 border-r border-base-300 flex flex-col h-full shrink-0 shadow-inner">
                <div className="p-4 border-b border-base-300 bg-base-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2">
                        📚 План курса
                    </h2>
                    <Link to={`/courses/${courseId}`} className="btn btn-xs btn-ghost" title="Предпросмотр">👁️</Link>
                </div>
                
                <div className="overflow-y-auto flex-1 p-2">
                    <ul className="menu w-full rounded-box gap-1">
                        {lessons.map((lesson, index) => (
                            <li key={lesson.id}>
                                <a 
                                    className={`${activeLesson?.id === lesson.id ? "active font-bold bg-primary text-white" : "hover:bg-base-300"}`}
                                    onClick={() => { setActiveLesson(lesson); setActiveTab('content'); }}
                                >
                                    <span className="truncate">{index + 1}. {lesson.title}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                    
                    {lessons.length === 0 && (
                        <div className="text-center mt-10 text-gray-400 text-sm px-4">
                            Уроков пока нет.<br/>Нажмите кнопку ниже 👇
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-base-300 bg-base-100">
                    <button 
                        className="btn btn-outline btn-primary w-full" 
                        onClick={() => setIsModalOpen(true)}
                    >
                        ➕ Добавить урок
                    </button>
                </div>
            </div>

            {/* --- 2. ПРАВАЯ КОЛОНКА (РЕДАКТОР) --- */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
                {activeLesson ? (
                    <>
                        {/* Шапка редактора */}
                        <div className="navbar border-b px-6 py-2 bg-base-100 shrink-0 z-10 shadow-sm">
                            <div className="flex-1 mr-4">
                                <input 
                                    type="text" 
                                    className="input input-ghost font-bold text-xl w-full hover:bg-base-200 focus:bg-white transition-colors"
                                    value={activeLesson.title}
                                    onChange={(e) => setActiveLesson({...activeLesson, title: e.target.value})}
                                    placeholder="Название урока"
                                />
                            </div>
                            <div className="flex-none">
                                <div role="tablist" className="tabs tabs-boxed">
                                    <a role="tab" className={`tab ${activeTab === 'content' ? 'tab-active' : ''}`} onClick={() => setActiveTab('content')}>📝 Теория</a>
                                    <a role="tab" className={`tab ${activeTab === 'quiz' ? 'tab-active bg-secondary text-white' : ''}`} onClick={() => setActiveTab('quiz')}>⚡ AI Тесты</a>
                                </div>
                            </div>
                        </div>

                        {/* Рабочая область */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                            
                            {/* Вкладка ТЕОРИЯ */}
                            {activeTab === 'content' && (
                                <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                                    
                                    {/* Поле Видео */}
                                    <div className="form-control w-full">
                                        <label className="label font-bold text-gray-500 text-xs uppercase">Видео (YouTube)</label>
                                        <input 
                                            type="text" 
                                            className="input input-bordered w-full bg-white" 
                                            placeholder="https://youtu.be/..."
                                            value={activeLesson.video_url || ""}
                                            onChange={(e) => setActiveLesson({...activeLesson, video_url: e.target.value})}
                                        />
                                    </div>

                                    {/* РЕДАКТОР ТЕКСТА (React Quill) */}
                                    <div className="card bg-white shadow-sm border border-base-200 flex flex-col overflow-visible">
                                        <div className="p-3 border-b bg-base-50 flex justify-between items-center px-4">
                                            <span className="font-bold text-gray-500 text-xs uppercase">Конспект лекции</span>
                                            <button id="save-btn" className="btn btn-sm btn-ghost border-base-300" onClick={handleSaveContent}>
                                                💾 Сохранить
                                            </button>
                                        </div>
                                        
                                        {/* Замена textarea на ReactQuill */}
                                        <ReactQuill 
                                            theme="snow"
                                            value={activeLesson.content || ""}
                                            onChange={(content) => setActiveLesson({...activeLesson, content: content})}
                                            modules={modules}
                                            formats={formats}
                                            className="h-[500px] mb-12" // mb-12 нужен, чтобы тулбар не перекрывал низ при скролле
                                            placeholder="Напишите здесь теорию урока. Вы можете вставлять картинки, списки и форматировать текст..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Вкладка AI ТЕСТЫ */}
                            {activeTab === 'quiz' && (
                                <div className="max-w-5xl mx-auto animate-fade-in">
                                    <TeacherPanel 
                                        preSelectedLessonId={activeLesson.id} 
                                        preFilledText={activeLesson.content} // AI теперь получит HTML текст, но он справится
                                    />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // Заглушка (Empty State)
                    <div className="flex flex-col h-full items-center justify-center text-gray-300 bg-slate-50">
                        <div className="text-8xl mb-4 opacity-20">👈</div>
                        <h2 className="text-2xl font-bold text-gray-400">Выберите урок</h2>
                        <p className="text-gray-400">В меню слева или создайте новый</p>
                    </div>
                )}
            </div>

            {/* --- 3. МОДАЛЬНОЕ ОКНО СОЗДАНИЯ --- */}
            {isModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">✨ Новый урок</h3>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-bold">Название темы</span>
                            </label>
                            <input 
                                type="text" 
                                placeholder="Например: Введение в функции" 
                                className="input input-bordered w-full" 
                                autoFocus
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateLesson()}
                            />
                        </div>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                            <button 
                                className={`btn btn-primary ${isCreating ? 'loading' : ''}`} 
                                onClick={handleCreateLesson}
                                disabled={!newLessonTitle.trim() || isCreating}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
                </dialog>
            )}
        </div>
    );
}

export default CourseBuilder;