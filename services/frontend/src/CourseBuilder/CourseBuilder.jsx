import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; 
import api from '../api';
import aiApi from '../aiApi'; 
import { toast } from 'react-toastify'; 
import CourseSettingsTab from './components/CourseSettingsTab';
import StepEditor from './components/StepEditor';
import { 
    Settings, 
    Eye, 
    Plus, 
    Trash2, 
    FileText, 
    PlayCircle, 
    HelpCircle, 
    ShieldAlert, 
    Code2, 
    AlertTriangle,
    LayoutGrid,
    CheckCircle2,
    X,
    ChevronRight
} from 'lucide-react';

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
            const res = await api.get(`quizzes/lesson/${lessonId}/?t=${new Date().getTime()}`);
            let data = res.data;
            if (!Array.isArray(data)) data = data.results ? data.results : [data];
            
            const validQuizzes = data.filter(q => q && q.id).sort((a, b) => b.id - a.id);
            
            if (validQuizzes.length > 0) {
                const quiz = validQuizzes[0];
                setCurrentQuizId(quiz.id); 
                
                if (quiz.questions && quiz.questions.length > 0) {
                    const mapped = quiz.questions.map(q => {
                        let optionsList = [];
                        let correctIdx = 0;

                        if (q.choices && q.choices.length > 0) {
                            optionsList = q.choices.map(c => c.text);
                            correctIdx = q.choices.findIndex(c => c.is_correct);
                            if (correctIdx === -1) correctIdx = 0;
                        } else if (q.options && q.options.length > 0) {
                            optionsList = q.options;
                            correctIdx = optionsList.indexOf(q.correct_answer);
                            if (correctIdx === -1) correctIdx = 0;
                        } else {
                            optionsList = ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"];
                        }

                        return {
                            id: q.id, 
                            question: q.text || q.question || "", 
                            options: optionsList,
                            correct_answer: optionsList[correctIdx] || "",
                            user_selected_index: correctIdx,
                            correct_option_index: correctIdx,
                            ai_suggested_index: -1 
                        };
                    });
                    setQuizQuestions(mapped);
                } else setQuizQuestions([]);
            } else { setCurrentQuizId(null); setQuizQuestions([]); }
        } catch (err) { setCurrentQuizId(null); setQuizQuestions([]); }
    };

    // --- ЛОГИКА СОХРАНЕНИЯ / УДАЛЕНИЯ ---
    const handleSaveCourseSettings = async () => {
        setLoading(true);
        try {
            // Если есть новый файл картинки, отправляем как FormData
            if (courseData.newImageFile) {
                const formData = new FormData();
                formData.append('title', courseData.title);
                formData.append('description', courseData.description);
                formData.append('price', courseData.price);
                formData.append('cover_image', courseData.newImageFile);

                await api.patch(`courses/${courseId}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // Если картинку не меняли, отправляем как обычно
                await api.patch(`courses/${courseId}/`, {
                    title: courseData.title,
                    description: courseData.description,
                    price: courseData.price
                });
            }
            toast.success("Настройки курса успешно сохранены!");
        } catch (err) { 
            toast.error("Ошибка сохранения курса"); 
            console.error(err);
        } finally { 
            setLoading(false); 
        }
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
                    let userIndex = q.user_selected_index ?? q.correct_option_index ?? 0;
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
                return { id: null, question: questionText, options, correct_answer: correct, user_selected_index: aiSuggestedIndex, correct_option_index: aiSuggestedIndex, ai_suggested_index: aiSuggestedIndex };
            }) : [];
            setQuizQuestions(normalized); toast.success('Тест успешно сгенерирован');
        } catch (err) { toast.error("Не удалось сгенерировать тест."); } finally { setIsGeneratingQuiz(false); }
    };

    const handleQuestionChange = (index, field, value) => { const updated = [...quizQuestions]; updated[index][field] = value; setQuizQuestions(updated); };
    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...quizQuestions]; updated[qIndex].options[oIndex] = value;
        const correctIdx = updated[qIndex].correct_option_index !== undefined ? updated[qIndex].correct_option_index : updated[qIndex].user_selected_index;
        if (correctIdx === oIndex) updated[qIndex].correct_answer = value;
        setQuizQuestions(updated);
    };
    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...quizQuestions]; 
        updated[qIndex].user_selected_index = oIndex; 
        updated[qIndex].correct_option_index = oIndex;
        updated[qIndex].correct_answer = updated[qIndex].options[oIndex] || '';
        setQuizQuestions(updated);
    };
    const handleAddManualQuestion = () => {
        const newQuestion = { id: null, question: "Новый вопрос", options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], correct_answer: "Вариант 1", user_selected_index: 0, correct_option_index: 0, ai_suggested_index: -1 };
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

    // Утилита для иконок шагов
    const getStepIcon = (type, size = 20) => {
        if (type === 'video_url') return <PlayCircle size={size} />;
        if (type.includes('simulation')) return <ShieldAlert size={size} />;
        if (type === 'quiz') return <HelpCircle size={size} />;
        if (type === 'interactive_code') return <Code2 size={size} />;
        return <FileText size={size} />;
    };

    if (loading && lessons.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white font-sans text-slate-900 animate-in fade-in"> 
            
            {/* === ЛЕВАЯ КОЛОНКА (САЙДБАР) === */}
            <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0 z-20">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white">
                    <h2 className="font-black text-slate-900 truncate pr-4 text-lg" title={courseData.title}>
                        {courseData.title || "Настройка курса"}
                    </h2>
                    <div className="flex gap-1 shrink-0">
                        <button 
                            className={`p-2 rounded-xl transition-colors ${isSettingsMode ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'}`} 
                            onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }} 
                            title="Настройки курса"
                        >
                            <Settings size={18} />
                        </button>
                        <RouterLink 
                            to={`/courses/${courseId}`} 
                            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors" 
                            title="Предпросмотр курса"
                        >
                            <Eye size={18} />
                        </RouterLink>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-4 space-y-2 custom-scrollbar">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-2 mt-2">Программа курса</div>
                    {lessons.map((lesson, index) => (
                        <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl cursor-pointer transition-all border 
                                ${activeLesson?.id === lesson.id && !isSettingsMode 
                                    ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm"}`}
                            onClick={() => { setActiveLesson(lesson); setActiveStep(lesson.steps?.[0] || null); setIsSettingsMode(false); }}
                        >
                            <div className="font-bold text-sm truncate flex items-center gap-3">
                                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black 
                                    ${activeLesson?.id === lesson.id && !isSettingsMode ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {index + 1}
                                </span>
                                {lesson.title}
                            </div>
                            <div className={`text-xs mt-2 font-medium flex items-center gap-1 pl-9
                                ${activeLesson?.id === lesson.id && !isSettingsMode ? 'text-white/60' : 'text-slate-400'}`}>
                                Шагов внутри: {lesson.steps?.length || 0}
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && (
                        <div className="text-center mt-10 p-6 border-2 border-dashed border-slate-200 rounded-2xl">
                            <LayoutGrid size={24} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-400">Разделов пока нет</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-white">
                    <button 
                        className="w-full py-3 border border-slate-200 bg-white text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm" 
                        onClick={() => setIsLessonModalOpen(true)}
                    >
                        <Plus size={16} strokeWidth={2.5} /> Добавить раздел
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
                
                {isSettingsMode ? (
                    <CourseSettingsTab 
                        courseData={courseData} 
                        setCourseData={setCourseData} 
                        onSave={handleSaveCourseSettings} 
                        loading={loading} 
                    />
                ) : activeLesson ? (
                    <>
                        {/* Панель навигации по шагам */}
                        <div className="bg-slate-50/50 border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 sticky top-0 backdrop-blur-sm">
                            <div className="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2 shrink-0">Шаги:</span>
                                <div className="flex gap-2 items-center">
                                    {activeLesson.steps?.map((step, index) => {
                                        const isActive = activeStep?.id === step.id;
                                        return (
                                            <button 
                                                key={step.id}
                                                onClick={() => setActiveStep(step)}
                                                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all border-2 
                                                    ${isActive 
                                                        ? 'bg-slate-900 border-slate-900 text-white shadow-md scale-105' 
                                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-700'}`}
                                                title={step.title || `Шаг ${index + 1}`}
                                            >
                                                {getStepIcon(step.step_type, 18)}
                                            </button>
                                        );
                                    })}
                                    <button 
                                        onClick={() => setIsStepModalOpen(true)} 
                                        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-900 hover:text-slate-900 transition-colors ml-2"
                                        title="Добавить шаг"
                                    >
                                        <Plus size={20} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="shrink-0 ml-6 pl-6 border-l border-slate-200">
                                <button 
                                    onClick={handleDeleteLesson} 
                                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Удалить раздел
                                </button>
                            </div>
                        </div>

                        {/* Рабочая область */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/30">
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
                                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                                        <Plus size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 mb-2">Создайте первый шаг</h3>
                                    <p className="text-sm text-slate-500 font-medium">Нажмите на плюсик в верхней панели, чтобы добавить материал.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[80vh] text-center bg-slate-50">
                        <div className="w-20 h-20 bg-white border border-slate-200 shadow-sm rounded-3xl flex items-center justify-center mb-6 text-slate-300">
                            <ChevronRight size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Выберите раздел</h3>
                        <p className="text-sm text-slate-500 font-medium max-w-sm">Выберите раздел в меню слева или создайте новый, чтобы начать наполнение курса.</p>
                    </div>
                )}
            </div>

            {/* === МОДАЛКИ === */}

            {/* Модалка: Новый раздел */}
            {isLessonModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-slate-900">Новый раздел</h3>
                            <button onClick={() => setIsLessonModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Название раздела</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-slate-900 outline-none transition-all" 
                                autoFocus 
                                placeholder="Например: Введение в Python"
                                value={newLessonTitle} 
                                onChange={(e) => setNewLessonTitle(e.target.value)} 
                            />
                        </div>
                        <button 
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition-all shadow-md disabled:bg-slate-200 disabled:text-slate-400" 
                            onClick={handleCreateLesson} 
                            disabled={!newLessonTitle.trim()}
                        >
                            Создать раздел
                        </button>
                    </div>
                </div>
            )}

            {/* Модалка: Новый шаг */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 md:p-12 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-10">
                            <h3 className="font-black text-3xl text-slate-900 mb-2">Что добавим в урок?</h3>
                            <p className="text-sm text-slate-500 font-medium">Выберите формат обучающего материала</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { type: 'text', icon: <FileText size={32} strokeWidth={1.5} />, title: 'Текстовая теория', desc: 'Статьи и материалы' },
                                { type: 'video_url', icon: <PlayCircle size={32} strokeWidth={1.5} />, title: 'Видеоролик', desc: 'Вставка из YouTube' },
                                { type: 'quiz', icon: <HelpCircle size={32} strokeWidth={1.5} />, title: 'Тестирование', desc: 'С AI-генератором' },
                                { type: 'simulation_chat', icon: <ShieldAlert size={32} strokeWidth={1.5} />, title: 'Симуляция', desc: 'Тренажеры фишинга', badge: 'AI' },
                                { type: 'interactive_code', icon: <Code2 size={32} strokeWidth={1.5} />, title: 'Код', desc: 'Интерактивный IDE' },
                            ].map((item) => (
                                <button 
                                    key={item.type} onClick={() => handleCreateStep(item.type)} 
                                    className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 bg-slate-50/50 rounded-2xl hover:border-slate-900 hover:bg-white hover:shadow-lg transition-all group relative text-center"
                                >
                                    {item.badge && <span className="absolute top-4 right-4 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-widest">{item.badge}</span>}
                                    <div className="text-slate-400 group-hover:text-slate-900 group-hover:scale-110 transition-all duration-300 mb-4">
                                        {item.icon}
                                    </div>
                                    <span className="font-bold text-slate-900 mb-1">{item.title}</span>
                                    <span className="text-xs text-slate-500 font-medium">{item.desc}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-10 text-center">
                            <button className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors" onClick={() => setIsStepModalOpen(false)}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Диалог подтверждения (Удаление) */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200 text-center">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
                            <AlertTriangle size={32} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-3">{confirmDialog.title}</h3>
                        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                className="w-full py-3.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-md shadow-red-500/20" 
                                onClick={confirmDialog.onConfirm}
                            >
                                {confirmDialog.confirmText}
                            </button>
                            <button 
                                className="w-full py-3.5 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors" 
                                onClick={closeDialog}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CourseBuilder;