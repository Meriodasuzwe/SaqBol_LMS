import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
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
    ArrowLeft,
    Award,
    BrainCircuit, 
    Search,
    Lock // Добавили иконку замка
} from 'lucide-react';

import FakeMessenger from './FakeMessenger'; 
import FakeEmail from './FakeEmail';
import PythonEditor from './PythonEditor'; 
import SpotThePhishing from './SpotThePhishing'; 
import FreeResponseAI from './FreeResponseAI';
import { t } from 'i18next';

function LessonPage() {
    const { lessonId } = useParams();
    const navigate = useNavigate();
    
    const location = useLocation();
    
    const [lesson, setLesson] = useState(null);
    const [courseLessons, setCourseLessons] = useState([]);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [certLanguage, setCertLanguage] = useState('ru');
    const [isGeneratingCert, setIsGeneratingCert] = useState(false);
    const [certGenerated, setCertGenerated] = useState(false);

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
                
                const searchParams = new URLSearchParams(location.search);
                const targetStepId = searchParams.get('step');
                
                if (targetStepId && lessonRes.data.steps) {
                    const stepIndex = lessonRes.data.steps.findIndex(step => step.id === parseInt(targetStepId));
                    if (stepIndex !== -1) {
                        setActiveStepIndex(stepIndex);
                    } else {
                        const firstUncompletedIndex = lessonRes.data.steps?.findIndex(step => !step.is_completed);
                        setActiveStepIndex(firstUncompletedIndex !== -1 ? firstUncompletedIndex : 0);
                    }
                } else {
                    const firstUncompletedIndex = lessonRes.data.steps?.findIndex(step => !step.is_completed);
                    setActiveStepIndex(firstUncompletedIndex !== -1 ? firstUncompletedIndex : 0);
                }

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
    }, [lessonId, location.search]);

    const handleStepComplete = async (score = 10) => {
        if (!lesson || !lesson.steps || lesson.steps.length === 0) return;
        const currentStep = lesson.steps[activeStepIndex];
        
        try {
            const res = await api.post(`courses/steps/${currentStep.id}/complete/`, { score });
            
            setLesson(prevLesson => {
                const updatedSteps = [...prevLesson.steps];
                updatedSteps[activeStepIndex] = { ...updatedSteps[activeStepIndex], is_completed: true };
                return { ...prevLesson, steps: updatedSteps };
            });

            // ИСПРАВЛЕНИЕ №1: Запрашиваем обновленные данные курса, чтобы прогресс-бар сдвинулся!
            try {
                const updatedCourseRes = await api.get(`courses/${lesson.course}/`);
                setCourse(updatedCourseRes.data);
            } catch (courseErr) {
                console.error("Не удалось обновить прогресс курса", courseErr);
            }

            // Если бэкенд сказал, что ВЕСЬ КУРС только что пройден впервые
            if (res.data?.just_completed) {
                setShowCompletionModal(true);
                return; 
            }
            
            const currentIndexInCourse = courseLessons.findIndex(l => l.id === lesson.id);
            const nextLessonObj = currentIndexInCourse < courseLessons.length - 1 ? courseLessons[currentIndexInCourse + 1] : null;

            if (activeStepIndex < lesson.steps.length - 1) {
                // 1. Если в уроке ЕЩЕ ЕСТЬ шаги — просто плавно переключаем вкладку
                setActiveStepIndex(activeStepIndex + 1);
                const nextStepId = lesson.steps[activeStepIndex + 1].id;
                window.history.replaceState(null, '', `/lesson/${lessonId}?step=${nextStepId}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // 2. ЕСЛИ ЭТО БЫЛ ПОСЛЕДНИЙ ШАГ В УРОКЕ
                if (nextLessonObj) {
                    toast.success(t('builder.toasts.simEnd'));
                    setTimeout(() => {
                        navigate(`/lesson/${nextLessonObj.id}`);
                    }, 1200);
                } else {
                    // 3. ЭТО ПОСЛЕДНИЙ УРОК В КУРСЕ
                    toast.success(t('builder.toasts.simCongrat'));
                    setTimeout(() => {
                        navigate(`/course/${lesson.course}`);
                    }, 1500);
                }
            }
        } catch (err) {
            if (err.response?.data?.error) toast.error(err.response.data.error);
        }
    };

    const handleTabClick = (index, stepId) => {
        setActiveStepIndex(index);
        window.history.replaceState(null, '', `/lesson/${lessonId}?step=${stepId}`);
    };

    const getStepIcon = (type, isCompleted, isActive) => {
        if (isCompleted && !isActive) return <Check size={18} />;
        const props = { size: 18 };
        switch (type) {
            case 'video_url':
            case 'video_file': return <PlayCircle {...props} />;
            case 'simulation_chat':
            case 'simulation_email': return <ShieldCheck {...props} />;
            case 'interactive_spot': return <Search {...props} />; 
            case 'interactive_free': return <BrainCircuit {...props} />; 
            case 'quiz': return <HelpCircle {...props} />;
            case 'interactive_code': return <Code2 {...props} />;
            default: return <FileText {...props} />;
        }
    };

    // Функция проверки: заблокирован ли модуль?
    const isModuleLocked = (idx) => {
        // Мы блокируем ТОЛЬКО последний модуль
        if (idx !== courseLessons.length - 1) return false;
        
        // Если бэкенд отдает поле is_completed для уроков, используем его:
        if (courseLessons[0]?.hasOwnProperty('is_completed')) {
            return courseLessons.slice(0, -1).some(l => !l.is_completed);
        }
        
        // Если бэкенд не отдает is_completed, высчитываем по общему прогрессу курса.
        // Чтобы открыть последний урок, прогресс должен быть пропорционален пройденным модулям.
        const requiredProgress = ((courseLessons.length - 1) / courseLessons.length) * 100;
        return course?.progress < (requiredProgress - 2); // -2% для погрешности округления бэкенда
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-base-200">
            <div className="w-8 h-8 border-4 border-base-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    if (!lesson) return <div className="p-10 text-center font-bold text-base-content/50">Урок не найден</div>;

    const currentStep = lesson.steps && lesson.steps.length > 0 ? lesson.steps[activeStepIndex] : null;
    
    const isSimulation = currentStep && ['simulation_chat', 'simulation_email', 'interactive_spot', 'interactive_free'].includes(currentStep.step_type);

    return (
        <div className="min-h-screen bg-base-200 flex justify-center pb-20 font-sans text-base-content transition-colors duration-200">
            <div className="flex w-full max-w-7xl mx-auto pt-8 px-6 lg:px-8 gap-12 relative">
                
                {/* ── ЛЕВЫЙ САЙДБАР ── */}
                <aside className="hidden lg:flex flex-col w-[300px] shrink-0">
                    <button 
                        onClick={() => navigate(`/course/${lesson.course}`)}
                        className="text-[11px] font-black uppercase tracking-widest text-base-content/50 hover:text-base-content mb-8 flex items-center gap-2 transition-all group"
                    >
                        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Вернуться к курсу
                    </button>
                    
                    <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden sticky top-8 transition-colors duration-200">
                        <div className="p-6 border-b border-base-200">
                            <h2 className="font-black text-sm uppercase tracking-tight text-base-content leading-tight mb-4">
                                {course?.title}
                            </h2>
                            {course && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-base-content/50 uppercase tracking-widest">
                                        <span>Прогресс</span>
                                        <span className="text-blue-600 dark:text-blue-400">{course.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-base-300 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 transition-all duration-500"
                                            style={{ width: `${course.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <nav className="p-2 overflow-y-auto max-h-[50vh]">
                            {courseLessons.map((l, idx) => {
                                const isLocked = isModuleLocked(idx);

                                // Если модуль заблокирован, мы рендерим <div> вместо <Link>
                                if (isLocked) {
                                    return (
                                        <div 
                                            key={l.id}
                                            onClick={() => toast.info('Пройдите предыдущие модули, чтобы открыть финальное тестирование')}
                                            className="flex items-center gap-4 p-3 rounded-xl transition-all cursor-not-allowed opacity-60 bg-base-100"
                                        >
                                            <span className="text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border border-base-300 bg-base-200 text-base-content/40">
                                                <Lock size={10} />
                                            </span>
                                            <span className="text-xs font-bold truncate text-base-content/50">{l.title}</span>
                                        </div>
                                    );
                                }

                                // Обычный рендер доступного модуля
                                return (
                                    <Link 
                                        key={l.id}
                                        to={`/lesson/${l.id}`}
                                        className={`flex items-center gap-4 p-3 rounded-xl transition-all
                                            ${l.id === lesson.id
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                                                : 'hover:bg-base-200 text-base-content/80 hover:text-base-content'
                                            }`}
                                    >
                                        <span className={`text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border
                                            ${l.id === lesson.id ? 'border-white/30' : 'border-base-300 text-base-content/50'}`}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold truncate">{l.title}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* ── ЦЕНТРАЛЬНЫЙ КОНТЕНТ ── */}
                <main className="flex-1 max-w-4xl">
                    <header className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/50">
                                Урок {courseLessons.findIndex(l => l.id === lesson.id) + 1}
                            </span>
                            <div className="h-px flex-1 bg-base-300"></div>
                        </div>
                        <h1 className="text-3xl font-black text-base-content tracking-tight leading-tight">{lesson.title}</h1>
                    </header>

                    <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm overflow-hidden flex flex-col min-h-[600px] transition-colors duration-200">
                        
                        <div className="bg-base-200/50 border-b border-base-300 px-6 py-4 flex items-center gap-3 overflow-x-auto">
                            {lesson.steps?.map((step, index) => {
                                const isActive  = index === activeStepIndex;
                                const isPassed  = step.is_completed;
                                return (
                                    <button 
                                        key={step.id}
                                        onClick={() => handleTabClick(index, step.id)} 
                                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 border-2
                                            ${isActive
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20 scale-105'
                                                : isPassed
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-base-100 border-base-200 text-base-content/30 hover:border-base-300 hover:text-base-content/60'
                                            }`}
                                        title={step.title}
                                    >
                                        {getStepIcon(step.step_type, isPassed, isActive)}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-1 flex flex-col">
                            {currentStep ? (
                                <div className="animate-in fade-in duration-500">
                                    
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
                                            <h2 className="text-2xl font-black text-base-content mb-6">{currentStep.title}</h2>
                                        )}

                                        <div className="text-base-content/80">
                                            {currentStep.step_type === 'simulation_chat' ? (
                                                <div className="flex justify-center py-4">
                                                    <FakeMessenger 
                                                        scenario={currentStep.scenario_data} 
                                                        onComplete={handleStepComplete} 
                                                        stepId={currentStep.id}
                                                        onExit={() => navigate(`/course/${lesson.course}`)}
                                                    />
                                                </div>
                                            ) : currentStep.step_type === 'simulation_email' ? (
                                                <div className="flex justify-center py-4">
                                                    <FakeEmail scenario={currentStep.scenario_data} onComplete={handleStepComplete} />
                                                </div>
                                            ) : currentStep.step_type === 'interactive_spot' ? (
                                                <div className="flex justify-center py-4">
                                                    <SpotThePhishing 
                                                        data={currentStep.scenario_data} 
                                                        onComplete={handleStepComplete} 
                                                    />
                                                </div>
                                            ) : currentStep.step_type === 'interactive_free' ? (
                                                <div className="flex justify-center py-4 w-full">
                                                    <FreeResponseAI stepData={currentStep} onComplete={handleStepComplete} />
                                                </div>
                                            ) : currentStep.step_type === 'interactive_code' ? (
                                                <div className="rounded-xl overflow-hidden border border-base-300 dark:border-slate-700">
                                                    <PythonEditor stepData={currentStep} onSuccess={() => handleStepComplete(20)} />
                                                </div>
                                            ) : currentStep.step_type === 'quiz' ? (
                                                <div className="text-center py-16 bg-base-200 rounded-2xl border border-dashed border-base-300">
                                                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
                                                        <HelpCircle className="text-blue-600 dark:text-blue-400" size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-black mb-2 text-base-content">Проверка знаний</h3>
                                                    <p className="text-base-content/60 text-sm mb-8 max-w-xs mx-auto">
                                                        Пройдите тест по материалам урока, чтобы разблокировать следующий модуль.
                                                    </p>
                                                    <Link 
                                                        to={`/quiz/lesson/${lesson.id}?quiz_id=${currentStep.scenario_data?.quiz_id || ''}`} 
                                                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                                                    >
                                                        Начать тест <ArrowRight size={18} />
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div
                                                    className="prose prose-sm sm:prose-base max-w-none prose-headings:font-black prose-img:rounded-2xl dark:prose-invert prose-a:text-blue-600 hover:prose-a:text-blue-500"
                                                    dangerouslySetInnerHTML={{ __html: currentStep.content }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-base-content/30 italic">
                                    Контент шага пуст
                                </div>
                            )}
                        </div>

                        {!isSimulation && currentStep && !['quiz', 'interactive_code'].includes(currentStep.step_type) && (
                            <div className="p-6 bg-base-200/50 border-t border-base-300 flex items-center justify-between mt-auto">
                                {activeStepIndex > 0 ? (
                                    <button onClick={() => {
                                        setActiveStepIndex(activeStepIndex - 1); 
                                        window.history.replaceState(null, '', `/lesson/${lessonId}?step=${lesson.steps[activeStepIndex - 1].id}`);
                                        window.scrollTo(0, 0);
                                    }}
                                        className="flex items-center gap-2 text-xs font-bold text-base-content/50 hover:text-base-content transition-colors uppercase tracking-widest"
                                    >
                                        <ArrowLeft size={16} /> Назад
                                    </button>
                                ) : <div />}

                                <button 
                                    onClick={() => handleStepComplete(10)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 ml-auto"
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

                {showCompletionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-base-300/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-base-100 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center relative animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
                            <Award size={48} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-black mb-2 text-base-content">Курс пройден!</h2>
                        <p className="text-sm text-base-content/60 mb-8">
                            Вы проделали отличную работу. Ваш сертификат готов и ждет вас в профиле.
                        </p>
                        <Link 
                            to="/profile" 
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                            Перейти в профиль <ArrowRight size={18} />
                        </Link>
                        <button 
                            onClick={() => {
                                setShowCompletionModal(false);
                                navigate(`/course/${lesson.course}`);
                            }} 
                            className="mt-4 text-sm text-base-content/50 hover:text-base-content font-medium w-full py-2"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

export default LessonPage;