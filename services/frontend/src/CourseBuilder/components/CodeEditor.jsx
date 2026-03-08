import React from 'react';
import Editor from '@monaco-editor/react';
import TiptapEditor from './TiptapEditor';

const CodeEditor = ({ activeStep, setActiveStep }) => {
    return (
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 md:p-8">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><span className="text-2xl">💻</span>Тренажер кода (Python)</h3>
            <p className="text-sm text-base-content/60 mb-6">Студент получит встроенную среду разработки для выполнения задачи.</p>
            
            <div className="form-control mb-6">
                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Текст задания (с новым редактором)</span></label>
                <div className="border border-base-200 rounded-xl overflow-hidden">
                    <TiptapEditor 
                        key={`tiptap-code-${activeStep.id}`} 
                        content={activeStep.content || ""} 
                        onChange={(newContent) => setActiveStep({...activeStep, content: newContent})} 
                    />
                </div>
            </div>
            
            <div className="form-control mb-6">
                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Начальный код (увидит студент)</span></label>
                <div className="h-64 rounded-xl overflow-hidden border border-base-300 bg-[#1e1e1e]">
                    <Editor
                        height="100%" defaultLanguage="python" theme="vs-dark"
                        value={activeStep.scenario_data?.initial_code || "def solve():\n    # Напишите код\n    pass"}
                        onChange={(value) => setActiveStep({...activeStep, scenario_data: { ...(activeStep.scenario_data || {}), initial_code: value }})}
                        options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
                    />
                </div>
            </div>
            
            <div className="form-control">
                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Ожидаемый вывод (Консоль)</span></label>
                <input 
                    type="text" 
                    className="input input-bordered border-base-300 bg-base-50 font-mono text-sm" 
                    placeholder="Например: Hello World" 
                    value={activeStep.scenario_data?.expected_output || ""} 
                    onChange={(e) => setActiveStep({...activeStep, scenario_data: { ...(activeStep.scenario_data || {}), expected_output: e.target.value }})} 
                />
                <label className="label py-0 pt-1.5"><span className="text-[11px] text-base-content/40">Точное совпадение вывода консоли для успешного прохождения шага.</span></label>
            </div>
        </div>
    );
};

export default CodeEditor;