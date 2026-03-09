import React, { useState } from 'react';
import { 
    BrainCircuit, 
    Plus, 
    Trash2, 
    ChevronDown, 
    ChevronUp,
    CheckCircle2,
    Circle,
    HelpCircle
} from 'lucide-react';

const QuizGenerator = ({ 
    quizQuestions, quizPrompt, setQuizPrompt, 
    quizDifficulty, setQuizDifficulty, quizCount, setQuizCount, 
    isGeneratingQuiz, onGenerate, onQuestionChange, onOptionChange, 
    onCorrectSelect, onAddManual, onDeleteQuestion 
}) => {
    // Безопасная проверка
    const questions = Array.isArray(quizQuestions) ? quizQuestions : [];
    
    // AI-панель свернута по умолчанию, если вопросы уже есть в базе
    const [isAIOpen, setIsAIOpen] = useState(questions.length === 0);

    return (
        <div className="space-y-8 animate-in fade-in">
            
            {/* === БЛОК AI-ГЕНЕРАЦИИ (Сворачиваемый) === */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all">
                <button 
                    onClick={() => setIsAIOpen(!isAIOpen)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                            <BrainCircuit size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-black text-slate-900">AI-Ассистент</h3>
                            <p className="text-xs text-slate-500 font-medium">Сгенерировать новые вопросы по тексту лекции</p>
                        </div>
                    </div>
                    <div className="text-slate-400">
                        {isAIOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </button>

                {isAIOpen && (
                    <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50">
                        <textarea 
                            className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-slate-900 focus:outline-none transition-all mb-6 resize-none shadow-sm" 
                            placeholder="Вставьте материал лекции сюда..." 
                            value={quizPrompt || ''} 
                            onChange={e => setQuizPrompt(e.target.value)}
                        />
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Вопросов</label>
                                <input 
                                    type="number" min="1" max="15" 
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-slate-900 outline-none shadow-sm" 
                                    value={quizCount || 3} 
                                    onChange={e => setQuizCount(e.target.value)} 
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Сложность</label>
                                <select 
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-slate-900 outline-none appearance-none cursor-pointer shadow-sm" 
                                    value={quizDifficulty || 'medium'} 
                                    onChange={e => setQuizDifficulty(e.target.value)}
                                >
                                    <option value="easy">Лёгкая (Знания)</option>
                                    <option value="medium">Средняя (Понимание)</option>
                                    <option value="hard">Сложная (Анализ)</option>
                                </select>
                            </div>
                        </div>
                        
                        <button 
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-black transition-all disabled:bg-slate-300 disabled:text-slate-500 flex justify-center items-center gap-2 shadow-md" 
                            onClick={onGenerate} 
                            disabled={isGeneratingQuiz || !quizPrompt?.trim()}
                        >
                            {isGeneratingQuiz ? (
                                <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>Сгенерировать вопросы <BrainCircuit size={18} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* === ОСНОВНОЙ РЕДАКТОР ВОПРОСОВ (Доступен всегда) === */}
            <div>
                <div className="flex justify-between items-end mb-4 px-1">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <HelpCircle size={20} className="text-slate-400" />
                            Вопросы теста
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Отредактируйте текст или укажите правильные ответы</p>
                    </div>
                    <button 
                        className="text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors" 
                        onClick={onAddManual}
                    >
                        <Plus size={16} strokeWidth={2.5} /> Добавить
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <HelpCircle size={32} className="text-slate-300" />
                        </div>
                        <p className="text-lg font-black text-slate-900 mb-1">Вопросов пока нет</p>
                        <p className="text-sm text-slate-500 max-w-sm">Сгенерируйте их с помощью AI-ассистента выше или добавьте свой первый вопрос вручную.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative group hover:border-slate-300 transition-all">
                                
                                {/* Удалить вопрос */}
                                <button 
                                    className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" 
                                    onClick={() => onDeleteQuestion(qIndex)} 
                                    title="Удалить вопрос"
                                >
                                    <Trash2 size={18} />
                                </button>
                                
                                <div className="mb-8 pr-12">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                        Вопрос {qIndex + 1}
                                    </label>
                                    <textarea 
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:border-slate-900 outline-none transition-all resize-none min-h-[100px]" 
                                        value={q.question || ''} 
                                        onChange={(e) => onQuestionChange(qIndex, 'question', e.target.value)} 
                                        placeholder="Напишите ваш вопрос..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                                        Варианты ответов (отметьте верный)
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options && q.options.map((opt, oIndex) => {
                                            // Синхронизация полей
                                            const correctIndex = q.correct_option_index !== undefined ? q.correct_option_index : q.user_selected_index;
                                            const isCorrect = correctIndex === oIndex;

                                            return (
                                                <div 
                                                    key={oIndex} 
                                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer
                                                        ${isCorrect 
                                                            ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                                                            : 'bg-white border-slate-100 hover:border-slate-300'
                                                        }`}
                                                    onClick={() => onCorrectSelect(qIndex, oIndex)}
                                                >
                                                    <div className="mt-0.5 shrink-0">
                                                        {isCorrect ? <CheckCircle2 size={20} className="text-white" /> : <Circle size={20} className="text-slate-300" />}
                                                    </div>
                                                    <textarea 
                                                        className={`w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden min-h-[24px]
                                                            ${isCorrect ? 'text-white placeholder:text-white/50' : 'text-slate-700 placeholder:text-slate-400'}
                                                        `} 
                                                        value={opt || ''} 
                                                        onChange={(e) => {
                                                            e.stopPropagation(); 
                                                            onOptionChange(qIndex, oIndex, e.target.value);
                                                        }} 
                                                        placeholder={`Вариант ${oIndex + 1}`} 
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuizGenerator;