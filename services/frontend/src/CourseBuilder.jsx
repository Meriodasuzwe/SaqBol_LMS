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
    const [courseData, setCourseData] = useState({ title: '', description: '' }); 
    
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeTab, setActiveTab] = useState('content'); // 'content' | 'quiz' | 'simulation'
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);

    // Модалки
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // 🔥 СОСТОЯНИЯ ДЛЯ AI СИМУЛЯЦИЙ
    const [aiTopic, setAiTopic] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

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
                const [lessonsRes, courseRes] = await Promise.all([
                    api.get(`courses/${courseId}/lessons/`),
                    api.get(`courses/${courseId}/`)
                ]);

                const sorted = lessonsRes.data.sort((a, b) => a.id - b.id);
                setLessons(sorted);
                if (sorted.length > 0) {
                    setActiveLesson(sorted[0]);
                } else {
                    setIsSettingsMode(true);
                }

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
                lesson_type: 'text', // По умолчанию обычный текст
                order: lessons.length + 1,
                course: courseId
            };

            const res = await api.post(`courses/${courseId}/lessons/`, payload);

            const updatedLessons = [...lessons, res.data];
            setLessons(updatedLessons);
            
            setIsSettingsMode(false);
            setActiveLesson(res.data);
            setActiveTab('content');
            
            setIsModalOpen(false);
            setNewLessonTitle("");
        } catch (err) {
            console.error('Ошибка при создании урока:', err);
            alert(`Ошибка создания урока`);
        } finally {
            setIsCreating(false);
        }
    };

    // --- 🔥 ГЕНЕРАЦИЯ СЦЕНАРИЯ ЧЕРЕЗ AI ---
    const handleGenerateScenario = async (type) => {
        if (!aiTopic) return alert("Напишите тему для генерации!");
        
        setAiLoading(true);
        try {
            // Запрос напрямую к AI сервису (порт 8001)
            const response = await fetch('http://localhost:8001/generate-scenario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: aiTopic,
                    scenario_type: type === 'simulation_email' ? 'email' : 'chat'
                })
            });

            if (!response.ok) throw new Error("AI Error");
            const data = await response.json();

            // Обновляем активный урок данными от AI
            setActiveLesson(prev => ({
                ...prev,
                lesson_type: type, // Меняем тип урока
                scenario_data: data // Записываем JSON
            }));

            alert("✨ Сценарий создан! Не забудьте нажать 'Сохранить'.");
        } catch (err) {
            console.error(err);
            alert("Ошибка генерации AI. Проверьте консоль.");
        } finally {
            setAiLoading(false);
        }
    };

    // --- СОХРАНЕНИЕ УРОКА (ИСПРАВЛЕНО) ---
    // Добавили параметр btnId с дефолтным значением
    const handleSaveLesson = async (btnId = "save-lesson-btn") => { 
        if (!activeLesson) return;
        try {
            await api.patch(`courses/lessons/${activeLesson.id}/`, {
                title: activeLesson.title,
                content: activeLesson.content,
                video_url: activeLesson.video_url,
                lesson_type: activeLesson.lesson_type, 
                scenario_data: activeLesson.scenario_data
            });
            
            setLessons(lessons.map(l => l.id === activeLesson.id ? activeLesson : l));
            showToast(btnId); // Используем переданный ID кнопки для анимации
        } catch (err) {
            console.error(err);
            alert("Ошибка сохранения урока: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        }
    };

    // --- ПЕРЕИМЕНОВАНИЕ УРОКА ---
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
        } finally {
            setIsRenameModalOpen(false);
        }
    };

    // --- УДАЛЕНИЕ УРОКА ---
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
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    // --- СОХРАНЕНИЕ НАСТРОЕК КУРСА ---
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
                
                <div className="overflow-y-auto flex-1 p-2">
                    <ul className="menu w-full rounded-box gap-1">
                        {lessons.map((lesson, index) => (
                            <li key={lesson.id}>
                                <a 
                                    className={`${activeLesson?.id === lesson.id && !isSettingsMode ? "active font-bold bg-primary text-white" : "hover:bg-base-300"}`}
                                    onClick={() => { setActiveLesson(lesson); setIsSettingsMode(false); setActiveTab('content'); }}
                                >
                                    <span className="truncate">
                                        {/* Иконка типа урока */}
                                        {lesson.lesson_type === 'simulation_chat' && '💬 '}
                                        {lesson.lesson_type === 'simulation_email' && '📧 '}
                                        {lesson.lesson_type === 'text' && (index + 1 + '. ')}
                                        {lesson.title}
                                    </span>
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
                
                {isSettingsMode ? (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                        <div className="max-w-3xl mx-auto card bg-base-100 shadow-xl">
                            <div className="card-body">
                                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">⚙️ Настройки курса</h2>
                                <div className="form-control w-full mb-4">
                                    <label className="label"><span className="label-text font-bold">Название курса</span></label>
                                    <input type="text" className="input input-bordered w-full text-lg" value={courseData.title} onChange={(e) => setCourseData({...courseData, title: e.target.value})} />
                                </div>
                                <div className="form-control w-full mb-6">
                                    <label className="label"><span className="label-text font-bold">Описание курса</span></label>
                                    <textarea className="textarea textarea-bordered h-40 text-base leading-relaxed" value={courseData.description} onChange={(e) => setCourseData({...courseData, description: e.target.value})}></textarea>
                                </div>
                                <div className="card-actions justify-end">
                                    <button id="save-course-btn" className="btn btn-primary px-8" onClick={handleSaveCourseSettings}>Сохранить настройки</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeLesson ? (
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
                                    <a role="tab" className={`tab ${activeTab === 'simulation' ? 'tab-active bg-accent text-white' : ''}`} onClick={() => setActiveTab('simulation')}>🎮 Симуляция</a>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button title="Переименовать урок" className="btn btn-sm btn-ghost" onClick={handleRenameLesson}>✏️</button>
                                    <button title="Удалить урок" className={`btn btn-sm btn-ghost text-red-600`} onClick={handleDeleteLesson} disabled={isDeleting}>{isDeleting ? '...' : '🗑️'}</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                            
                            {/* ВКЛАДКА 1: ТЕОРИЯ */}
                            {activeTab === 'content' && (
                                <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
                                    <div className="form-control w-full">
                                        <label className="label font-bold text-gray-500 text-xs uppercase">Видео (YouTube)</label>
                                        <input type="text" className="input input-bordered w-full bg-white" placeholder="https://youtu.be/..." value={activeLesson.video_url || ""} onChange={(e) => setActiveLesson({...activeLesson, video_url: e.target.value})} />
                                    </div>

                                    <div className="card bg-white shadow-sm border border-base-200 flex flex-col overflow-visible">
                                        <div className="p-3 border-b bg-base-50 flex justify-between items-center px-4">
                                            <span className="font-bold text-gray-500 text-xs uppercase">Конспект лекции</span>
                                            {/* ПЕРЕДАЕМ ID КНОПКИ 'save-lesson-btn' */}
                                            <button 
                                                id="save-lesson-btn" 
                                                className="btn btn-sm btn-ghost border-base-300" 
                                                onClick={() => handleSaveLesson("save-lesson-btn")}
                                            >
                                                💾 Сохранить
                                            </button>
                                        </div>
                                        <ReactQuill theme="snow" value={activeLesson.content || ""} onChange={(content) => setActiveLesson({...activeLesson, content: content})} modules={modules} formats={formats} className="h-[500px] mb-12" placeholder="Пишите теорию здесь..." />
                                    </div>
                                </div>
                            )}

                            {/* ВКЛАДКА 2: ТЕСТЫ */}
                            {activeTab === 'quiz' && (
                                <div className="max-w-5xl mx-auto animate-fade-in">
                                    <TeacherPanel preSelectedLessonId={activeLesson.id} preFilledText={activeLesson.content} />
                                </div>
                            )}

                            {/* 🔥 ВКЛАДКА 3: СИМУЛЯТОРЫ */}
                            {activeTab === 'simulation' && (
                                <div className="max-w-4xl mx-auto animate-fade-in">
                                    <div className="card bg-white shadow-lg border border-base-200">
                                        <div className="card-body">
                                            <h2 className="card-title flex items-center gap-2">
                                                🤖 Интерактивный AI Генератор
                                                <div className="badge badge-accent text-white text-xs">BETA</div>
                                            </h2>
                                            <p className="text-gray-500 text-sm mb-4">
                                                Превратите этот урок в интерактивную игру (симуляцию атаки). Нейросеть сама напишет сценарий.
                                            </p>

                                            <div className="bg-base-50 p-6 rounded-xl border border-dashed border-base-300 mb-6">
                                                <div className="form-control w-full">
                                                    <label className="label"><span className="label-text font-bold">Опишите тему атаки</span></label>
                                                    <input 
                                                        type="text" 
                                                        className="input input-bordered w-full" 
                                                        placeholder="Например: Звонок мошенника, который представляется сотрудником полиции..." 
                                                        value={aiTopic}
                                                        onChange={(e) => setAiTopic(e.target.value)}
                                                    />
                                                </div>

                                                <div className="flex gap-4 mt-4">
                                                    <button 
                                                        className={`btn flex-1 btn-success text-white ${aiLoading ? 'loading' : ''}`}
                                                        onClick={() => handleGenerateScenario('simulation_chat')}
                                                    >
                                                        💬 Создать Чат (WhatsApp)
                                                    </button>
                                                    <button 
                                                        className={`btn flex-1 btn-warning text-white ${aiLoading ? 'loading' : ''}`}
                                                        onClick={() => handleGenerateScenario('simulation_email')}
                                                    >
                                                        📧 Создать Email (Фишинг)
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ПРЕДПРОСМОТР JSON */}
                                            {activeLesson.scenario_data && (
                                                <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                                                    <input type="checkbox" /> 
                                                    <div className="collapse-title text-sm font-medium flex items-center gap-2">
                                                        ✅ Сценарий сгенерирован (JSON)
                                                        <span className="badge badge-sm badge-ghost">{activeLesson.lesson_type}</span>
                                                    </div>
                                                    <div className="collapse-content"> 
                                                        <pre className="text-xs font-mono bg-gray-800 text-green-400 p-4 rounded-lg overflow-x-auto max-h-60">
                                                            {JSON.stringify(activeLesson.scenario_data, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="card-actions justify-end mt-4">
                                                {/* ПЕРЕДАЕМ ID КНОПКИ 'save-sim-btn' */}
                                                <button 
                                                    id="save-sim-btn"
                                                    className="btn btn-primary" 
                                                    onClick={() => handleSaveLesson("save-sim-btn")}
                                                >
                                                    💾 Сохранить симуляцию
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                ) : (
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