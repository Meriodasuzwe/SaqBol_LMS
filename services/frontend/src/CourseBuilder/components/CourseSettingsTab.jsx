import React, { useRef, useState } from 'react';
import { Save, ImagePlus, X, FileText } from 'lucide-react';
import TiptapEditor from './TiptapEditor'; 

const CourseSettingsTab = ({ courseData, setCourseData, onSave, loading }) => {
    const fileInputRef = useRef(null);
    const [previewUrl, setPreviewUrl] = useState(courseData.image || courseData.cover_image || null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCourseData({ ...courseData, newImageFile: file });
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setCourseData({ ...courseData, newImageFile: null, image: null, cover_image: null });
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        // 🔥 ФИКС: Добавили h-full и overflow-y-auto, чтобы страница скроллилась! 🔥
        <div className="h-full overflow-y-auto custom-scrollbar bg-white">
            {/* Добавили pb-32 для комфортного отступа снизу */}
            <div className="max-w-3xl mx-auto py-10 px-6 pb-32 animate-in fade-in duration-300">
                <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Настройки курса</h2>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8">
                    
                    {/* ОБЛОЖКА КУРСА */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
                            Обложка курса
                        </label>
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            {previewUrl ? (
                                <div className="relative w-full sm:w-64 aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group shrink-0">
                                    <img src={previewUrl} alt="Cover preview" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full sm:w-64 aspect-video rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600 shrink-0"
                                >
                                    <ImagePlus size={32} strokeWidth={1.5} className="mb-2" />
                                    <span className="text-xs font-bold">Загрузить обложку</span>
                                </div>
                            )}
                            
                            <div className="flex-1">
                                <p className="text-sm text-slate-500 mb-4 font-medium leading-relaxed">
                                    Рекомендуемый размер: 1280x720. Поддерживаются форматы JPG, PNG. Максимальный размер файла — 5 МБ.
                                </p>
                                <input 
                                    type="file" 
                                    accept="image/jpeg, image/png, image/webp" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Выбрать файл
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full bg-slate-100"></div>

                    {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                            Название курса
                        </label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold focus:bg-white focus:border-slate-900 outline-none transition-all" 
                            value={courseData.title || ""} 
                            onChange={(e) => setCourseData({...courseData, title: e.target.value})} 
                            placeholder="Например: Основы кибербезопасности"
                        />
                    </div>

                    {/* ОПИСАНИЕ */}
                    <div>
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 rounded-t-xl border border-b-0">
                            <FileText size={18} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">
                                Описание курса
                            </span>
                        </div>
                        <div className="border border-slate-200 rounded-b-xl overflow-hidden bg-white">
                            <TiptapEditor 
                                content={courseData.description || ""} 
                                onChange={(newContent) => setCourseData({...courseData, description: newContent})} 
                            />
                        </div>
                    </div>

                    {/* ЦЕНА */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                            Цена (в тенге)
                        </label>
                        <input 
                            type="number" 
                            className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold focus:bg-white focus:border-slate-900 outline-none transition-all" 
                            value={courseData.price || 0} 
                            onChange={(e) => setCourseData({...courseData, price: e.target.value})} 
                            min="0"
                        />
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <button 
                            className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-md disabled:opacity-70 disabled:pointer-events-none w-full sm:w-auto" 
                            onClick={onSave} 
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <><Save size={18} /> Сохранить настройки</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseSettingsTab;