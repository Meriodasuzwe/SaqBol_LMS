import { useEffect, useState, useRef } from 'react';
import api from './api';      //  Для работы с Django (курсы, сохранение)
import aiApi from './aiApi';  //  Для работы с AI (генерация)
import ReactQuill from 'react-quill-new';         
import 'react-quill-new/dist/quill.snow.css';      

// Настройки для текстового редактора
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
    
    const [selectedLessonId, setSelectedLessonId] = useState(preSelectedLessonId || "");
    const [selectedCourseId, setSelectedCourseId] = useState("");
    const [quizzesList, setQuizzesList] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState("");
    const [newQuizTitle, setNewQuizTitle] = useState("");
    const [customText, setCustomText] = useState(preFilledText || "");
    const [count, setCount] = useState(3);
    const [difficulty, setDifficulty] = useState("medium");
    
    const [inputType, setInputType] = useState('text'); 
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingCourse, setIsSavingCourse] = useState(false); // 👈 Состояние загрузки сохранения курса
    const [previewQuestions, setPreviewQuestions] = useState(null);
    const [generatedCourse, setGeneratedCourse] = useState(null); 
    
    const [toast, setToast] = useState(null); 

    const stripHtml = (html) => {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    };

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
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
        } catch (err) { console.error("Ошибка загрузки курсов:", err); } 
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

    const handleStartGeneration = async () => {
        const plainText = stripHtml(customText);
        if (!plainText || plainText.length < 10) {
            return showToast('error', "Введите текст лекции (минимум 10 символов) для генерации.");
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
            showToast('success', 'Тест успешно сгенерирован AI!');
        } catch (err) {
            console.error("Ошибка генерации AI:", err);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                 showToast('error', "Ошибка доступа к AI. Попробуйте перезайти в систему.");
            } else {
                 showToast('error', "AI не смог сгенерировать тест. Попробуйте другой текст.");
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'pdf' && ext !== 'docx') {
                showToast('error', 'Пожалуйста, загрузите файл формата PDF или DOCX');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleFileGeneration = async () => {
        if (!selectedFile) return showToast('error', "Выберите файл для анализа.");
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
            showToast('success', 'Структура курса успешно создана!');
        } catch (err) {
            console.error("Ошибка генерации курса из файла:", err);
            showToast('error', err.response?.data?.detail || "Ошибка при обработке файла.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    // ОТПРАВКА КУРСА В БАЗУ ДАННЫХ 
    const handleSaveCourse = async () => {
        if (!generatedCourse) return;
        
        setIsSavingCourse(true);
        try {
            // ВЕРНУЛИ courses/ на место!
            await api.post('courses/bulk-create/', generatedCourse);
            
            showToast('success', 'Курс и уроки успешно сохранены в БД!');
            setGeneratedCourse(null); // Очищаем экран
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            
            // Обновляем список курсов слева, чтобы новый курс сразу появился в выпадающем списке
            fetchCourses(); 
        } catch (err) {
            console.error("Ошибка сохранения курса:", err);
            showToast('error', "Не удалось сохранить курс в базу данных.");
        } finally {
            setIsSavingCourse(false);
        }
    };

    const handleLessonContentChange = (lessonIndex, newContent) => {
        const updatedCourse = { ...generatedCourse };
        updatedCourse.lessons[lessonIndex].content = newContent;
        setGeneratedCourse(updatedCourse);
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

    const handleSaveQuiz = async () => {
        if (!selectedLessonId) return showToast("error", "Не выбран урок для сохранения!");
        if (!previewQuestions || previewQuestions.length === 0) return showToast("error", "Нет вопросов для сохранения!");

        const payloadQuestions = previewQuestions.map(q => {
            const options = q.options.map(s => String(s || '').trim()).filter(Boolean);
            let userIndex = q.user_selected_index ?? 0;
            if (userIndex >= options.length) userIndex = 0;
            return { question: String(q.question), options, correct_answer: String(userIndex), correct_index: userIndex, explanation: String(q.explanation || '') };
        });

        for (const pq of payloadQuestions) {
            if (pq.options.length < 2) return showToast("error", "В вопросе слишком мало вариантов ответа.");
        }

        const payload = { lesson_id: Number(selectedLessonId), questions: payloadQuestions };
        if (selectedQuizId) payload.quiz_id = Number(selectedQuizId);
        else if (newQuizTitle) payload.quiz_title = newQuizTitle.trim();

        try {
            await api.post(`quizzes/save-generated/`, payload);
            showToast("success", "Тест сохранен в базу данных!");
            setPreviewQuestions(null); 
            if (selectedLessonId) fetchQuizzesForLesson(selectedLessonId);
        } catch (err) {
            console.error("Ошибка сохранения:", err);
            showToast("error", "Не удалось сохранить тест в БД.");
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 animate-fade-in">
            {toast && (
                <div className="fixed top-4 right-4 z-50 animate-slide-in">
                    <div className={`alert alert-${toast.type} shadow-lg rounded-lg flex items-center gap-3`}>
                        <span className="font-semibold">{toast.message}</span>
                    </div>
                </div>
            )}
            <h1 className="text-4xl font-black mb-10 flex items-center gap-4 tracking-tighter">
                Лаборатория Учителя <div className="badge badge-secondary badge-lg py-4">AI HELPER</div>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ЛЕВАЯ КОЛОНКА */}
                <div className="lg:col-span-4">
                    <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sticky top-24">
                        <div className="tabs tabs-boxed mb-6 justify-center bg-base-200/50 p-1">
                            <a className={`tab tab-sm font-bold ${inputType === 'text' ? 'tab-active bg-primary text-white' : ''}`} onClick={() => setInputType('text')}>📝 Текст (Тесты)</a> 
                            <a className={`tab tab-sm font-bold ${inputType === 'file' ? 'tab-active bg-secondary text-white' : ''}`} onClick={() => setInputType('file')}>📄 Файл (Курсы)</a> 
                        </div>

                        {inputType === 'text' && (
                            <div className="animate-fade-in">
                                <div className="form-control w-full">
                                    <label className="label"><span className="label-text font-bold">Курс</span></label>
                                    <select className="select select-bordered" value={selectedCourseId} onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedLessonId(""); setQuizzesList([]); setSelectedQuizId(""); }}>
                                        <option value="">-- Выберите курс --</option>
                                        {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-control w-full mt-4">
                                    <label className="label"><span className="label-text font-bold">Урок</span></label>
                                    <select className="select select-bordered" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} disabled={!selectedCourseId}>
                                        <option value="">-- Выберите урок --</option>
                                        {selectedCourseId && courses?.find(c => String(c.id) === String(selectedCourseId))?.lessons?.map(l => (
                                            <option key={l.id} value={l.id}>{l.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-control w-full mt-4">
                                    <label className="label"><span className="label-text font-bold">Тест</span></label>
                                    <select className="select select-bordered" value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)} disabled={!selectedLessonId}>
                                        <option value="">-- Создать новый тест --</option>
                                        {quizzesList?.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                                    </select>
                                    {!selectedQuizId && <input type="text" placeholder="Название (опционально)" className="input input-bordered mt-2" value={newQuizTitle} onChange={(e) => setNewQuizTitle(e.target.value)} />}
                                </div>
                                
                                <div className="divider text-[10px] uppercase font-bold opacity-50">Контекст лекции</div>

                                <div className="form-control w-full">
                                    <textarea className="textarea textarea-bordered h-32 text-sm" placeholder="Вставьте текст лекции сюда..." value={customText} onChange={(e) => setCustomText(e.target.value)}></textarea>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="form-control">
                                        <label className="label"><span className="label-text text-xs">Вопросов</span></label>
                                        <input type="number" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} className="input input-bordered" />
                                    </div>
                                    <div className="form-control">
                                        <label className="label"><span className="label-text text-xs">Сложность</span></label>
                                        <select className="select select-bordered" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                </div>

                                <button className={`btn btn-primary w-full mt-8 ${isGenerating ? 'loading' : ''}`} onClick={handleStartGeneration} disabled={isGenerating}>
                                    {isGenerating ? 'AI Думает...' : '🪄 Сгенерировать тесты'}
                                </button>
                            </div>
                        )}

                        {inputType === 'file' && (
                            <div className="animate-fade-in text-center py-4">
                                <div className="text-4xl mb-4">📄</div>
                                <h3 className="font-bold mb-2">Анализ документов</h3>
                                <p className="text-sm text-gray-500 mb-6">Загрузите рабочую программу или методичку (PDF/Word), и AI создаст готовую структуру курса с уроками.</p>
                                
                                <div className="form-control w-full items-center">
                                    <input type="file" accept=".pdf,.docx" className="file-input file-input-bordered file-input-secondary w-full max-w-xs" onChange={handleFileChange} ref={fileInputRef} />
                                    {selectedFile && <span className="text-xs text-success mt-2 font-bold">Выбран: {selectedFile.name}</span>}
                                </div>

                                <button className={`btn btn-secondary w-full mt-8 ${isGenerating ? 'loading' : ''}`} onClick={handleFileGeneration} disabled={isGenerating || !selectedFile}>
                                    {isGenerating ? 'AI Читает файл...' : '🧠 Создать структуру курса'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА */}
                <div className="lg:col-span-8">
                    
                    {previewQuestions && (
                        <div className="space-y-6 pb-24 animate-fade-in">
                            <div className="flex justify-between items-center mb-4 border-b pb-4">
                                <h2 className="text-2xl font-bold">📝 Сгенерированные тесты</h2>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-outline" onClick={handleAddManualQuestion}>➕</button>
                                    <button className="btn btn-sm btn-success text-white" onClick={handleSaveQuiz}>💾 Сохранить</button>
                                </div>
                            </div>
                            
                            {previewQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="card bg-base-100 shadow-md border border-base-200 p-6 relative group">
                                    <button className="btn btn-circle btn-xs btn-error absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteQuestion(qIndex)}>✕</button>
                                    <div className="form-control mb-4">
                                        <label className="label text-[10px] font-bold uppercase text-gray-400">Вопрос #{qIndex + 1}</label>
                                        <input type="text" className="input input-bordered font-bold text-lg w-full bg-base-50" value={q.question} onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                        {q.options.map((opt, oIndex) => {
                                            const isUserSelected = (typeof q.user_selected_index === 'number') && q.user_selected_index === oIndex;
                                            const isAiSuggested = (typeof q.ai_suggested_index === 'number') && q.ai_suggested_index === oIndex;
                                            return (
                                                <div key={oIndex} className={`flex items-center gap-3 p-2 rounded-xl ${isAiSuggested ? 'bg-yellow-50 border border-yellow-200' : 'bg-base-200/50'}`}>
                                                    <input type="radio" name={`q-${qIndex}`} className="radio radio-primary radio-sm" checked={isUserSelected} onChange={() => handleCorrectSelect(qIndex, oIndex)} />
                                                    <input type="text" className={`input input-sm w-full bg-transparent border-none ${isUserSelected ? 'font-bold text-primary' : ''}`} value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} />
                                                    {isAiSuggested && <span className="badge badge-sm badge-outline ml-2">AI</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-center mt-12">
                                <button className="btn btn-wide btn-success btn-lg text-white shadow-xl" onClick={handleSaveQuiz}>Утвердить тесты</button>
                            </div>
                        </div>
                    )}

                    {generatedCourse && (
                        <div className="space-y-6 pb-24 animate-fade-in">
                            <div className="card bg-gradient-to-r from-secondary to-primary text-primary-content shadow-xl p-8 rounded-3xl">
                                <h2 className="text-3xl font-black mb-2">{generatedCourse.course_title}</h2>
                                <p className="opacity-90">{generatedCourse.course_description}</p>
                            </div>

                            <div className="mt-8">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    📚 Содержание курса <span className="badge badge-secondary">{generatedCourse.lessons?.length || 0} уроков</span>
                                </h3>
                                
                                <div className="flex flex-col gap-4">
                                    {generatedCourse.lessons?.map((lesson, idx) => (
                                        <div key={idx} className="collapse collapse-arrow bg-base-100 border border-base-200 shadow-sm rounded-xl">
                                            <input type="checkbox" defaultChecked={idx === 0} /> 
                                            <div className="collapse-title text-lg font-bold flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-sm">{idx + 1}</div>
                                                {lesson.title}
                                            </div>
                                            <div className="collapse-content pb-4"> 
                                            <div className="mt-2 bg-base-100 rounded-xl overflow-hidden border border-base-300">
                                                <ReactQuill 
                                                    theme="snow"
                                                    value={lesson.content}
                                                    onChange={(content) => handleLessonContentChange(idx, content)}
                                                    modules={quillModules}
                                                    className="h-64 mb-12" 
                                                />
                                            </div>
                                        </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex justify-center mt-12">
                                {/* 🔥 КНОПКА ТЕПЕРЬ РАБОТАЕТ */}
                                <button 
                                    className={`btn btn-wide btn-secondary btn-lg shadow-xl shadow-secondary/30 ${isSavingCourse ? 'loading' : ''}`}
                                    onClick={handleSaveCourse}
                                    disabled={isSavingCourse}
                                >
                                    {isSavingCourse ? 'Сохранение...' : '⚡ Создать курс в базе'}
                                </button>
                            </div>
                        </div>
                    )}

                    {!previewQuestions && !generatedCourse && (
                        <div className="h-[500px] border-2 border-dashed border-base-300 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10 opacity-60">
                             <div className="text-6xl mb-4">🤖</div>
                             <h3 className="text-xl font-bold">AI Помощник готов</h3>
                             <p>Выберите нужный режим слева, чтобы начать магию.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TeacherPanel;