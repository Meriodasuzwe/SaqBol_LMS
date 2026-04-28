import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ArrowRight, User, Wifi, Battery, Signal, Terminal, AlertTriangle } from 'lucide-react';

export default function FakeMessenger({ scenario: rawScenario, onComplete }) {
    // 🔥 ВОТ ТОТ САМЫЙ ФИКС: Распаковываем JSON, если ИИ засунул его внутрь "scenario_data"
    const scenario = rawScenario?.scenario_data || rawScenario;

    const [chatHistory, setChatHistory] = useState([]);
    const [currentStepId, setCurrentStepId] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [gameOver, setGameOver] = useState(null); 
    const chatEndRef = useRef(null);
    const [time, setTime] = useState('12:00');

    useEffect(() => {
        const now = new Date();
        setTime(now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        if (scenario && scenario.steps && scenario.steps.length > 0) {
            setChatHistory([]);
            setGameOver(null);
            setCurrentStepId(scenario.steps[0].id);
        }
    }, [scenario]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isTyping, gameOver]);

    useEffect(() => {
        if (!currentStepId || gameOver || !scenario?.steps) return;
        const step = scenario.steps.find(s => s.id === currentStepId);
        if (!step) return;

        if (step.type === 'message') {
            setIsTyping(true);
            const delay = Math.min(Math.max(step.text?.length * 25, 800), 2000);

            const timer = setTimeout(() => {
                setIsTyping(false);
                setChatHistory(prev => [...prev, { id: Date.now(), sender: 'bot', text: step.text }]);
                if (step.next_step_id) {
                    setCurrentStepId(step.next_step_id);
                } else {
                    // Если next_step_id пустой, значит хакер сдался или диалог окончен (как в твоем JSON на 8 шаге)
                    setGameOver({ isSuccess: true, explanation: "Диалог завершен. Вы не поддались на уловки мошенника." });
                }
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [currentStepId, gameOver, scenario]);

    const handleChoice = (option) => {
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'user', text: option.text }]);

        if (option.is_fatal) {
            setTimeout(() => {
                setGameOver({ isSuccess: false, explanation: option.explanation || "КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ." });
                setCurrentStepId(null);
            }, 600);
        } else if (option.is_success) {
            setTimeout(() => {
                setGameOver({ isSuccess: true, explanation: option.explanation || "Атака успешно отражена." });
                setCurrentStepId(null);
            }, 600);
        } else if (option.next_step_id) {
            setCurrentStepId(option.next_step_id);
        } else {
            // Фолбэк, если ИИ забыл указать куда идти дальше
            setGameOver({ isSuccess: true, explanation: "Вы успешно прервали контакт с мошенником." });
        }
    };

    // 🔥 ЗАЩИТА ОТ ПУСТОГО ЭКРАНА: если JSON вообще кривой, покажем ошибку
    if (!scenario || !scenario.steps) {
        return (
            <div className="flex flex-col items-center justify-center p-10 bg-red-50 text-red-500 rounded-2xl border border-red-200">
                <AlertTriangle size={48} className="mb-4" />
                <h3 className="font-bold text-lg mb-2">Ошибка загрузки сценария</h3>
                <p className="text-sm opacity-80 text-center">ИИ сгенерировал неверный формат данных. Попробуйте пересоздать сценарий в админке.</p>
            </div>
        );
    }

    const currentStep = scenario.steps.find(s => s.id === currentStepId);
    const showOptions = currentStep && currentStep.type === 'choice' && !isTyping && !gameOver;

    return (
        <div className="flex justify-center items-center py-10 w-full">
            <style>{`
                @keyframes glitch-anim {
                    0% { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 2px); }
                    20% { clip-path: inset(80% 0 1% 0); transform: translate(2px, -2px); }
                    40% { clip-path: inset(40% 0 40% 0); transform: translate(2px, 2px); }
                    60% { clip-path: inset(2% 0 90% 0); transform: translate(-2px, -2px); }
                    80% { clip-path: inset(60% 0 20% 0); transform: translate(2px, 2px); }
                    100% { clip-path: inset(30% 0 50% 0); transform: translate(-2px, -2px); }
                }
                .glitch-effect {
                    animation: glitch-anim 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
                    color: red;
                    text-shadow: 2px 0 blue, -2px 0 lime;
                }
                .scanline {
                    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
                    background-size: 100% 4px;
                    position: absolute; left: 0; right: 0; top: 0; bottom: 0;
                    pointer-events: none;
                    z-index: 50;
                }
            `}</style>

            <div className="w-[360px] h-[720px] bg-white dark:bg-slate-900 rounded-[3rem] border-[12px] border-slate-800 shadow-2xl relative flex flex-col overflow-hidden ring-4 ring-slate-900/10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>

                <div className="flex justify-between items-center px-6 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 z-10 bg-white dark:bg-slate-900">
                    <span>{time}</span>
                    <div className="flex items-center gap-1.5">
                        <Signal size={12} />
                        <Wifi size={12} />
                        <Battery size={14} />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 z-10">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-inner">
                        {scenario.contact_name ? scenario.contact_name[0] : <User size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {scenario.contact_name || "Неизвестный"}
                        </h3>
                        <p className="text-[10px] text-indigo-500 font-medium">в сети</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-[#0f172a] relative">
                    <div className="text-center my-2">
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
                            Сегодня
                        </span>
                    </div>

                    {chatHistory.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in zoom-in-95 duration-200`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
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
                    <div ref={chatEndRef} />
                </div>

                {showOptions && (
                    <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-3 pb-6 animate-in slide-in-from-bottom-2 duration-200 z-10">
                        <div className="flex flex-col gap-2">
                            {currentStep.options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleChoice(option)}
                                    className="text-left w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 active:bg-indigo-50 dark:active:bg-indigo-900/30 transition-all text-[13px] font-medium text-slate-700 dark:text-slate-300 shadow-sm"
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                                    Завершить
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 bg-[#0a0a0a] text-red-500 flex flex-col relative overflow-hidden animate-in fade-in duration-100">
                                <div className="scanline"></div>
                                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 relative z-10">
                                    <Terminal size={56} className="mb-4 glitch-effect" />
                                    <h2 className="text-3xl font-black mb-2 uppercase tracking-widest glitch-effect font-mono">
                                        FATAL ERROR
                                    </h2>
                                    <div className="bg-red-950/50 border border-red-900 rounded-lg p-4 mb-8 text-left w-full font-mono text-[11px] text-red-400">
                                        <p className="opacity-50">&gt; Executing payload...</p>
                                        <p className="opacity-50">&gt; Extracting credentials...</p>
                                        <p className="text-red-300 mt-2 font-bold">{gameOver.explanation}</p>
                                    </div>
                                </div>
                                <div className="p-6 relative z-10">
                                    <button 
                                        onClick={() => {
                                            setChatHistory([]);
                                            setGameOver(null);
                                            setCurrentStepId(scenario.steps[0].id);
                                        }}
                                        className="w-full border-2 border-red-600 text-red-500 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.5)] active:scale-95 transition-all font-mono"
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