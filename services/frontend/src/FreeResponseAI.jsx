import React, { useState } from 'react';
import { BrainCircuit, Send, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
// import api from './api'; // Раскомментируем, когда будем подключать бэкенд

export default function FreeResponseAI({ stepData, onComplete }) {
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Достаем ситуацию из данных шага. Если данных нет - показываем демо-ситуацию.
    const situation = stepData?.scenario_data?.situation || 
        "Тебе звонит человек, представившийся сотрудником IT-отдела. Говорит, что проводит плановое обновление и ему нужен твой пароль от корпоративной почты для «синхронизации аккаунта». Что ты ответишь?";

    const submitAnswer = async () => {
        if (!answer.trim() || loading) return;
        
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // 🔥 ЗДЕСЬ БУДЕТ РЕАЛЬНЫЙ ЗАПРОС К DJANGO 🔥
            // const res = await api.post(`courses/steps/${stepData.id}/analyze/`, { answer });
            // setResult(res.data);

            // 👇 А пока имитируем работу нейросети (заглушка для теста UI) 👇
            setTimeout(() => {
                // Простая логика для теста: если ответ длиннее 15 символов - "сдал", иначе - "не сдал"
                const score = answer.length > 15 ? 85 : 40; 
                setResult({
                    score: score,
                    verdict: score >= 70 ? "Отличный ответ" : "Частично верно / Неверно",
                    strength: score >= 70 ? "Вы не поддались панике и отказали вымогателю." : "",
                    gap: score < 70 ? "Ответ слишком короткий. Вы не сообщили об инциденте в СБ." : "",
                    ideal: "Правильное действие: Ответить отказом, положить трубку и немедленно сообщить в отдел информационной безопасности по официальному номеру."
                });
                setLoading(false);
            }, 2000);

        } catch (e) {
            setError("Ошибка связи с сервером. Попробуйте еще раз.");
            setLoading(false);
        }
    };

    const isSuccess = result?.score >= 70;
    const scoreColor = isSuccess ? 'text-emerald-500' : result?.score >= 40 ? 'text-amber-500' : 'text-red-500';
    const scoreBg = isSuccess ? 'bg-emerald-500' : result?.score >= 40 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            
            {/* ── ЗАГОЛОВОК И СИТУАЦИЯ ── */}
            <div className="bg-base-100 rounded-3xl border border-base-300 shadow-xl overflow-hidden">
                <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-50 dark:from-indigo-900/20 to-base-100 border-b border-base-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BrainCircuit size={20} />
                        </div>
                        <h2 className="text-xl font-black text-base-content uppercase tracking-tight">Анализ решения (ИИ)</h2>
                    </div>
                    <p className="text-base-content/90 leading-relaxed font-medium text-[15px]">
                        {situation}
                    </p>
                </div>

                {/* ── ПОЛЕ ВВОДА ── */}
                <div className="p-6 sm:p-8 bg-base-100">
                    <label className="block text-xs font-bold uppercase tracking-widest text-base-content/50 mb-3">
                        Ваши действия:
                    </label>
                    <textarea
                        value={answer}
                        onChange={(e) => {
                            setAnswer(e.target.value);
                            if (result) setResult(null); // сбрасываем результат при редактировании
                        }}
                        placeholder="Опишите, как вы поступите в этой ситуации и почему..."
                        disabled={loading || isSuccess} // блокируем, если грузится или уже сдал
                        className="w-full min-h-[120px] p-4 bg-base-200/50 border border-base-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-y text-[15px] leading-relaxed text-base-content disabled:opacity-60"
                    />

                    {!result && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={submitAnswer}
                                disabled={!answer.trim() || loading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ИИ анализирует...
                                    </>
                                ) : (
                                    <>Получить оценку <Send size={18} /></>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── ОШИБКА ── */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in">
                    <AlertTriangle size={20} />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* ── РЕЗУЛЬТАТ ОТ ИИ ── */}
            {result && (
                <div className="bg-base-100 border border-base-300 rounded-3xl p-6 sm:p-8 shadow-xl animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-black text-base-content/40 mb-1">Вердикт ИИ</p>
                            <h3 className="text-2xl font-black text-base-content">{result.verdict}</h3>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="flex items-baseline gap-1">
                                <span className={`text-4xl font-black ${scoreColor}`}>{result.score}</span>
                                <span className="text-base-content/40 font-bold">/ 100</span>
                            </div>
                        </div>
                    </div>

                    {/* Полоса прогресса оценки */}
                    <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden mb-8">
                        <div 
                            className={`h-full ${scoreBg} transition-all duration-1000 ease-out`} 
                            style={{ width: `${result.score}%` }} 
                        />
                    </div>

                    {/* Детальный разбор */}
                    <div className="space-y-4 mb-8">
                        {result.strength && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70 mb-1">✓ Сильная сторона</span>
                                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{result.strength}</p>
                            </div>
                        )}
                        {result.gap && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 rounded-xl">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-red-600/70 dark:text-red-400/70 mb-1">✗ Ошибка или упущение</span>
                                <p className="text-sm font-medium text-red-800 dark:text-red-300">{result.gap}</p>
                            </div>
                        )}
                        {result.ideal && (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-xl">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-600/70 dark:text-indigo-400/70 mb-1">💡 Как нужно было поступить</span>
                                <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">{result.ideal}</p>
                            </div>
                        )}
                    </div>

                    {/* Кнопки действий после проверки */}
                    <div className="flex justify-end border-t border-base-200 pt-6">
                        {isSuccess ? (
                            <button 
                                onClick={() => onComplete(result.score)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                            >
                                Шаг пройден <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button 
                                onClick={() => {
                                    setResult(null);
                                    setAnswer("");
                                }}
                                className="bg-base-200 hover:bg-base-300 text-base-content font-bold py-3 px-6 rounded-xl transition-all text-sm"
                            >
                                Попробовать снова
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}