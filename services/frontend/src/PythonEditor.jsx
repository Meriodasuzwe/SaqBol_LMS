import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

function PythonEditor({ stepData, onSuccess }) {
    const initialCode = stepData.scenario_data?.initial_code || "# Напиши свой код здесь\n";
    const expectedOutput = stepData.scenario_data?.expected_output?.trim();
    
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    
    // Состояние готовности виртуальной машины Python
    const [isPythonReady, setIsPythonReady] = useState(false);
    const pyodideRef = useRef(null);

    // Подгружаем ядро Python (Pyodide) в браузер при открытии урока
    useEffect(() => {
        const initPyodide = async () => {
            // Если уже загрузили ранее на другой странице, берем из кэша
            if (window.pyodide) {
                pyodideRef.current = window.pyodide;
                setIsPythonReady(true);
                return;
            }

            setOutput('Инициализация ядра Python (первый запуск может занять пару секунд)...\n');
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
            script.onload = async () => {
                pyodideRef.current = await window.loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                });
                window.pyodide = pyodideRef.current; // Кэшируем в window, чтобы не грузить заново
                setIsPythonReady(true);
                setOutput('');
            };
            document.body.appendChild(script);
        };
        
        initPyodide();
    }, []);

    const runCode = async () => {
        if (!isPythonReady) return;
        
        setIsRunning(true);
        setOutput('Выполнение...\n');
        
        try {
            // 1. Создаем виртуальную консоль, чтобы перехватывать print()
            await pyodideRef.current.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
            `);

            // 2. Выполняем код студента
            await pyodideRef.current.runPythonAsync(code);

            // 3. Забираем то, что накопилось в виртуальной консоли
            const rawOutput = await pyodideRef.current.runPythonAsync("sys.stdout.getvalue()");
            const actualOutput = rawOutput ? rawOutput.trim() : "";

            // 4. Проверяем правильность
            if (expectedOutput) {
                if (actualOutput === expectedOutput) {
                    // 🎉 ОТВЕТ ВЕРНЫЙ
                    setOutput(rawOutput + '\n\n✅ Отлично! Ответ верный.');
                    setIsSuccess(true);
                    setTimeout(() => {
                        onSuccess(); 
                    }, 2000);
                } else {
                    // ❌ ОТВЕТ НЕВЕРНЫЙ
                    setOutput(rawOutput + `\n\n❌ Ответ неверный.\nВаш вывод: "${actualOutput}"\nОжидалось: "${expectedOutput}"`);
                }
            } else {
                // Если препод забыл указать expected_output в базе
                setOutput((rawOutput || 'Код выполнен успешно (нет вывода).') + '\n\n⚠️ Внимание: для этой задачи преподаватель не задал проверочный вывод.');
            }

        } catch (error) {
            // 🐛 ОШИБКА СИНТАКСИСА ИЛИ ВЫПОЛНЕНИЯ
            const partialOutput = await pyodideRef.current.runPythonAsync("sys.stdout.getvalue()");
            setOutput(partialOutput + '\n--- Ошибка (Syntax/Runtime Error) ---\n' + error.toString());
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
            {stepData.content && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 prose prose-lg max-w-none mb-4">
                    <div dangerouslySetInnerHTML={{ __html: stepData.content }} />
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 h-[500px]">
                {/* Левая часть: Редактор кода */}
                <div className="flex-1 border border-gray-300 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-[#1e1e1e] text-gray-400 text-xs px-4 py-2 font-mono border-b border-gray-800 flex justify-between items-center">
                        <span>main.py</span>
                        <span className="text-green-500">{isPythonReady ? 'Python 3.11 Готов' : 'Загрузка ядра...'}</span>
                    </div>
                    <div className="flex-1">
                        <Editor
                            height="100%"
                            defaultLanguage="python"
                            theme="vs-dark"
                            value={code}
                            onChange={(value) => setCode(value)}
                            options={{ minimap: { enabled: false }, fontSize: 16 }}
                        />
                    </div>
                </div>

                {/* Правая часть: Консоль вывода */}
                <div className="w-full lg:w-1/3 bg-[#1e1e1e] rounded-xl overflow-hidden flex flex-col shadow-sm border border-gray-800">
                    <div className="bg-[#2d2d2d] text-gray-300 text-xs px-4 py-2 font-bold uppercase tracking-wider flex justify-between items-center">
                        <span>Terminal</span>
                        <button 
                            onClick={runCode} 
                            disabled={isRunning || isSuccess || !isPythonReady}
                            className={`btn btn-sm text-white ${isSuccess ? 'btn-success' : 'btn-primary'} shadow-lg`}
                        >
                            {!isPythonReady ? <span className="loading loading-spinner loading-xs"></span> : 
                             isRunning ? <span className="loading loading-spinner loading-xs"></span> : 
                             (isSuccess ? 'Решено! 🎉' : '▶ Запустить')}
                        </button>
                    </div>
                    <div className="flex-1 p-4 font-mono text-sm text-gray-300 overflow-y-auto whitespace-pre-wrap">
                        {output || 'Нажмите "Запустить", чтобы увидеть результат программы...'}
                    </div>
                    
                    {expectedOutput && !isSuccess && (
                        <div className="p-3 bg-[#252526] border-t border-gray-700 text-xs text-gray-500 font-mono">
                            Ожидаемый вывод: <span className="text-blue-400">{expectedOutput}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PythonEditor;