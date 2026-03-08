import React from 'react';
import TiptapEditor from './TiptapEditor';
import QuizGenerator from './QuizGenerator';
import CodeEditor from './CodeEditor';

const StepEditor = ({ 
    activeStep, setActiveStep, handleDeleteStep, handleSaveStep, loading,
    quizProps, aiProps 
}) => {
    if (!activeStep) return null;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in pb-20 space-y-6">
            
            {/* Шапка шага */}
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                <div className="flex-1 w-full">
                    <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Название шага</span></label>
                    <input 
                        type="text" 
                        className="input input-lg input-ghost w-full px-0 font-bold text-2xl focus:bg-base-50 focus:px-4 transition-all" 
                        value={activeStep.title || ""} 
                        onChange={(e) => setActiveStep({...activeStep, title: e.target.value})} 
                        placeholder="Без названия" 
                    />
                </div>
                <div className="flex gap-2 shrink-0">
                    <button className="btn btn-outline border-base-300 text-error hover:bg-error hover:border-error hover:text-white" onClick={handleDeleteStep} title="Удалить шаг">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <button className={`btn btn-primary shadow-sm ${loading ? 'loading' : ''}`} onClick={handleSaveStep} disabled={loading}>
                        Сохранить шаг
                    </button>
                </div>
            </div>

            {/* Контент в зависимости от типа */}
            {(activeStep.step_type === 'text' || activeStep.step_type === 'video_url') && (
                <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
                    {activeStep.step_type === 'video_url' && (
                        <div className="p-6 border-b border-base-200 bg-base-50/50">
                            <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Ссылка на YouTube</span></label>
                            <input type="text" className="input input-bordered border-base-300 bg-base-100 w-full shadow-sm" placeholder="https://youtu.be/..." value={activeStep.content || ""} onChange={(e) => setActiveStep({...activeStep, content: e.target.value})} />
                        </div>
                    )}
                    <div className="p-4 border-b border-base-100 bg-base-50 flex items-center gap-2">
                        <span className="text-xl">{activeStep.step_type === 'text' ? '📝' : '▶️'}</span>
                        <span className="text-sm font-semibold text-base-content/80">{activeStep.step_type === 'text' ? 'Содержание лекции' : 'Описание'}</span>
                    </div>
                    <TiptapEditor key={activeStep.id} content={activeStep.content || ""} onChange={(newContent) => setActiveStep({...activeStep, content: newContent})} />
                </div>
            )}

            {activeStep.step_type === 'quiz' && <QuizGenerator {...quizProps} />}

            {activeStep.step_type === 'interactive_code' && <CodeEditor activeStep={activeStep} setActiveStep={setActiveStep} />}

            {activeStep.step_type.includes('simulation') && (
                <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 md:p-8">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><span className="text-2xl">🛡️</span>Сценарий атаки (AI)</h3>
                    <p className="text-sm text-base-content/60 mb-6">Опишите суть фишинга или социальной инженерии, ИИ сгенерирует интерактивный тренажер.</p>
                    <div className="form-control mb-6">
                        <input type="text" className="input input-bordered border-base-300 bg-base-50" placeholder="Например: Письмо от налоговой с требованием оплатить штраф..." value={aiProps.aiTopic} onChange={(e) => aiProps.setAiTopic(e.target.value)} />
                    </div>
                    <button className={`btn btn-primary w-full shadow-sm ${aiProps.aiLoading ? 'loading' : ''}`} onClick={() => aiProps.handleGenerateScenario(activeStep.step_type)} disabled={aiProps.aiLoading}>
                        Сгенерировать симуляцию
                    </button>
                    {activeStep.scenario_data && (
                        <div className="mt-8 bg-base-200/50 rounded-xl p-4 border border-base-200">
                            <div className="text-xs font-bold text-success uppercase tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Сценарий загружен
                            </div>
                            <pre className="text-xs font-mono text-base-content/60 overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-base-300">{JSON.stringify(activeStep.scenario_data, null, 2)}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StepEditor;