import React from 'react';
import { useTranslation } from 'react-i18next';
import TiptapEditor from './TiptapEditor';
import QuizGenerator from './QuizGenerator';
import CodeEditor from './CodeEditor';
import { 
    Trash2, Save, FileText, MonitorPlay, 
    ShieldAlert, TerminalSquare, MessageSquare, Plus, Check, X, ShieldCheck, UserCircle2, Bot, AlertTriangle
} from 'lucide-react';

// ==========================================
// ПРЕМИУМ РЕДАКТОР СЦЕНАРИЯ (UI/UX ОБНОВЛЕН)
// ==========================================
const ScenarioVisualEditor = ({ scenarioData, onChange }) => {
    const data = scenarioData || { contact_name: "Неизвестный", steps: [] };
    const steps = data.steps || [];

    const updateContactName = (val) => onChange({ ...data, contact_name: val });

    const updateStepText = (index, text) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], text };
        onChange({ ...data, steps: newSteps });
    };

    const updateOptionText = (stepIndex, optIndex, text) => {
        const newSteps = [...steps];
        const newOptions = [...newSteps[stepIndex].options];
        newOptions[optIndex] = { ...newOptions[optIndex], text };
        newSteps[stepIndex].options = newOptions;
        onChange({ ...data, steps: newSteps });
    };

    const toggleOptionOutcome = (stepIndex, optIndex, type) => {
        const newSteps = [...steps];
        const newOptions = [...newSteps[stepIndex].options];
        const opt = newOptions[optIndex];

        if (type === 'success') {
            opt.is_success = !opt.is_success;
            if (opt.is_success) {
                delete opt.is_fatal;
                delete opt.next_step_id;
                opt.explanation = opt.explanation || "Вы успешно отразили атаку!";
            } else {
                opt.next_step_id = stepIndex + 2; 
                delete opt.explanation;
            }
        } else if (type === 'fatal') {
            opt.is_fatal = !opt.is_fatal;
            if (opt.is_fatal) {
                delete opt.is_success;
                delete opt.next_step_id;
                opt.explanation = opt.explanation || "Критическая ошибка. Вы поддались мошеннику.";
            } else {
                opt.next_step_id = stepIndex + 2;
                delete opt.explanation;
            }
        }
        newOptions[optIndex] = opt;
        newSteps[stepIndex].options = newOptions;
        onChange({ ...data, steps: newSteps });
    };

    const updateOptionExplanation = (stepIndex, optIndex, text) => {
        const newSteps = [...steps];
        const newOptions = [...newSteps[stepIndex].options];
        newOptions[optIndex].explanation = text;
        newSteps[stepIndex].options = newOptions;
        onChange({ ...data, steps: newSteps });
    };

    const removeOption = (stepIndex, optIndex) => {
        const newSteps = [...steps];
        newSteps[stepIndex].options = newSteps[stepIndex].options.filter((_, i) => i !== optIndex);
        onChange({ ...data, steps: newSteps });
    };

    const addOption = (stepIndex) => {
        const newSteps = [...steps];
        newSteps[stepIndex].options.push({ text: "", next_step_id: stepIndex + 2 });
        onChange({ ...data, steps: newSteps });
    };

    return (
        <div className="mt-8 space-y-8 animate-in fade-in">
            
            {/* 1. НАСТРОЙКА ПРОФИЛЯ МОШЕННИКА */}
            <div className="bg-base-100 border border-base-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all hover:shadow-md">
                <div className="w-14 h-14 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <UserCircle2 size={32} strokeWidth={1.5} />
                </div>
                <div className="flex-1 w-full">
                    <label className="text-[11px] font-black uppercase tracking-widest text-base-content/50 block mb-2">
                        Имя злоумышленника в чате
                    </label>
                    <input 
                        type="text" 
                        placeholder="Например: Служба безопасности банка"
                        className="w-full bg-base-200/50 border border-base-200 focus:bg-base-100 rounded-xl px-4 py-3 text-sm font-bold text-base-content focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        value={data.contact_name || ""}
                        onChange={(e) => updateContactName(e.target.value)}
                    />
                </div>
            </div>

            {/* 2. ЦЕПОЧКА ДИАЛОГА */}
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-7 before:w-0.5 before:bg-base-200 before:-z-10 ml-2">
                {steps.map((step, index) => (
                    <div key={index} className="relative z-10">
                        
                        {/* ШАГ: СООБЩЕНИЕ БОТА */}
                        {step.type === 'message' && (
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 border-4 border-base-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <Bot size={18} />
                                </div>
                                <div className="flex-1 bg-base-100 border border-base-200 rounded-3xl rounded-tl-sm p-5 shadow-sm hover:border-blue-300 transition-colors">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-1.5">
                                        Сообщение мошенника
                                    </div>
                                    <textarea 
                                        className="w-full bg-base-200/30 border border-transparent hover:border-base-300 focus:bg-base-100 focus:border-blue-400 rounded-xl px-4 py-3 text-sm text-base-content outline-none resize-none transition-all"
                                        rows={3}
                                        placeholder="Что напишет мошенник?"
                                        value={step.text || ""}
                                        onChange={(e) => updateStepText(index, e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ШАГ: ВЫБОР ОТВЕТА ЖЕРТВЫ */}
                        {step.type === 'choice' && (
                            <div className="flex gap-4 items-start mt-8">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 border-4 border-base-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <MessageSquare size={16} />
                                </div>
                                <div className="flex-1 bg-base-100 border border-base-200 rounded-3xl p-6 shadow-sm">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-5 flex items-center gap-1.5">
                                        Варианты ответа ученика
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {(step.options || []).map((opt, optIndex) => {
                                            const isSuccess = opt.is_success;
                                            const isFatal = opt.is_fatal;
                                            const isActive = isSuccess || isFatal;

                                            return (
                                                <div key={optIndex} className={`group relative bg-base-100 border-2 rounded-2xl p-4 transition-all duration-300 ${isSuccess ? 'border-emerald-400 shadow-sm shadow-emerald-500/10' : isFatal ? 'border-red-400 shadow-sm shadow-red-500/10' : 'border-base-200 hover:border-base-300'}`}>
                                                    
                                                    {/* Удалить вариант */}
                                                    <button 
                                                        onClick={() => removeOption(index, optIndex)} 
                                                        className="absolute -top-3 -right-3 w-8 h-8 bg-base-100 border border-base-200 text-base-content/40 hover:text-red-500 hover:border-red-200 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                                                        title="Удалить вариант"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>

                                                    {/* Ввод текста ответа */}
                                                    <input 
                                                        className="w-full bg-transparent text-sm font-bold text-base-content placeholder:text-base-content/30 outline-none mb-4"
                                                        placeholder="Введите текст ответа..."
                                                        value={opt.text || ""}
                                                        onChange={(e) => updateOptionText(index, optIndex, e.target.value)}
                                                    />

                                                    {/* Переключатели исхода (Chips) */}
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        <button 
                                                            onClick={() => toggleOptionOutcome(index, optIndex, 'success')}
                                                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border ${isSuccess ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-base-200/50 text-base-content/50 border-transparent hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10'}`}
                                                        >
                                                            <ShieldCheck size={14} /> Правильный ответ
                                                        </button>
                                                        <button 
                                                            onClick={() => toggleOptionOutcome(index, optIndex, 'fatal')}
                                                            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border ${isFatal ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-base-200/50 text-base-content/50 border-transparent hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10'}`}
                                                        >
                                                            <AlertTriangle size={14} /> Фатальная ошибка
                                                        </button>
                                                    </div>

                                                    {/* Поле объяснения (появляется плавно) */}
                                                    {isActive && (
                                                        <div className="mt-4 pt-4 border-t border-base-200 animate-in slide-in-from-top-2 duration-300">
                                                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isSuccess ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {isSuccess ? 'Объяснение победы:' : 'Объяснение ошибки:'}
                                                            </label>
                                                            <textarea 
                                                                className="w-full bg-base-200/50 border border-transparent focus:bg-base-100 focus:border-blue-400 rounded-xl px-4 py-3 text-sm text-base-content outline-none resize-none transition-all"
                                                                rows={2}
                                                                placeholder="Почему этот ответ привел к такому результату?"
                                                                value={opt.explanation || ""}
                                                                onChange={(e) => updateOptionExplanation(index, optIndex, e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    <button 
                                        onClick={() => addOption(index)}
                                        className="mt-4 w-full py-3 rounded-2xl border-2 border-dashed border-base-300 text-base-content/50 font-bold text-sm hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} strokeWidth={2.5} /> Добавить ответ
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};


// ==========================================
// ОСНОВНОЙ КОМПОНЕНТ STEP EDITOR
// ==========================================
const StepEditor = ({ 
    activeStep, setActiveStep, handleDeleteStep, handleSaveStep, loading,
    quizProps, aiProps 
}) => {
    const { t } = useTranslation();

    if (!activeStep) return null;

    // Парсим scenario_data, если он пришел строкой (защита)
    let safeScenarioData = activeStep.scenario_data;
    if (typeof safeScenarioData === 'string') {
        try { safeScenarioData = JSON.parse(safeScenarioData); } catch(e) { safeScenarioData = null; }
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-300 pb-20 space-y-6">
            
            {/* ШАПКА ШАГА */}
            <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-6 flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                <div className="flex-1 w-full">
                    <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 block">
                        {t('builder.stepName')}
                    </label>
                    <input 
                        type="text" 
                        className="w-full bg-transparent font-black text-2xl text-base-content border-b-2 border-transparent focus:border-blue-400 focus:outline-none transition-colors px-0 py-1" 
                        value={activeStep.title || ""} 
                        onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} 
                        placeholder={t('builder.stepNamePh')} 
                    />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button 
                        className="p-3 text-base-content/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" 
                        onClick={handleDeleteStep} 
                        title={t('builder.delStepIconTitle')}
                    >
                        <Trash2 size={18} />
                    </button>
                    <button 
                        className={`bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 ${loading ? 'opacity-70 pointer-events-none' : ''}`} 
                        onClick={handleSaveStep} 
                        disabled={loading}
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={16} />}
                        {t('builder.saveStep')}
                    </button>
                </div>
            </div>

            {/* ТЕКСТ ИЛИ ВИДЕО */}
            {(activeStep.step_type === 'text' || activeStep.step_type === 'video_url') && (
                <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 overflow-hidden">
                    {activeStep.step_type === 'video_url' && (
                        <div className="p-6 border-b border-base-200 bg-base-200/30">
                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 block">
                                {t('builder.youtubeLink')}
                            </label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-base-100 border border-base-300 rounded-xl text-sm font-medium focus:border-blue-600 outline-none transition-all shadow-sm" 
                                placeholder="https://youtu.be/..." 
                                value={activeStep.content || ""} 
                                onChange={(e) => setActiveStep({...activeStep, content: e.target.value})} 
                            />
                        </div>
                    )}
                    <div className="px-6 py-4 border-b border-base-200 bg-base-200/50 flex items-center gap-3">
                        <div className="text-base-content/50">
                            {activeStep.step_type === 'text' ? <FileText size={18} /> : <MonitorPlay size={18} />}
                        </div>
                        <span className="text-sm font-bold text-base-content">
                            {activeStep.step_type === 'text' ? t('builder.lectureContent') : t('builder.videoDescLabel')}
                        </span>
                    </div>
                    <TiptapEditor key={activeStep.id} content={activeStep.content || ""} onChange={(newContent) => setActiveStep({...activeStep, content: newContent})} />
                </div>
            )}

            {/* ТЕСТ (КВИЗ) */}
            {activeStep.step_type === 'quiz' && <QuizGenerator {...quizProps} />}

            {/* ТРЕНАЖЕР КОДА */}
            {activeStep.step_type === 'interactive_code' && <CodeEditor activeStep={activeStep} setActiveStep={setActiveStep} />}

            {/* СИМУЛЯЦИИ */}
            {activeStep.step_type.includes('simulation') && (
                <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-8 space-y-6">
                    
                    {/* Генератор ИИ */}
                    <div className="bg-base-200/50 rounded-2xl p-6 border border-base-200">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                <ShieldAlert size={20} />
                            </div>
                            <h3 className="text-lg font-black text-base-content">{t('builder.aiScenarioTitle')}</h3>
                        </div>
                        <p className="text-sm text-base-content/60 mb-5">{t('builder.aiScenarioDesc')}</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input 
                                type="text" 
                                className="flex-1 px-4 py-3 bg-base-100 border border-base-300 rounded-xl text-sm font-medium focus:border-blue-600 outline-none transition-all shadow-inner" 
                                placeholder={t('builder.aiScenarioPh')} 
                                value={aiProps.aiTopic} 
                                onChange={(e) => aiProps.setAiTopic(e.target.value)} 
                            />
                            <button 
                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 disabled:bg-base-300 disabled:text-base-content/40 disabled:shadow-none shrink-0" 
                                onClick={() => aiProps.handleGenerateScenario(activeStep.step_type)} 
                                disabled={aiProps.aiLoading}
                            >
                                {aiProps.aiLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : t('builder.genSimBtn')}
                            </button>
                        </div>
                    </div>

                    {/* 🔥 ДОРОГОЙ ВИЗУАЛЬНЫЙ РЕДАКТОР СЦЕНАРИЯ 🔥 */}
                    {safeScenarioData && activeStep.step_type === 'simulation_chat' && (
                        <div className="pt-6 border-t border-base-200">
                            <h4 className="text-sm font-black uppercase tracking-widest text-base-content mb-2 flex items-center gap-2">
                                <TerminalSquare size={16} className="text-blue-500" /> Конструктор диалога
                            </h4>
                            <ScenarioVisualEditor 
                                scenarioData={safeScenarioData} 
                                onChange={(newData) => setActiveStep({...activeStep, scenario_data: newData})} 
                            />
                        </div>
                    )}
                    
                    {/* Для Email */}
                    {safeScenarioData && activeStep.step_type === 'simulation_email' && (
                        <div className="mt-8 bg-base-200/50 rounded-2xl p-5 border border-base-200">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <TerminalSquare size={14} /> Конструктор Email (JSON)
                            </div>
                            <pre className="text-xs font-mono text-base-content/70 overflow-x-auto max-h-60 custom-scrollbar p-3 bg-base-100 rounded-xl border border-base-200 shadow-inner">
                                {JSON.stringify(safeScenarioData, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StepEditor;