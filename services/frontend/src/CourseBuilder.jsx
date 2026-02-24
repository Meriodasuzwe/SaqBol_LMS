import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactQuill from 'react-quill-new'; 
import 'react-quill-new/dist/quill.snow.css';
import api from './api';
import aiApi from './aiApi'; 
import { toast } from 'react-toastify'; 

function CourseBuilder() {
    const { courseId } = useParams();
    
    // --- СОСТОЯНИЯ ---
    const [lessons, setLessons] = useState([]);
    const [courseData, setCourseData] = useState({ title: '', description: '' }); 
    
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeStep, setActiveStep] = useState(null); 
    
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);

    // Модалки
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isStepModalOpen, setIsStepModalOpen] = useState(false); 
    
    // Кастомное диалоговое окно 
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Да", isDanger: false
    });
    const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // Состояния AI Симуляций
    const [aiTopic, setAiTopic] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // 🔥 Состояния AI Тестов (Квизов)
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [currentQuizId, setCurrentQuizId] = useState(null); 
    const [quizPrompt, setQuizPrompt] = useState("");
    const [quizDifficulty, setQuizDifficulty] = useState("medium");
    const [quizCount, setQuizCount] = useState(3);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

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

    // --- ЗАГРУЗКА ДАННЫХ КУРСА ---
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

    // 🔥 ЗАГРУЗКА ВОПРОСОВ ДЛЯ ВЫБРАННОГО ТЕСТА
    useEffect(() => {
        if (activeStep?.step_type === 'quiz' && activeLesson) {
            fetchQuizForLesson(activeLesson.id);
        } else {
            setQuizQuestions(null);
            setCurrentQuizId(null);
        }
    }, [activeStep, activeLesson]);

    const fetchQuizForLesson = async (lessonId) => {
        try {
            const res = await api.get(`quizzes/lesson/${lessonId}/`);
            let data = res.data;
            if (!Array.isArray(data)) data = data.results ? data.results : [data];
            
            if (data.length > 0) {
                const quiz = data[0];
                setCurrentQuizId(quiz.id); 

                if (quiz.questions && quiz.questions.length > 0) {
                    const mapped = quiz.questions.map(q => ({
                        id: q.id, 
                        question: q.text || q.question,
                        options: q.options || ["", "", "", ""],
                        correct_answer: q.correct_answer || "",
                        user_selected_index: q.options?.indexOf(q.correct_answer) !== -1 ? q.options.indexOf(q.correct_answer) : 0,
                        ai_suggested_index: -1 
                    }));
                    setQuizQuestions(mapped);
                } else {
                    setQuizQuestions([]);
                }
            } else {
                setCurrentQuizId(null);
                setQuizQuestions([]);
            }
        } catch (err) {
            setCurrentQuizId(null);
            setQuizQuestions([]);
        }
    };


    // --- ЛОГИКА УРОКОВ (ПАПОК) ---
    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        try {
            const res = await api.post(`courses/${courseId}/lessons/`, {
                title: newLessonTitle,
                order: lessons.length + 1,
                course: parseInt(courseId) // 🔥 ИСПРАВЛЕНИЕ: ДОБАВИЛИ ID КУРСА СЮДА!
            });
            setLessons([...lessons, { ...res.data, steps: [] }]);
            setIsLessonModalOpen(false);
            setNewLessonTitle("");
            toast.success("Урок успешно создан!");
        } catch (err) {
            console.error("Ошибка при создании урока:", err.response?.data);
            toast.error("Ошибка создания урока");
        }
    };

    const handleDeleteLesson = async () => {
        setConfirmDialog({
            isOpen: true,
            title: "Удаление раздела",
            message: `Вы уверены, что хотите удалить весь раздел "${activeLesson.title}" со всеми его шагами?`,
            confirmText: "Да, удалить",
            isDanger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`courses/lessons/${activeLesson.id}/`);
                    window.location.reload(); 
                } catch (err) {
                    toast.error("Ошибка удаления урока");
                }
            }
        });
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
            toast.error("Ошибка создания шага");
        }
    };

    const handleDeleteStep = async () => {
        setConfirmDialog({
            isOpen: true,
            title: "Удаление шага",
            message: "Вы уверены, что хотите безвозвратно удалить этот шаг?",
            confirmText: "Удалить",
            isDanger: true,
            onConfirm: async () => {
                closeDialog();
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
                    toast.error("Ошибка удаления шага");
                }
            }
        });
    };

    // 🔥 ФУНКЦИИ РЕДАКТОРА ТЕСТОВ 🔥
    const handlePreGenerateQuiz = () => {
        if (!quizPrompt.trim()) return toast.warning("Введите текст лекции для генерации вопросов.");
        
        if (quizQuestions && quizQuestions.length > 0) {
            setConfirmDialog({
                isOpen: true,
                title: "Перезапись вопросов",
                message: `В этом тесте уже есть вопросы (${quizQuestions.length} шт). Если вы сгенерируете новые, старые будут удалены с экрана. Продолжить?`,
                confirmText: "Да, сгенерировать новые",
                isDanger: true,
                onConfirm: () => {
                    closeDialog();
                    executeQuizGeneration();
                }
            });
        } else {
            executeQuizGeneration();
        }
    };

    const executeQuizGeneration = async () => {
        setIsGeneratingQuiz(true);
        try {
            const res = await aiApi.post('generate-quiz', {
                text: quizPrompt,
                count: Number(quizCount),
                difficulty: quizDifficulty
            });
            const questions = res.data.generated_questions || res.data;
            const normalized = Array.isArray(questions) ? questions.map(q => {
                const questionText = (q.question || q.text || q.prompt || q.title || '').trim();
                let rawOptions = q.options || q.choices || q.answers || q.variants || q.options_list || [];
                if (typeof rawOptions === 'string') rawOptions = rawOptions.split(/\r?\n|\||;|,|•|\-|\u2022/).map(s => s.trim()).filter(Boolean);
                let options = Array.isArray(rawOptions) ? rawOptions.map(o => String(o.text || o).trim()).filter(Boolean) : [];

                let correct = (q.correct_answer || q.correctAnswer || q.correct || '').toString().trim();
                if (correct && /^\d+$/.test(correct) && options.length > 0) {
                    const idx = parseInt(correct, 10);
                    if (idx >= 0 && idx < options.length) correct = options[idx];
                }
                if (options.length < 2) {
                    options = [correct || "Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"];
                }
                let aiSuggestedIndex = options.indexOf(correct);
                if (aiSuggestedIndex === -1) { aiSuggestedIndex = 0; correct = options[0]; }
                
                return { 
                    id: null, 
                    question: questionText, 
                    options, 
                    correct_answer: correct, 
                    user_selected_index: aiSuggestedIndex,
                    ai_suggested_index: aiSuggestedIndex 
                };
            }) : [];
            
            setQuizQuestions(normalized);
            toast.success('✨ Тест успешно сгенерирован! Проверьте и сохраните шаг.');
        } catch (err) {
            toast.error("Не удалось сгенерировать тест. Попробуйте изменить текст.");
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleQuestionChange = (index, field, value) => {
        const updated = [...quizQuestions];
        updated[index][field] = value;
        setQuizQuestions(updated);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...quizQuestions];
        updated[qIndex].options[oIndex] = value;
        if (updated[qIndex].user_selected_index === oIndex) {
            updated[qIndex].correct_answer = value;
        }
        setQuizQuestions(updated);
    };

    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...quizQuestions];
        updated[qIndex].user_selected_index = oIndex;
        updated[qIndex].correct_answer = updated[qIndex].options[oIndex] || '';
        setQuizQuestions(updated);
    };

    const handleAddManualQuestion = () => {
        const newQuestion = { id: null, question: "Новый вопрос", options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], correct_answer: "Вариант 1", user_selected_index: 0, ai_suggested_index: -1 };
        setQuizQuestions(quizQuestions ? [...quizQuestions, newQuestion] : [newQuestion]);
    };

    const handleDeleteQuestion = (index) => {
        const updated = quizQuestions.filter((_, i) => i !== index);
        setQuizQuestions(updated);
    };

    // --- AI СИМУЛЯЦИЯ ---
        const handleGenerateScenario = async (type) => {
    if (!aiTopic) return toast.warning("Напишите тему для генерации!");
    setAiLoading(true);

    try {
        const res = await aiApi.post('generate-scenario', {
        topic: aiTopic,
        scenario_type: type === 'simulation_email' ? 'email' : 'chat',
        difficulty: 'medium',
        });

        setActiveStep(prev => ({
        ...prev,
        step_type: type,
        scenario_data: res.data
        }));

        toast.success("✨ Сценарий создан! Не забудьте нажать 'Сохранить'.");
    } catch (err) {
        toast.error("Ошибка генерации AI. Попробуйте перезайти в аккаунт.");
    } finally {
        setAiLoading(false);
    }
    };  

    // --- ЕДИНАЯ ФУНКЦИЯ СОХРАНЕНИЯ ШАГА ---
    const handleSaveStep = async (btnId = "save-step-btn") => { 
        if (!activeStep) return;
        try {
            const res = await api.patch(`courses/steps/${activeStep.id}/`, {
                title: activeStep.title,
                content: activeStep.content,
                step_type: activeStep.step_type, 
                scenario_data: activeStep.scenario_data
            });
            
            if (activeStep.step_type === 'quiz' && quizQuestions) {
                const payloadQuestions = quizQuestions.map(q => {
                    const options = q.options.map(s => String(s || '').trim()).filter(Boolean);
                    let userIndex = q.user_selected_index ?? 0;
                    if (userIndex >= options.length) userIndex = 0;
                    
                    const mappedQ = { 
                        question: String(q.question), 
                        options, 
                        correct_answer: String(userIndex), 
                        correct_index: userIndex, 
                        explanation: "" 
                    };
                    
                    if (q.id) mappedQ.id = q.id; 
                    return mappedQ;
                });
                
                const payload = {
                    lesson_id: Number(activeLesson.id),
                    quiz_title: activeStep.title || `Тест к уроку: ${activeLesson.title}`,
                    questions: payloadQuestions
                };

                if (currentQuizId) {
                    payload.quiz_id = currentQuizId;
                }
                
                await api.post(`quizzes/save-generated/`, payload);
            }
            
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
            toast.error("Ошибка сохранения шага");
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
        } catch (err) { toast.error("Ошибка сохранения курса"); }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden font-sans relative"> 
            
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
                                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-0 z-20">
                                        <div className="flex-1 mr-4">
                                            <label className="text-xs font-bold text-gray-400 uppercase">Заголовок шага</label>
                                            <input type="text" className="input input-ghost w-full text-lg font-bold px-0 focus:bg-transparent" value={activeStep.title || ""} onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} placeholder="Без названия" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button id="save-step-btn" className="btn btn-success text-white shadow-sm" onClick={() => handleSaveStep("save-step-btn")}>💾 Сохранить шаг</button>
                                            <button className="btn btn-square btn-outline btn-error" onClick={handleDeleteStep} title="Удалить шаг">🗑️</button>
                                        </div>
                                    </div>

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

                                    {/* 🔥 2. НАСТИВНЫЙ РЕДАКТОР ТЕСТОВ (С КРАСИВЫМ ДИЗАЙНОМ) 🔥 */}
                                    {activeStep.step_type === 'quiz' && (
                                        <div className="space-y-6">
                                            
                                            <div className="card bg-white shadow-sm border border-gray-200 p-6">
                                                <h3 className="font-bold text-lg mb-2 text-gray-800 flex items-center gap-2">🤖 ИИ-Генератор вопросов</h3>
                                                <p className="text-sm text-gray-500 mb-4">Вставьте текст лекции, и нейросеть создаст проверочный тест.</p>
                                                <textarea className="textarea textarea-bordered w-full h-24 mb-4 bg-gray-50 focus:bg-white resize-none" placeholder="Вставьте текст лекции сюда..." value={quizPrompt} onChange={e => setQuizPrompt(e.target.value)}></textarea>
                                                
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="label pt-0 text-xs font-bold text-gray-500">Вопросов</label>
                                                        <input type="number" min="1" max="10" className="input input-bordered w-full input-sm bg-gray-50" value={quizCount} onChange={e => setQuizCount(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="label pt-0 text-xs font-bold text-gray-500">Сложность</label>
                                                        <select className="select select-bordered w-full select-sm bg-gray-50" value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}>
                                                            <option value="easy">Лёгкая</option>
                                                            <option value="medium">Средняя</option>
                                                            <option value="hard">Сложная</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {/* Кнопка с защитой от перезаписи */}
                                                <button className={`btn btn-primary w-full shadow-sm text-white ${isGeneratingQuiz ? 'loading' : ''}`} onClick={handlePreGenerateQuiz} disabled={isGeneratingQuiz}>Сгенерировать тест</button>
                                            </div>

                                            {/* Список вопросов */}
                                            {quizQuestions !== null && (
                                                <div className="space-y-6 animate-fade-in">
                                                    <div className="flex justify-between items-center px-2">
                                                        <h3 className="font-bold text-xl text-gray-800">Список вопросов ({quizQuestions.length})</h3>
                                                        <button className="btn btn-sm btn-outline border-gray-300 text-gray-600" onClick={handleAddManualQuestion}>+ Вопрос вручную</button>
                                                    </div>
                                                    
                                                    {quizQuestions.length === 0 ? (
                                                        <div className="text-center text-gray-400 py-10 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
                                                            Вопросов пока нет. Сгенерируйте их или добавьте вручную.
                                                        </div>
                                                    ) : (
                                                        quizQuestions.map((q, qIndex) => (
                                                            <div key={qIndex} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative group">
                                                                <button className="btn btn-circle btn-sm btn-ghost text-red-500 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteQuestion(qIndex)} title="Удалить вопрос">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                </button>
                                                                <div className="form-control mb-6">
                                                                    <label className="label pt-0 text-[11px] font-bold uppercase tracking-wider text-gray-400">Вопрос {qIndex + 1}</label>
                                                                    <input type="text" className="input input-bordered font-bold text-lg w-full bg-gray-50 focus:bg-white" value={q.question} onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)} />
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {q.options.map((opt, oIndex) => {
                                                                        const isUserSelected = (typeof q.user_selected_index === 'number') && q.user_selected_index === oIndex;
                                                                        const isAiSuggested = (typeof q.ai_suggested_index === 'number') && q.ai_suggested_index === oIndex;
                                                                        return (
                                                                            <div key={oIndex} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isUserSelected ? 'bg-primary/5 border-primary' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                                                <input type="radio" name={`q-${qIndex}`} className="radio radio-primary radio-sm" checked={isUserSelected} onChange={() => handleCorrectSelect(qIndex, oIndex)} />
                                                                                <input type="text" className={`input input-sm w-full bg-transparent border-none px-0 focus:outline-none ${isUserSelected ? 'font-semibold text-primary' : 'text-gray-700'}`} value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Вариант ${oIndex + 1}`} />
                                                                                {isAiSuggested && !isUserSelected && <span className="badge badge-sm bg-gray-100 text-gray-400 border-none ml-2" title="AI считает этот ответ правильным">AI</span>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. AI СИМУЛЯЦИЯ */}
                                    {(activeStep.step_type.includes('simulation')) && (
                                        <div className="card bg-white shadow-sm border border-purple-200">
                                            <div className="card-body">
                                                <h2 className="card-title text-purple-700">🤖 Настройка AI Симуляции</h2>
                                                <p className="text-gray-500 text-sm mb-4">Опишите сценарий атаки, и нейросеть сгенерирует интерактивный тренажер для студента.</p>

                                                <div className="form-control w-full mb-4">
                                                    <input type="text" className="input input-bordered border-purple-300 w-full" placeholder="Тема атаки. Например: Фишинговое письмо от 'налоговой'..." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
                                                </div>

                                                <button className={`btn bg-purple-600 hover:bg-purple-700 text-white border-none w-full shadow-sm ${aiLoading ? 'loading' : ''}`} onClick={() => handleGenerateScenario(activeStep.step_type)}>
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

            {/* МОДАЛКИ */}
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

            {isStepModalOpen && (
                <dialog className="modal modal-open bg-black/40 backdrop-blur-sm">
                    <div className="modal-box max-w-2xl bg-white">
                        <h3 className="font-black text-2xl mb-2 text-center text-gray-800">Что добавим в урок?</h3>
                        <p className="text-center text-gray-500 mb-8">Выберите формат обучающего материала</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleCreateStep('text')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group text-left">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">📝</span>
                                <span className="font-bold text-gray-800">Текстовая теория</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Статьи, инструкции, картинки</span>
                            </button>
                            
                            <button onClick={() => handleCreateStep('video_url')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-error hover:bg-error/5 transition-all group">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">▶️</span>
                                <span className="font-bold text-gray-800">Видеоролик</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Вставка из YouTube</span>
                            </button>

                            <button onClick={() => handleCreateStep('quiz')} className="flex flex-col items-center p-6 border-2 border-gray-100 rounded-2xl hover:border-success hover:bg-success/5 transition-all group">
                                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">❓</span>
                                <span className="font-bold text-gray-800">Тестирование</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Проверка знаний с AI генерацией</span>
                            </button>

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

            {/* 🔥 КАСТОМНОЕ МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ 🔥 */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${confirmDialog.isDanger ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                                {confirmDialog.isDanger ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">{confirmDialog.title}</h3>
                        </div>
                        <p className="text-gray-600 mb-8 pl-13">{confirmDialog.message}</p>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-ghost text-gray-600 hover:bg-gray-100" onClick={closeDialog}>
                                Отмена
                            </button>
                            <button 
                                className={`btn text-white shadow-sm border-none ${confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-primary hover:bg-primary-focus shadow-primary/30'}`} 
                                onClick={confirmDialog.onConfirm}
                            >
                                {confirmDialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CourseBuilder;