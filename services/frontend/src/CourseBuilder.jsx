import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactQuill from 'react-quill-new'; 
import 'react-quill-new/dist/quill.snow.css';
import api from './api';
import TeacherPanel from './TeacherPanel';

function CourseBuilder() {
    const { courseId } = useParams();
    
    // --- СОСТОЯНИЯ ---
    const [lessons, setLessons] = useState([]);
    const [courseData, setCourseData] = useState({ title: '', description: '' }); // Данные курса
    
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeTab, setActiveTab] = useState('content'); // 'content' | 'quiz'
    const [isSettingsMode, setIsSettingsMode] = useState(false); // Режим настроек курса
    const [loading, setLoading] = useState(true);

    // Модалка создания урока
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // --- НАСТРОЙКИ РЕДАКТОРА ---
    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, {'list': 'bullet'}],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean']
        ],
    };

    const formats = [
        'header', 'bold', 'italic', 'underline', 'strike',
        'color', 'background', 'list', 'bullet', 'align',
        'link', 'image', 'video'
    ];

    // --- ЗАГРУЗКА ДАННЫХ ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Загружаем параллельно и уроки, и инфо о курсе
                const [lessonsRes, courseRes] = await Promise.all([
                    api.get(`courses/${courseId}/lessons/`),
                    api.get(`courses/${courseId}/`)
                ]);

                // Уроки
                const sorted = lessonsRes.data.sort((a, b) => a.id - b.id);
                setLessons(sorted);
                if (sorted.length > 0) {
                    setActiveLesson(sorted[0]);
                } else {
                    // Если уроков нет, открываем настройки курса
                    setIsSettingsMode(true);
                }

                // Курс
                setCourseData({
                    title: courseRes.data.title,
                    description: courseRes.data.description || ""
                });

            } catch (err) {
                console.error("Ошибка загрузки:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId]);

    // --- ЛОГИКА СОЗДАНИЯ УРОКА ---
    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        setIsCreating(true);
        try {
            const payload = {
                title: newLessonTitle,
                content: "",
                video_url: "",
                order: lessons.length + 1,
                course: courseId
            };
            console.log('Creating lesson payload:', payload);

            const res = await api.post(`courses/${courseId}/lessons/`, payload);
            console.log('Create lesson response:', res);

            const updatedLessons = [...lessons, res.data];
            setLessons(updatedLessons);
            
            // Переключаемся на новый урок
            setIsSettingsMode(false);
            setActiveLesson(res.data);
            setActiveTab('content');
            
            setIsModalOpen(false);
            setNewLessonTitle("");
        } catch (err) {
            console.error('Ошибка при создании урока:', err);
            const serverMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
            alert(`Ошибка создания урока: ${serverMsg}`);
        } finally {
            setIsCreating(false);
        }
    };

    // --- СОХРАНЕНИЕ УРОКА ---
    const handleSaveLesson = async () => {
        if (!activeLesson) return;
        try {
            await api.patch(`courses/lessons/${activeLesson.id}/`, {
                title: activeLesson.title,
                content: activeLesson.content,
                video_url: activeLesson.video_url
            });
            
            // Обновляем список (на случай смены названия)
            setLessons(lessons.map(l => l.id === activeLesson.id ? activeLesson : l));
            showToast("save-lesson-btn");
        } catch (err) {
            console.error(err);
            alert("Ошибка сохранения урока");
        }
    };

    // --- ПЕРЕИМЕНОВАНИЕ УРОКА (МОДАЛ) ---
    const handleRenameLesson = () => {
        if (!activeLesson) return;
        setRenameValue(activeLesson.title || '');
        setIsRenameModalOpen(true);
    };

    const handleConfirmRename = async () => {
        if (!activeLesson) return setIsRenameModalOpen(false);
        const newTitle = renameValue && renameValue.trim();
        if (!newTitle || newTitle === activeLesson.title) {
            setIsRenameModalOpen(false);
            return;
        }
        try {
            await api.patch(`courses/lessons/${activeLesson.id}/`, { title: newTitle });
            const updated = { ...activeLesson, title: newTitle };
            setActiveLesson(updated);
            setLessons(lessons.map(l => l.id === updated.id ? updated : l));
            showToast('save-lesson-btn');
        } catch (err) {
            console.error('Ошибка переименования:', err);
            alert('Не удалось переименовать урок.');
        } finally {
            setIsRenameModalOpen(false);
        }
    };

    // --- УДАЛЕНИЕ УРОКА (МОДАЛ) ---
    const handleDeleteLesson = () => {
        if (!activeLesson) return;
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!activeLesson) return setIsDeleteModalOpen(false);
        setIsDeleting(true);
        try {
            await api.delete(`courses/lessons/${activeLesson.id}/`);
            const idx = lessons.findIndex(l => l.id === activeLesson.id);
            const remaining = lessons.filter(l => l.id !== activeLesson.id);
            setLessons(remaining);
            if (remaining.length > 0) {
                const nextIndex = Math.min(idx, remaining.length - 1);
                setActiveLesson(remaining[nextIndex]);
                setActiveTab('content');
            } else {
                setActiveLesson(null);
                setIsSettingsMode(true);
            }
        } catch (err) {
            console.error('Ошибка удаления урока:', err);
            alert('Не удалось удалить урок.');
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    // --- СОХРАНЕНИЕ НАСТРОЕК КУРСА (НОВОЕ) ---
    const handleSaveCourseSettings = async () => {
        try {
            await api.patch(`courses/${courseId}/`, {
                title: courseData.title,
                description: courseData.description
            });
            showToast("save-course-btn");
        } catch (err) {
            console.error(err);
            alert("Ошибка сохранения настроек курса");
        }
    };

    // Анимация кнопки сохранения
    const showToast = (btnId) => {
        const btn = document.getElementById(btnId);
        if(btn) {
            const originalText = btn.innerText;
            btn.innerText = "✅ Сохранено!";
            btn.classList.add('btn-success', 'text-white');
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('btn-success', 'text-white');
            }, 2000);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="flex h-[calc(100vh-64px)] bg-base-100 overflow-hidden"> 
            
            {/* === ЛЕВАЯ КОЛОНКА (САЙДБАР) === */}
            <div className="w-72 bg-base-200 border-r border-base-300 flex flex-col h-full shrink-0 shadow-inner">
                {/* Шапка сайдбара */}
                <div className="p-4 border-b border-base-300 bg-base-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-700 truncate max-w-[150px]" title={courseData.title}>
                        {courseData.title || "Курс"}
                    </h2>
                    <div className="flex gap-1">
                        <button 
                            className={`btn btn-sm btn-ghost ${isSettingsMode ? 'text-primary bg-primary/10' : ''}`} 
                            onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }}
                            title="Настройки курса"
                        >
                            ⚙️
                        </button>
                        <Link to={`/courses/${courseId}`} className="btn btn-sm btn-ghost" title="Предпросмотр">👁️</Link>
                    </div>
                </div>
                
                {/* Список уроков */}
                <div className="overflow-y-auto flex-1 p-2">
                    <ul className="menu w-full rounded-box gap-1">
                        {lessons.map((lesson, index) => (
                            <li key={lesson.id}>
                                <a 
                                    className={`${activeLesson?.id === lesson.id && !isSettingsMode ? "active font-bold bg-primary text-white" : "hover:bg-base-300"}`}
                                    onClick={() => { setActiveLesson(lesson); setIsSettingsMode(false); setActiveTab('content'); }}
                                >
                                    <span className="truncate">{index + 1}. {lesson.title}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                    {lessons.length === 0 && (
                        <div className="text-center mt-10 text-gray-400 text-sm px-4">
                            Уроков пока нет.<br/>Создайте первый 👇
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-base-300 bg-base-100">
                    <button className="btn btn-outline btn-primary w-full" onClick={() => setIsModalOpen(true)}>
                        ➕ Добавить урок
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА (КОНТЕНТ) === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
                
                {/* ВАРИАНТ 1: РЕЖИМ НАСТРОЕК КУРСА */}
                {isSettingsMode ? (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                        <div className="max-w-3xl mx-auto card bg-base-100 shadow-xl">
                            <div className="card-body">
                                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                                    ⚙️ Настройки курса
                                </h2>
                                
                                <div className="form-control w-full mb-4">
                                    <label className="label"><span className="label-text font-bold">Название курса</span></label>
                                    <input 
                                        type="text" 
                                        className="input input-bordered w-full text-lg" 
                                        value={courseData.title}
                                        onChange={(e) => setCourseData({...courseData, title: e.target.value})}
                                    />
                                </div>

                                <div className="form-control w-full mb-6">
                                    <label className="label"><span className="label-text font-bold">Описание курса</span></label>
                                    <textarea 
                                        className="textarea textarea-bordered h-40 text-base leading-relaxed" 
                                        placeholder="О чем этот курс? Чему научатся студенты? (Это описание будет видно на карточке курса)"
                                        value={courseData.description}
                                        onChange={(e) => setCourseData({...courseData, description: e.target.value})}
                                    ></textarea>
                                </div>

                                <div className="card-actions justify-end">
                                    <button 
                                        id="save-course-btn" 
                                        className="btn btn-primary px-8" 
                                        onClick={handleSaveCourseSettings}
                                    >
                                        Сохранить настройки
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : 
                
                /* ВАРИАНТ 2: РЕДАКТОР УРОКА */
                activeLesson ? (
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
                            <div className="flex-none flex items-center gap-3">
                                <div role="tablist" className="tabs tabs-boxed">
                                    <a role="tab" className={`tab ${activeTab === 'content' ? 'tab-active' : ''}`} onClick={() => setActiveTab('content')}>📝 Теория</a>
                                    <a role="tab" className={`tab ${activeTab === 'quiz' ? 'tab-active bg-secondary text-white' : ''}`} onClick={() => setActiveTab('quiz')}>⚡ AI Тесты</a>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button title="Переименовать урок" className="btn btn-sm btn-ghost" onClick={handleRenameLesson}>✏️</button>
                                    <button title="Удалить урок" className={`btn btn-sm btn-ghost text-red-600`} onClick={handleDeleteLesson} disabled={isDeleting}>{isDeleting ? 'Удаление...' : '🗑️'}</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                            {activeTab === 'content' && (
                                <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
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

                                    <div className="card bg-white shadow-sm border border-base-200 flex flex-col overflow-visible">
                                        <div className="p-3 border-b bg-base-50 flex justify-between items-center px-4">
                                            <span className="font-bold text-gray-500 text-xs uppercase">Конспект лекции</span>
                                            <button id="save-lesson-btn" className="btn btn-sm btn-ghost border-base-300" onClick={handleSaveLesson}>
                                                💾 Сохранить
                                            </button>
                                        </div>
                                        <ReactQuill 
                                            theme="snow"
                                            value={activeLesson.content || ""}
                                            onChange={(content) => setActiveLesson({...activeLesson, content: content})}
                                            modules={modules}
                                            formats={formats}
                                            className="h-[500px] mb-12"
                                            placeholder="Пишите теорию здесь..."
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'quiz' && (
                                <div className="max-w-5xl mx-auto animate-fade-in">
                                    <TeacherPanel preSelectedLessonId={activeLesson.id} preFilledText={activeLesson.content} />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // Заглушка
                    <div className="flex flex-col h-full items-center justify-center text-gray-300 bg-slate-50">
                        <div className="text-8xl mb-4 opacity-20">👈</div>
                        <h2 className="text-2xl font-bold text-gray-400">Выберите урок</h2>
                        <p className="text-gray-400">или откройте настройки курса (⚙️)</p>
                    </div>
                )}
            </div>

            {/* Модальное окно создания урока */}
            {isModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">✨ Новый урок</h3>
                        <div className="form-control w-full">
                            <input 
                                type="text" 
                                className="input input-bordered w-full" 
                                autoFocus
                                placeholder="Название урока"
                                value={newLessonTitle}
                                onChange={(e) => setNewLessonTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateLesson()}
                            />
                        </div>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsModalOpen(false)}>Отмена</button>
                            <button className={`btn btn-primary ${isCreating ? 'loading' : ''}`} onClick={handleCreateLesson}>Создать</button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}></div>
                </dialog>
            )}

            {/* Модальное окно переименования */}
            {isRenameModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">✏️ Переименовать урок</h3>
                        <div className="form-control w-full">
                            <input type="text" className="input input-bordered w-full" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                        </div>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsRenameModalOpen(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleConfirmRename}>Сохранить</button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsRenameModalOpen(false)}></div>
                </dialog>
            )}

            {/* Модальное окно удаления */}
            {isDeleteModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">🗑️ Удалить урок</h3>
                        <p className="mb-4">Вы уверены, что хотите удалить урок "{activeLesson?.title}"? Это действие нельзя отменить.</p>
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsDeleteModalOpen(false)}>Отмена</button>
                            <button className={`btn btn-error ${isDeleting ? 'loading' : ''}`} onClick={handleConfirmDelete}>Удалить</button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsDeleteModalOpen(false)}></div>
                </dialog>
            )}
        </div>
    );
}

export default CourseBuilder;