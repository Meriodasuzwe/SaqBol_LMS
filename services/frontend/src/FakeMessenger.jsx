import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, User, Wifi, Battery, Signal, Terminal, Send } from 'lucide-react';
import api from './api';

export default function FakeMessenger({ scenario: rawScenario, onComplete, stepId }) {
    
    // Парсим начальные данные
    let scenario = rawScenario;
    while (typeof scenario === 'string') {
        try { scenario = JSON.parse(scenario); } catch (e) { break; }
    }
    if (scenario && scenario.scenario_data) scenario = scenario.scenario_data;

    const [chatHistory, setChatHistory] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [gameOver, setGameOver] = useState(null); 
    
    // 🔥 1. Изменили ref. Теперь он будет висеть на самом контейнере сообщений
    const chatContainerRef = useRef(null); 
    const [time, setTime] = useState('12:00');

    // При старте компонента добавляем первое сообщение от бота
    useEffect(() => {
        const now = new Date();
        setTime(now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        
        if (scenario && scenario.steps && scenario.steps.length > 0) {
            setChatHistory([{ 
                id: Date.now(), 
                sender: 'bot', 
                text: scenario.steps[0].text || "Здравствуйте." 
            }]);
            setGameOver(null);
        }
    }, [scenario]);

    // 🔥 2. Правильный автоскролл, который не дергает всю страницу
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [chatHistory, isTyping, gameOver]);

    
    // 🔥 БОЕВАЯ ОТПРАВКА СООБЩЕНИЯ К ИИ 🔥
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!inputText.trim() || isTyping || gameOver) return;

        const userMsg = inputText.trim();
        setInputText('');
        
        // 1. Создаем обновленный массив истории СРАЗУ
        const updatedHistory = [...chatHistory, { id: Date.now(), sender: 'user', text: userMsg }];
        
        // 2. Обновляем визуал чата
        setChatHistory(updatedHistory);
        setIsTyping(true); 

        try {
            // 3. Отправляем в запросе ИМЕННО updatedHistory!
            const response = await api.post(`courses/steps/${stepId}/chat-reply/`, {
                message: userMsg,
                history: updatedHistory 
            });

            const data = response.data;

            if (data.reply) {
                setChatHistory(prev => [...prev, { id: Date.now(), sender: 'bot', text: data.reply }]);
            }

            if (data.isSuccess === true || data.isSuccess === false) {
                setTimeout(() => {
                    setGameOver({ 
                        isSuccess: data.isSuccess, 
                        explanation: data.explanation 
                    });
                }, 1000);
            }

        } catch (error) {
            console.error("Ошибка при запросе к ИИ:", error);
            const errorMsg = error.response?.data?.error || "⚠️ Ошибка связи с сервером. Проверьте интернет.";
            setChatHistory(prev => [...prev, { id: Date.now(), sender: 'bot', text: errorMsg }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!scenario) return null;

    return (
        <div className="flex justify-center items-center py-10 w-full animate-in fade-in duration-500">
            <div className="w-[360px] h-[720px] bg-white dark:bg-slate-900 rounded-[3rem] border-[12px] border-slate-800 shadow-2xl relative flex flex-col overflow-hidden ring-4 ring-slate-900/10">
                
                {/* Челка айфона */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>

                {/* Статус бар */}
                <div className="flex justify-between items-center px-6 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 z-10 bg-white dark:bg-slate-900">
                    <span>{time}</span>
                    <div className="flex items-center gap-1.5">
                        <Signal size={12} />
                        <Wifi size={12} />
                        <Battery size={14} />
                    </div>
                </div>

                {/* Шапка чата */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 z-10">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-inner font-bold text-lg">
                        {scenario.contact_name ? scenario.contact_name[0] : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {scenario.contact_name || "Неизвестный номер"}
                        </h3>
                        <p className="text-[10px] text-indigo-500 font-medium">в сети</p>
                    </div>
                </div>

                {/* 🔥 3. Повесили ref={chatContainerRef} прямо сюда */}
                {/* Окно сообщений */}
                <div 
                    ref={chatContainerRef} 
                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-[#0f172a] relative scroll-smooth"
                >
                    <div className="text-center my-2">
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
                            Сегодня
                        </span>
                    </div>

                    {chatHistory.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in zoom-in-95 duration-200`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                                msg.sender === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                    {/* Пустой div внизу больше не нужен, мы его удалили! */}
                </div>

                {/* 🔥 ЗОНА ВВОДА ТЕКСТА 🔥 */}
                {!gameOver && (
                    <form 
                        onSubmit={handleSendMessage}
                        className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-3 z-10 flex items-end gap-2"
                    >
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Сообщение..."
                            disabled={isTyping}
                            className="flex-1 max-h-24 min-h-[44px] bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-400 rounded-2xl px-4 py-3 text-[14px] text-slate-900 dark:text-white outline-none resize-none transition-all disabled:opacity-50 no-scrollbar"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isTyping}
                            className="w-11 h-11 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:bg-slate-300 shadow-sm"
                        >
                            <Send size={18} className="ml-1" />
                        </button>
                    </form>
                )}

                {/* Экран победы / проигрыша */}
                {gameOver && (
                    <div className="absolute inset-0 z-50 flex flex-col">
                        {gameOver.isSuccess ? (
                            <div className="flex-1 bg-emerald-500 text-white flex flex-col p-6 animate-in fade-in duration-500">
                                <div className="flex-1 flex flex-col justify-center items-center text-center">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                                        <ShieldCheck size={48} className="text-white" />
                                    </div>
                                    <h2 className="text-2xl font-black mb-2 uppercase tracking-widest">Угроза устранена</h2>
                                    <p className="text-sm text-emerald-50 opacity-90 leading-relaxed mb-8">
                                        {gameOver.explanation}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => onComplete(10)}
                                    className="w-full bg-white text-emerald-600 font-black uppercase tracking-widest py-4 rounded-xl shadow-xl active:scale-95 transition-transform"
                                >
                                    Завершить шаг
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 bg-[#0a0a0a] text-red-500 flex flex-col relative overflow-hidden animate-in fade-in duration-100">
                                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 relative z-10">
                                    <Terminal size={56} className="mb-4 text-red-500" />
                                    <h2 className="text-3xl font-black mb-2 uppercase tracking-widest font-mono">
                                        FATAL ERROR
                                    </h2>
                                    <div className="bg-red-950/50 border border-red-900 rounded-lg p-4 mb-8 text-left w-full font-mono text-[11px] text-red-400">
                                        <p className="text-red-300 mt-2 font-bold">{gameOver.explanation}</p>
                                    </div>
                                </div>
                                <div className="p-6 relative z-10">
                                    <button 
                                        onClick={() => {
                                            setChatHistory([{ id: Date.now(), sender: 'bot', text: scenario.steps[0].text }]);
                                            setGameOver(null);
                                        }}
                                        className="w-full border-2 border-red-600 text-red-500 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all font-mono"
                                    >
                                        REBOOT SYSTEM
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}