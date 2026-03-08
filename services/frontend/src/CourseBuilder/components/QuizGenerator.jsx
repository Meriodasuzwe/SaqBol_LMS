import React from 'react';

const QuizGenerator = ({ 
    quizQuestions, quizPrompt, setQuizPrompt, 
    quizDifficulty, setQuizDifficulty, quizCount, setQuizCount, 
    isGeneratingQuiz, onGenerate, onQuestionChange, onOptionChange, 
    onCorrectSelect, onAddManual, onDeleteQuestion 
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 md:p-8">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><span className="text-2xl">❓</span>Генерация теста (AI)</h3>
                <p className="text-sm text-base-content/60 mb-6">Вставьте текст вашей лекции, и нейросеть создаст проверочный тест на его основе.</p>
                
                <textarea 
                    className="textarea textarea-bordered border-base-300 w-full h-32 mb-6 text-base" 
                    placeholder="Текст лекции..." 
                    value={quizPrompt} 
                    onChange={e => setQuizPrompt(e.target.value)}
                ></textarea>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Количество вопросов</span></label>
                        <input type="number" min="1" max="10" className="input input-bordered border-base-300 bg-base-50" value={quizCount} onChange={e => setQuizCount(e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">Сложность</span></label>
                        <select className="select select-bordered border-base-300 bg-base-50" value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}>
                            <option value="easy">Лёгкая</option>
                            <option value="medium">Средняя</option>
                            <option value="hard">Сложная</option>
                        </select>
                    </div>
                </div>
                <button className={`btn btn-primary w-full shadow-sm ${isGeneratingQuiz ? 'loading' : ''}`} onClick={onGenerate} disabled={isGeneratingQuiz}>
                    Сгенерировать вопросы
                </button>
            </div>

            {quizQuestions !== null && (
                <div className="space-y-4">
                    <div className="flex justify-between items-end pb-2">
                        <h3 className="text-lg font-bold">Редактор вопросов ({quizQuestions.length})</h3>
                        <button className="btn btn-sm btn-ghost text-primary" onClick={onAddManual}>+ Добавить вручную</button>
                    </div>
                    {quizQuestions.length === 0 ? (
                        <div className="text-center text-base-content/40 py-12 bg-base-100 border border-dashed border-base-300 rounded-xl text-sm font-medium">Вопросов пока нет. Сгенерируйте их выше.</div>
                    ) : (
                        quizQuestions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 relative group">
                                <button className="btn btn-sm btn-circle btn-ghost text-base-content/30 hover:text-error hover:bg-error/10 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDeleteQuestion(qIndex)} title="Удалить вопрос">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                                
                                <div className="form-control mb-4 pr-8">
                                    <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/50 uppercase tracking-widest">Вопрос {qIndex + 1}</span></label>
                                    <input type="text" className="input input-bordered border-base-300 bg-base-50 font-medium" value={q.question} onChange={(e) => onQuestionChange(qIndex, 'question', e.target.value)} />
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {q.options.map((opt, oIndex) => {
                                        const isUserSelected = (typeof q.user_selected_index === 'number') && q.user_selected_index === oIndex;
                                        return (
                                            <div key={oIndex} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isUserSelected ? 'bg-primary/5 border-primary/50 text-primary' : 'bg-base-100 border-base-200 hover:border-base-300'}`}>
                                                <input type="radio" name={`q-${qIndex}`} className="radio radio-primary radio-sm" checked={isUserSelected} onChange={() => onCorrectSelect(qIndex, oIndex)} />
                                                <input type="text" className={`input input-sm input-ghost w-full px-1 focus:bg-base-100 ${isUserSelected ? 'font-semibold' : 'text-base-content/80'}`} value={opt} onChange={(e) => onOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Вариант ${oIndex + 1}`} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default QuizGenerator;