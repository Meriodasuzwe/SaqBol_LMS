import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; 
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../api';
 
import CourseSettingsTab from './components/CourseSettingsTab';
import StepEditor from './components/StepEditor';
import { 
    Settings, Eye, Plus, Trash2, FileText, PlayCircle, HelpCircle, 
    Code2, AlertTriangle, LayoutGrid, X, ChevronRight, GripVertical
} from 'lucide-react';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableLesson({ lesson, index, isActive, onClick, t }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <div
                className={`p-3 rounded-xl cursor-pointer transition-all border 
                    ${isActive ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20" 
                               : "bg-base-100 border-base-200 text-base-content hover:border-blue-400 hover:shadow-sm"}`}
                onClick={onClick}
            >
                <div className="font-bold text-sm truncate flex items-center gap-3">
                    <div {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 text-current opacity-40 hover:opacity-80"
                        onClick={e => e.stopPropagation()}>
                        <GripVertical size={14} />
                    </div>
                    <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black 
                        ${isActive ? 'bg-white/20 text-white' : 'bg-base-200 text-base-content/50'}`}>
                        {index + 1}
                    </span>
                    {lesson.title}
                </div>
                <div className={`text-xs mt-2 font-medium pl-9 ${isActive ? 'text-white/70' : 'text-base-content/50'}`}>
                    {t('builder.stepsInside')}: {lesson.steps?.length || 0}
                </div>
            </div>
        </div>
    );
}

function SortableStep({ step, index, isActive, onClick, getStepIcon, t }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <button
                onClick={onClick}
                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all border-2 
                    ${isActive 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20 scale-105' 
                        : 'bg-base-100 border-base-200 text-base-content/50 hover:border-blue-400 hover:text-base-content'}`}
                title={step.title || `${t('builder.stepLabel')} ${index + 1}`}
            >
                {getStepIcon(step.step_type, 18)}
            </button>
        </div>
    );
}

function CourseBuilder() {
    const { courseId } = useParams();
    const { t } = useTranslation(); 

    const [lessons, setLessons] = useState([]);
    const [courseData, setCourseData] = useState({ title: '', description: '', price: 0 }); 
    const [activeLesson, setActiveLesson] = useState(null);
    const [activeStep, setActiveStep] = useState(null); 
    const [isSettingsMode, setIsSettingsMode] = useState(false); 
    const [loading, setLoading] = useState(true);
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [newLessonTitle, setNewLessonTitle] = useState("");
    const [isStepModalOpen, setIsStepModalOpen] = useState(false); 
    const [pendingReorder, setPendingReorder] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Да", isDanger: false });
    
    const closeDialog = () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setPendingReorder(null);
    };

    const [quizQuestions, setQuizQuestions] = useState(null);
    const [currentQuizId, setCurrentQuizId] = useState(null); 

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [lessonsRes, courseRes] = await Promise.all([
                    api.get(`courses/${courseId}/lessons/`),
                    api.get(`courses/${courseId}/`)
                ]);
                const sorted = lessonsRes.data.sort((a, b) => a.order - b.order || a.id - b.id);
                setLessons(sorted);
                if (sorted.length > 0) {
                    setActiveLesson(sorted[0]);
                    if (sorted[0].steps && sorted[0].steps.length > 0) {
                        const sortedSteps = [...sorted[0].steps].sort((a, b) => a.order - b.order || a.id - b.id);
                        setActiveStep(sortedSteps[0]);
                    }
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
                if (currentQuizId !== stepQuizId) fetchQuizForStep(activeLesson.id, stepQuizId);
            } else {
                if (quizQuestions === null) setQuizQuestions([]); 
                setCurrentQuizId(null);
            }
        } else {
            setQuizQuestions(null);
            setCurrentQuizId(null);
        }
    }, [activeStep?.id, activeLesson?.id, activeStep?.scenario_data?.quiz_id]); 

    const handleLessonDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = lessons.findIndex(l => l.id === active.id);
        const newIndex = lessons.findIndex(l => l.id === over.id);
        const reordered = arrayMove(lessons, oldIndex, newIndex);
        setPendingReorder({ items: reordered, type: 'lesson', oldIndex, newIndex });
        setConfirmDialog({
            isOpen: true,
            title: 'Переместить раздел?',
            message: `Переместить «${lessons[oldIndex].title}» на позицию ${newIndex + 1}?`,
            confirmText: 'Переместить',
            isDanger: false,
            onConfirm: async () => {
                closeDialog();
                setLessons(reordered);
                try {
                    await Promise.all(reordered.map((lesson, i) =>
                        api.patch(`courses/lessons/${lesson.id}/`, { order: i + 1 })
                    ));
                    toast.success('Порядок разделов сохранён');
                } catch {
                    toast.error('Ошибка сохранения порядка');
                }
            }
        });
    };

    const handleStepDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const steps = activeLesson.steps || [];
        const oldIndex = steps.findIndex(s => s.id === active.id);
        const newIndex = steps.findIndex(s => s.id === over.id);
        const reordered = arrayMove(steps, oldIndex, newIndex);
        setConfirmDialog({
            isOpen: true,
            title: 'Переместить шаг?',
            message: `Переместить шаг на позицию ${newIndex + 1}?`,
            confirmText: 'Переместить',
            isDanger: false,
            onConfirm: async () => {
                closeDialog();
                const updatedLessons = lessons.map(l =>
                    l.id === activeLesson.id ? { ...l, steps: reordered } : l
                );
                setLessons(updatedLessons);
                setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id));
                try {
                    await Promise.all(reordered.map((step, i) =>
                        api.patch(`courses/steps/${step.id}/`, { order: i + 1 })
                    ));
                    toast.success('Порядок шагов сохранён');
                } catch {
                    toast.error('Ошибка сохранения порядка');
                }
            }
        });
    };

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
                        let correctIdx = []; 
                        if (q.choices && q.choices.length > 0) {
                            optionsList = q.choices.map(c => c.text);
                            correctIdx = q.choices.reduce((acc, c, i) => c.is_correct ? [...acc, i] : acc, []);
                            if (correctIdx.length === 0) correctIdx = [0];
                        } else if (q.options && q.options.length > 0) {
                            optionsList = q.options;
                            if (Array.isArray(q.correct_index)) {
                                correctIdx = q.correct_index;
                            } else {
                                let singleIdx = optionsList.indexOf(q.correct_answer);
                                correctIdx = singleIdx === -1 ? [0] : [singleIdx];
                            }
                        } else {
                            optionsList = ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"];
                            correctIdx = [0];
                        }
                        return {
                            id: q.id, question: q.text || q.question || "", options: optionsList,
                            correct_answer: correctIdx.map(i => optionsList[i]).join(' | '), 
                            user_selected_index: correctIdx,
                            correct_option_index: correctIdx
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
                    let userIndex = q.correct_option_index !== undefined ? q.correct_option_index : q.user_selected_index;
                    if (!Array.isArray(userIndex)) userIndex = userIndex !== undefined ? [userIndex] : [0];
                    userIndex = userIndex.filter(i => i >= 0 && i < options.length);
                    if (userIndex.length === 0) userIndex = [0];
                    const mappedQ = { 
                        question: String(q.question), options, 
                        correct_answer: userIndex.map(i => options[i]).join(' | '), 
                        correct_index: userIndex, explanation: "" 
                    };
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
                title: activeStep.title, content: activeStep.content, 
                step_type: activeStep.step_type, scenario_data: updatedScenarioData 
            });
            const updatedLessons = lessons.map(l => l.id === activeLesson.id ? { ...l, steps: l.steps.map(s => s.id === activeStep.id ? res.data : s) } : l);
            setLessons(updatedLessons); setActiveLesson(updatedLessons.find(l => l.id === activeLesson.id)); setActiveStep(res.data);
            toast.success(t('builder.toasts.stepSaved'));
        } catch (err) { toast.error(t('builder.toasts.stepSaveError')); } finally { setLoading(false); }
    };

    const handleQuestionChange = (index, field, value) => { const updated = [...quizQuestions]; updated[index][field] = value; setQuizQuestions(updated); };
    
    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...quizQuestions]; 
        updated[qIndex].options[oIndex] = value;
        const correctIndices = updated[qIndex].correct_option_index || [];
        if (correctIndices.includes(oIndex)) {
            updated[qIndex].correct_answer = correctIndices.map(i => updated[qIndex].options[i]).join(' | ');
        }
        setQuizQuestions(updated);
    };

    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...quizQuestions];
        let currentSelected = updated[qIndex].correct_option_index;
        if (currentSelected === undefined) currentSelected = updated[qIndex].user_selected_index;
        if (!Array.isArray(currentSelected)) currentSelected = currentSelected !== undefined ? [currentSelected] : [];
        if (currentSelected.includes(oIndex)) {
            if (currentSelected.length > 1) currentSelected = currentSelected.filter(i => i !== oIndex);
        } else {
            currentSelected.push(oIndex); 
        }
        updated[qIndex].user_selected_index = currentSelected;
        updated[qIndex].correct_option_index = currentSelected;
        updated[qIndex].correct_answer = currentSelected.map(i => updated[qIndex].options[i]).join(' | ');
        setQuizQuestions(updated);
    };

    const handleAddManualQuestion = () => {
        const newQuestion = { 
            id: null, question: "Новый вопрос", 
            options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], 
            correct_answer: "Вариант 1", user_selected_index: [0], correct_option_index: [0]
        };
        setQuizQuestions(quizQuestions ? [...quizQuestions, newQuestion] : [newQuestion]);
    };

    const handleDeleteQuestion = (index) => { 
        setQuizQuestions(quizQuestions.filter((_, i) => i !== index)); 
    };

    const handleAddOption = (qIndex) => {
        const updated = [...quizQuestions];
        if (updated[qIndex].options.length < 6) {
            updated[qIndex].options.push(`Новый вариант ${updated[qIndex].options.length + 1}`);
            setQuizQuestions(updated);
        }
    };

    const handleRemoveOption = (qIndex, oIndex) => {
        const updated = [...quizQuestions];
        if (updated[qIndex].options.length > 2) {
            updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== oIndex);
            let currentSelected = (updated[qIndex].correct_option_index || [0])
                .map(i => { if (i === oIndex) return -1; if (i > oIndex) return i - 1; return i; })
                .filter(i => i !== -1);
            if (currentSelected.length === 0) currentSelected = [0];
            updated[qIndex].user_selected_index = currentSelected;
            updated[qIndex].correct_option_index = currentSelected;
            updated[qIndex].correct_answer = currentSelected.map(i => updated[qIndex].options[i]).join(' | ');
            setQuizQuestions(updated);
        }
    };

    const getStepIcon = (type, size = 20) => {
        if (type === 'video_url') return <PlayCircle size={size} />;
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
        <div className="fixed inset-0 top-[var(--navbar-height,64px)] flex w-full overflow-hidden bg-base-100 font-sans text-base-content animate-in fade-in">
            
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
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
                        <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                            {lessons.map((lesson, index) => (
                                <SortableLesson
                                    key={lesson.id} lesson={lesson} index={index} t={t}
                                    isActive={activeLesson?.id === lesson.id && !isSettingsMode}
                                    onClick={() => { setActiveLesson(lesson); setActiveStep(lesson.steps?.[0] || null); setIsSettingsMode(false); }}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
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
            <div className="flex-1 flex flex-col min-h-0 bg-base-100 relative">
                {isSettingsMode ? (
                    <CourseSettingsTab 
                        courseData={courseData} setCourseData={setCourseData} 
                        onSave={handleSaveCourseSettings} loading={loading} 
                    />
                ) : activeLesson ? (
                    <>
                        {/* Шапка со шагами — не скроллится */}
                        <div className="bg-base-200/30 border-b border-base-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
                            <div className="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
                                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mr-2 shrink-0">{t('builder.stepsLabel')}</span>
                                <div className="flex gap-2 items-center">
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
                                        <SortableContext items={(activeLesson.steps || []).map(s => s.id)} strategy={horizontalListSortingStrategy}>
                                            {activeLesson.steps?.map((step, index) => (
                                                <SortableStep
                                                    key={step.id} step={step} index={index}
                                                    isActive={activeStep?.id === step.id}
                                                    onClick={() => setActiveStep(step)}
                                                    getStepIcon={getStepIcon} t={t}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
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
                                <button onClick={handleDeleteLesson} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
                                    <Trash2 size={14} /> {t('builder.deleteSection')}
                                </button>
                            </div>
                        </div>

                        {/* Единый скролл для всего контента */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-base-200/20">
                            {activeStep ? (
                                <StepEditor 
                                    activeStep={activeStep} setActiveStep={setActiveStep} 
                                    handleDeleteStep={handleDeleteStep} handleSaveStep={handleSaveStep} 
                                    loading={loading}
                                    quizProps={{
                                        quizQuestions, setQuizQuestions,
                                        onQuestionChange: handleQuestionChange, onOptionChange: handleOptionChange,
                                        onCorrectSelect: handleCorrectSelect, onAddManual: handleAddManualQuestion,
                                        onDeleteQuestion: handleDeleteQuestion,
                                        onAddOption: handleAddOption, onRemoveOption: handleRemoveOption  
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
                    <div className="flex flex-col items-center justify-center h-full text-center bg-base-200/20">
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
                                autoFocus placeholder={t('builder.sectionNamePh')}
                                value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} 
                            />
                        </div>
                        <button 
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 disabled:bg-base-300 disabled:text-base-content/40 disabled:shadow-none" 
                            onClick={handleCreateLesson} disabled={!newLessonTitle.trim()}
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
                                { type: 'interactive_code', icon: <Code2 size={32} strokeWidth={1.5} />, title: t('builder.formats.code'), desc: t('builder.formats.codeDesc') },
                            ].map((item) => (
                                <button 
                                    key={item.type} onClick={() => handleCreateStep(item.type)} 
                                    className="flex flex-col items-center justify-center p-6 border-2 border-base-200 bg-base-200/30 rounded-2xl hover:border-blue-600 hover:bg-base-100 hover:shadow-lg transition-all group relative text-center"
                                >
                                    <div className="text-base-content/40 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300 mb-4">{item.icon}</div>
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
                            <button className="w-full py-3.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-md shadow-red-500/20" onClick={confirmDialog.onConfirm}>
                                {confirmDialog.confirmText}
                            </button>
                            <button className="w-full py-3.5 bg-base-200 text-base-content rounded-xl font-bold hover:bg-base-300 transition-colors" onClick={closeDialog}>
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