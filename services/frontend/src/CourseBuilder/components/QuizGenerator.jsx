import React, { useState } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Подключаем i18n
import { 
    BrainCircuit, Plus, Trash2, ChevronDown, 
    ChevronUp, CheckCircle2, Circle, HelpCircle
} from 'lucide-react';

const QuizGenerator = ({ 
    quizQuestions, quizPrompt, setQuizPrompt, 
    quizDifficulty, setQuizDifficulty, quizCount, setQuizCount, 
    isGeneratingQuiz, onGenerate, onQuestionChange, onOptionChange, 
    onCorrectSelect, onAddManual, onDeleteQuestion 
}) => {
    const { t } = useTranslation(); // ✅ Инициализируем переводы
    
    // Безопасная проверка
    const questions = Array.isArray(quizQuestions) ? quizQuestions : [];
    
    // AI-панель свернута по умолчанию, если вопросы уже есть в базе
    const [isAIOpen, setIsAIOpen] = useState(questions.length === 0);

    return (
        <div className="space-y-8 animate-in fade-in">
            
            {/* === БЛОК AI-ГЕНЕРАЦИИ (Сворачиваемый) === */}
            <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm transition-all">
                <button 
                    onClick={() => setIsAIOpen(!isAIOpen)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-base-200/50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                            <BrainCircuit size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-black text-base-content">{t('builder.aiAssistantTitle')}</h3>
                            <p className="text-xs text-base-content/60 font-medium">{t('builder.aiAssistantDesc')}</p>
                        </div>
                    </div>
                    <div className="text-base-content/40">
                        {isAIOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </button>

                {isAIOpen && (
                    <div className="p-6 md:p-8 border-t border-base-200 bg-base-200/30">
                        <textarea 
                            className="w-full h-32 p-4 bg-base-100 border border-base-300 rounded-xl text-sm font-medium focus:border-blue-600 focus:outline-none transition-all mb-6 resize-none shadow-sm" 
                            placeholder={t('builder.lectureMaterialPh')} 
                            value={quizPrompt || ''} 
                            onChange={e => setQuizPrompt(e.target.value)}
                        />
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2 block">
                                    {t('builder.questionsCountLabel')}
                                </label>
                                <input 
                                    type="number" min="1" max="15" 
                                    className="w-full px-4 py-3 bg-base-100 border border-base-300 rounded-xl text-sm font-bold focus:border-blue-600 outline-none shadow-sm transition-all" 
                                    value={quizCount || 3} 
                                    onChange={e => setQuizCount(e.target.value)} 
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2 block">
                                    {t('builder.difficultyLabel')}
                                </label>
                                <select 
                                    className="w-full px-4 py-3 bg-base-100 border border-base-300 rounded-xl text-sm font-bold focus:border-blue-600 outline-none appearance-none cursor-pointer shadow-sm transition-all" 
                                    value={quizDifficulty || 'medium'} 
                                    onChange={e => setQuizDifficulty(e.target.value)}
                                >
                                    <option value="easy">{t('builder.diffEasy')}</option>
                                    <option value="medium">{t('builder.diffMedium')}</option>
                                    <option value="hard">{t('builder.diffHard')}</option>
                                </select>
                            </div>
                        </div>
                        
                        <button 
                            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-base-300 disabled:text-base-content/40 disabled:shadow-none flex justify-center items-center gap-2 shadow-md shadow-blue-600/20" 
                            onClick={onGenerate} 
                            disabled={isGeneratingQuiz || !quizPrompt?.trim()}
                        >
                            {isGeneratingQuiz ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>{t('builder.generateQuestionsBtn')} <BrainCircuit size={18} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* === ОСНОВНОЙ РЕДАКТОР ВОПРОСОВ (Доступен всегда) === */}
            <div>
                <div className="flex justify-between items-end mb-4 px-1">
                    <div>
                        <h3 className="text-xl font-black text-base-content tracking-tight flex items-center gap-2">
                            <HelpCircle size={20} className="text-blue-600" />
                            {t('builder.quizQuestionsTitle')}
                        </h3>
                        <p className="text-xs text-base-content/60 font-medium mt-1">
                            {t('builder.quizQuestionsDesc')}
                        </p>
                    </div>
                    <button 
                        className="text-[11px] font-black uppercase tracking-widest text-base-content/50 hover:text-blue-600 flex items-center gap-1.5 transition-colors" 
                        onClick={onAddManual}
                    >
                        <Plus size={16} strokeWidth={2.5} /> {t('builder.addBtn')}
                    </button>
                </div>

                {questions.length === 0 ? (
                    <div className="bg-base-100 border-2 border-dashed border-base-300 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-base-200/50 rounded-full flex items-center justify-center mb-4">
                            <HelpCircle size={32} className="text-base-content/30" />
                        </div>
                        <p className="text-lg font-black text-base-content mb-1">{t('builder.noQuestionsYet')}</p>
                        <p className="text-sm text-base-content/50 max-w-sm">
                            {t('builder.noQuestionsDesc')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-base-100 rounded-3xl border border-base-200 shadow-sm p-6 sm:p-8 relative group hover:border-blue-400 transition-all duration-300">
                                
                                {/* Удалить вопрос */}
                                <button 
                                    className="absolute top-6 right-6 p-2 text-base-content/30 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100" 
                                    onClick={() => onDeleteQuestion(qIndex)} 
                                    title={t('builder.delQuestionIconTitle')}
                                >
                                    <Trash2 size={18} />
                                </button>
                                
                                <div className="mb-8 pr-12">
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-3 block">
                                        {t('builder.questionLabel', { num: qIndex + 1 })}
                                    </label>
                                    <textarea 
                                        className="w-full px-5 py-4 bg-base-200/50 border border-base-200 rounded-xl text-base font-bold text-base-content focus:bg-base-100 focus:border-blue-600 outline-none transition-all resize-none min-h-[100px]" 
                                        value={q.question || ''} 
                                        onChange={(e) => onQuestionChange(qIndex, 'question', e.target.value)} 
                                        placeholder={t('builder.questionPh')}
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-3 block">
                                        {t('builder.optionsLabel')}
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
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20' 
                                                            : 'bg-base-100 border-base-200 hover:border-blue-400'
                                                        }`}
                                                    onClick={() => onCorrectSelect(qIndex, oIndex)}
                                                >
                                                    <div className="mt-0.5 shrink-0">
                                                        {isCorrect ? <CheckCircle2 size={20} className="text-white" /> : <Circle size={20} className="text-base-content/30" />}
                                                    </div>
                                                    <textarea 
                                                        className={`w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden min-h-[24px]
                                                            ${isCorrect ? 'text-white placeholder:text-white/70' : 'text-base-content placeholder:text-base-content/40'}
                                                        `} 
                                                        value={opt || ''} 
                                                        onChange={(e) => {
                                                            e.stopPropagation(); 
                                                            onOptionChange(qIndex, oIndex, e.target.value);
                                                        }} 
                                                        placeholder={t('builder.optionPh', { num: oIndex + 1 })} 
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