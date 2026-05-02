import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';      
import aiApi from './aiApi';    
import { toast } from 'react-toastify'; 
import { useTranslation } from 'react-i18next';
import { 
    UploadCloud, FileText, Settings, Sparkles, 
    Trash2, ChevronRight, CheckCircle2, Layout 
} from 'lucide-react';

import TiptapEditor from './CourseBuilder/components/TiptapEditor';

function TeacherPanel() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    
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
            toast.warning(t('teacherPanel.formatNotSupported'));
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setSelectedFile(file);
    };

    // --- ГЕНЕРАЦИЯ КУРСА ---
    const handleGenerate = async () => {
        if (!selectedFile) return toast.warning(t('teacherPanel.uploadDocPrompt'));
        
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
            toast.success(t('teacherPanel.draftCreated'));
        } catch (err) {
            console.error("Ошибка ИИ:", err);
            toast.error(err.response?.data?.detail || t('teacherPanel.generateError'));
        } finally {
            setIsGenerating(false);
        }
    };
    
    // --- СОХРАНЕНИЕ ---
    const handleSaveCourse = async () => {
        if (!generatedCourse?.course_title?.trim()) return toast.warning(t('teacherPanel.enterCourseName'));
        if (!generatedCourse?.lessons?.length) return toast.warning(t('teacherPanel.noLessons'));
        
        setIsSaving(true);
        try {
            await api.post('courses/bulk-create/', generatedCourse);
            toast.success(t('teacherPanel.draftSaved'));
            
            setGeneratedCourse(null); 
            setSelectedFile(null);
            setCourseContext("");
            setTimeout(() => navigate('/profile'), 1500);
            
        } catch (err) {
            console.error("Ошибка сохранения:", err);
            toast.error(t('teacherPanel.saveError'));
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
            title: t('teacherPanel.deleteLessonTitle'),
            message: t('teacherPanel.deleteLessonMessage'),
            confirmText: t('teacherPanel.deleteBtn'),
            isDanger: true,
            onConfirm: () => {
                const updated = { ...generatedCourse };
                updated.lessons.splice(idx, 1);
                setGeneratedCourse(updated);
                toast.info(t('teacherPanel.lessonDeleted'));
                closeDialog();
            }
        });
    };

    return (
        // 🔥 Обертка с правильными переменными темы
        <div className="min-h-screen bg-base-200 font-sans text-base-content transition-colors duration-200 pb-24">
            <div className="max-w-7xl mx-auto px-6 pt-10">
                
                {/* ── HEADER ── */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[11px] font-extrabold uppercase tracking-widest mb-3">
                            <Sparkles size={12} /> {t('teacherPanel.aiStudio')}
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('teacherPanel.generatorTitle')}</h1>
                        <p className="text-base-content/60 font-medium mt-2 max-w-xl">
                            {t('teacherPanel.generatorDesc')}
                        </p>
                    </div>
                    <button 
                        onClick={() => navigate('/profile')}
                        className="px-5 py-2.5 bg-base-100 border border-base-300 text-base-content font-bold rounded-xl text-sm hover:bg-base-200 transition-colors shadow-sm"
                    >
                        {t('teacherPanel.myCoursesBtn')}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* ── LEFT COLUMN: UPLOAD & SETTINGS ── */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Upload Card */}
                        <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-6 transition-colors">
                            <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" /> {t('teacherPanel.sourceMaterial')}
                            </h3>
                            
                            <div 
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                                    isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
                                    selectedFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 
                                    'border-base-300 bg-base-200/50 hover:border-blue-400 hover:bg-base-200'
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
                                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-3">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <p className="font-bold text-sm">{selectedFile.name}</p>
                                        <p className="text-xs text-base-content/50 mt-1">{t('teacherPanel.readyToAnalyze')}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 bg-base-100 text-blue-500 rounded-xl flex items-center justify-center shadow-sm border border-base-300 mb-3 pointer-events-none transition-colors">
                                            <UploadCloud size={24} />
                                        </div>
                                        <p className="font-bold text-sm">{t('teacherPanel.dragDropText')}</p>
                                        <p className="text-xs text-base-content/40 mt-1">{t('teacherPanel.maxSize')}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings Card */}
                        <div className="bg-base-100 rounded-[2rem] border border-base-300 shadow-sm p-6 transition-colors">
                            <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
                                <Settings size={20} className="text-base-content/50" /> {t('teacherPanel.aiSettingsTitle')}
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2 ml-1">
                                        {t('teacherPanel.courseFocus')}
                                    </label>
                                    <textarea 
                                        className="w-full px-4 py-3 bg-base-200/50 border border-base-300 rounded-xl text-sm font-medium placeholder:text-base-content/30 focus:outline-none focus:border-blue-500 transition-all resize-none h-24"
                                        placeholder={t('teacherPanel.courseFocusPlaceholder')}
                                        value={courseContext}
                                        onChange={(e) => setCourseContext(e.target.value)}
                                    ></textarea>
                                </div>

                                <button 
                                    className={`w-full py-4 rounded-xl font-extrabold text-white flex items-center justify-center gap-2 transition-all ${
                                        isGenerating ? 'bg-blue-400 dark:bg-blue-500/70 cursor-wait' : 
                                        !selectedFile ? 'bg-base-300 text-base-content/40 cursor-not-allowed' : 
                                        'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 shadow-lg shadow-blue-600/20'
                                    }`}
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !selectedFile}
                                >
                                    {isGenerating ? (
                                        <> <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> {t('teacherPanel.analyzing')} </>
                                    ) : (
                                        <> <Sparkles size={18} /> {t('teacherPanel.generateDraftBtn')} </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN: WORKSPACE ── */}
                    <div className="lg:col-span-8">
                        {!generatedCourse ? (
                            <div className="h-full min-h-[500px] border-2 border-dashed border-base-300 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10 bg-base-200/30 transition-colors">
                                <div className="w-20 h-20 bg-base-100 rounded-2xl flex items-center justify-center shadow-sm border border-base-300 mb-6">
                                    <Layout size={32} className="text-base-content/30" />
                                </div>
                                <h3 className="text-xl font-extrabold mb-2">{t('teacherPanel.emptyWorkspaceTitle')}</h3>
                                <p className="text-base-content/50 font-medium max-w-sm">
                                    {t('teacherPanel.emptyWorkspaceDesc')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-500">
                                
                                {/* Draft Meta */}
                                <div className="bg-base-100 rounded-[2.5rem] border border-base-300 shadow-sm p-8 transition-colors">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider rounded-lg">{t('teacherPanel.draftBadge')}</span>
                                        <span className="text-sm font-medium text-base-content/50">{generatedCourse.lessons?.length || 0} {t('teacherPanel.modulesCount')}</span>
                                    </div>
                                    
                                    <input 
                                        className="w-full text-3xl md:text-4xl font-black placeholder:text-base-content/20 outline-none mb-4 bg-transparent transition-colors focus:bg-base-200/50 rounded-xl px-2 -ml-2 py-1"
                                        value={generatedCourse.course_title}
                                        onChange={(e) => updateField('course_title', e.target.value)}
                                        placeholder={t('teacherPanel.courseNamePlaceholder')}
                                    />
                                    <textarea 
                                        className="w-full text-lg text-base-content/70 font-medium placeholder:text-base-content/20 outline-none resize-none h-24 bg-transparent transition-colors focus:bg-base-200/50 rounded-xl px-2 -ml-2 py-1"
                                        value={generatedCourse.course_description}
                                        onChange={(e) => updateField('course_description', e.target.value)}
                                        placeholder={t('teacherPanel.courseDescPlaceholder')}
                                    />
                                </div>

                                {/* Lessons List */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-extrabold px-2 flex items-center gap-2">
                                        {t('teacherPanel.courseProgram')}
                                    </h3>
                                    
                                    {generatedCourse.lessons?.map((lesson, idx) => (
                                        <div key={idx} className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden group mb-6 transition-colors">
                                            <div className="flex items-center gap-4 p-4 border-b border-base-200 bg-base-200/30">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <input 
                                                    className="flex-1 text-lg font-bold outline-none bg-transparent placeholder:text-base-content/30"
                                                    value={lesson.title}
                                                    onChange={(e) => updateLesson(idx, 'title', e.target.value)}
                                                    placeholder={t('teacherPanel.lessonNamePlaceholder')}
                                                />
                                                <button 
                                                    onClick={() => removeLesson(idx)}
                                                    className="p-2 text-base-content/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title={t('teacherPanel.deleteBtn')}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                            <div className="p-4">
                                                <TiptapEditor 
                                                    content={lesson.content} 
                                                    onChange={(content) => updateLesson(idx, 'content', content)} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Publish Bar */}
                                <div className="sticky bottom-6 bg-base-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl border border-base-300 z-10 transition-colors">
                                    <button 
                                        className="text-base-content/50 hover:text-base-content font-medium text-sm transition-colors"
                                        onClick={() => setGeneratedCourse(null)}
                                    >
                                        {t('teacherPanel.resetBtn')}
                                    </button>
                                    <button 
                                        className={`px-8 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
                                            isSaving ? 'bg-base-300 text-base-content/50' : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                        onClick={handleSaveCourse}
                                        disabled={isSaving || !generatedCourse.lessons?.length}
                                    >
                                        {isSaving ? t('teacherPanel.saving') : <> {t('teacherPanel.saveDraftBtn')} <ChevronRight size={16} /> </>}
                                    </button>
                                </div>

                            </div>
                        )}
                    </div>
                </div>

                {/* ── MODAL ── */}
                {confirmDialog.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-base-content/60 backdrop-blur-sm" onClick={closeDialog}></div>
                        <div className="bg-base-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 relative z-10 animate-in zoom-in-95 duration-200 border border-base-300">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                {confirmDialog.isDanger ? <Trash2 size={24} /> : <Settings size={24} />}
                            </div>
                            <h3 className="text-xl font-extrabold mb-2">{confirmDialog.title}</h3>
                            <p className="text-base-content/60 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
                            <div className="flex gap-3">
                                <button className="flex-1 py-3 bg-base-200 hover:bg-base-300 text-base-content font-bold rounded-xl transition-colors text-sm" onClick={closeDialog}>
                                    {t('teacherPanel.cancelBtn')}
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
        </div>
    );
}

export default TeacherPanel;