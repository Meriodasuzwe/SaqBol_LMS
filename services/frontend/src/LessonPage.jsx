import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from './api';
import { 
    ChevronLeft, 
    Check, 
    PlayCircle, 
    ShieldCheck, 
    HelpCircle, 
    Code2, 
    FileText, 
    ArrowRight,
    ArrowLeft
} from 'lucide-react';

import FakeMessenger from './FakeMessenger';
import FakeEmail from './FakeEmail';
import PythonEditor from './PythonEditor'; 

function LessonPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    
    const [lesson, setLesson] = useState(null);
    const [courseLessons, setCourseLessons] = useState([]);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;
        if (url.includes("embed")) return url;
        let videoId = "";
        if (url.includes("youtu.be")) {
            videoId = url.split("/").pop();
        } else if (url.includes("v=")) {
            videoId = url.split("v=")[1].split("&")[0];
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };

    useEffect(() => {
        const fetchLessonData = async () => {
            setLoading(true);
            try {
                const lessonRes = await api.get(`courses/lessons/${lessonId}/`);
                setLesson(lessonRes.data);
                
                const firstUncompletedIndex = lessonRes.data.steps?.findIndex(step => !step.is_completed);
                setActiveStepIndex(firstUncompletedIndex !== -1 ? firstUncompletedIndex : 0);

                const allLessonsRes = await api.get(`courses/${lessonRes.data.course}/lessons/`);
                setCourseLessons(allLessonsRes.data);

                const courseRes = await api.get(`courses/${lessonRes.data.course}/`);
                setCourse(courseRes.data);

            } catch (err) {
                console.error("Ошибка загрузки урока", err);
            } finally {
                setLoading(false);
            }
        };

        if (lessonId) fetchLessonData();
    }, [lessonId]);

    const handleStepComplete = async (score = 10) => {
        if (!lesson || !lesson.steps || lesson.steps.length === 0) return;
        const currentStep = lesson.steps[activeStepIndex];
        
        try {
            await api.post(`courses/steps/${currentStep.id}/complete/`, { score });
            
            setLesson(prevLesson => {
                const updatedSteps = [...prevLesson.steps];
                updatedSteps[activeStepIndex] = { ...updatedSteps[activeStepIndex], is_completed: true };
                return { ...prevLesson, steps: updatedSteps };
            });
            
            const currentIndexInCourse = courseLessons.findIndex(l => l.id === lesson.id);
            const nextLessonObj = currentIndexInCourse < courseLessons.length - 1 ? courseLessons[currentIndexInCourse + 1] : null;

            if (activeStepIndex < lesson.steps.length - 1) {
                setActiveStepIndex(activeStepIndex + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if (nextLessonObj) {
                    toast.success("Урок завершен! Переходим к следующему");
                    navigate(`/lesson/${nextLessonObj.id}`);
                } else {
                    toast.success("Поздравляем! Вы завершили курс! 🎉");
                    navigate(`/course/${lesson.course}`);
                }
            }
        } catch (err) {
            if (err.response?.data?.error) toast.error(err.response.data.error);
        }
    };

    const getStepIcon = (type, isCompleted, isActive) => {
        if (isCompleted && !isActive) return <Check size={18} />;
        const props = { size: 18 };
        switch (type) {
            case 'video_url':
            case 'video_file': return <PlayCircle {...props} />;
            case 'simulation_chat':
            case 'simulation_email': return <ShieldCheck {...props} />;
            case 'quiz': return <HelpCircle {...props} />;
            case 'interactive_code': return <Code2 {...props} />;
            default: return <FileText {...props} />;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
        </div>
    );

    if (!lesson) return <div className="p-10 text-center font-bold text-slate-400">Урок не найден</div>;

    const currentStep = lesson.steps && lesson.steps.length > 0 ? lesson.steps[activeStepIndex] : null;
    const isSimulation = currentStep && ['simulation_chat', 'simulation_email'].includes(currentStep.step_type);

    return (
        <div className="min-h-screen bg-slate-50/50 flex justify-center pb-20 font-sans text-slate-900">
            
            <div className="flex w-full max-w-7xl mx-auto pt-8 px-6 lg:px-8 gap-12">
                
                {/* --- ЛЕВЫЙ САЙДБАР --- */}
                <aside className="hidden lg:flex flex-col w-[300px] shrink-0">
                    <button 
                        onClick={() => navigate(`/course/${lesson.course}`)}
                        className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 mb-8 flex items-center gap-2 transition-all group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Вернуться к курсу
                    </button>
                    
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-8">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="font-black text-sm uppercase tracking-tight text-slate-900 leading-tight mb-4">
                                {course?.title}
                            </h2>
                            {course && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>Прогресс</span>
                                        <span>{course.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${course.progress}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <nav className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar">
                            {courseLessons.map((l, idx) => (
                                <Link 
                                    key={l.id}
                                    to={`/lesson/${l.id}`}
                                    className={`flex items-center gap-4 p-3 rounded-xl transition-all ${l.id === lesson.id ? 'bg-slate-900 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}
                                >
                                    <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border ${l.id === lesson.id ? 'border-white/20' : 'border-slate-200 text-slate-400'}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-xs font-bold truncate">{l.title}</span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* --- ЦЕНТРАЛЬНЫЙ КОНТЕНТ --- */}
                <main className="flex-1 max-w-4xl">
                    <header className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Урок {courseLessons.findIndex(l => l.id === lesson.id) + 1}</span>
                            <div className="h-px flex-1 bg-slate-100"></div>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{lesson.title}</h1>
                    </header>

                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        
                        {/* Timeline шагов (Tabs) */}
                        <div className="bg-slate-50/50 border-b border-slate-200 px-6 py-4 flex items-center gap-3 overflow-x-auto no-scrollbar">
                            {lesson.steps?.map((step, index) => {
                                const isActive = index === activeStepIndex;
                                const isPassed = step.is_completed; 
                                return (
                                    <button 
                                        key={step.id}
                                        onClick={() => setActiveStepIndex(index)}
                                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 border-2
                                            ${isActive 
                                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' 
                                                : isPassed 
                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                                                    : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300' 
                                            }`}
                                        title={step.title}
                                    >
                                        {getStepIcon(step.step_type, isPassed, isActive)}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Контент шага */}
                        <div className="flex-1 flex flex-col">
                            {currentStep ? (
                                <div className="animate-in fade-in duration-500">
                                    
                                    {/* Видео блок */}
                                    {(currentStep.step_type === 'video_url' || currentStep.step_type === 'video_file') && (
                                        <div className="bg-black aspect-video w-full overflow-hidden">
                                            {currentStep.step_type === 'video_url' ? (
                                                <iframe src={getYoutubeEmbedUrl(currentStep.content)} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                                            ) : (
                                                <video src={currentStep.file} controls className="w-full h-full" />
                                            )}
                                        </div>
                                    )}

                                    <div className="p-8 sm:p-12">
                                        {currentStep.title && (
                                            <h2 className="text-2xl font-black text-slate-900 mb-6">{currentStep.title}</h2>
                                        )}

                                        {/* Рендер контента */}
                                        <div className="text-slate-700">
                                            {currentStep.step_type === 'simulation_chat' ? (
                                                <div className="flex justify-center py-4"><FakeMessenger scenario={currentStep.scenario_data} onComplete={handleStepComplete} /></div>
                                            ) : currentStep.step_type === 'simulation_email' ? (
                                                <div className="flex justify-center py-4"><FakeEmail scenario={currentStep.scenario_data} onComplete={handleStepComplete} /></div>
                                            ) : currentStep.step_type === 'interactive_code' ? (
                                                <div className="rounded-xl overflow-hidden border border-slate-800"><PythonEditor stepData={currentStep} onSuccess={() => handleStepComplete(20)} /></div>
                                            ) : currentStep.step_type === 'quiz' ? (
                                                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6"><HelpCircle className="text-slate-900" size={32} /></div>
                                                    <h3 className="text-xl font-black mb-2">Проверка знаний</h3>
                                                    <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto">Пройдите тест по материалам урока, чтобы разблокировать следующий модуль.</p>
                                                    <Link to={`/quiz/lesson/${lesson.id}`} className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all">Начать тест <ArrowRight size={18} /></Link>
                                                </div>
                                            ) : (
                                                <div className="prose prose-slate max-w-none prose-headings:font-black prose-img:rounded-2xl" dangerouslySetInnerHTML={{ __html: currentStep.content }} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-300 italic">Контент шага пуст</div>
                            )}
                        </div>

                        {/* Футер навигации (только для текстовых/видео шагов) */}
                        {!isSimulation && currentStep && !['quiz', 'interactive_code'].includes(currentStep.step_type) && (
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                {activeStepIndex > 0 ? (
                                    <button onClick={() => {setActiveStepIndex(activeStepIndex - 1); window.scrollTo(0,0)}} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">
                                        <ArrowLeft size={16} /> Назад
                                    </button>
                                ) : <div />}

                                <button 
                                    onClick={() => handleStepComplete(10)}
                                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200"
                                >
                                    {activeStepIndex < lesson.steps.length - 1 ? (
                                        <>Следующий шаг <ArrowRight size={18} /></>
                                    ) : (
                                        <>Завершить урок <Check size={18} /></>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default LessonPage;