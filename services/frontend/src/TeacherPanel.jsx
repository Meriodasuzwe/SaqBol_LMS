import { useEffect, useState, useRef } from 'react';
import api from './api';      
import aiApi from './aiApi';  
import ReactQuill from 'react-quill-new';         
import 'react-quill-new/dist/quill.snow.css';      
import { toast } from 'react-toastify'; 

const quillModules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }], 
        ['bold', 'italic', 'underline', 'strike'], 
        [{ 'color': [] }, { 'background': [] }], 
        [{ 'list': 'ordered'}, { 'list': 'bullet' }], 
        ['link', 'image', 'video'], 
        ['clean'] 
    ],
};

function TeacherPanel({ preSelectedLessonId, preFilledText }) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Стейты тестов
    const [selectedLessonId, setSelectedLessonId] = useState(preSelectedLessonId || "");
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [quizzesList, setQuizzesList] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState("");
    const [newQuizTitle, setNewQuizTitle] = useState("");
    const [customText, setCustomText] = useState(preFilledText || "");
    const [count, setCount] = useState(3);
    const [difficulty, setDifficulty] = useState("medium");
    
    // Стейты файлов/курсов
    const [inputType, setInputType] = useState('text'); 
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    // Стейты процесса
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingCourse, setIsSavingCourse] = useState(false); 
    const [previewQuestions, setPreviewQuestions] = useState(null);
    const [generatedCourse, setGeneratedCourse] = useState(null); 

    // 🔥 СТЕЙТ ДЛЯ КАСТОМНОГО МОДАЛЬНОГО ОКНА 🔥
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: null,
        confirmText: "Подтвердить",
        isDanger: false // Делает кнопку красной
    });

    const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    const stripHtml = (html) => {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    };

    useEffect(() => {
        if (preSelectedLessonId) setSelectedLessonId(preSelectedLessonId);
        if (preFilledText) setCustomText(preFilledText);
        setPreviewQuestions(null);
    }, [preSelectedLessonId, preFilledText]);

    useEffect(() => { fetchCourses(); }, []);

    const fetchCourses = async () => {
        try {
            const res = await api.get('courses/');
            setCourses(res.data);
        } catch (err) { 
            console.error("Ошибка загрузки курсов:", err); 
            toast.error("Не удалось загрузить список курсов");
        } 
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (selectedLessonId) fetchQuizzesForLesson(selectedLessonId);
        else { setQuizzesList([]); setSelectedQuizId(""); }
    }, [selectedLessonId]);

    const fetchQuizzesForLesson = async (lessonId) => {
        try {
            const res = await api.get(`quizzes/lesson/${lessonId}/`);
            let data = res.data;
            if (!Array.isArray(data)) {
                 data = data.results ? data.results : [data];
            }
            setQuizzesList(data);
        } catch (err) {
            console.error('Ошибка загрузки тестов для урока:', err);
            setQuizzesList([]);
        }
    };

    // --- ЛОГИКА ГЕНЕРАЦИИ ТЕСТОВ ---
    const handleStartGeneration = async () => {
        const plainText = stripHtml(customText);
        if (!plainText || plainText.length < 10) {
            return toast.warning("Введите текст лекции (минимум 10 символов) для генерации.");
        }
        setIsGenerating(true);
        setPreviewQuestions(null); 
        setGeneratedCourse(null);
        
        try {
            const res = await aiApi.post('generate-quiz', {
                text: plainText,      
                count: Number(count),
                difficulty: difficulty
            });
            const questions = res.data.generated_questions || res.data;
            const normalized = Array.isArray(questions) ? questions.map(q => {
                const questionText = (q.question || q.text || q.prompt || q.title || '').trim();
                let rawOptions = q.options || q.choices || q.answers || q.variants || q.options_list || [];
                if (typeof rawOptions === 'string') rawOptions = rawOptions.split(/\r?\n|\||;|,|•|\-|\u2022/).map(s => s.trim()).filter(Boolean);
                let options = Array.isArray(rawOptions) ? rawOptions.map(o => {
                    if (!o) return '';
                    if (typeof o === 'string') return o.trim();
                    if (o.text) return String(o.text).trim();
                    return String(o).trim();
                }).filter(Boolean) : [];

                let correct = (q.correct_answer || q.correctAnswer || q.correct || '').toString().trim();
                let aiIndex = -1;
                if (correct && /^\d+$/.test(correct) && options.length > 0) {
                    const idx = parseInt(correct, 10);
                    if (idx >= 0 && idx < options.length) correct = options[idx];
                }
                if (options.length < 2) {
                    const placeholders = [];
                    if (correct) placeholders.push(correct);
                    while (placeholders.length < 4) placeholders.push(`Вариант ${placeholders.length + 1}`);
                    options = Array.from(new Set(placeholders));
                }
                let aiSuggestedIndex = -1;
                if (correct) aiSuggestedIndex = options.indexOf(correct);
                if (aiSuggestedIndex === -1) {
                    aiSuggestedIndex = 0;
                    correct = options[0] || '';
                }
                return {
                    question: questionText,
                    options,
                    correct_answer: correct,
                    explanation: q.explanation || '',
                    ai_suggested_index: aiSuggestedIndex,
                    user_selected_index: aiSuggestedIndex
                };
            }) : [];
            setPreviewQuestions(normalized);
            toast.success('✨ Тест успешно сгенерирован AI!');
        } catch (err) {
            console.error("Ошибка генерации AI:", err);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                 toast.error("Ошибка доступа к AI. Попробуйте перезайти в систему.");
            } else {
                 toast.error("AI не смог сгенерировать тест. Попробуйте другой текст.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // --- ЛОГИКА ГЕНЕРАЦИИ КУРСОВ ИЗ ФАЙЛА ---
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'pdf' && ext !== 'docx') {
                toast.warning('Пожалуйста, загрузите файл формата PDF или DOCX');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleFileGeneration = async () => {
        if (!selectedFile) return toast.warning("Выберите файл для анализа.");
        setIsGenerating(true);
        setPreviewQuestions(null);
        setGeneratedCourse(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await aiApi.post('generate-course-from-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setGeneratedCourse(res.data);
            toast.success('🧠 Черновик структуры курса создан!');
        } catch (err) {
            console.error("Ошибка генерации курса из файла:", err);
            toast.error(err.response?.data?.detail || "Ошибка при обработке файла.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveCourse = async () => {
        if (!generatedCourse || !generatedCourse.course_title) {
            return toast.warning("Название курса не может быть пустым!");
        }
        if (!generatedCourse.lessons || generatedCourse.lessons.length === 0) {
            return toast.warning("В курсе должен быть хотя бы один урок!");
        }
        
        setIsSavingCourse(true);
        try {
            await api.post('courses/bulk-create/', generatedCourse);
            toast.success('🎉 Курс и уроки успешно опубликованы!');
            setGeneratedCourse(null); 
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            fetchCourses(); 
        } catch (err) {
            console.error("Ошибка сохранения курса:", err);
            toast.error("Не удалось сохранить курс в базу данных.");
        } finally {
            setIsSavingCourse(false);
        }
    };

    // --- ФУНКЦИИ РЕДАКТИРОВАНИЯ ЧЕРНОВИКА КУРСА ---
    const handleCourseMetaChange = (field, value) => {
        setGeneratedCourse(prev => ({ ...prev, [field]: value }));
    };

    const handleLessonTitleChange = (lessonIndex, newTitle) => {
        const updatedCourse = { ...generatedCourse };
        updatedCourse.lessons[lessonIndex].title = newTitle;
        setGeneratedCourse(updatedCourse);
    };

    const handleLessonContentChange = (lessonIndex, newContent) => {
        const updatedCourse = { ...generatedCourse };
        updatedCourse.lessons[lessonIndex].content = newContent;
        setGeneratedCourse(updatedCourse);
    };

    const handleRemoveLessonFromDraft = (lessonIndex) => {
        // Вызываем нашу красивую модалку вместо window.confirm
        setConfirmDialog({
            isOpen: true,
            title: "Удаление урока",
            message: "Вы уверены, что хотите удалить этот урок из черновика? Это действие нельзя отменить.",
            confirmText: "Удалить",
            isDanger: true,
            onConfirm: () => {
                const updatedCourse = { ...generatedCourse };
                updatedCourse.lessons.splice(lessonIndex, 1);
                setGeneratedCourse(updatedCourse);
                toast.info("Урок удален из черновика.");
                closeDialog();
            }
        });
    };

    // --- ФУНКЦИИ РЕДАКТИРОВАНИЯ ТЕСТОВ ---
    const handleQuestionChange = (index, field, value) => {
        const updated = [...previewQuestions];
        updated[index][field] = value;
        setPreviewQuestions(updated);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...previewQuestions];
        updated[qIndex].options[oIndex] = value;
        if (updated[qIndex].user_selected_index === oIndex) {
            updated[qIndex].correct_answer = value;
        }
        setPreviewQuestions(updated);
    };

    const handleCorrectSelect = (qIndex, oIndex) => {
        const updated = [...previewQuestions];
        updated[qIndex].user_selected_index = oIndex;
        updated[qIndex].correct_answer = updated[qIndex].options[oIndex] || '';
        setPreviewQuestions(updated);
    };

    const handleAddManualQuestion = () => {
        const newQuestion = { question: "Новый вопрос", options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"], correct_answer: "Вариант 1", ai_suggested_index: 0, user_selected_index: 0, explanation: "" };
        setPreviewQuestions(previewQuestions ? [...previewQuestions, newQuestion] : [newQuestion]);
    };

    const handleDeleteQuestion = (index) => {
        const updated = previewQuestions.filter((_, i) => i !== index);
        setPreviewQuestions(updated);
    };

    // ФАЗА 1: Проверка перед сохранением тестов
    const handleSaveQuiz = async () => {
        if (!selectedLessonId) return toast.warning("Не выбран урок для сохранения!");
        if (!previewQuestions || previewQuestions.length === 0) return toast.warning("Нет вопросов для сохранения!");

        // Проверка на существующий тест
        if (selectedQuizId) {
            const existingQuiz = quizzesList.find(q => String(q.id) === String(selectedQuizId));
            
            if (existingQuiz && existingQuiz.questions && existingQuiz.questions.length > 0) {
                // Показываем модалку вместо window.confirm
                setConfirmDialog({
                    isOpen: true,
                    title: "Предупреждение",
                    message: `У теста "${existingQuiz.title}" уже есть вопросы (${existingQuiz.questions.length} шт.). Вы уверены, что хотите добавить новые ответы в этот тест?`,
                    confirmText: "Да, добавить",
                    isDanger: false,
                    onConfirm: () => {
                        closeDialog();
                        finalizeSaveQuiz(); // Запускаем сохранение, если юзер нажал "Да"
                    }
                });
                return; // Останавливаем выполнение функции, ждем решения юзера
            }
        } else if (!newQuizTitle.trim()) {
            return toast.warning("Пожалуйста, введите название для нового теста!");
        }

        // Если проблем нет — сохраняем сразу
        finalizeSaveQuiz();
    };

    // ФАЗА 2: Фактическая отправка на сервер
    const finalizeSaveQuiz = async () => {
        const payloadQuestions = previewQuestions.map(q => {
            const options = q.options.map(s => String(s || '').trim()).filter(Boolean);
            let userIndex = q.user_selected_index ?? 0;
            if (userIndex >= options.length) userIndex = 0;
            return { question: String(q.question), options, correct_answer: String(userIndex), correct_index: userIndex, explanation: String(q.explanation || '') };
        });

        for (const pq of payloadQuestions) {
            if (pq.options.length < 2) return toast.warning("В некоторых вопросах слишком мало вариантов ответа.");
        }

        const payload = { lesson_id: Number(selectedLessonId), questions: payloadQuestions };
        if (selectedQuizId) payload.quiz_id = Number(selectedQuizId);
        else payload.quiz_title = newQuizTitle.trim();

        try {
            await api.post(`quizzes/save-generated/`, payload);
            toast.success("✅ Тест утвержден и сохранен в базу!");
            setPreviewQuestions(null); 
            setNewQuizTitle(""); 
            if (selectedLessonId) fetchQuizzesForLesson(selectedLessonId);
        } catch (err) {
            console.error("Ошибка сохранения:", err);
            toast.error("Не удалось сохранить тест в БД.");
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 animate-fade-in font-sans bg-gray-50 min-h-screen">
            
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                    Студия Преподавателя
                    <span className="badge badge-primary badge-sm py-3 px-3 uppercase text-[10px] tracking-widest">AI Helper</span>
                </h1>
                <p className="text-gray-500 mt-2">Генерация тестов и сборка курсов с помощью искусственного интеллекта.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* --- ЛЕВАЯ КОЛОНКА (Инструменты) --- */}
                <div className="lg:col-span-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
                        
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                            <button 
                                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${inputType === 'text' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => { setInputType('text'); setGeneratedCourse(null); setPreviewQuestions(null); }}
                            >
                                📝 Тесты
                            </button>
                            <button 
                                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${inputType === 'file' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => { setInputType('file'); setGeneratedCourse(null); setPreviewQuestions(null); }}
                            >
                                📄 Сборка Курса
                            </button>
                        </div>

                        {inputType === 'text' && (
                            <div className="animate-fade-in space-y-4">
                                <div className="alert alert-info bg-blue-50 text-blue-700 border-none rounded-xl text-xs mb-2">
                                    Создайте вопросы для конкретного урока на основе текста.
                                </div>
                                <div className="form-control w-full">
                                    <label className="label pt-0"><span className="label-text font-bold text-gray-700">Целевой курс</span></label>
                                    <select className="select select-bordered select-sm bg-gray-50 focus:bg-white w-full" value={selectedCourseId} onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedLessonId(""); setQuizzesList([]); setSelectedQuizId(""); }}>
                                        <option value="">-- Выберите курс --</option>
                                        {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <label className="label pt-0"><span className="label-text font-bold text-gray-700">Урок</span></label>
                                    <select className="select select-bordered select-sm bg-gray-50 focus:bg-white w-full" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} disabled={!selectedCourseId}>
                                        <option value="">-- Выберите урок --</option>
                                        {selectedCourseId && courses?.find(c => String(c.id) === String(selectedCourseId))?.lessons?.map(l => (
                                            <option key={l.id} value={l.id}>{l.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <label className="label pt-0"><span className="label-text font-bold text-gray-700">Набор тестов</span></label>
                                    <select className="select select-bordered select-sm bg-gray-50 focus:bg-white w-full" value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)} disabled={!selectedLessonId}>
                                        <option value="">-- Создать новый тест --</option>
                                        {quizzesList?.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                                    </select>
                                    {!selectedQuizId && (
                                        <input 
                                            type="text" 
                                            placeholder="Название нового теста (например: Итоговый контроль)" 
                                            className="input input-bordered input-sm bg-gray-50 focus:bg-white mt-2 w-full" 
                                            value={newQuizTitle} 
                                            onChange={(e) => setNewQuizTitle(e.target.value)} 
                                        />
                                    )}
                                </div>
                                
                                <div className="divider text-[10px] uppercase font-bold text-gray-400 my-2">Исходные данные</div>

                                <div className="form-control w-full">
                                    <textarea className="textarea textarea-bordered bg-gray-50 focus:bg-white h-32 text-sm resize-none" placeholder="Вставьте текст лекции или конспект сюда..." value={customText} onChange={(e) => setCustomText(e.target.value)}></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-control">
                                        <label className="label pt-0"><span className="label-text text-xs text-gray-500">Вопросов</span></label>
                                        <input type="number" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} className="input input-bordered bg-gray-50 focus:bg-white" />
                                    </div>
                                    <div className="form-control">
                                        <label className="label pt-0"><span className="label-text text-xs text-gray-500">Сложность</span></label>
                                        <select className="select select-bordered bg-gray-50 focus:bg-white" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                            <option value="easy">Лёгкая</option>
                                            <option value="medium">Средняя</option>
                                            <option value="hard">Сложная</option>
                                        </select>
                                    </div>
                                </div>

                                <button className={`btn btn-primary w-full mt-4 text-white shadow-sm ${isGenerating ? 'loading' : ''}`} onClick={handleStartGeneration} disabled={isGenerating}>
                                    {isGenerating ? 'Нейросеть обрабатывает...' : 'Создать тесты'}
                                </button>
                            </div>
                        )}

                        {inputType === 'file' && (
                            <div className="animate-fade-in flex flex-col items-center text-center py-6">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-4">📄</div>
                                <h3 className="font-bold text-gray-800 mb-2">Генератор Курсов</h3>
                                <p className="text-sm text-gray-500 mb-6 px-4">Загрузите рабочую программу (PDF/DOCX). ИИ разобьет её на модули и уроки и создаст готовый черновик курса.</p>
                                
                                <div className="form-control w-full">
                                    <input type="file" accept=".pdf,.docx" className="file-input file-input-bordered bg-gray-50 w-full" onChange={handleFileChange} ref={fileInputRef} />
                                    {selectedFile && <span className="text-xs text-success mt-2 font-bold text-left">Файл готов: {selectedFile.name}</span>}
                                </div>

                                <button className={`btn btn-primary w-full mt-6 text-white shadow-sm ${isGenerating ? 'loading' : ''}`} onClick={handleFileGeneration} disabled={isGenerating || !selectedFile}>
                                    {isGenerating ? 'Идет анализ документа...' : 'Сгенерировать черновик'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- ПРАВАЯ КОЛОНКА (Результаты / Черновики) --- */}
                <div className="lg:col-span-8">
                    
                    {previewQuestions && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Черновик тестов</div>
                                    <h2 className="text-xl font-bold text-gray-800">Проверьте вопросы</h2>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button className="btn btn-outline border-gray-300 text-gray-600 flex-1 sm:flex-none" onClick={handleAddManualQuestion}>+ Вопрос</button>
                                    <button className="btn btn-success text-white shadow-sm flex-1 sm:flex-none" onClick={handleSaveQuiz}>Утвердить и Сохранить</button>
                                </div>
                            </div>
                            
                            {previewQuestions.map((q, qIndex) => (
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
                                                    <input type="text" className={`input input-sm w-full bg-transparent border-none px-0 focus:outline-none ${isUserSelected ? 'font-semibold text-primary' : 'text-gray-700'}`} value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} />
                                                    {isAiSuggested && !isUserSelected && <span className="badge badge-sm bg-gray-100 text-gray-400 border-none ml-2" title="AI считает этот ответ правильным">AI</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {generatedCourse && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white border-l-4 border-l-primary shadow-sm p-8 rounded-2xl flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-1 w-full">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                        <span>Черновик курса</span>
                                        <span className="badge badge-warning badge-sm">Не опубликован</span>
                                    </div>
                                    <input 
                                        className="input input-ghost px-0 text-3xl font-black text-gray-800 mb-2 w-full focus:bg-gray-50" 
                                        value={generatedCourse.course_title}
                                        onChange={(e) => handleCourseMetaChange('course_title', e.target.value)}
                                        placeholder="Название курса..."
                                    />
                                    <textarea 
                                        className="textarea textarea-ghost px-0 text-gray-600 leading-relaxed w-full h-24 focus:bg-gray-50 resize-none" 
                                        value={generatedCourse.course_description}
                                        onChange={(e) => handleCourseMetaChange('course_description', e.target.value)}
                                        placeholder="О чем этот курс..."
                                    />
                                </div>
                                <div className="hidden md:flex flex-col items-center justify-center w-24 h-24 bg-primary/5 text-primary rounded-xl shrink-0">
                                    <span className="text-2xl font-black">{generatedCourse.lessons?.length || 0}</span>
                                    <span className="text-xs font-bold uppercase">Уроков</span>
                                </div>
                            </div>

                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 px-1">Редактирование уроков:</h3>
                                <div className="flex flex-col gap-4">
                                    {generatedCourse.lessons?.map((lesson, idx) => (
                                        <div key={idx} className="collapse collapse-arrow bg-white border border-gray-200 shadow-sm rounded-xl overflow-visible">
                                            <input type="checkbox" defaultChecked={idx === 0} /> 
                                            <div className="collapse-title flex items-center gap-4 text-gray-800 pr-12">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-black shrink-0">{idx + 1}</div>
                                                <input 
                                                    className="input input-ghost input-sm text-lg font-bold flex-1 px-1 focus:bg-gray-50 z-10" 
                                                    value={lesson.title}
                                                    onChange={(e) => handleLessonTitleChange(idx, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()} 
                                                    placeholder="Название урока..."
                                                />
                                                <button 
                                                    className="btn btn-sm btn-ghost text-red-400 hover:bg-red-50 hover:text-red-600 z-10 shrink-0 tooltip"
                                                    data-tip="Удалить урок"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveLessonFromDraft(idx); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                </button>
                                            </div>
                                            <div className="collapse-content pb-6 px-6 relative z-0"> 
                                                <div className="mt-2 bg-white rounded-xl overflow-hidden border border-gray-200">
                                                    <ReactQuill 
                                                        theme="snow"
                                                        value={lesson.content}
                                                        onChange={(content) => handleLessonContentChange(idx, content)}
                                                        modules={quillModules}
                                                        className="h-64 mb-10" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {generatedCourse.lessons?.length === 0 && (
                                        <div className="text-center text-gray-400 py-10">
                                            Вы удалили все уроки из черновика.
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center mt-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <button className="btn btn-ghost text-red-500" onClick={() => setGeneratedCourse(null)}>Сбросить черновик</button>
                                <button 
                                    className={`btn btn-primary px-10 text-white shadow-sm ${isSavingCourse ? 'loading' : ''}`}
                                    onClick={handleSaveCourse}
                                    disabled={isSavingCourse || generatedCourse.lessons?.length === 0}
                                >
                                    {isSavingCourse ? 'Сохранение...' : 'Опубликовать курс 🚀'}
                                </button>
                            </div>
                        </div>
                    )}

                    {!previewQuestions && !generatedCourse && (
                        <div className="h-[500px] border-2 border-dashed border-gray-200 bg-white rounded-3xl flex flex-col items-center justify-center text-center p-10">
                             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                             </div>
                             <h3 className="text-xl font-bold text-gray-700">Рабочая область пуста</h3>
                             <p className="text-gray-500 mt-2 max-w-sm">Заполните данные слева и нажмите кнопку генерации, чтобы ИИ подготовил черновик.</p>
                        </div>
                    )}
                </div>
            </div>

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

export default TeacherPanel;