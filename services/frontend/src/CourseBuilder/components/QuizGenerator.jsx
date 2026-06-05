import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    BrainCircuit, Plus, Trash2, ChevronDown, 
    ChevronUp, CheckSquare, Square, HelpCircle, GripVertical, X
} from 'lucide-react';

const QuizGenerator = ({ 
    quizQuestions, quizPrompt, setQuizPrompt, 
    quizDifficulty, setQuizDifficulty, quizCount, setQuizCount, 
    isGeneratingQuiz, onGenerate, onQuestionChange, onOptionChange, 
    onCorrectSelect, onAddManual, onDeleteQuestion,
    onAddOption, onRemoveOption // 🔥 Новые пропсы
}) => {
    const { t } = useTranslation();
    const questions = Array.isArray(quizQuestions) ? quizQuestions : [];
    const [isAIOpen, setIsAIOpen] = useState(questions.length === 0);
    
    const [collapsedQs, setCollapsedQs] = useState({});

    const toggleCollapse = (index) => {
        setCollapsedQs(prev => ({ ...prev, [index]: !prev[index] }));
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            
            {/* === БЛОК AI-ГЕНЕРАЦИИ === */}
            <div className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden shadow-sm transition-all">
                <button 
                    onClick={() => setIsAIOpen(!isAIOpen)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-base-200/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                            <BrainCircuit size={16} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-bold text-base-content">{t('builder.aiAssistantTitle', 'AI-Помощник')}</h3>
                        </div>
                    </div>
                    <div className="text-base-content/40 bg-base-200 p-1.5 rounded-lg">
                        {isAIOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </button>

                {isAIOpen && (
                    <div className="p-5 border-t border-base-200 bg-base-200/20">
                        <textarea 
                            className="w-full h-24 p-3 bg-base-100 border border-base-300 rounded-xl text-sm focus:border-blue-600 focus:outline-none transition-all mb-4 resize-none shadow-sm" 
                            placeholder={t('builder.lectureMaterialPh', 'Вставьте текст лекции...')} 
                            value={quizPrompt || ''} 
                            onChange={e => setQuizPrompt(e.target.value)}
                        />
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1.5 block">Кол-во вопросов</label>
                                <input type="number" min="1" max="15" 
                                    className="w-full px-3 py-2.5 bg-base-100 border border-base-300 rounded-xl text-sm font-semibold focus:border-blue-600 outline-none" 
                                    value={quizCount || 3} onChange={e => setQuizCount(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider mb-1.5 block">Сложность</label>
                                <select className="w-full px-3 py-2.5 bg-base-100 border border-base-300 rounded-xl text-sm font-semibold focus:border-blue-600 outline-none" 
                                    value={quizDifficulty || 'medium'} onChange={e => setQuizDifficulty(e.target.value)}>
                                    <option value="easy">{t('builder.diffEasy', 'Легко')}</option>
                                    <option value="medium">{t('builder.diffMedium', 'Средне')}</option>
                                    <option value="hard">{t('builder.diffHard', 'Сложно')}</option>
                                </select>
                            </div>
                        </div>
                        <button 
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-base-300 disabled:text-base-content/40 flex justify-center items-center gap-2" 
                            onClick={onGenerate} disabled={isGeneratingQuiz || !quizPrompt?.trim()}
                        >
                            {isGeneratingQuiz ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> 
                            : <>{t('builder.generateQuestionsBtn', 'Сгенерировать')} <BrainCircuit size={16} /></>}
                        </button>
                    </div>
                )}
            </div>

            {/* === ОСНОВНОЙ РЕДАКТОР ВОПРОСОВ === */}
            <div>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-lg font-black text-base-content flex items-center gap-2">
                        <HelpCircle size={18} className="text-blue-600" />
                        {t('builder.quizQuestionsTitle', 'Вопросы теста')}
                        <span className="bg-base-200 text-base-content/60 text-xs px-2 py-0.5 rounded-full">{questions.length}</span>
                    </h3>
                    <button className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors" onClick={onAddManual}>
                        <Plus size={14} strokeWidth={2.5} /> {t('builder.addBtn', 'Добавить')}
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div className="bg-base-100 border-2 border-dashed border-base-300 rounded-2xl p-10 text-center flex flex-col items-center">
                        <HelpCircle size={28} className="text-base-content/20 mb-3" />
                        <p className="text-base font-bold text-base-content mb-1">{t('builder.noQuestionsYet', 'Пока нет вопросов')}</p>
                        <p className="text-xs text-base-content/50">{t('builder.noQuestionsDesc', 'Сгенерируйте их с помощью AI или добавьте вручную.')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {questions.map((q, qIndex) => {
                            const isCollapsed = collapsedQs[qIndex];
                            
                            return (
                                <div key={qIndex} className="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden group">
                                    
                                    {/* Шапка вопроса (Кликабельная для сворачивания) */}
                                    <div 
                                        className="flex items-center justify-between p-4 bg-base-100 hover:bg-base-200/30 cursor-pointer transition-colors"
                                        onClick={() => toggleCollapse(qIndex)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <GripVertical size={16} className="text-base-content/20 cursor-grab" />
                                            <span className="font-bold text-sm text-base-content shrink-0">Вопрос {qIndex + 1}</span>
                                            <span className="text-sm text-base-content/50 truncate max-w-[200px] md:max-w-[400px]">
                                                {q.question ? q.question.replace(/(<([^>]+)>)/gi, "") : "Новый вопрос..."}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button 
                                                className="p-1.5 text-base-content/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" 
                                                onClick={(e) => { e.stopPropagation(); onDeleteQuestion(qIndex); }} 
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="p-1.5 text-base-content/40">
                                                {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Тело вопроса (Скрывается при сворачивании) */}
                                    {!isCollapsed && (
                                        <div className="p-5 border-t border-base-100 bg-base-200/10">
                                            <textarea 
                                                className="w-full px-4 py-3 bg-white border border-base-200 rounded-xl text-sm font-semibold text-base-content focus:border-blue-600 outline-none transition-all resize-none min-h-[80px] mb-5 shadow-sm" 
                                                value={q.question || ''} 
                                                onChange={(e) => onQuestionChange(qIndex, 'question', e.target.value)} 
                                                placeholder={t('builder.questionPh', 'Напишите ваш вопрос здесь...')}
                                            />
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {q.options && q.options.map((opt, oIndex) => {
                                                    const correctData = q.correct_option_index !== undefined ? q.correct_option_index : q.user_selected_index;
                                                    const isCorrect = Array.isArray(correctData) 
                                                        ? correctData.includes(oIndex) 
                                                        : correctData === oIndex;

                                                    return (
                                                        <div 
                                                            key={oIndex} 
                                                            className={`relative flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer group/opt
                                                                ${isCorrect ? 'bg-blue-50 border-blue-600 shadow-sm' : 'bg-white border-base-200 hover:border-blue-300'}`}
                                                            onClick={() => onCorrectSelect(qIndex, oIndex)}
                                                        >
                                                            <div className="mt-0.5 shrink-0">
                                                                {isCorrect 
                                                                    ? <CheckSquare size={18} className="text-blue-600" /> 
                                                                    : <Square size={18} className="text-base-content/30" />
                                                                }
                                                            </div>
                                                            <textarea 
                                                                className={`w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden min-h-[24px] pr-8 ${isCorrect ? 'text-blue-900' : 'text-base-content'}`} 
                                                                value={opt || ''} 
                                                                onChange={(e) => {
                                                                    e.stopPropagation(); 
                                                                    onOptionChange(qIndex, oIndex, e.target.value);
                                                                }} 
                                                                placeholder={t('builder.optionPh', { num: oIndex + 1 })} 
                                                            />
                                                            
                                                            {/* 🔥 Кнопка удаления варианта (показывается при наведении, если вариантов > 2) */}
                                                            {q.options.length > 2 && (
                                                                <button
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-base-content/30 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 hover:bg-white rounded-md transition-all"
                                                                    onClick={(e) => { e.stopPropagation(); onRemoveOption(qIndex, oIndex); }}
                                                                    title="Удалить вариант"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* 🔥 Кнопка добавления нового варианта (если вариантов < 6) */}
                                            {q.options && q.options.length < 6 && (
                                                <button
                                                    className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 border-2 border-dashed border-base-300 text-base-content/50 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-bold"
                                                    onClick={() => onAddOption(qIndex)}
                                                >
                                                    <Plus size={16} /> Добавить вариант
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuizGenerator;