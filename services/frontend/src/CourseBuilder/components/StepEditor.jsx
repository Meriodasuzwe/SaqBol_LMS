import React from 'react';
import TiptapEditor from './TiptapEditor';
import QuizGenerator from './QuizGenerator';
import CodeEditor from './CodeEditor';
import { 
    Trash2, 
    Save, 
    FileText, 
    MonitorPlay, 
    ShieldAlert, 
    TerminalSquare 
} from 'lucide-react';

const StepEditor = ({ 
    activeStep, setActiveStep, handleDeleteStep, handleSaveStep, loading,
    quizProps, aiProps 
}) => {
    if (!activeStep) return null;

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-300 pb-20 space-y-6">
            
            {/* ШАПКА ШАГА */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                <div className="flex-1 w-full">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Название шага</label>
                    <input 
                        type="text" 
                        className="w-full bg-transparent font-black text-2xl text-slate-900 border-b-2 border-transparent focus:border-slate-300 focus:outline-none transition-colors px-0 py-1" 
                        value={activeStep.title || ""} 
                        onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} 
                        placeholder="Введите название шага..." 
                    />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button 
                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" 
                        onClick={handleDeleteStep} 
                        title="Удалить шаг"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button 
                        className={`bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md ${loading ? 'opacity-70 pointer-events-none' : ''}`} 
                        onClick={handleSaveStep} 
                        disabled={loading}
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={16} />}
                        Сохранить шаг
                    </button>
                </div>
            </div>

            {/* ТЕКСТ ИЛИ ВИДЕО */}
            {(activeStep.step_type === 'text' || activeStep.step_type === 'video_url') && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {activeStep.step_type === 'video_url' && (
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Ссылка на YouTube</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-900 outline-none transition-all shadow-sm" 
                                placeholder="https://youtu.be/..." 
                                value={activeStep.content || ""} 
                                onChange={(e) => setActiveStep({...activeStep, content: e.target.value})} 
                            />
                        </div>
                    )}
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                        <div className="text-slate-500">
                            {activeStep.step_type === 'text' ? <FileText size={18} /> : <MonitorPlay size={18} />}
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                            {activeStep.step_type === 'text' ? 'Содержание лекции' : 'Описание к видео'}
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                            <ShieldAlert size={20} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900">Сценарий атаки (AI)</h3>
                    </div>
                    <p className="text-sm text-slate-500">Опишите суть фишинга, ИИ сгенерирует тренажер для студентов.</p>
                    
                    <div className="form-control">
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-slate-900 outline-none transition-all" 
                            placeholder="Например: Письмо от налоговой..." 
                            value={aiProps.aiTopic} 
                            onChange={(e) => aiProps.setAiTopic(e.target.value)} 
                        />
                    </div>
                    
                    <button 
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:bg-slate-300" 
                        onClick={() => aiProps.handleGenerateScenario(activeStep.step_type)} 
                        disabled={aiProps.aiLoading}
                    >
                        {aiProps.aiLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Сгенерировать симуляцию'}
                    </button>

                    {activeStep.scenario_data && (
                        <div className="mt-8 bg-slate-50 rounded-xl p-5 border border-slate-200">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <TerminalSquare size={14} /> Сценарий успешно загружен
                            </div>
                            <pre className="text-xs font-mono text-slate-500 overflow-x-auto max-h-60 custom-scrollbar p-2 bg-white rounded-lg border border-slate-100">
                                {JSON.stringify(activeStep.scenario_data, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StepEditor;