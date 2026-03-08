import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; 
import api from '../api';
import aiApi from '../aiApi'; 
import { toast } from 'react-toastify'; 
import CourseSettingsTab from './components/CourseSettingsTab';
import StepEditor from './components/StepEditor';

function CourseBuilder() {
    const { courseId } = useParams();
    
    // --- СОСТОЯНИЯ ---
    const [lessons, setLessons] = useState([]);
    const [courseData, setCourseData] = useState({ title: '', description: '', price: 0 }); 
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeStep, setActiveStep] = useState(null); 
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);

    // Модалки
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isStepModalOpen, setIsStepModalOpen] = useState(false); 
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Да", isDanger: false });
    const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // AI Симуляции
    const [aiTopic, setAiTopic] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Тесты
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [currentQuizId, setCurrentQuizId] = useState(null); 
    const [quizPrompt, setQuizPrompt] = useState("");
    const [quizDifficulty, setQuizDifficulty] = useState("medium");
    const [quizCount, setQuizCount] = useState(3);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

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
                    if (sorted[0].steps && sorted[0].steps.length > 0) setActiveStep(sorted[0].steps[0]);
                } else {
                    setIsSettingsMode(true);
                }

                setCourseData({ 
                    title: courseRes.data.title, 
                    description: courseRes.data.description || "",
                    price: courseRes.data.price || 0 
                });
            } catch (err) {
                console.error("Ошибка загрузки:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [courseId]);

    // Загрузка квиза при смене шага
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
                        id: q.id, question: q.text || q.question, options: q.options || ["", "", "", ""],
                        correct_answer: q.correct_answer || "",
                        user_selected_index: q.options?.indexOf(q.correct_answer) !== -1 ? q.options.indexOf(q.correct_answer) : 0,
                        ai_suggested_index: -1 
                    }));
                    setQuizQuestions(mapped);
                } else setQuizQuestions([]);
            } else { setCurrentQuizId(null); setQuizQuestions([]); }
        } catch (err) { setCurrentQuizId(null); setQuizQuestions([]); }
    };

    // --- ЛОГИКА СОХРАНЕНИЯ / УДАЛЕНИЯ ---
    const handleSaveCourseSettings = async () => {
        setLoading(true);
        try {
            await api.patch(`courses/${courseId}/`, courseData);
            toast.success("Настройки курса успешно сохранены!");
        } catch (err) { toast.error("Ошибка сохранения курса"); } finally { setLoading(false); }
    };

    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        try {
            const res = await api.post(`courses/${courseId}/lessons/`, { title: newLessonTitle, order: lessons.length + 1, course: parseInt(courseId) });
            setLessons([...lessons, { ...res.data, steps: [] }]);
            setIsLessonModalOpen(false); setNewLessonTitle(""); toast.success("Раздел успешно создан");
        } catch (err) { toast.error("Ошибка создания раздела"); }
    };

    const handleDeleteLesson = async () => {
        setConfirmDialog({
            isOpen: true, title: "Удаление раздела",
            message: `Вы уверены, что хотите удалить раздел "${activeLesson.title}" со всеми его шагами? Это действие необратимо.`,
            confirmText: "Удалить", isDanger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`courses/lessons/${activeLesson.id}/`);
                    window.location.reload(); 
                } catch (err) { toast.error("Ошибка удаления урока"); }
            }
        });
    };

    const handleCreateStep = async (stepType) => {
        try {
            const res = await api.post(`courses/lessons/${activeLesson.id}/steps/`, { title: 'Новый шаг', step_type: stepType, content: '', order: (activeLesson.steps?.length || 0) + 1 });
            const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: [...(l.steps || []), res.data] } : l);
            setLessons(updatedLessons); setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id)); setActiveStep(res.data); setIsStepModalOpen(false);
        } catch (err) { toast.error("Ошибка создания шага"); }
    };

    const handleDeleteStep = async () => {
        setConfirmDialog({
            isOpen: true, title: "Удаление шага", message: "Вы уверены, что хотите безвозвратно удалить этот шаг?",
            confirmText: "Удалить", isDanger: true,
            onConfirm: async () => {
                closeDialog();
                try {
                    await api.delete(`courses/steps/${activeStep.id}/`);
                    const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: l.steps.filter(s => s.id !== activeStep.id) } : l);
                    setLessons(updatedLessons);
                    const updLesson = updatedLessons.find(l => l.id === activeLesson.id);
                    setActiveLesson(updLesson); setActiveStep(updLesson.steps.length > 0 ? updLesson.steps[0] : null);
                } catch (err) { toast.error("Ошибка удаления шага"); }
            }
        });
    };

    const handleSaveStep = async () => { 
        if (!activeStep) return;
        setLoading(true);
        try {
            const res = await api.patch(`courses/steps/${activeStep.id}/`, { title: activeStep.title, content: activeStep.content, step_type: activeStep.step_type, scenario_data: activeStep.scenario_data });
            if (activeStep.step_type === 'quiz' && quizQuestions) {
                const payloadQuestions = quizQuestions.map(q => {
                    const options = q.options.map(s => String(s || '').trim()).filter(Boolean);
                    let userIndex = q.user_selected_index ?? 0;
                    if (userIndex >= options.length) userIndex = 0;
                    const mappedQ = { question: String(q.question), options, correct_answer: String(userIndex), correct_index: userIndex, explanation: "" };
                    if (q.id) mappedQ.id = q.id; 
                    return mappedQ;
                });
                const payload = { lesson_id: Number(activeLesson.id), quiz_title: activeStep.title || `Тест к уроку: ${activeLesson.title}`, questions: payloadQuestions };
                if (currentQuizId) payload.quiz_id = currentQuizId;
                await api.post(`quizzes/save-generated/`, payload);
            }
            const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: l.steps.map(s => s.id === activeStep.id ? res.data : s) } : l);
            setLessons(updatedLessons); setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id)); setActiveStep(res.data);
            toast.success("Шаг сохранен");
        } catch (err) { toast.error("Ошибка сохранения"); } finally { setLoading(false); }
    };

    // --- ЛОГИКА ГЕНЕРАЦИИ (КВИЗЫ И СИМУЛЯЦИИ) ---
    const handlePreGenerateQuiz = () => {
        if (!quizPrompt.trim()) return toast.warning("Введите текст лекции для генерации вопросов.");
        if (quizQuestions && quizQuestions.length > 0) {
            setConfirmDialog({
                isOpen: true, title: "Перезапись вопросов",
                message: `В этом тесте уже есть вопросы (${quizQuestions.length} шт). При генерации новых, старые будут удалены. Продолжить?`,
                confirmText: "Сгенерировать новые", isDanger: true,
                onConfirm: () => { closeDialog(); executeQuizGeneration(); }
            });
        } else executeQuizGeneration();
    };

    const executeQuizGeneration = async () => {
        setIsGeneratingQuiz(true);
        try {
            const res = await aiApi.post('generate-quiz', { text: quizPrompt, count: Number(quizCount), difficulty: quizDifficulty });
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
                if (options.length < 2) options = [correct || "Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"];
                let aiSuggestedIndex = options.indexOf(correct);
                if (aiSuggestedIndex === -1) { aiSuggestedIndex = 0; correct = options[0]; }
                return { id: null, question: questionText, options, correct_answer: correct, user_selected_index: aiSuggestedIndex, ai_suggested_index: aiSuggestedIndex };
            }) : [];
            setQuizQuestions(normalized); toast.success('Тест успешно сгенерирован');
        } catch (err) { toast.error("Не удалось сгенерировать тест."); } finally { setIsGeneratingQuiz(false); }
    };

    const handleQuestionChange = (index, field, value) => { const updated = [...quizQuestions]; updated[index][field] = value; setQuizQuestions(updated); };
    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...quizQuestions]; updated[qIndex].options[oIndex] = value;
        if (updated[qIndex].user_selected_index === oIndex) updated[qIndex].correct_answer = value;
        setQuizQuestions(updated);
    };
    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...quizQuestions]; updated[qIndex].user_selected_index = oIndex; updated[qIndex].correct_answer = updated[qIndex].options[oIndex] || '';
        setQuizQuestions(updated);
    };
    const handleAddManualQuestion = () => {
        const newQuestion = { id: null, question: "Новый вопрос", options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], correct_answer: "Вариант 1", user_selected_index: 0, ai_suggested_index: -1 };
        setQuizQuestions(quizQuestions ? [...quizQuestions, newQuestion] : [newQuestion]);
    };
    const handleDeleteQuestion = (index) => { const updated = quizQuestions.filter((_, i) => i !== index); setQuizQuestions(updated); };

    const handleGenerateScenario = async (type) => {
        if (!aiTopic) return toast.warning("Опишите сценарий!");
        setAiLoading(true);
        try {
            const res = await aiApi.post('generate-scenario', { topic: aiTopic, scenario_type: type === 'simulation_email' ? 'email' : 'chat', difficulty: 'medium' });
            setActiveStep(prev => ({ ...prev, step_type: type, scenario_data: res.data }));
            toast.success("Сценарий создан");
        } catch (err) { toast.error("Ошибка генерации симуляции"); } finally { setAiLoading(false); }
    };  

    if (loading && lessons.length === 0) {
        return <div className="flex min-h-[50vh] items-center justify-center"><span className="loading loading-spinner text-primary"></span></div>;
    }

    return (
        <div className="flex h-[calc(100vh-64px)] max-w-7xl mx-auto text-base-content animate-fade-in"> 
            
            {/* === ЛЕВАЯ КОЛОНКА (САЙДБАР) === */}
            <div className="w-80 bg-base-100 border-r border-base-200 flex flex-col h-full shrink-0 shadow-sm z-20">
                <div className="px-6 py-5 border-b border-base-200 flex justify-between items-center bg-base-50/50">
                    <h2 className="font-bold text-base-content truncate pr-4 text-lg" title={courseData.title}>
                        {courseData.title || "Конструктор курса"}
                    </h2>
                    <div className="flex gap-2 shrink-0">
                        <button 
                            className={`btn btn-sm btn-ghost btn-square ${isSettingsMode ? 'bg-primary/10 text-primary' : 'text-base-content/60'}`} 
                            onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }} 
                            title="Настройки курса"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        <RouterLink to={`/courses/${courseId}`} className="btn btn-sm btn-ghost btn-square text-base-content/60 hover:text-primary" title="Предпросмотр курса">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </RouterLink>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-4 space-y-2 bg-base-200/30">
                    <div className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-2 pl-2">Программа курса</div>
                    {lessons.map((lesson, index) => (
                        <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl cursor-pointer transition-colors border ${activeLesson?.id === lesson.id && !isSettingsMode ? "bg-primary/10 border-primary/20 text-primary shadow-sm" : "bg-base-100 border-base-200 text-base-content hover:border-base-300"}`}
                            onClick={() => { setActiveLesson(lesson); setActiveStep(lesson.steps?.[0] || null); setIsSettingsMode(false); }}
                        >
                            <div className="font-semibold text-sm truncate flex items-center gap-2">
                                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[11px] ${activeLesson?.id === lesson.id && !isSettingsMode ? 'bg-primary/20 text-primary' : 'bg-base-200 text-base-content/50'}`}>{index + 1}</span>
                                {lesson.title}
                            </div>
                            <div className={`text-xs mt-2 font-medium flex items-center gap-1 ${activeLesson?.id === lesson.id && !isSettingsMode ? 'text-primary/70' : 'text-base-content/40'}`}>
                                Шагов внутри: {lesson.steps?.length || 0}
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && <div className="text-center mt-10 text-base-content/40 text-sm font-medium">Разделов пока нет</div>}
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50">
                    <button className="btn btn-outline border-base-300 w-full text-base-content/70 hover:bg-base-200 hover:border-base-300" onClick={() => setIsLessonModalOpen(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Добавить раздел
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-base-100 relative border-r border-base-200">
                
                {isSettingsMode ? (
                    <CourseSettingsTab 
                        courseData={courseData} 
                        setCourseData={setCourseData} 
                        onSave={handleSaveCourseSettings} 
                        loading={loading} 
                    />
                ) : activeLesson ? (
                    <>
                        <div className="bg-base-100 border-b border-base-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
                            <div className="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
                                <span className="text-sm font-semibold text-base-content/60 mr-2 shrink-0">Шаги:</span>
                                <div className="flex gap-2">
                                    {activeLesson.steps?.map((step, index) => {
                                        let icon = "📝";
                                        if (step.step_type === 'video_url') icon = "▶️";
                                        if (step.step_type.includes('simulation')) icon = "🛡️";
                                        if (step.step_type === 'quiz') icon = "❓";
                                        if (step.step_type === 'interactive_code') icon = "💻";

                                        const isActive = activeStep?.id === step.id;

                                        return (
                                            <button 
                                                key={step.id}
                                                onClick={() => setActiveStep(step)}
                                                className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-xl text-2xl transition-all border-2 
                                                    ${isActive ? 'bg-base-100 border-b-4 border-b-primary border-t-base-200 border-x-base-200 shadow-sm scale-105' : 'bg-base-100 border-base-200 hover:border-base-300 hover:bg-base-50 opacity-70 hover:opacity-100'}`}
                                                title={step.title || `Шаг ${index + 1}`}
                                            >
                                                {icon}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => setIsStepModalOpen(true)} className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl bg-base-50 border-2 border-dashed border-base-300 text-base-content/40 hover:border-primary hover:text-primary transition-colors text-2xl font-light">
                                        +
                                    </button>
                                </div>
                            </div>
                            
                            <div className="shrink-0 ml-4 pl-4 border-l border-base-200">
                                <button onClick={handleDeleteLesson} className="btn btn-sm btn-ghost text-error hover:bg-error/10">Удалить раздел</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-base-200/20">
                            {activeStep ? (
                                <StepEditor 
                                    activeStep={activeStep} 
                                    setActiveStep={setActiveStep} 
                                    handleDeleteStep={handleDeleteStep} 
                                    handleSaveStep={handleSaveStep} 
                                    loading={loading}
                                    quizProps={{
                                        quizQuestions, setQuizQuestions, quizPrompt, setQuizPrompt,
                                        quizDifficulty, setQuizDifficulty, quizCount, setQuizCount,
                                        isGeneratingQuiz, onGenerate: handlePreGenerateQuiz,
                                        onQuestionChange: handleQuestionChange, onOptionChange: handleOptionChange,
                                        onCorrectSelect: handleCorrectSelect, onAddManual: handleAddManualQuestion,
                                        onDeleteQuestion: handleDeleteQuestion
                                    }}
                                    aiProps={{
                                        aiTopic, setAiTopic, aiLoading, handleGenerateScenario
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                                    <div className="bg-base-200 p-4 rounded-full mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-base-content/60">Выберите шаг для редактирования</h3>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center text-base-content/40 bg-base-200/10">
                        <div className="bg-base-200 p-4 rounded-full mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-base-content/60">Выберите раздел курса слева</h3>
                    </div>
                )}
            </div>

            {/* МОДАЛКИ (Раздел) */}
            {isLessonModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/50 backdrop-blur-sm animate-fade-in px-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl border border-base-200 max-w-sm w-full p-6 animate-slide-up">
                        <h3 className="font-bold text-lg mb-4">Новый раздел</h3>
                        <div className="form-control mb-6">
                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Название раздела</span></label>
                            <input type="text" className="input input-bordered border-base-300 w-full shadow-sm" autoFocus value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-ghost btn-sm" onClick={() => setIsLessonModalOpen(false)}>Отмена</button>
                            <button className="btn btn-primary btn-sm shadow-sm" onClick={handleCreateLesson} disabled={!newLessonTitle.trim()}>Создать</button>
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКИ (Шаг) */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/50 backdrop-blur-sm animate-fade-in px-4">
                    <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 max-w-2xl w-full p-8 md:p-10 animate-slide-up">
                        <div className="text-center mb-8">
                            <h3 className="font-extrabold text-2xl text-base-content">Что добавим в урок?</h3>
                            <p className="text-sm text-base-content/60 mt-2">Выберите формат обучающего материала</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { type: 'text', icon: '📝', title: 'Текстовая теория', desc: 'Статьи, инструкции, картинки' },
                                { type: 'video_url', icon: '▶️', title: 'Видеоролик', desc: 'Вставка видео из YouTube' },
                                { type: 'quiz', icon: '❓', title: 'Тестирование', desc: 'Проверка знаний с AI генерацией' },
                                { type: 'simulation_chat', icon: '🛡️', title: 'Симуляция атаки', desc: 'Тренажеры фишинга и СИ', badge: 'AI' },
                                { type: 'interactive_code', icon: '💻', title: 'Тренажер кода', desc: 'Интерактивный Python IDE' },
                            ].map((item) => (
                                <button 
                                    key={item.type} onClick={() => handleCreateStep(item.type)} 
                                    className="flex flex-col items-center justify-center p-6 border-2 border-base-200 rounded-2xl hover:border-primary hover:bg-base-50 hover:shadow-md transition-all group relative bg-base-100"
                                >
                                    {item.badge && <span className="absolute top-3 right-3 badge badge-sm bg-accent text-white border-none font-bold text-[10px]">{item.badge}</span>}
                                    <span className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                                    <span className="font-bold text-base-content mb-1">{item.title}</span>
                                    <span className="text-xs text-base-content/50 text-center">{item.desc}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-8 text-center">
                            <button className="btn btn-ghost font-bold text-base-content/70 hover:bg-base-200 w-full sm:w-auto px-8" onClick={() => setIsStepModalOpen(false)}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ДИАЛОГ ПОДТВЕРЖДЕНИЯ */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-base-300/50 backdrop-blur-sm animate-fade-in px-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl border border-base-200 max-w-sm w-full p-6 animate-slide-up">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${confirmDialog.isDanger ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                                {confirmDialog.isDanger ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-base-content">{confirmDialog.title}</h3>
                        </div>
                        <p className="text-sm text-base-content/70 mb-6 pl-[52px]">{confirmDialog.message}</p>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-ghost btn-sm" onClick={closeDialog}>Отмена</button>
                            <button className={`btn btn-sm shadow-sm ${confirmDialog.isDanger ? 'btn-error' : 'btn-primary'}`} onClick={confirmDialog.onConfirm}>
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