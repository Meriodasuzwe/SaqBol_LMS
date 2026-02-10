import { useEffect, useState } from 'react';
import api from './api';

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
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState(null);

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
        } catch (err) { console.error("Ошибка загрузки курсов:", err); } 
        finally { setLoading(false); }
    };

    // When lesson changes, fetch quizzes for that lesson
    useEffect(() => {
        if (selectedLessonId) fetchQuizzesForLesson(selectedLessonId);
        else { setQuizzesList([]); setSelectedQuizId(""); }
    }, [selectedLessonId]);

    const fetchQuizzesForLesson = async (lessonId) => {
        try {
            const res = await api.get(`quizzes/?lesson_id=${lessonId}`);
            setQuizzesList(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {
            console.error('Ошибка загрузки тестов для урока:', err.response?.data || err.message);
            setQuizzesList([]);
        }
    };

    const handleStartGeneration = async () => {
        if (!selectedLessonId && !customText) return alert("Выберите урок или введите текст");
        setIsGenerating(true);
        setPreviewQuestions(null); 
        
        try {
            const plainText = stripHtml(customText);
            const res = await api.post(`quizzes/generate-preview/`, {
                lesson_id: selectedLessonId ? Number(selectedLessonId) : null,
                custom_text: plainText || null,
                count: Number(count),
                difficulty: difficulty
            });

            const questions = res.data.generated_questions || res.data;
            // Нормализуем каждый вопрос: обеспечим поля question, options (array), correct_answer, explanation
            const normalized = Array.isArray(questions) ? questions.map(q => {
                const questionText = (q.question || q.text || q.prompt || q.title || '').trim();
                
                // Try multiple keys that AI might return
                let rawOptions = q.options || q.choices || q.answers || q.variants || q.options_list || q.generated_options || [];

                // If options come as a single string, try splitting by common separators
                if (typeof rawOptions === 'string') {
                    rawOptions = rawOptions.split(/\r?\n|\||;|,|•|\-|\u2022/).map(s => s.trim()).filter(Boolean);
                }

                // Normalize option items (objects or strings)
                let options = Array.isArray(rawOptions) ? rawOptions.map(o => {
                    if (!o) return '';
                    if (typeof o === 'string') return o.trim();
                    if (typeof o === 'number') return String(o);
                    if (o.text) return String(o.text).trim();
                    if (o.value) return String(o.value).trim();
                    return String(o).trim();
                }).filter(Boolean) : [];

                // Determine correct answer from multiple possible keys
                let correct = (q.correct_answer || q.correctAnswer || q.correct || q.answer || q.correct_option || '').toString().trim();

                // If correct is numeric index, convert to value
                if (correct && /^\d+$/.test(correct) && options.length > 0) {
                    const idx = parseInt(correct, 10);
                    if (idx >= 0 && idx < options.length) correct = options[idx];
                }

                // If options are empty but AI returned an object 'answers' mapping or similar
                if (options.length === 0 && (q.answers && typeof q.answers === 'object')) {
                    // try to extract values
                    options = Object.values(q.answers).map(v => (typeof v === 'string' ? v.trim() : (v && v.text ? v.text : ''))).filter(Boolean);
                }

                // If still no options, build placeholders: include correct (if exists) plus generated distractors
                if (options.length < 2) {
                    const placeholders = [];
                    if (correct) placeholders.push(correct);
                    // generate placeholder variants
                    while (placeholders.length < 4) placeholders.push(`Вариант ${placeholders.length + 1}`);
                    // Merge unique
                    options = Array.from(new Set(placeholders));
                }

                // Ensure correct is one of options; if not, fallback to first
                if (!correct || !options.includes(correct)) {
                    correct = options[0] || '';
                }

                const explanation = (q.explanation || q.explain || q.expl || q.hint || '').toString().trim();

                return {
                    question: questionText,
                    options,
                    correct_answer: correct,
                    explanation
                };
            }) : [];
             setPreviewQuestions(normalized);
        } catch (err) {
            console.error("Ошибка генерации:", err.response?.data || err.message);
            alert("Ошибка генерации. Проверьте консоль.");
        } finally {
            setIsGenerating(false);
        }
    };

    // --- ФУНКЦИИ РЕДАКТИРОВАНИЯ ---
    const handleQuestionChange = (index, field, value) => {
        const updated = [...previewQuestions];
        updated[index][field] = value;
        setPreviewQuestions(updated);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...previewQuestions];
        const oldOptionValue = updated[qIndex].options[oIndex];
        updated[qIndex].options[oIndex] = value;
        if (oldOptionValue === updated[qIndex].correct_answer) {
            updated[qIndex].correct_answer = value;
        }
        setPreviewQuestions(updated);
    };

    const handleCorrectSelect = (qIndex, value) => {
        const updated = [...previewQuestions];
        updated[qIndex].correct_answer = value;
        setPreviewQuestions(updated);
    };

    const handleAddManualQuestion = () => {
        const newQuestion = {
            question: "Новый вопрос",
            options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
            correct_answer: "Вариант 1",
            explanation: "" 
        };
        setPreviewQuestions(previewQuestions ? [...previewQuestions, newQuestion] : [newQuestion]);
    };

    const handleDeleteQuestion = (index) => {
        const updated = previewQuestions.filter((_, i) => i !== index);
        setPreviewQuestions(updated);
    };

    // --- СОХРАНЕНИЕ (ИСПРАВЛЕНО) ---
    const handleSaveQuiz = async () => {
        if (!selectedLessonId || selectedLessonId === "") {
            return alert("Ошибка: Не выбран ID урока. Выберите урок в списке слева.");
        }
        
        if (!previewQuestions || previewQuestions.length === 0) {
            return alert("Нет вопросов для сохранения!");
        }

        // ПРЕОБРАЗОВАНИЕ ДАННЫХ (Важно!)
        // Если твой бэкенд ждет "text" вместо "question", меняем здесь.
        // Формируем payload в формате, ожидаемом сервером:
        // { question: string, options: [string], correct_answer: string, explanation: string }
        const payloadQuestions = previewQuestions.map(q => {
            const optionsRaw = Array.isArray(q.options) ? q.options : [];
            // Нормализуем: если опция объект {text:...} — берем text, если строка — оставляем
            const options = optionsRaw
                .map(o => (typeof o === 'string' ? o : (o && o.text ? o.text : '')))
                .map(s => (s == null ? '' : String(s).trim()))
                .filter(s => s.length > 0);

            let correct = (typeof q.correct_answer === 'string') ? q.correct_answer : (q.correct_answer && q.correct_answer.text ? q.correct_answer.text : '');
            correct = correct ? String(correct).trim() : '';

            // Если correct отсутствует в options, пытаемся подставить первый вариант
            if (correct && !options.includes(correct)) {
                // возможно correct приходил как индекс
                const idx = Number(correct);
                if (!Number.isNaN(idx) && options[idx]) correct = options[idx];
                else correct = options[0] || '';
            }

            return {
                question: q.question ? String(q.question) : '',
                options,
                correct_answer: correct,
                explanation: q.explanation ? String(q.explanation) : ''
            };
        });

        // Валидация: убедимся что каждая запись имеет минимум 2 опции
        for (const [i, pq] of payloadQuestions.entries()) {
            if (!pq.options || pq.options.length < 2) {
                return alert(`Ошибка: в вопросе #${i+1} недостаточно вариантов (нужно минимум 2).`);
            }
            if (!pq.correct_answer || !pq.options.includes(pq.correct_answer)) {
                // если нет корректного варианта, ставим первый
                pq.correct_answer = pq.options[0];
            }
        }

        const payload = {
            lesson_id: Number(selectedLessonId),
            questions: payloadQuestions
        };

        // Если выбран существующий тест - передаём его ID, иначе можно передать title для создания нового
        if (selectedQuizId) payload.quiz_id = Number(selectedQuizId);
        else if (newQuizTitle && newQuizTitle.trim().length > 0) payload.quiz_title = newQuizTitle.trim();

        console.log("📤 Отправка данных на сохранение:", payload);

        try {
            const res = await api.post(`quizzes/save-generated/`, payload);
            console.log("📥 Ответ сервера:", res.data);
            alert("✅ Тест успешно сохранен в базу!");
            setPreviewQuestions(null); 
            if (!preFilledText) setCustomText("");
            
            // После сохранения — обновим список тестов для урока
            if (selectedLessonId) fetchQuizzesForLesson(selectedLessonId);
        } catch (err) {
            // ВЫВОДИМ ПОЛНУЮ ОШИБКУ В КОНСОЛЬ
            console.error("❌ ОШИБКА СОХРАНЕНИЯ:", err.response?.data || err.message);
            const errorMsg = err.response?.data?.error || err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message;
            alert(`Ошибка при сохранении: ${errorMsg}`);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>;

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 animate-fade-in">
            <h1 className="text-4xl font-black mb-10 flex items-center gap-4 tracking-tighter">
                Лаборатория Учителя <div className="badge badge-secondary badge-lg py-4">AI HELPER</div>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* ЛЕВАЯ КОЛОНКА: НАСТРОЙКИ */}
                <div className="lg:col-span-4">
                    <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sticky top-24">
                        <h2 className="card-title mb-4">⚙️ Настройки</h2>
                        
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Курс</span></label>
                            <select className="select select-bordered" value={selectedCourseId} onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedLessonId(""); setQuizzesList([]); setSelectedQuizId(""); }}>
                                <option value="">-- Выберите курс --</option>
                                {courses?.map(c => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-control w-full mt-4">
                            <label className="label"><span className="label-text font-bold">Урок</span></label>
                            <select className="select select-bordered" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} disabled={!!preSelectedLessonId || !selectedCourseId}>
                                <option value="">-- Выберите урок --</option>
                                {selectedCourseId && courses?.find(c => String(c.id) === String(selectedCourseId))?.lessons?.map(l => (
                                    <option key={l.id} value={l.id}>{l.title}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-control w-full mt-4">
                            <label className="label"><span className="label-text font-bold">Тест (существующий или новый)</span></label>
                            <select className="select select-bordered" value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)} disabled={!selectedLessonId}>
                                <option value="">-- Создать новый тест --</option>
                                {quizzesList?.map(q => (
                                    <option key={q.id} value={q.id}>{q.title || `Тест #${q.id}`}</option>
                                ))}
                            </select>
                            {!selectedQuizId && (
                                <input type="text" placeholder="Название нового теста (необязательно)" className="input input-bordered mt-2" value={newQuizTitle} onChange={(e) => setNewQuizTitle(e.target.value)} />
                            )}
                        </div>
                        
                        <div className="divider text-[10px] uppercase font-bold opacity-50">Контекст</div>

                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Текст лекции</span></label>
                            <textarea 
                                className="textarea textarea-bordered h-48 text-sm" 
                                placeholder="Текст для анализа..."
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text text-xs">Вопросов</span></label>
                                <input type="number" min="1" max="15" value={count} onChange={(e) => setCount(e.target.value)} className="input input-bordered" />
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

                        <button 
                            className={`btn btn-primary w-full mt-8 ${isGenerating ? 'loading' : ''}`}
                            onClick={handleStartGeneration}
                            disabled={isGenerating}
                        >
                            {isGenerating ? 'Анализирую...' : '🪄 Сгенерировать'}
                        </button>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА: РЕДАКТОР */}
                <div className="lg:col-span-8">
                    {previewQuestions ? (
                        <div className="space-y-6 pb-24">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">📝 Проверка черновика</h2>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-outline" onClick={handleAddManualQuestion}>➕</button>
                                    <button className="btn btn-sm btn-success text-white" onClick={handleSaveQuiz}>💾 Сохранить</button>
                                </div>
                            </div>

                            {previewQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="card bg-base-100 shadow-md border border-base-200 p-6 relative group">
                                    <button 
                                        className="btn btn-circle btn-xs btn-error absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteQuestion(qIndex)}
                                    >✕</button>

                                    <div className="form-control mb-4">
                                        <label className="label text-[10px] font-bold uppercase text-gray-400">Вопрос #{qIndex + 1}</label>
                                        <input 
                                            type="text" 
                                            className="input input-bordered font-bold text-lg w-full bg-base-50" 
                                            value={q.question}
                                            onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                        {q.options.map((opt, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-3 p-2 rounded-xl bg-base-200/50">
                                                <input 
                                                    type="radio" 
                                                    name={`q-${qIndex}`} 
                                                    className="radio radio-primary radio-sm"
                                                    checked={opt === q.correct_answer}
                                                    onChange={() => handleCorrectSelect(qIndex, opt)}
                                                />
                                                <input 
                                                    type="text" 
                                                    className={`input input-sm w-full bg-transparent border-none ${opt === q.correct_answer ? 'font-bold text-primary' : ''}`}
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="collapse collapse-arrow bg-primary/5 rounded-xl border border-primary/10">
                                        <input type="checkbox" /> 
                                        <div className="collapse-title text-xs font-bold text-primary flex items-center gap-2">
                                            💡 Объяснение
                                        </div>
                                        <div className="collapse-content"> 
                                            <textarea 
                                                className="textarea textarea-bordered w-full h-20 text-sm"
                                                value={q.explanation || ""}
                                                onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-center mt-12">
                                <button className="btn btn-wide btn-success btn-lg text-white" onClick={handleSaveQuiz}>
                                    Утвердить и опубликовать
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] border-2 border-dashed border-base-300 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10 bg-base-100">
                             <div className="text-7xl opacity-20 mb-4">✨</div>
                             <h3 className="text-xl font-bold opacity-60">Жду ваших настроек</h3>
                             <p className="text-sm opacity-40">Выберите урок и нажмите кнопку генерации.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TeacherPanel;