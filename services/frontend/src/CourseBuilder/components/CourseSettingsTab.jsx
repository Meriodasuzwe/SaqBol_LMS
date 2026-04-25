import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Подключили i18n
import { Save, ImagePlus, X, FileText } from 'lucide-react';
import TiptapEditor from './TiptapEditor'; 

const CourseSettingsTab = ({ courseData, setCourseData, onSave, loading }) => {
    const { t } = useTranslation(); // ✅ Инициализация
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
        <div className="h-full overflow-y-auto custom-scrollbar bg-base-100">
            <div className="max-w-3xl mx-auto py-10 px-6 pb-32 animate-in fade-in duration-300">
                <h2 className="text-3xl font-black text-base-content mb-8 tracking-tight">
                    {t('builder.courseSettingsTitle')}
                </h2>

                <div className="bg-base-100 rounded-3xl border border-base-200 shadow-sm p-8 space-y-8">
                    
                    {/* ОБЛОЖКА КУРСА */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3 block">
                            {t('builder.courseCover')}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            {previewUrl ? (
                                <div className="relative w-full sm:w-64 aspect-video rounded-2xl overflow-hidden border border-base-200 bg-base-200/50 group shrink-0">
                                    <img src={previewUrl} alt="Cover preview" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1.5 bg-base-100/90 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full sm:w-64 aspect-video rounded-2xl border-2 border-dashed border-base-300 bg-base-200/30 hover:bg-base-200 hover:border-blue-400 transition-all flex flex-col items-center justify-center cursor-pointer text-base-content/40 hover:text-blue-600 shrink-0 group"
                                >
                                    <ImagePlus size={32} strokeWidth={1.5} className="mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold">{t('builder.uploadCover')}</span>
                                </div>
                            )}
                            
                            <div className="flex-1">
                                <p className="text-sm text-base-content/50 mb-4 font-medium leading-relaxed">
                                    {t('builder.coverRecommendation')}
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
                                    className="px-4 py-2 bg-base-200 text-base-content text-sm font-bold rounded-xl hover:bg-base-300 transition-colors"
                                >
                                    {t('builder.chooseFile')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full bg-base-200"></div>

                    {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 block">
                            {t('builder.courseName')}
                        </label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-base-200/50 border border-base-200 rounded-xl text-base font-bold text-base-content focus:bg-base-100 focus:border-blue-600 outline-none transition-all" 
                            value={courseData.title || ""} 
                            onChange={(e) => setCourseData({...courseData, title: e.target.value})} 
                            placeholder={t('builder.courseNamePh')}
                        />
                    </div>

                    {/* ОПИСАНИЕ */}
                    <div>
                        <div className="px-6 py-4 border-b border-base-200 bg-base-200/50 flex items-center gap-3 rounded-t-2xl border border-b-0">
                            <FileText size={18} className="text-base-content/50" />
                            <span className="text-sm font-bold text-base-content">
                                {t('builder.courseDesc')}
                            </span>
                        </div>
                        <div className="border border-base-200 rounded-b-2xl overflow-hidden bg-base-100">
                            <TiptapEditor 
                                content={courseData.description || ""} 
                                onChange={(newContent) => setCourseData({...courseData, description: newContent})} 
                            />
                        </div>
                    </div>

                    {/* ЦЕНА */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 block">
                            {t('builder.coursePrice')}
                        </label>
                        <input 
                            type="number" 
                            className="w-full sm:w-48 px-4 py-3 bg-base-200/50 border border-base-200 rounded-xl text-base font-bold text-base-content focus:bg-base-100 focus:border-blue-600 outline-none transition-all" 
                            value={courseData.price || 0} 
                            onChange={(e) => setCourseData({...courseData, price: e.target.value})} 
                            min="0"
                        />
                    </div>

                    <div className="pt-6 border-t border-base-200">
                        <button 
                            className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 disabled:opacity-70 disabled:pointer-events-none w-full sm:w-auto" 
                            onClick={onSave} 
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <><Save size={18} /> {t('builder.saveSettingsBtn')}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseSettingsTab;