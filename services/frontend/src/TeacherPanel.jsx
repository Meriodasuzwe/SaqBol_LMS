import { useEffect, useState } from 'react';
import api from './api';

// 1. Принимаем пропсы (параметры) из CourseBuilder
function TeacherPanel({ preSelectedLessonId, preFilledText }) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 2. Инициализируем стейт: если пропсы есть, берем их, иначе пустые строки
    const [selectedLessonId, setSelectedLessonId] = useState(preSelectedLessonId || "");
    const [customText, setCustomText] = useState(preFilledText || "");
    const [count, setCount] = useState(3);
    const [difficulty, setDifficulty] = useState("medium");
    
    // Состояния интерфейса
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState(null);

    // 3. Следим за изменениями: если учитель переключил урок в CourseBuilder, обновляем здесь
    useEffect(() => {
        if (preSelectedLessonId) setSelectedLessonId(preSelectedLessonId);
        if (preFilledText) setCustomText(preFilledText);
        // Сбрасываем старые вопросы при смене урока
        setPreviewQuestions(null);
    }, [preSelectedLessonId, preFilledText]);

    useEffect(() => { fetchCourses(); }, []);

    const fetchCourses = async () => {
        try {
            const res = await api.get('courses/');
            setCourses(res.data);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    // --- ЛОГИКА ГЕНЕРАЦИИ (ШАГ 1) ---
    const handleStartGeneration = async () => {
        if (!selectedLessonId && !customText) return alert("Выберите урок или введите текст");
        
        setIsGenerating(true);
        setPreviewQuestions(null); 
        
        try {
            const res = await api.post(`quizzes/generate-preview/`, {
                lesson_id: selectedLessonId || null,
                custom_text: customText || null,
                count: count,
                difficulty: difficulty
            });
            setPreviewQuestions(res.data.generated_questions);
        } catch (err) {
            alert("Ошибка генерации. Проверь консоль.");
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    // --- ЛОГИКА РЕДАКТИРОВАНИЯ (ШАГ 2) ---

    const handleQuestionChange = (index, field, value) => {
        const updated = [...previewQuestions];
        updated[index][field] = value;
        setPreviewQuestions(updated);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const updated = [...previewQuestions];
        updated[qIndex].options[oIndex] = value;
        
        if (previewQuestions[qIndex].options[oIndex] === previewQuestions[qIndex].correct_answer) {
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
        setPreviewQuestions([
            ...previewQuestions, 
            {
                question: "Новый вопрос",
                options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
                correct_answer: "Вариант 1",
                explanation: "" 
            }
        ]);
    };

    const handleDeleteQuestion = (index) => {
        const updated = previewQuestions.filter((_, i) => i !== index);
        setPreviewQuestions(updated);
    };

    // --- СОХРАНЕНИЕ (ШАГ 3) ---
    const handleSaveQuiz = async () => {
        if (!selectedLessonId) return alert("Выберите урок слева, к которому нужно прикрепить этот тест!");
        
        try {
            await api.post(`quizzes/save-generated/`, {
                lesson_id: selectedLessonId,
                questions: previewQuestions 
            });
            alert("✅ Тест успешно сохранен в базу!");
            setPreviewQuestions(null); 
            // Не очищаем customText, если он пришел из пропсов, чтобы не сбивать контекст
            if (!preFilledText) setCustomText("");
        } catch (err) {
            console.error(err);
            alert("Ошибка при сохранении");
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg"></span></div>;

    return (
        <div className="max-w-7xl mx-auto py-10 px-4">
            <h1 className="text-4xl font-black mb-10 flex items-center gap-4">
                👨‍🏫 Лаборатория Учителя <div className="badge badge-secondary badge-lg">AI HYBRID</div>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* ЛЕВАЯ КОЛОНКА: НАСТРОЙКИ */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sticky top-10">
                        <h2 className="card-title mb-4">⚙️ Настройки генерации</h2>
                        
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Целевой урок</span></label>
                            <select 
                                className="select select-bordered" 
                                value={selectedLessonId} 
                                onChange={(e) => setSelectedLessonId(e.target.value)}
                                // Если ID передан сверху (из CourseBuilder), блокируем выбор, чтобы не сломать логику
                                disabled={!!preSelectedLessonId}
                            >
                                <option value="">-- Выберите урок --</option>
                                {courses.map(c => c.lessons.map(l => (
                                    <option key={l.id} value={l.id}>{c.title} : {l.title}</option>
                                )))}
                            </select>
                        </div>

                        <div className="divider text-xs">ИСТОЧНИК ЗНАНИЙ</div>

                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Текст лекции / Материал</span></label>
                            <textarea 
                                className="textarea textarea-bordered h-40 text-sm" 
                                placeholder="Вставьте сюда текст лекции..."
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Вопросов</span></label>
                                <input type="number" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} className="input input-bordered input-sm" />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Сложность</span></label>
                                <select className="select select-sm select-bordered w-full" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                    <option value="easy">Легко</option>
                                    <option value="medium">Средне</option>
                                    <option value="hard">Сложно</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            className={`btn btn-primary w-full mt-6 ${isGenerating ? 'loading' : ''}`}
                            onClick={handleStartGeneration}
                            disabled={isGenerating}
                        >
                            {isGenerating ? 'Думаю...' : '🪄 Сгенерировать черновик'}
                        </button>
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА: РЕДАКТОР */}
                <div className="lg:col-span-8">
                    {previewQuestions ? (
                        <div className="space-y-6 pb-20">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">📝 Редактор теста</h2>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-outline" onClick={handleAddManualQuestion}>➕ Вопрос</button>
                                    <button className="btn btn-sm btn-success text-white" onClick={handleSaveQuiz}>💾 Сохранить всё</button>
                                </div>
                            </div>

                            {previewQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="card bg-base-100 shadow-md border border-base-200 p-6 relative group">
                                    <button 
                                        className="btn btn-circle btn-xs btn-error absolute top-4 right-4 opacity-10 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteQuestion(qIndex)}
                                        title="Удалить вопрос"
                                    >✕</button>

                                    {/* Редактирование вопроса */}
                                    <div className="form-control mb-4">
                                        <label className="label text-xs font-bold uppercase text-base-content/50">Вопрос {qIndex + 1}</label>
                                        <input 
                                            type="text" 
                                            className="input input-bordered font-bold text-lg w-full" 
                                            value={q.question}
                                            onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                                        />
                                    </div>

                                    {/* Варианты ответов */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {q.options.map((opt, oIndex) => (
                                            <div key={oIndex} className="flex items-center gap-2">
                                                <input 
                                                    type="radio" 
                                                    name={`q-${qIndex}`} 
                                                    className="radio radio-success radio-sm"
                                                    checked={opt === q.correct_answer}
                                                    onChange={() => handleCorrectSelect(qIndex, opt)}
                                                />
                                                <input 
                                                    type="text" 
                                                    className={`input input-sm input-bordered w-full ${opt === q.correct_answer ? 'input-success border-2' : ''}`}
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Поле объяснения */}
                                    <div className="collapse collapse-arrow bg-blue-50 border border-blue-100 rounded-box">
                                        <input type="checkbox" /> 
                                        <div className="collapse-title text-sm font-medium text-blue-800 flex items-center gap-2">
                                            💡 Объяснение ответа (развернуть)
                                        </div>
                                        <div className="collapse-content"> 
                                            <textarea 
                                                className="textarea textarea-bordered w-full h-20"
                                                placeholder="Объясните студенту, почему этот ответ правильный..."
                                                value={q.explanation || ""}
                                                onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="flex justify-center mt-8">
                                <button className="btn btn-wide btn-success btn-lg shadow-xl" onClick={handleSaveQuiz}>
                                    ✅ Утвердить и Сохранить
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[500px] border-4 border-dashed border-base-300 rounded-3xl flex flex-col items-center justify-center text-base-content/40 bg-base-100">
                            {isGenerating ? (
                                <>
                                    <span className="loading loading-dots loading-lg text-primary mb-4"></span>
                                    <p className="animate-pulse">AI методист анализирует ваш текст...</p>
                                </>
                            ) : (
                                <>
                                    <div className="text-6xl mb-4">👈</div>
                                    <p className="text-xl font-bold">
                                        {preSelectedLessonId ? "Урок выбран автоматически." : "Выберите урок или вставьте текст,"}
                                    </p>
                                    <p>Нажмите кнопку слева, чтобы начать.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TeacherPanel;