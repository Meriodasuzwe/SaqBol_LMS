import React from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Подключили переводы
import TiptapEditor from './TiptapEditor';
import QuizGenerator from './QuizGenerator';
import CodeEditor from './CodeEditor';
import { 
    Trash2, Save, FileText, MonitorPlay, 
    ShieldAlert, TerminalSquare 
} from 'lucide-react';

const StepEditor = ({ 
    activeStep, setActiveStep, handleDeleteStep, handleSaveStep, loading,
    quizProps, aiProps 
}) => {
    const { t } = useTranslation();

    if (!activeStep) return null;

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
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <ShieldAlert size={20} />
                        </div>
                        <h3 className="text-lg font-black text-base-content">{t('builder.aiScenarioTitle')}</h3>
                    </div>
                    <p className="text-sm text-base-content/60">{t('builder.aiScenarioDesc')}</p>
                    
                    <div className="form-control">
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl text-sm font-medium focus:bg-base-100 focus:border-blue-600 outline-none transition-all" 
                            placeholder={t('builder.aiScenarioPh')} 
                            value={aiProps.aiTopic} 
                            onChange={(e) => aiProps.setAiTopic(e.target.value)} 
                        />
                    </div>
                    
                    <button 
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 disabled:bg-base-300 disabled:text-base-content/40 disabled:shadow-none" 
                        onClick={() => aiProps.handleGenerateScenario(activeStep.step_type)} 
                        disabled={aiProps.aiLoading}
                    >
                        {aiProps.aiLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : t('builder.genSimBtn')}
                    </button>

                    {activeStep.scenario_data && (
                        <div className="mt-8 bg-base-200/50 rounded-2xl p-5 border border-base-200">
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <TerminalSquare size={14} /> {t('builder.scenarioLoaded')}
                            </div>
                            <pre className="text-xs font-mono text-base-content/70 overflow-x-auto max-h-60 custom-scrollbar p-3 bg-base-100 rounded-xl border border-base-200 shadow-inner">
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