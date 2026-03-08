import React from 'react';
import TiptapEditor from './TiptapEditor';

const CourseSettingsTab = ({ courseData, setCourseData, onSave, loading }) => {
    const maxTitleLen = 60;
    const titleLen = courseData.title?.length || 0;
    const isTitleOverLimit = titleLen > maxTitleLen;

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-base-200/20">
            <div className="max-w-4xl mx-auto animate-fade-in pb-20">
                
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold text-base-content tracking-tight">Настройки курса</h2>
                    <p className="text-base-content/60 mt-2 text-sm">Основная информация, которую увидят студенты на странице описания и в поиске.</p>
                </div>

                <div className="bg-base-100 rounded-3xl shadow-sm border border-base-200 p-8 sm:p-10 space-y-10">
                    <div className="form-control w-full">
                        <label className="label py-0 pb-2">
                            <span className="font-bold text-base-content text-base">Название курса</span>
                        </label>
                        <input 
                            type="text" 
                            className={`input input-lg input-bordered w-full bg-base-50 focus:bg-white transition-colors ${isTitleOverLimit ? 'border-error focus:border-error' : 'focus:border-primary'}`}
                            value={courseData.title} 
                            onChange={(e) => setCourseData({...courseData, title: e.target.value})} 
                            placeholder="Например: Основы Python для начинающих"
                        />
                        <div className="label py-1 pt-2">
                            <span className="text-xs text-base-content/50">Четкое и привлекающее внимание название.</span>
                            <span className={`text-xs font-bold ${isTitleOverLimit ? 'text-error' : 'text-base-content/40'}`}>
                                {titleLen} / {maxTitleLen}
                            </span>
                        </div>
                    </div>

                    <div className="form-control w-full max-w-xs">
                        <label className="label py-0 pb-2">
                            <span className="font-bold text-base-content text-base">Стоимость участия</span>
                        </label>
                        <label className="input input-lg input-bordered bg-base-50 focus-within:bg-white flex items-center gap-4">
                            <input 
                                type="number" 
                                className="grow font-bold" 
                                value={courseData.price || ''} 
                                onChange={(e) => setCourseData({...courseData, price: e.target.value})}
                                placeholder="0"
                            />
                            <span className="text-base-content/40 font-bold uppercase text-sm tracking-widest">KZT</span>
                        </label>
                        <div className="label py-1 pt-2">
                            <span className="text-xs text-base-content/50">Оставьте 0 или пустым, чтобы сделать курс бесплатным.</span>
                        </div>
                    </div>

                    <div className="divider opacity-30"></div>

                    <div className="form-control w-full">
                        <label className="label py-0 pb-3 flex-col items-start gap-1">
                            <span className="font-bold text-base-content text-base">Подробное описание (Визитка)</span>
                            <span className="text-sm text-base-content/50 font-normal">Расскажите, для кого этот курс, чему научатся студенты и какие навыки получат. Это ваш главный продающий текст.</span>
                        </label>
                        
                        <div className="mt-2 border border-base-200 rounded-3xl overflow-hidden shadow-sm">
                            <TiptapEditor 
                                content={courseData.description || ""} 
                                onChange={(html) => setCourseData({...courseData, description: html})} 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-8">
                    <button 
                        className={`btn btn-primary btn-lg px-10 shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all ${loading ? 'loading' : ''}`} 
                        onClick={onSave} 
                        disabled={loading || !courseData.title?.trim() || isTitleOverLimit}
                    >
                        Сохранить изменения
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CourseSettingsTab;