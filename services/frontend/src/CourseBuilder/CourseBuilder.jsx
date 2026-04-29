import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; 
import { useTranslation } from 'react-i18next';
import api from '../api';
import aiApi from '../aiApi'; 
import { toast } from 'react-toastify'; 
import CourseSettingsTab from './components/CourseSettingsTab';
import StepEditor from './components/StepEditor';
import { 
    Settings, Eye, Plus, Trash2, FileText, PlayCircle, HelpCircle, 
    ShieldAlert, Code2, AlertTriangle, LayoutGrid, CheckCircle2, X, ChevronRight
} from 'lucide-react';

function CourseBuilder() {
    const { courseId } = useParams();
    const { t, i18n } = useTranslation(); 
    
    const getAiLanguage = () => {
        const langMap = {
            'kk': 'Казахский',
            'ru': 'Русский',
            'en': 'English'
        };
        return langMap[i18n.language] || 'Русский';
    };

    const [lessons, setLessons] = useState([]);
    const [courseData, setCourseData] = useState({ title: '', description: '', price: 0 }); 
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeStep, setActiveStep] = useState(null); 
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);

    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isStepModalOpen, setIsStepModalOpen] = useState(false); 
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Да", isDanger: false });
    const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    const [aiTopic, setAiTopic] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const [quizQuestions, setQuizQuestions] = useState(null);
    const [currentQuizId, setCurrentQuizId] = useState(null); 
    const [quizPrompt, setQuizPrompt] = useState("");
    const [quizDifficulty, setQuizDifficulty] = useState("medium");
    const [quizCount, setQuizCount] = useState(3);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

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

    useEffect(() => {
        if (activeStep?.step_type === 'quiz' && activeLesson) {
            const stepQuizId = activeStep.scenario_data?.quiz_id;
            if (stepQuizId) {
                fetchQuizForStep(activeLesson.id, stepQuizId);
            } else {
                setQuizQuestions([]);
                setCurrentQuizId(null);
            }
        } else {
            setQuizQuestions(null);
            setCurrentQuizId(null);
        }
    }, [activeStep, activeLesson]);

    const fetchQuizForStep = async (lessonId, targetQuizId) => {
        try {
            const res = await api.get(`quizzes/lesson/${lessonId}/?t=${new Date().getTime()}`, {
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });

            let data = res.data;
            if (!Array.isArray(data)) data = data.results ? data.results : [data];
            
            const targetQuiz = data.find(q => q.id === targetQuizId);
            
            if (targetQuiz) {
                setCurrentQuizId(targetQuiz.id); 
                if (targetQuiz.questions && targetQuiz.questions.length > 0) {
                    const mapped = targetQuiz.questions.map(q => {
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
                            id: q.id, question: q.text || q.question || "", options: optionsList,
                            correct_answer: optionsList[correctIdx] || "", user_selected_index: correctIdx,
                            correct_option_index: correctIdx, ai_suggested_index: -1 
                        };
                    });
                    setQuizQuestions(mapped);
                } else setQuizQuestions([]);
            } else { setCurrentQuizId(null); setQuizQuestions([]); }
        } catch (err) { setCurrentQuizId(null); setQuizQuestions([]); }
    };

    const handleSaveCourseSettings = async () => {
        setLoading(true);
        try {
            if (courseData.newImageFile) {
                const formData = new FormData();
                formData.append('title', courseData.title);
                formData.append('description', courseData.description);
                formData.append('price', courseData.price);
                formData.append('cover_image', courseData.newImageFile);
                await api.patch(`courses/${courseId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await api.patch(`courses/${courseId}/`, { title: courseData.title, description: courseData.description, price: courseData.price });
            }
            toast.success(t('builder.toasts.settingsSaved'));
        } catch (err) { toast.error(t('builder.toasts.settingsError')); } finally { setLoading(false); }
    };

    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        try {
            const res = await api.post(`courses/${courseId}/lessons/`, { title: newLessonTitle, order: lessons.length + 1, course: parseInt(courseId) });
            setLessons([...lessons, { ...res.data, steps: [] }]);
            setIsLessonModalOpen(false); setNewLessonTitle(""); 
            toast.success(t('builder.toasts.sectionCreated'));
        } catch (err) { toast.error(t('builder.toasts.sectionError')); }
    };

    const handleDeleteLesson = async () => {
        setConfirmDialog({
            isOpen: true, title: t('builder.delSectionTitle'), message: t('builder.delSectionMsg', { title: activeLesson.title }),
            confirmText: t('builder.deleteBtn'), isDanger: true,
            onConfirm: async () => {
                try {
                    await api.delete(`courses/lessons/${activeLesson.id}/`);
                    window.location.reload(); 
                } catch (err) { toast.error(t('builder.toasts.delLessonError')); }
            }
        });
    };

    const handleCreateStep = async (stepType) => {
        try {
            const res = await api.post(`courses/lessons/${activeLesson.id}/steps/`, { title: 'Новый шаг', step_type: stepType, content: '', order: (activeLesson.steps?.length || 0) + 1 });
            const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: [...(l.steps || []), res.data] } : l);
            setLessons(updatedLessons); setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id)); setActiveStep(res.data); setIsStepModalOpen(false);
        } catch (err) { toast.error(t('builder.toasts.stepCreateError')); }
    };

    const handleDeleteStep = async () => {
        setConfirmDialog({
            isOpen: true, title: t('builder.delStepTitle'), message: t('builder.delStepMsg'), confirmText: t('builder.deleteBtn'), isDanger: true,
            onConfirm: async () => {
                closeDialog();
                try {
                    await api.delete(`courses/steps/${activeStep.id}/`);
                    const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: l.steps.filter(s => s.id !== activeStep.id) } : l);
                    setLessons(updatedLessons);
                    const updLesson = updatedLessons.find(l => l.id === activeLesson.id);
                    setActiveLesson(updLesson); setActiveStep(updLesson.steps.length > 0 ? updLesson.steps[0] : null);
                } catch (err) { toast.error(t('builder.toasts.delStepError')); }
            }
        });
    };

    const handleSaveStep = async () => { 
        if (!activeStep) return;
        setLoading(true);
        try {
            let savedQuizId = currentQuizId;

            if (activeStep.step_type === 'quiz' && quizQuestions) {
                const payloadQuestions = quizQuestions.map(q => {
                    const options = q.options.map(s => String(s || '').trim()).filter(Boolean);
                    let userIndex = q.user_selected_index ?? q.correct_option_index ?? 0;
                    if (userIndex >= options.length) userIndex = 0;
                    const mappedQ = { question: String(q.question), options, correct_answer: options[userIndex] || "", correct_index: userIndex, explanation: "" };
                    if (q.id) mappedQ.id = q.id; 
                    return mappedQ;
                });
                
                const payload = { lesson_id: Number(activeLesson.id), quiz_title: activeStep.title || `Тест к уроку`, questions: payloadQuestions };
                if (currentQuizId) payload.quiz_id = currentQuizId;
                
                const quizRes = await api.post(`quizzes/save-generated/`, payload);
                savedQuizId = quizRes.data.quiz_id; 
                setCurrentQuizId(savedQuizId);
            }

            let updatedScenarioData = activeStep.scenario_data;
            if (typeof updatedScenarioData === 'string') {
                try { updatedScenarioData = JSON.parse(updatedScenarioData); } catch(e) {}
            }
            if (typeof updatedScenarioData !== 'object' || updatedScenarioData === null) {
                updatedScenarioData = {};
            } else {
                updatedScenarioData = { ...updatedScenarioData };
            }

            if (savedQuizId) updatedScenarioData.quiz_id = savedQuizId;

            const res = await api.patch(`courses/steps/${activeStep.id}/`, { 
                title: activeStep.title, 
                content: activeStep.content, 
                step_type: activeStep.step_type, 
                scenario_data: updatedScenarioData 
            });
            
            const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: l.steps.map(s => s.id === activeStep.id ? res.data : s) } : l);
            setLessons(updatedLessons); setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id)); setActiveStep(res.data);
            toast.success(t('builder.toasts.stepSaved'));
        } catch (err) { toast.error(t('builder.toasts.stepSaveError')); } finally { setLoading(false); }
    };

    const handlePreGenerateQuiz = () => {
        if (!quizPrompt.trim()) return toast.warning(t('builder.toasts.quizEmptyPrompt'));
        if (quizQuestions && quizQuestions.length > 0) {
            setConfirmDialog({
                isOpen: true, title: t('builder.rewriteQuizTitle'), message: t('builder.rewriteQuizMsg', { count: quizQuestions.length }),
                confirmText: t('builder.generateNewBtn'), isDanger: true,
                onConfirm: () => { closeDialog(); executeQuizGeneration(); }
            });
        } else executeQuizGeneration();
    };

    const executeQuizGeneration = async () => {
        setIsGeneratingQuiz(true);
        try {
            const res = await aiApi.post('generate-quiz', { text: quizPrompt, count: Number(quizCount), difficulty: quizDifficulty, language: getAiLanguage() });
            const questions = res.data.generated_questions || res.data;
            const normalized = Array.isArray(questions) ? questions.map(q => {
                const questionText = (q.question || q.text || q.prompt || q.title || '').trim();
                let rawOptions = q.options || q.choices || q.answers || q.variants || q.options_list || [];
                if (typeof rawOptions === 'string') rawOptions = rawOptions.split(/\r?\n|\||;|,|•|\-|\u2022/).map(s => s.trim()).filter(Boolean);
                let options = Array.isArray(rawOptions) ? rawOptions.map(o => String(o.text || o).trim()).filter(Boolean) : [];
                let correct = (q.correct_answer || q.correctAnswer || q.correct || '').toString().trim();
                let aiSuggestedIndex = options.indexOf(correct);
                if (aiSuggestedIndex === -1) { aiSuggestedIndex = 0; correct = options[0]; }
                return { id: null, question: questionText, options, correct_answer: correct, user_selected_index: aiSuggestedIndex, correct_option_index: aiSuggestedIndex, ai_suggested_index: aiSuggestedIndex };
            }) : [];
            setQuizQuestions(normalized); toast.success(t('builder.toasts.quizSuccess'));
        } catch (err) { toast.error(t('builder.toasts.quizError')); } finally { setIsGeneratingQuiz(false); }
    };

    const handleQuestionChange = (index, field, value) => { const updated = [...quizQuestions]; updated[index][field] = value; setQuizQuestions(updated); };
    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...quizQuestions]; updated[qIndex].options[oIndex] = value;
        const correctIdx = updated[qIndex].correct_option_index !== undefined ? updated[qIndex].correct_option_index : updated[qIndex].user_selected_index;
        if (correctIdx === oIndex) updated[qIndex].correct_answer = value;
        setQuizQuestions(updated);
    };
    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...quizQuestions]; updated[qIndex].user_selected_index = oIndex; updated[qIndex].correct_option_index = oIndex;
        updated[qIndex].correct_answer = updated[qIndex].options[oIndex] || ''; setQuizQuestions(updated);
    };
    const handleAddManualQuestion = () => {
        const newQuestion = { id: null, question: "Новый вопрос", options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], correct_answer: "Вариант 1", user_selected_index: 0, correct_option_index: 0, ai_suggested_index: -1 };
        setQuizQuestions(quizQuestions ? [...quizQuestions, newQuestion] : [newQuestion]);
    };
    const handleDeleteQuestion = (index) => { const updated = quizQuestions.filter((_, i) => i !== index); setQuizQuestions(updated); };

    const handleGenerateScenario = async (type) => {
        if (!aiTopic) return toast.warning(t('builder.toasts.simEmptyPrompt'));
        setAiLoading(true);
        try {
            const res = await aiApi.post('generate-scenario', { 
                topic: aiTopic, 
                scenario_type: type === 'simulation_email' ? 'email' : 'chat', 
                difficulty: 'medium',
                language: getAiLanguage() 
            });
            
            let newScenarioData = res.data;
            
            if (typeof newScenarioData === 'string') {
                try { newScenarioData = JSON.parse(newScenarioData); } catch(e) {}
            }
            
            if (newScenarioData && newScenarioData.scenario_data) {
                newScenarioData = newScenarioData.scenario_data;
            }

            // 🔥 ПРОСТО ОБНОВЛЯЕМ ЛОКАЛЬНЫЙ СТЕЙТ (БЕЗ ЗАПРОСА К DJANGO) 🔥
            setActiveStep(prev => ({ ...prev, step_type: type, scenario_data: newScenarioData }));
            
            // Уведомляем, что можно редактировать
            toast.success(t('builder.toasts.simSuccess'));
        } catch (err) { 
            console.error("AI Error:", err);
            toast.error(t('builder.toasts.simError')); 
        } finally { 
            setAiLoading(false); 
        }
    }; 

    const getStepIcon = (type, size = 20) => {
        if (type === 'video_url') return <PlayCircle size={size} />;
        if (type.includes('simulation') || type.includes('interactive')) return <ShieldAlert size={size} />;
        if (type === 'quiz') return <HelpCircle size={size} />;
        if (type === 'interactive_code') return <Code2 size={size} />;
        return <FileText size={size} />;
    };

    if (loading && lessons.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-base-200">
                <div className="w-8 h-8 border-4 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-base-100 font-sans text-base-content animate-in fade-in"> 
            
            {/* === ЛЕВАЯ КОЛОНКА === */}
            <div className="w-80 bg-base-200/50 border-r border-base-200 flex flex-col h-full shrink-0 z-20">
                <div className="px-6 py-5 border-b border-base-200 flex justify-between items-center bg-base-100">
                    <h2 className="font-black text-base-content truncate pr-4 text-lg" title={courseData.title}>
                        {courseData.title || t('builder.courseSettings')}
                    </h2>
                    <div className="flex gap-1 shrink-0">
                        <button 
                            className={`p-2 rounded-xl transition-colors ${isSettingsMode ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-base-content/50 hover:bg-base-200 hover:text-base-content'}`} 
                            onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }} 
                            title={t('builder.courseSettings')}
                        >
                            <Settings size={18} />
                        </button>
                        <RouterLink 
                            to={`/courses/${courseId}`} 
                            className="p-2 rounded-xl text-base-content/50 hover:bg-base-200 hover:text-base-content transition-colors" 
                            title={t('builder.previewCourse')}
                        >
                            <Eye size={18} />
                        </RouterLink>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-4 space-y-2 custom-scrollbar">
                    <div className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-3 pl-2 mt-2">{t('builder.courseSyllabus')}</div>
                    {lessons.map((lesson, index) => (
                        <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl cursor-pointer transition-all border 
                                ${activeLesson?.id === lesson.id && !isSettingsMode 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20" 
                                    : "bg-base-100 border-base-200 text-base-content hover:border-blue-400 hover:shadow-sm"}`}
                            onClick={() => { setActiveLesson(lesson); setActiveStep(lesson.steps?.[0] || null); setIsSettingsMode(false); }}
                        >
                            <div className="font-bold text-sm truncate flex items-center gap-3">
                                <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black 
                                    ${activeLesson?.id === lesson.id && !isSettingsMode ? 'bg-white/20 text-white' : 'bg-base-200 text-base-content/50'}`}>
                                    {index + 1}
                                </span>
                                {lesson.title}
                            </div>
                            <div className={`text-xs mt-2 font-medium flex items-center gap-1 pl-9
                                ${activeLesson?.id === lesson.id && !isSettingsMode ? 'text-white/70' : 'text-base-content/50'}`}>
                                {t('builder.stepsInside')}: {lesson.steps?.length || 0}
                            </div>
                        </div>
                    ))}
                    {lessons.length === 0 && (
                        <div className="text-center mt-10 p-6 border-2 border-dashed border-base-300 rounded-2xl">
                            <LayoutGrid size={24} className="text-base-content/30 mx-auto mb-2" />
                            <p className="text-sm font-bold text-base-content/50">{t('builder.noSections')}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-base-200 bg-base-100">
                    <button 
                        className="w-full py-3 border border-base-200 bg-base-100 text-base-content font-bold rounded-xl hover:bg-base-200 hover:border-blue-400 transition-all flex items-center justify-center gap-2 shadow-sm" 
                        onClick={() => setIsLessonModalOpen(true)}
                    >
                        <Plus size={16} strokeWidth={2.5} /> {t('builder.addSection')}
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-base-100 relative">
                
                {isSettingsMode ? (
                    <CourseSettingsTab 
                        courseData={courseData} 
                        setCourseData={setCourseData} 
                        onSave={handleSaveCourseSettings} 
                        loading={loading} 
                    />
                ) : activeLesson ? (
                    <>
                        <div className="bg-base-200/30 border-b border-base-200 px-8 py-4 flex items-center justify-between z-10 sticky top-0 backdrop-blur-sm">
                            <div className="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
                                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mr-2 shrink-0">{t('builder.stepsLabel')}</span>
                                <div className="flex gap-2 items-center">
                                    {activeLesson.steps?.map((step, index) => {
                                        const isActive = activeStep?.id === step.id;
                                        return (
                                            <button 
                                                key={step.id}
                                                onClick={() => setActiveStep(step)}
                                                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all border-2 
                                                    ${isActive 
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20 scale-105' 
                                                        : 'bg-base-100 border-base-200 text-base-content/50 hover:border-blue-400 hover:text-base-content'}`}
                                                title={step.title || `${t('builder.stepLabel')} ${index + 1}`}
                                            >
                                                {getStepIcon(step.step_type, 18)}
                                            </button>
                                        );
                                    })}
                                    <button 
                                        onClick={() => setIsStepModalOpen(true)} 
                                        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-base-100 border-2 border-dashed border-base-300 text-base-content/40 hover:border-blue-600 hover:text-blue-600 transition-colors ml-2"
                                        title={t('builder.addStep')}
                                    >
                                        <Plus size={20} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="shrink-0 ml-6 pl-6 border-l border-base-200">
                                <button 
                                    onClick={handleDeleteLesson} 
                                    className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> {t('builder.deleteSection')}
                                </button>
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
                                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                                    <div className="w-16 h-16 bg-base-200 rounded-2xl flex items-center justify-center mb-4 text-base-content/30">
                                        <Plus size={32} />
                                    </div>
                                    <h3 className="text-xl font-black text-base-content mb-2">{t('builder.createFirstStep')}</h3>
                                    <p className="text-sm text-base-content/50 font-medium">{t('builder.createFirstStepDesc')}</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[80vh] text-center bg-base-200/20">
                        <div className="w-20 h-20 bg-base-100 border border-base-200 shadow-sm rounded-3xl flex items-center justify-center mb-6 text-base-content/30">
                            <ChevronRight size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-base-content mb-2">{t('builder.selectSection')}</h3>
                        <p className="text-sm text-base-content/50 font-medium max-w-sm">{t('builder.selectSectionDesc')}</p>
                    </div>
                )}
            </div>

            {/* === МОДАЛКИ === */}
            {isLessonModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/80 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-base-100 rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-xl text-base-content">{t('builder.newSectionTitle')}</h3>
                            <button onClick={() => setIsLessonModalOpen(false)} className="text-base-content/40 hover:text-base-content transition-colors"><X size={20} /></button>
                        </div>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2 block">{t('builder.sectionNameLabel')}</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl text-sm font-bold focus:bg-base-100 focus:border-blue-600 outline-none transition-all" 
                                autoFocus 
                                placeholder={t('builder.sectionNamePh')}
                                value={newLessonTitle} 
                                onChange={(e) => setNewLessonTitle(e.target.value)} 
                            />
                        </div>
                        <button 
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 disabled:bg-base-300 disabled:text-base-content/40 disabled:shadow-none" 
                            onClick={handleCreateLesson} 
                            disabled={!newLessonTitle.trim()}
                        >
                            {t('builder.createBtn')}
                        </button>
                    </div>
                </div>
            )}

            {isStepModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/80 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-base-100 rounded-3xl shadow-2xl max-w-3xl w-full p-8 md:p-12 animate-in zoom-in-95 duration-200">
                        <div className="text-center mb-10">
                            <h3 className="font-black text-3xl text-base-content mb-2">{t('builder.whatToAdd')}</h3>
                            <p className="text-sm text-base-content/50 font-medium">{t('builder.selectFormat')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { type: 'text', icon: <FileText size={32} strokeWidth={1.5} />, title: t('builder.formats.text'), desc: t('builder.formats.textDesc') },
                                { type: 'video_url', icon: <PlayCircle size={32} strokeWidth={1.5} />, title: t('builder.formats.video'), desc: t('builder.formats.videoDesc') },
                                { type: 'quiz', icon: <HelpCircle size={32} strokeWidth={1.5} />, title: t('builder.formats.quiz'), desc: t('builder.formats.quizDesc') },
                                { type: 'simulation_chat', icon: <ShieldAlert size={32} strokeWidth={1.5} />, title: t('builder.formats.sim'), desc: t('builder.formats.simDesc'), badge: 'AI' },
                                { type: 'interactive_code', icon: <Code2 size={32} strokeWidth={1.5} />, title: t('builder.formats.code'), desc: t('builder.formats.codeDesc') },
                            ].map((item) => (
                                <button 
                                    key={item.type} onClick={() => handleCreateStep(item.type)} 
                                    className="flex flex-col items-center justify-center p-6 border-2 border-base-200 bg-base-200/30 rounded-2xl hover:border-blue-600 hover:bg-base-100 hover:shadow-lg transition-all group relative text-center"
                                >
                                    {item.badge && <span className="absolute top-4 right-4 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase tracking-widest">{item.badge}</span>}
                                    <div className="text-base-content/40 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300 mb-4">
                                        {item.icon}
                                    </div>
                                    <span className="font-bold text-base-content mb-1">{item.title}</span>
                                    <span className="text-xs text-base-content/50 font-medium">{item.desc}</span>
                                </button>
                            ))}
                        </div>
                        <div className="mt-10 text-center">
                            <button className="text-sm font-bold text-base-content/50 hover:text-base-content transition-colors" onClick={() => setIsStepModalOpen(false)}>{t('builder.cancel')}</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-base-300/80 backdrop-blur-sm animate-in fade-in px-4">
                    <div className="bg-base-100 rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in-95 duration-200 text-center">
                        <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-6">
                            <AlertTriangle size={32} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-black text-base-content mb-3">{confirmDialog.title}</h3>
                        <p className="text-sm text-base-content/50 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                className="w-full py-3.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-md shadow-red-500/20" 
                                onClick={confirmDialog.onConfirm}
                            >
                                {confirmDialog.confirmText}
                            </button>
                            <button 
                                className="w-full py-3.5 bg-base-200 text-base-content rounded-xl font-bold hover:bg-base-300 transition-colors" 
                                onClick={closeDialog}
                            >
                                {t('builder.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CourseBuilder;