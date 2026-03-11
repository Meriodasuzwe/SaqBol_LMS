import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';      
import aiApi from './aiApi';    
import { toast } from 'react-toastify'; 
import { 
    UploadCloud, FileText, Settings, Sparkles, 
    Trash2, ChevronRight, CheckCircle2, Layout 
} from 'lucide-react';


import TiptapEditor from './CourseBuilder/components/TiptapEditor';

function TeacherPanel() {
    const navigate = useNavigate();
    
    // --- СТЕЙТЫ ---
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [courseContext, setCourseContext] = useState(""); 
    const fileInputRef = useRef(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 
    const [generatedCourse, setGeneratedCourse] = useState(null); 

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: "", message: "", onConfirm: null, confirmText: "", isDanger: false
    });

    const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // --- DRAG & DROP ЛОГИКА ---
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        validateAndSetFile(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        validateAndSetFile(file);
    };

    const validateAndSetFile = (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' && ext !== 'docx') {
            toast.warning('Формат не поддерживается. Только PDF или DOCX.');
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setSelectedFile(file);
    };

    // --- ГЕНЕРАЦИЯ КУРСА ---
    const handleGenerate = async () => {
        if (!selectedFile) return toast.warning("Загрузите документ для анализа.");
        
        setIsGenerating(true);
        setGeneratedCourse(null);

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (courseContext) formData.append('context', courseContext); 

        try {
            const res = await aiApi.post('generate-course-from-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setGeneratedCourse(res.data);
            toast.success('✨ Черновик курса успешно создан!');
        } catch (err) {
            console.error("Ошибка ИИ:", err);
            toast.error(err.response?.data?.detail || "Ошибка при генерации курса.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    // --- СОХРАНЕНИЕ ---
    const handleSaveCourse = async () => {
        if (!generatedCourse?.course_title?.trim()) return toast.warning("Введите название курса");
        if (!generatedCourse?.lessons?.length) return toast.warning("В курсе нет уроков!");
        
        setIsSaving(true);
        try {
            await api.post('courses/bulk-create/', generatedCourse);
            toast.success('🚀 Курс опубликован!');
            
            setGeneratedCourse(null); 
            setSelectedFile(null);
            setCourseContext("");
            
        } catch (err) {
            console.error("Ошибка сохранения:", err);
            toast.error("Не удалось сохранить курс.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- ОБРАБОТЧИКИ ЧЕРНОВИКА ---
    const updateField = (field, value) => {
        setGeneratedCourse(prev => ({ ...prev, [field]: value }));
    };

    const updateLesson = (idx, field, value) => {
        const updated = { ...generatedCourse };
        updated.lessons[idx][field] = value;
        setGeneratedCourse(updated);
    };

    const removeLesson = (idx) => {
        setConfirmDialog({
            isOpen: true,
            title: "Удалить урок?",
            message: "Этот урок будет удален из черновика. Отменить нельзя.",
            confirmText: "Удалить",
            isDanger: true,
            onConfirm: () => {
                const updated = { ...generatedCourse };
                updated.lessons.splice(idx, 1);
                setGeneratedCourse(updated);
                toast.info("Урок удален");
                closeDialog();
            }
        });
    };

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 font-sans text-slate-900 selection:bg-blue-600 selection:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* ── HEADER ── */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[11px] font-extrabold uppercase tracking-widest mb-3">
                        <Sparkles size={12} /> AI Студия
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Генератор курсов</h1>
                    <p className="text-slate-500 font-medium mt-2 max-w-xl">
                        Превратите ваши должностные инструкции, регламенты или PDF-методички в полноценный интерактивный курс за пару минут.
                    </p>
                </div>
                <button 
                    onClick={() => navigate('/teacher/courses')}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors shadow-sm"
                >
                    Мои курсы
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* ── LEFT COLUMN: UPLOAD & SETTINGS ── */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Upload Card */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
                        <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-blue-600" /> Исходный материал
                        </h3>
                        
                        <div 
                            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                                isDragging ? 'border-blue-500 bg-blue-50' : 
                                selectedFile ? 'border-emerald-500 bg-emerald-50/30' : 
                                'border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-slate-50/50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input 
                                type="file" 
                                accept=".pdf,.docx" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                onChange={handleFileChange} 
                                ref={fileInputRef} 
                            />
                            
                            {selectedFile ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <p className="font-bold text-slate-900 text-sm">{selectedFile.name}</p>
                                    <p className="text-xs text-slate-500 mt-1">Готово к анализу</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-white text-blue-600 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 mb-3 pointer-events-none">
                                        <UploadCloud size={24} />
                                    </div>
                                    <p className="font-bold text-slate-700 text-sm">Перетащите PDF или DOCX</p>
                                    <p className="text-xs text-slate-400 mt-1">до 50 МБ</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Settings Card */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
                        <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                            <Settings size={20} className="text-slate-600" /> Настройки ИИ
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Фокус курса (Опционально)</label>
                                <textarea 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none h-24"
                                    placeholder="Например: Сделай акцент на практических примерах для отдела продаж..."
                                    value={courseContext}
                                    onChange={(e) => setCourseContext(e.target.value)}
                                ></textarea>
                            </div>

                            <button 
                                className={`w-full py-4 rounded-xl font-extrabold text-white flex items-center justify-center gap-2 transition-all ${
                                    isGenerating ? 'bg-blue-400 cursor-wait' : 
                                    !selectedFile ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
                                    'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 shadow-lg shadow-blue-600/20'
                                }`}
                                onClick={handleGenerate}
                                disabled={isGenerating || !selectedFile}
                            >
                                {isGenerating ? (
                                    <> <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Анализируем... </>
                                ) : (
                                    <> <Sparkles size={18} /> Сгенерировать черновик </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN: WORKSPACE ── */}
                <div className="lg:col-span-8">
                    {!generatedCourse ? (
                        <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10 bg-slate-50/50">
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-6">
                                <Layout size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Рабочая область пуста</h3>
                            <p className="text-slate-500 font-medium max-w-sm">
                                Загрузите документ слева и нажмите генерацию. ИИ изучит материал и соберет структуру курса.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-500">
                            
                            {/* Draft Meta */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-lg">Черновик</span>
                                    <span className="text-sm font-medium text-slate-400">{generatedCourse.lessons?.length || 0} модулей</span>
                                </div>
                                
                                <input 
                                    className="w-full text-3xl md:text-4xl font-black text-slate-900 placeholder:text-slate-300 outline-none mb-4 bg-transparent transition-colors focus:bg-slate-50 rounded-xl px-2 -ml-2 py-1"
                                    value={generatedCourse.course_title}
                                    onChange={(e) => updateField('course_title', e.target.value)}
                                    placeholder="Название курса..."
                                />
                                <textarea 
                                    className="w-full text-lg text-slate-600 font-medium placeholder:text-slate-300 outline-none resize-none h-24 bg-transparent transition-colors focus:bg-slate-50 rounded-xl px-2 -ml-2 py-1"
                                    value={generatedCourse.course_description}
                                    onChange={(e) => updateField('course_description', e.target.value)}
                                    placeholder="Краткое описание курса..."
                                />
                            </div>

                            {/* Lessons List */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-extrabold text-slate-900 px-2 flex items-center gap-2">
                                    Программа курса
                                </h3>
                                
                                {generatedCourse.lessons?.map((lesson, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group mb-6">
                                        <div className="flex items-center gap-4 p-4 border-b border-slate-50 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm shrink-0">
                                                {idx + 1}
                                            </div>
                                            <input 
                                                className="flex-1 text-lg font-bold text-slate-900 outline-none bg-transparent"
                                                value={lesson.title}
                                                onChange={(e) => updateLesson(idx, 'title', e.target.value)}
                                                placeholder="Название урока..."
                                            />
                                            <button 
                                                onClick={() => removeLesson(idx)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Удалить урок"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div className="p-4">
                                            {/* 🔥 Вызов твоего кастомного TiptapEditor 🔥 */}
                                            <TiptapEditor 
                                                content={lesson.content} 
                                                onChange={(content) => updateLesson(idx, 'content', content)} 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Publish Bar */}
                            <div className="sticky bottom-6 bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl shadow-slate-900/30">
                                <button 
                                    className="text-slate-400 hover:text-white font-medium text-sm transition-colors"
                                    onClick={() => setGeneratedCourse(null)}
                                >
                                    Сбросить
                                </button>
                                <button 
                                    className={`px-8 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
                                        isSaving ? 'bg-slate-700 text-slate-300' : 'bg-blue-600 text-white hover:bg-blue-500'
                                    }`}
                                    onClick={handleSaveCourse}
                                    disabled={isSaving || !generatedCourse.lessons?.length}
                                >
                                    {isSaving ? 'Сохранение...' : <> Опубликовать курс <ChevronRight size={16} /> </>}
                                </button>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL ── */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeDialog}></div>
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative z-10 animate-in zoom-in-95 duration-200">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                            {confirmDialog.isDanger ? <Trash2 size={24} /> : <Settings size={24} />}
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 mb-2">{confirmDialog.title}</h3>
                        <p className="text-slate-500 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm" onClick={closeDialog}>
                                Отмена
                            </button>
                            <button 
                                className={`flex-1 py-3 font-bold rounded-xl transition-colors text-sm text-white ${confirmDialog.isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`} 
                                onClick={confirmDialog.onConfirm}
                            >
                                {confirmDialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default TeacherPanel;