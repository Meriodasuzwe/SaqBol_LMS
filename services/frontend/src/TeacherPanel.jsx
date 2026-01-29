import { useEffect, useState } from 'react';
import api from './api';

function TeacherPanel() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Состояния для генератора
    const [selectedLessonId, setSelectedLessonId] = useState("");
    const [customText, setCustomText] = useState("");
    const [count, setCount] = useState(3);
    const [difficulty, setDifficulty] = useState("medium");
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState(null);

    useEffect(() => { fetchCourses(); }, []);

    const fetchCourses = async () => {
        try {
            const res = await api.get('courses/');
            setCourses(res.data);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    // Шаг 1: Запрос к AI через Бэкенд
    const handleStartGeneration = async () => {
        if (!selectedLessonId && !customText) return alert("Выберите урок или введите текст");
        
        setIsGenerating(true);
        setPreviewQuestions(null);
        
        try {
            // Мы передаем параметры в бэкенд, который перешлет их в AI сервис
            const res = await api.post(`quizzes/generate-preview/`, {
                lesson_id: selectedLessonId || null,
                custom_text: customText || null,
                count: count,
                difficulty: difficulty
            });
            setPreviewQuestions(res.data.generated_questions);
        } catch (err) {
            alert("Ошибка генерации. Проверь логи сервисов.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Шаг 2: Сохранение проверенных вопросов в базу
    const handleSaveQuiz = async () => {
        if (!selectedLessonId) return alert("Выберите урок, к которому прикрепить тест");
        try {
            await api.post(`quizzes/save-generated/`, {
                lesson_id: selectedLessonId,
                questions: previewQuestions
            });
            alert("✅ Тест успешно сохранен в базу!");
            setPreviewQuestions(null);
        } catch (err) {
            alert("Ошибка при сохранении");
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><span className="loading loading-spinner loading-lg"></span></div>;

    return (
        <div className="max-w-6xl mx-auto py-10 px-4">
            <h1 className="text-4xl font-black mb-10 flex items-center gap-4">
                👨‍🏫 Лаборатория Учителя <div className="badge badge-secondary">AI POWERED</div>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* КОЛОНКА НАСТРОЕК */}
                <div className="space-y-6">
                    <div className="card bg-base-100 shadow-xl border border-base-200 p-6">
                        <h2 className="card-title mb-4">1. Источник данных</h2>
                        
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Выбрать из курса</span></label>
                            <select className="select select-bordered" value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)}>
                                <option value="">-- Выберите урок --</option>
                                {courses.map(c => c.lessons.map(l => (
                                    <option key={l.id} value={l.id}>{c.title} : {l.title}</option>
                                )))}
                            </select>
                        </div>

                        <div className="divider">ИЛИ</div>

                        <div className="form-control w-full">
                            <label className="label"><span className="label-text font-bold">Свой текст / Лекция</span></label>
                            <textarea 
                                className="textarea textarea-bordered h-32" 
                                placeholder="Вставьте материал здесь..."
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                            ></textarea>
                        </div>
                    </div>

                    <div className="card bg-base-100 shadow-xl border border-base-200 p-6">
                        <h2 className="card-title mb-4">2. Параметры теста</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="label"><span className="label-text">Количество вопросов: <b>{count}</b></span></label>
                                <input type="range" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} className="range range-primary range-sm" />
                            </div>
                            <div>
                                <label className="label"><span className="label-text">Сложность</span></label>
                                <select className="select select-sm select-bordered w-full" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                    <option value="easy">Легкий (База)</option>
                                    <option value="medium">Средний (Применение)</option>
                                    <option value="hard">Сложный (Анализ)</option>
                                </select>
                            </div>
                            <button 
                                className={`btn btn-primary w-full mt-4 ${isGenerating ? 'loading' : ''}`}
                                onClick={handleStartGeneration}
                                disabled={isGenerating}
                            >
                                {isGenerating ? 'Генерирую...' : '🪄 Создать черновик'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* КОЛОНКА ПРЕДПРОСМОТРА */}
                <div className="lg:col-span-2">
                    {previewQuestions ? (
                        <div className="card bg-base-100 shadow-2xl border-2 border-primary/20">
                            <div className="card-body">
                                <h2 className="card-title text-2xl flex justify-between">
                                    Результат генерации
                                    <button className="btn btn-success btn-sm" onClick={handleSaveQuiz}>💾 Сохранить в урок</button>
                                </h2>
                                <div className="divider"></div>
                                <div className="space-y-6">
                                    {previewQuestions.map((q, idx) => (
                                        <div key={idx} className="bg-base-200 p-4 rounded-lg">
                                            <p className="font-bold text-lg mb-3">{idx + 1}. {q.question}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {q.options.map((opt, i) => (
                                                    <div key={i} className={`p-2 rounded border ${opt === q.correct_answer ? 'bg-success/20 border-success text-success-content font-bold' : 'bg-base-100 border-base-300'}`}>
                                                        {opt} {opt === q.correct_answer && "✓"}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-4 border-dashed border-base-300 rounded-3xl flex items-center justify-center text-base-content/30 italic">
                            {isGenerating ? "Нейросеть читает ваш текст..." : "Здесь появится черновик теста"}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TeacherPanel;