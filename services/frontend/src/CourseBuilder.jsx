import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; 
import api from './api';
import { toast } from 'react-toastify'; 
import Editor from '@monaco-editor/react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TiptapLink from '@tiptap/extension-link'; // 🔥 Наш переименованный импорт
import TextAlign from '@tiptap/extension-text-align';
import Dropcursor from '@tiptap/extension-dropcursor';

// --- ПРЕМИАЛЬНЫЙ РЕДАКТОР С ПОНЯТНЫМ ИНТЕРФЕЙСОМ ---
const TiptapEditor = ({ content, onChange }) => {
    const [mediaModal, setMediaModal] = useState({ isOpen: false, type: 'image', url: '' });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                dropcursor: { color: '#570df8', width: 2 },
            }),
            Image.configure({
                HTMLAttributes: { class: 'rounded-2xl shadow-xl max-w-full h-auto mx-auto my-10 border border-base-200' },
            }),
            Youtube.configure({
                HTMLAttributes: { class: 'w-full aspect-video rounded-2xl shadow-xl my-10 border border-base-200' },
            }),
            TiptapLink.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-primary font-medium underline underline-offset-4 cursor-pointer' },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[400px] p-6 prose prose-sm sm:prose-base max-w-none',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Безопасная вставка медиа
    const handleMediaSubmit = () => {
        if (!editor || !mediaModal.url.trim()) return;

        try {
            const chain = editor.chain().focus();
            if (mediaModal.type === 'image') {
                chain.setImage({ src: mediaModal.url }).run();
            } else if (mediaModal.type === 'video') {
                chain.setYoutubeVideo({ src: mediaModal.url }).run();
            } else if (mediaModal.type === 'link') {
                chain.extendMarkRange('link').setLink({ href: mediaModal.url }).run();
            }
        } catch (error) {
            console.error("Editor Error:", error);
            toast.error("Ошибка при вставке медиа");
        }
        setMediaModal({ isOpen: false, type: 'image', url: '' });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Создаем временную ссылку
        const localUrl = URL.createObjectURL(file);
        setMediaModal(prev => ({ ...prev, url: localUrl }));
    };

    if (!editor) return <div className="p-10 text-center opacity-20">Загрузка редактора...</div>;

    return (
        <div className="w-full flex flex-col bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm hover:shadow-md transition-all relative">
            
            {/* ПАНЕЛЬ ИНСТРУМЕНТОВ В СТИЛЕ NAVBAR */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 gap-2 border-b border-base-200 bg-base-50/30 backdrop-blur-sm sticky top-0 z-20">
                
                <div className="flex items-center flex-wrap gap-1">
                    {/* Группа: Базовые */}
                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`join-item btn btn-sm btn-ghost ${editor.isActive('bold') ? 'bg-primary/10 text-primary' : ''}`}><b>B</b></button>
                        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`join-item btn btn-sm btn-ghost ${editor.isActive('italic') ? 'bg-primary/10 text-primary' : ''}`}><i>I</i></button>
                        <button onClick={() => editor.chain().focus().toggleCode().run()} className={`join-item btn btn-sm btn-ghost ${editor.isActive('code') ? 'bg-primary/10 text-primary' : ''}`}>{`<>`}</button>
                    </div>

                    {/* Группа: Структура */}
                    <div className="join bg-base-100 border border-base-200 shadow-sm">
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`join-item btn btn-sm btn-ghost ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/10 text-primary' : ''}`}>H2</button>
                        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`join-item btn btn-sm btn-ghost ${editor.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>

                {/* Группа: Контент (С ПОДПИСЯМИ) */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setMediaModal({ isOpen: true, type: 'image', url: '' })}
                        className="btn btn-sm btn-outline border-base-300 gap-2 font-medium normal-case hover:bg-primary hover:border-primary"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Фото
                    </button>
                    
                    <button 
                        onClick={() => setMediaModal({ isOpen: true, type: 'video', url: '' })}
                        className="btn btn-sm btn-outline border-base-300 gap-2 font-medium normal-case hover:bg-error hover:border-error"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Видео
                    </button>

                    <button 
                        onClick={() => setMediaModal({ isOpen: true, type: 'link', url: editor.getAttributes('link').href || '' })}
                        className={`btn btn-sm gap-2 font-medium normal-case ${editor.isActive('link') ? 'btn-primary' : 'btn-outline border-base-300'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        Ссылка
                    </button>
                </div>

            </div>
            
            {/* РАБОЧАЯ ОБЛАСТЬ */}
            <div className="bg-white min-h-[400px]">
                <EditorContent editor={editor} />
            </div>

            {/* ОЧИСТКА ВНИЗУ */}
            <div className="p-2 border-t border-base-100 flex justify-end bg-base-50/20">
                <button onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="btn btn-xs btn-ghost text-base-content/40 hover:text-error">
                    Сбросить форматирование
                </button>
            </div>

            {/* УЛУЧШЕННАЯ МОДАЛКА */}
            {mediaModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-900/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 w-full max-w-sm overflow-hidden animate-slide-up">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-1">
                                {mediaModal.type === 'image' ? 'Изображение' : mediaModal.type === 'video' ? 'YouTube видео' : 'Ссылка'}
                            </h3>
                            <p className="text-sm text-base-content/50 mb-6">Введите URL адрес контента</p>

                            <div className="space-y-4">
                                <div className="form-control w-full">
                                    <input 
                                        type="text" 
                                        className="input input-bordered w-full bg-base-50 focus:bg-white" 
                                        placeholder="https://..."
                                        value={mediaModal.url} 
                                        onChange={(e) => setMediaModal({ ...mediaModal, url: e.target.value })} 
                                        autoFocus
                                    />
                                </div>
                                
                                {mediaModal.type === 'image' && (
                                    <div className="form-control w-full">
                                        <div className="divider text-[10px] uppercase tracking-widest opacity-40">Или файл</div>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="file-input file-input-bordered file-input-sm w-full" 
                                            onChange={handleFileUpload} 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-base-50 flex gap-2 justify-end">
                            <button onClick={() => setMediaModal({ isOpen: false, type: 'image', url: '' })} className="btn btn-ghost btn-sm px-6">Отмена</button>
                            <button onClick={handleMediaSubmit} className="btn btn-primary btn-sm px-8 shadow-lg shadow-primary/20">Добавить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


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

    // Состояния Тестов (Квизов)
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [currentQuizId, setCurrentQuizId] = useState(null); 


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

    const handleCreateLesson = async () => {
        if (!newLessonTitle.trim()) return;
        try {
            const res = await api.post(`courses/${courseId}/lessons/`, {
                title: newLessonTitle,
                order: lessons.length + 1,
                course: parseInt(courseId)
            });
            setLessons([...lessons, { ...res.data, steps: [] }]);
            setIsLessonModalOpen(false);
            setNewLessonTitle("");
            toast.success("Раздел успешно создан");
        } catch (err) {
            toast.error("Ошибка создания раздела");
        }
    };

    const handleDeleteLesson = async () => {
        setConfirmDialog({
            isOpen: true,
            title: "Удаление раздела",
            message: `Вы уверены, что хотите удалить раздел "${activeLesson.title}" со всеми его шагами? Это действие необратимо.`,
            confirmText: "Удалить",
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

    const handleSaveStep = async () => { 
        if (!activeStep) return;
        setLoading(true);
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
                        question: String(q.question), options, correct_answer: String(userIndex), 
                        correct_index: userIndex, explanation: "" 
                    };
                    if (q.id) mappedQ.id = q.id; 
                    return mappedQ;
                });
                
                const payload = {
                    lesson_id: Number(activeLesson.id),
                    quiz_title: activeStep.title || `Тест к уроку: ${activeLesson.title}`,
                    questions: payloadQuestions
                };
                if (currentQuizId) payload.quiz_id = currentQuizId;
                
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
            toast.success("Шаг сохранен");
        } catch (err) {
            toast.error("Ошибка сохранения");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCourseSettings = async () => {
        setLoading(true);
        try {
            await api.patch(`courses/${courseId}/`, courseData);
            toast.success("Настройки курса сохранены");
        } catch (err) { 
            toast.error("Ошибка сохранения курса"); 
        } finally {
            setLoading(false);
        }
    };

    if (loading && lessons.length === 0) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="loading loading-spinner text-primary"></span>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] max-w-7xl mx-auto text-base-content animate-fade-in"> 
            
            {/* === ЛЕВАЯ КОЛОНКА (САЙДБАР: УРОКИ) === */}
            <div className="w-80 bg-base-100 border-r border-base-200 flex flex-col h-full shrink-0 shadow-sm z-20">
                <div className="px-6 py-5 border-b border-base-200 flex justify-between items-center">
                    <h2 className="font-bold text-base-content truncate pr-4 text-lg" title={courseData.title}>
                        {courseData.title || "Конструктор курса"}
                    </h2>
                    <div className="flex gap-2 shrink-0">
                        <button 
                            className={`btn btn-sm btn-ghost btn-square ${isSettingsMode ? 'bg-base-200 text-base-content' : 'text-base-content/60'}`} 
                            onClick={() => { setIsSettingsMode(true); setActiveLesson(null); }} 
                            title="Настройки курса"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        <RouterLink to={`/courses/${courseId}`} className="btn btn-sm btn-ghost btn-square text-base-content/60" title="Предпросмотр курса">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </RouterLink>
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-4 space-y-2 bg-base-200/30">
                    <div className="text-xs font-bold text-base-content/40 uppercase tracking-widest mb-2 pl-2">Программа курса</div>
                    {lessons.map((lesson, index) => (
                        <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl cursor-pointer transition-colors border ${activeLesson?.id === lesson.id && !isSettingsMode ? "bg-primary/10 border-primary/20 text-primary" : "bg-base-100 border-base-200 text-base-content hover:border-base-300 shadow-sm"}`}
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

                <div className="p-4 border-t border-base-200 bg-base-100">
                    <button className="btn btn-outline border-base-300 w-full text-base-content/70 hover:bg-base-200 hover:border-base-300" onClick={() => setIsLessonModalOpen(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Добавить раздел
                    </button>
                </div>
            </div>

            {/* === ПРАВАЯ КОЛОНКА (КОНТЕНТ ШАГА) === */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-base-100 relative border-r border-base-200">
                
                {isSettingsMode ? (
                    <div className="flex-1 overflow-y-auto p-6 md:p-10">
                        <div className="max-w-3xl mx-auto bg-base-100 rounded-xl shadow-sm border border-base-200 p-8">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Настройки курса
                            </h2>
                            
                            <div className="space-y-6">
                                <div className="form-control">
                                    <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Название курса</span></label>
                                    <input type="text" className="input input-bordered border-base-300 bg-base-50 focus:bg-base-100 shadow-sm" value={courseData.title} onChange={(e) => setCourseData({...courseData, title: e.target.value})} />
                                </div>
                                <div className="form-control">
                                    <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Описание (Визитка)</span></label>
                                    <textarea className="textarea textarea-bordered border-base-300 bg-base-50 focus:bg-base-100 shadow-sm h-40 resize-none text-base" value={courseData.description} onChange={(e) => setCourseData({...courseData, description: e.target.value})}></textarea>
                                </div>
                                <div className="pt-4 border-t border-base-200">
                                    <button className={`btn btn-primary px-8 shadow-sm ${loading ? 'loading' : ''}`} onClick={handleSaveCourseSettings} disabled={loading}>
                                        Сохранить настройки
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeLesson ? (
                    <>
                        {/* Панель Шагов (Верхняя полоса с квадратными кнопками) */}
                        <div className="bg-base-100 border-b border-base-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
                            <div className="flex items-center gap-3 flex-1 overflow-x-auto no-scrollbar">
                                <span className="text-sm font-semibold text-base-content/60 mr-2 shrink-0">Шаги:</span>
                                <div className="flex gap-2">
                                    {activeLesson.steps?.map((step) => {
                                        let icon = "📝";
                                        if (step.step_type === 'video_url') icon = "▶️";
                                        if (step.step_type === 'quiz') icon = "❓";
                                        if (step.step_type === 'interactive_code') icon = "💻";

                                        const isActive = activeStep?.id === step.id;

                                        return (
                                            <button 
                                                key={step.id}
                                                onClick={() => setActiveStep(step)}
                                                className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-xl text-2xl transition-all border-2 
                                                    ${isActive ? 'bg-base-100 border-b-4 border-b-primary border-t-base-200 border-x-base-200 shadow-sm scale-105' : 'bg-base-100 border-base-200 hover:border-base-300 hover:bg-base-50 opacity-70 hover:opacity-100'}`}
                                                title={step.title}
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

                        {/* Редактор Конкретного Шага */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-base-200/20">
                            {activeStep ? (
                                <div className="max-w-4xl mx-auto animate-fade-in pb-20 space-y-6">
                                    
                                    {/* Шапка шага (Инпут названия) */}
                                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                                        <div className="flex-1 w-full">
                                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Название шага</span></label>
                                            <input type="text" className="input input-lg input-ghost w-full px-0 font-bold text-2xl focus:bg-base-50 focus:px-4 transition-all" value={activeStep.title || ""} onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} placeholder="Без названия" />
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button className="btn btn-outline border-base-300 text-error hover:bg-error hover:border-error hover:text-white" onClick={handleDeleteStep} title="Удалить шаг">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                            <button className={`btn btn-primary shadow-sm ${loading ? 'loading' : ''}`} onClick={() => handleSaveStep()} disabled={loading}>
                                                Сохранить шаг
                                            </button>
                                        </div>
                                    </div>

                                    {/* 1. ТЕКСТ или ВИДЕО (С НОВЫМ РЕДАКТОРОМ TIPTAP) */}
                                    {(activeStep.step_type === 'text' || activeStep.step_type === 'video_url') && (
                                        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
                                            {activeStep.step_type === 'video_url' && (
                                                <div className="p-6 border-b border-base-200 bg-base-50/50">
                                                    <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Ссылка на YouTube</span></label>
                                                    <input type="text" className="input input-bordered border-base-300 bg-base-100 w-full shadow-sm" placeholder="https://youtu.be/..." value={activeStep.content || ""} onChange={(e) => setActiveStep({...activeStep, content: e.target.value})} />
                                                </div>
                                            )}
                                            <div className="p-4 border-b border-base-100 bg-base-50 flex items-center gap-2">
                                                <span className="text-xl">{activeStep.step_type === 'text' ? '📝' : '▶️'}</span>
                                                <span className="text-sm font-semibold text-base-content/80">{activeStep.step_type === 'text' ? 'Содержание лекции' : 'Описание'}</span>
                                            </div>
                                            {/* 🔥 ВОТ ОН, НОВЫЙ ЧИСТЫЙ РЕДАКТОР 🔥 */}
                                            <TiptapEditor 
                                                key={activeStep.id} // Важно! Чтобы редактор очищался при смене шага
                                                content={activeStep.content || ""} 
                                                onChange={(newContent) => setActiveStep({...activeStep, content: newContent})} 
                                            />
                                        </div>
                                    )}

                                    {/* 2. ТЕСТЫ */}
                                    {activeStep.step_type === 'quiz' && (
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end pb-2">
                                                    <h3 className="text-lg font-bold">Редактор вопросов ({(quizQuestions || []).length})</h3>
                                                    <button className="btn btn-sm btn-ghost text-primary" onClick={handleAddManualQuestion}>+ Добавить вопрос</button>
                                                </div>
                                                
                                                {(!quizQuestions || quizQuestions.length === 0) ? (
                                                    <div className="text-center text-base-content/40 py-12 bg-base-100 border border-dashed border-base-300 rounded-xl text-sm font-medium">
                                                        Вопросов пока нет. Добавьте первый вопрос вручную.
                                                    </div>
                                                ) : (
                                                    quizQuestions.map((q, qIndex) => (
                                                        <div key={qIndex} className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 relative group">
                                                            <button className="btn btn-sm btn-circle btn-ghost text-base-content/30 hover:text-error hover:bg-error/10 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteQuestion(qIndex)} title="Удалить вопрос">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                            </button>
                                                            
                                                            <div className="form-control mb-4 pr-8">
                                                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/50 uppercase tracking-widest">Вопрос {qIndex + 1}</span></label>
                                                                <input type="text" className="input input-bordered border-base-300 bg-base-50 font-medium" value={q.question} onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)} />
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {q.options.map((opt, oIndex) => {
                                                                    const isUserSelected = (typeof q.user_selected_index === 'number') && q.user_selected_index === oIndex;
                                                                    return (
                                                                        <div key={oIndex} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isUserSelected ? 'bg-primary/5 border-primary/50 text-primary' : 'bg-base-100 border-base-200 hover:border-base-300'}`}>
                                                                            <input type="radio" name={`q-${qIndex}`} className="radio radio-primary radio-sm" checked={isUserSelected} onChange={() => handleCorrectSelect(qIndex, oIndex)} />
                                                                            <input type="text" className={`input input-sm input-ghost w-full px-1 focus:bg-base-100 ${isUserSelected ? 'font-semibold' : 'text-base-content/80'}`} value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Вариант ${oIndex + 1}`} />
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. ТРЕНАЖЕР КОДА */}
                                    {activeStep.step_type === 'interactive_code' && (
                                        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 md:p-8">
                                            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                                                <span className="text-2xl">💻</span>
                                                Тренажер кода (Python)
                                            </h3>
                                            <p className="text-sm text-base-content/60 mb-6">Студент получит встроенную среду разработки для выполнения задачи.</p>

                                            <div className="form-control mb-6">
                                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Текст задания (с новым редактором)</span></label>
                                                <div className="border border-base-200 rounded-xl overflow-hidden">
                                                    <TiptapEditor 
                                                        key={`tiptap-code-${activeStep.id}`} 
                                                        content={activeStep.content || ""} 
                                                        onChange={(newContent) => setActiveStep({...activeStep, content: newContent})} 
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-control mb-6">
                                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Начальный код (увидит студент)</span></label>
                                                <div className="h-64 rounded-xl overflow-hidden border border-base-300 bg-[#1e1e1e]">
                                                    <Editor
                                                        height="100%"
                                                        defaultLanguage="python"
                                                        theme="vs-dark"
                                                        value={activeStep.scenario_data?.initial_code || "def solve():\n    # Напишите код\n    pass"}
                                                        onChange={(value) => setActiveStep({
                                                            ...activeStep, scenario_data: { ...(activeStep.scenario_data || {}), initial_code: value }
                                                        })}
                                                        options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-control">
                                                <label className="label py-0 pb-1.5">
                                                    <span className="text-xs font-medium text-base-content/70">Ожидаемый вывод (Консоль)</span>
                                                </label>
                                                <input 
                                                    type="text" 
                                                    className="input input-bordered border-base-300 bg-base-50 font-mono text-sm" 
                                                    placeholder="Например: Hello World" 
                                                    value={activeStep.scenario_data?.expected_output || ""} 
                                                    onChange={(e) => setActiveStep({
                                                        ...activeStep, scenario_data: { ...(activeStep.scenario_data || {}), expected_output: e.target.value }
                                                    })} 
                                                />
                                                <label className="label py-0 pt-1.5">
                                                    <span className="text-[11px] text-base-content/40">Точное совпадение вывода консоли для успешного прохождения шага.</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                                    <div className="bg-base-200 p-4 rounded-full mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-base-content/60">Выберите шаг для редактирования</h3>
                                    <p className="text-sm">Или создайте новый на панели сверху</p>
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

            {/* МОДАЛКИ */}
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

            {/* МОДАЛКА СОЗДАНИЯ ШАГА С БОЛЬШИМИ КАРТОЧКАМИ */}
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
                                { type: 'quiz', icon: '❓', title: 'Тестирование', desc: 'Проверка знаний' },
                                { type: 'interactive_code', icon: '💻', title: 'Тренажер кода', desc: 'Интерактивный Python IDE' },
                            ].map((item) => (
                                <button 
                                    key={item.type} 
                                    onClick={() => handleCreateStep(item.type)} 
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

            {/* КАСТОМНОЕ МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ */}
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
                            <button className="btn btn-ghost btn-sm" onClick={closeDialog}>
                                Отмена
                            </button>
                            <button 
                                className={`btn btn-sm shadow-sm ${confirmDialog.isDanger ? 'btn-error' : 'btn-primary'}`} 
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