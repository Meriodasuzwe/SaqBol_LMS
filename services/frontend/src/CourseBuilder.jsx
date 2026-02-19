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
    const [activeStep, setActiveStep] = useState(null); // НОВОЕ: Выбранный квадратик
    
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);

    // Модалки
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isStepModalOpen, setIsStepModalOpen] = useState(false); // Модалка выбора типа шага
    
    // Состояния загрузок
    const [aiTopic, setAiTopic] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

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
                    if (sorted[0].steps && sorted[0].steps.length > 0) {
                        setActiveStep(sorted[0].steps[0]);
                    }
                } else {
                    setIsSettingsMode(true);
                }

                setCourseData({ title: courseRes.data.title, description: courseRes.data.description || "" });
            } catch (err) {
                console.error("Ошибка загрузки:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [courseId]);

    // --- ЛОГИКА УРОКОВ (ПАПОК) ---
    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        try {
            const res = await api.post(`courses/${courseId}/lessons/`, {
                title: newLessonTitle,
                order: lessons.length + 1,
            });
            setLessons([...lessons, { ...res.data, steps: [] }]);
            setIsLessonModalOpen(false);
            setNewLessonTitle("");
        } catch (err) {
            alert("Ошибка создания урока");
        }
    };

    const handleDeleteLesson = async () => {
        if (!confirm(`Удалить урок "${activeLesson.title}" со всеми шагами?`)) return;
        try {
            await api.delete(`courses/lessons/${activeLesson.id}/`);
            window.location.reload(); // Простой рефреш для надежности
        } catch (err) {
            alert("Ошибка удаления урока");
        }
    };

    // --- ЛОГИКА ШАГОВ (КВАДРАТИКОВ) ---
    const handleCreateStep = async (stepType) => {
        try {
            const res = await api.post(`courses/lessons/${activeLesson.id}/steps/`, {
                title: 'Новый шаг',
                step_type: stepType,
                content: '',
                order: (activeLesson.steps?.length || 0) + 1
            });
            
            // Обновляем локальный стейт
            const updatedLessons = lessons.map(l => {
                if (l.id === activeLesson.id) {
                    const newSteps = [...(l.steps || []), res.data];
                    return { ...l, steps: newSteps };
                }
                return l;
            });
            
            setLessons(updatedLessons);
            setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id));
            setActiveStep(res.data);
            setIsStepModalOpen(false);
        } catch (err) {
            alert("Ошибка создания шага");
        }
    };

    const handleSaveStep = async (btnId = "save-step-btn") => { 
        if (!activeStep) return;
        try {
            const res = await api.patch(`courses/steps/${activeStep.id}/`, {
                title: activeStep.title,
                content: activeStep.content,
                step_type: activeStep.step_type, 
                scenario_data: activeStep.scenario_data
            });
            
            // Обновляем данные в массиве
            const updatedLessons = lessons.map(l => {
                if (l.id === activeLesson.id) {
                    return { ...l, steps: l.steps.map(s => s.id === activeStep.id ? res.data : s) };
                }
                return l;
            });
            
            setLessons(updatedLessons);
            setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id));
            setActiveStep(res.data);
            showToast(btnId);
        } catch (err) {
            alert("Ошибка сохранения шага");
        }
    };

    const handleDeleteStep = async () => {
        if (!confirm("Точно удалить этот шаг?")) return;
        try {
            await api.delete(`courses/steps/${activeStep.id}/`);
            const updatedLessons = lessons.map(l => {
                if (l.id === activeLesson.id) {
                    return { ...l, steps: l.steps.filter(s => s.id !== activeStep.id) };
                }
                return l;
            });
            setLessons(updatedLessons);
            const updLesson = updatedLessons.find(l => l.id === activeLesson.id);
            setActiveLesson(updLesson);
            setActiveStep(updLesson.steps.length > 0 ? updLesson.steps[0] : null);
        } catch (err) {
            alert("Ошибка удаления шага");
        }
    };

    // --- AI ГЕНЕРАТОР ---
    const handleGenerateScenario = async (type) => {
        if (!aiTopic) return alert("Напишите тему для генерации!");
        
        setAiLoading(true);
        
        // Достаем токен доступа из хранилища
        const token = localStorage.getItem('access'); 
        
        try {
            const response = await fetch('/ai/generate-scenario', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // НОВОЕ: Добавляем авторизацию, чтобы убрать ошибку 401
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    topic: aiTopic, 
                    scenario_type: type === 'simulation_email' ? 'email' : 'chat' 
                })
            });
            
            if (!response.ok) {
                // Если все равно ошибка, выведем статус в консоль для отладки
                const errorData = await response.json().catch(() => ({}));
                console.error("Сервер ответил ошибкой:", response.status, errorData);
                throw new Error("AI Error");
            }
            
            const data = await response.json();

            setActiveStep(prev => ({ ...prev, step_type: type, scenario_data: data }));
            alert("✨ Сценарий создан! Не забудьте нажать 'Сохранить'.");
        } catch (err) {
            console.error("Ошибка AI:", err);
            alert("Ошибка генерации AI. Возможно, сессия истекла, попробуйте перезайти в аккаунт.");
        } finally {
            setAiLoading(false);
        }
    };

    // --- УТИЛИТЫ ---
    const showToast = (btnId) => {
        const btn = document.getElementById(btnId);
        if(btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✅ Сохранено";
            btn.classList.add('btn-success', 'text-white');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('btn-success', 'text-white');
            }, 2000);
        }
    };

    const handleSaveCourseSettings = async () => {
        try {
            await api.patch(`courses/${courseId}/`, courseData);
            showToast("save-course-btn");
        } catch (err) { alert("Ошибка сохранения курса"); }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden font-sans"> 
            
            {/* === ЛЕВАЯ КОЛОНКА (САЙДБАР: УРОКИ) === */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 shadow-sm z-10">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 truncate max-w-[150px]" title={courseData.title}>
                        {courseData.title || "Курс"}
                    </h2>
                    <div className="flex gap-1">
                        <button className={`btn btn-sm btn-ghost ${isSettingsMode ? 'text-primary bg-primary/10' : ''}`} onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }}>⚙️</button>
                        <Link to={`/courses/${courseId}`} className="btn btn-sm btn-ghost" title="Предпросмотр">👁️</Link>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-3 space-y-1">
                    {lessons.map((lesson, index) => (
                        <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl cursor-pointer transition-all border ${activeLesson?.id === lesson.id && !isSettingsMode ? "bg-primary text-white border-primary shadow-md" : "hover:bg-gray-100 border-transparent text-gray-700"}`}
                            onClick={() => { setActiveLesson(lesson); setActiveStep(lesson.steps?.[0] || null); setIsSettingsMode(false); }}
                        >
                            <div className="font-medium text-sm truncate">{index + 1}. {lesson.title}</div>
                            <div className="text-[10px] mt-1 opacity-70 flex items-center gap-1">
                                🧩 Шагов: {lesson.steps?.length || 0}
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && <div className="text-center mt-10 text-gray-400 text-sm">Нет уроков</div>}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <button className="btn btn-outline border-dashed w-full" onClick={() => setIsLessonModalOpen(true)}>
                        ➕ Создать урок
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА (КОНТЕНТ ШАГА) === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative">
                
                {isSettingsMode ? (
                    /* НАСТРОЙКИ КУРСА */
                    <div className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-3xl mx-auto card bg-white shadow-sm border border-gray-200">
                            <div className="card-body">
                                <h2 className="card-title text-2xl mb-6">⚙️ Настройки курса</h2>
                                <div className="form-control w-full mb-4">
                                    <label className="label font-bold">Название курса</label>
                                    <input type="text" className="input input-bordered w-full" value={courseData.title} onChange={(e) => setCourseData({...courseData, title: e.target.value})} />
                                </div>
                                <div className="form-control w-full mb-6">
                                    <label className="label font-bold">Описание курса</label>
                                    <textarea className="textarea textarea-bordered h-40" value={courseData.description} onChange={(e) => setCourseData({...courseData, description: e.target.value})}></textarea>
                                </div>
                                <button id="save-course-btn" className="btn btn-primary" onClick={handleSaveCourseSettings}>Сохранить настройки</button>
                            </div>
                        </div>
                    </div>
                ) : activeLesson ? (
                    /* КОНСТРУКТОР ШАГОВ УРОКА */
                    <>
                        {/* Панель управления Уроком */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-10">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Редактирование урока</span>
                                <h2 className="text-xl font-black text-gray-800 mt-1">{activeLesson.title}</h2>
                            </div>
                            <button onClick={handleDeleteLesson} className="btn btn-sm btn-error btn-outline">Удалить урок</button>
                        </div>

                        {/* Панель Шагов (Квадратики) */}
                        <div className="bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center gap-3 overflow-x-auto shadow-inner">
                            <span className="text-sm font-semibold text-gray-500 mr-2">Шаги:</span>
                            {activeLesson.steps?.map((step, index) => {
                                let icon = "📝";
                                if (step.step_type === 'video_url') icon = "▶️";
                                if (step.step_type.includes('simulation')) icon = "🛡️";
                                if (step.step_type === 'quiz') icon = "❓";

                                return (
                                    <button 
                                        key={step.id}
                                        onClick={() => setActiveStep(step)}
                                        className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-lg font-medium transition-all duration-200 border-b-4
                                            ${activeStep?.id === step.id ? 'bg-white border-primary text-primary shadow-sm scale-110' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                        title={step.title}
                                    >
                                        <span className="text-lg">{icon}</span>
                                    </button>
                                );
                            })}
                            <button onClick={() => setIsStepModalOpen(true)} className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-transparent border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary hover:text-primary transition-colors">
                                ➕
                            </button>
                        </div>

                        {/* Редактор Конкретного Шага */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 lg:p-8">
                            {activeStep ? (
                                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
                                    
                                    {/* Шапка шага */}
                                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                        <div className="flex-1 mr-4">
                                            <label className="text-xs font-bold text-gray-400 uppercase">Заголовок шага (необязательно)</label>
                                            <input type="text" className="input input-ghost w-full text-lg font-bold px-0 focus:bg-transparent" value={activeStep.title || ""} onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} placeholder="Например: Введение в социальную инженерию" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button id="save-step-btn" className="btn btn-success text-white shadow-sm" onClick={() => handleSaveStep("save-step-btn")}>💾 Сохранить шаг</button>
                                            <button className="btn btn-square btn-outline btn-error" onClick={handleDeleteStep} title="Удалить шаг">🗑️</button>
                                        </div>
                                    </div>

                                    {/* РЕДАКТОР В ЗАВИСИМОСТИ ОТ ТИПА */}
                                    
                                    {/* 1. ТЕКСТ или ВИДЕО */}
                                    {(activeStep.step_type === 'text' || activeStep.step_type === 'video_url') && (
                                        <div className="card bg-white shadow-sm border border-gray-200 overflow-visible">
                                            {activeStep.step_type === 'video_url' && (
                                                <div className="p-4 border-b border-gray-100 bg-blue-50/50">
                                                    <label className="label font-bold text-blue-800">Ссылка на YouTube видео</label>
                                                    <input type="text" className="input input-bordered w-full border-blue-200" placeholder="https://youtu.be/..." value={activeStep.content || ""} onChange={(e) => setActiveStep({...activeStep, content: e.target.value})} />
                                                </div>
                                            )}
                                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                                <span className="font-bold text-gray-600">{activeStep.step_type === 'text' ? 'Текст лекции' : 'Описание под видео'}</span>
                                            </div>
                                            <ReactQuill theme="snow" value={activeStep.content || ""} onChange={(content) => setActiveStep({...activeStep, content: content})} modules={modules} className="h-[400px] mb-12" />
                                        </div>
                                    )}

                                    {/* 2. ТЕСТ (КВИЗ) */}
                                    {activeStep.step_type === 'quiz' && (
                                        <div className="card bg-white shadow-sm border border-gray-200">
                                            <div className="card-body">
                                                <div className="alert alert-info bg-blue-50 text-blue-800 border-none mb-4">
                                                    💡 Создайте вопросы для теста. Студент не сможет перейти к следующему уроку, пока не наберет 70% правильных ответов.
                                                </div>
                                                <TeacherPanel preSelectedLessonId={activeLesson.id} preFilledText="" />
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. AI СИМУЛЯЦИЯ */}
                                    {(activeStep.step_type.includes('simulation')) && (
                                        <div className="card bg-white shadow-sm border border-purple-200">
                                            <div className="card-body">
                                                <h2 className="card-title text-purple-700">🤖 Настройка AI Симуляции</h2>
                                                <p className="text-gray-500 text-sm mb-4">Опишите сценарий атаки, и нейросеть сгенерирует интерактивный тренажер для студента.</p>

                                                <div className="form-control w-full mb-4">
                                                    <input type="text" className="input input-bordered border-purple-300 w-full" placeholder="Тема атаки. Например: Фишинговое письмо от 'налоговой' с требованием оплатить штраф..." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
                                                </div>

                                                <button className={`btn bg-purple-600 hover:bg-purple-700 text-white border-none w-full ${aiLoading ? 'loading' : ''}`} onClick={() => handleGenerateScenario(activeStep.step_type)}>
                                                    Сгенерировать сценарий
                                                </button>

                                                {activeStep.scenario_data && (
                                                    <div className="mt-6 p-4 bg-gray-900 rounded-xl">
                                                        <div className="text-green-400 text-xs mb-2 font-mono">✅ JSON Сценарий готов:</div>
                                                        <pre className="text-[10px] font-mono text-gray-300 overflow-x-auto max-h-48">{JSON.stringify(activeStep.scenario_data, null, 2)}</pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <div className="text-6xl mb-4">👆</div>
                                    <h3 className="text-xl font-bold">Выберите шаг или создайте новый</h3>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">Выберите урок слева</div>
                )}
            </div>

            {/* МОДАЛКА: СОЗДАНИЕ УРОКА */}
            {isLessonModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">📁 Новый урок (Раздел)</h3>
                        <input type="text" className="input input-bordered w-full" autoFocus placeholder="Название раздела" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} />
                        <div className="modal-action">
                            <button className="btn" onClick={() => setIsLessonModalOpen(false)}>Отмена</button>
                            <button className="btn btn-primary" onClick={handleCreateLesson}>Создать</button>
                        </div>
                    </div>
                </dialog>
            )}

            {/* МОДАЛКА: ВЫБОР ТИПА ШАГА */}
            {isStepModalOpen && (
                <dialog className="modal modal-open bg-black/40 backdrop-blur-sm">
                    <div className="modal-box max-w-2xl bg-white">
                        <h3 className="font-black text-2xl mb-2 text-center text-gray-800">Что добавим в урок?</h3>
                        <p className="text-center text-gray-500 mb-8">Выберите формат обучающего материала</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {/* ТЕКСТ */}
                            <button onClick={() => handleCreateStep('text')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group text-left">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">📝</span>
                                <span className="font-bold text-gray-800">Текстовая теория</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Статьи, инструкции, картинки</span>
                            </button>
                            
                            {/* ВИДЕО */}
                            <button onClick={() => handleCreateStep('video_url')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-error hover:bg-error/5 transition-all group">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">▶️</span>
                                <span className="font-bold text-gray-800">Видеоролик</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Вставка из YouTube</span>
                            </button>

                            {/* ТЕСТ */}
                            <button onClick={() => handleCreateStep('quiz')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-success hover:bg-success/5 transition-all group">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">❓</span>
                                <span className="font-bold text-gray-800">Тестирование</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Проверка знаний с AI генерацией</span>
                            </button>

                            {/* СИМУЛЯЦИЯ */}
                            <button onClick={() => handleCreateStep('simulation_chat')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all group relative overflow-hidden">
                                <div className="absolute top-2 right-2 badge badge-accent text-white text-[10px]">AI</div>
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">🛡️</span>
                                <span className="font-bold text-gray-800">Симуляция атаки</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Тренажеры фишинга и СИ</span>
                            </button>
                        </div>
                        
                        <div className="modal-action mt-8">
                            <button className="btn btn-ghost w-full" onClick={() => setIsStepModalOpen(false)}>Отмена</button>
                        </div>
                    </div>
                </dialog>
            )}
        </div>
    );
}

export default CourseBuilder;