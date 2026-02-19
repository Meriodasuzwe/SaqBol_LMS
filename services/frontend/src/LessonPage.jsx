import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from './api';
import FakeMessenger from './FakeMessenger';
import FakeEmail from './FakeEmail';

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
                setActiveStepIndex(0);

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
            
            if (activeStepIndex < lesson.steps.length - 1) {
                setActiveStepIndex(activeStepIndex + 1);
                // Прокручиваем страницу наверх при переходе на новый шаг
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if (nextLesson) {
                    navigate(`/lesson/${nextLesson.id}`);
                } else {
                    alert("Поздравляем! Вы успешно завершили все шаги курса! 🎉");
                    navigate(`/courses/${lesson.course}`);
                }
            }
        } catch (err) {
            console.error("Ошибка завершения шага", err);
            if (err.response?.data?.error) alert(err.response.data.error);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
    );

    if (!lesson) return <div className="p-10 text-center text-error">Урок не найден</div>;

    const currentIndex = courseLessons.findIndex(l => l.id === lesson.id);
    const nextLesson = currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;
    const currentStep = lesson.steps && lesson.steps.length > 0 ? lesson.steps[activeStepIndex] : null;
    const isSimulation = currentStep && ['simulation_chat', 'simulation_email'].includes(currentStep.step_type);

    return (
        // Главный контейнер (Серый фон, чтобы белый контент выделялся)
        <div className="min-h-screen bg-gray-100 flex justify-center pb-12">
            
            {/* Макет с боковым меню (Сайдбаром) */}
            <div className="flex w-full max-w-7xl mx-auto pt-6 px-4 lg:px-8 gap-8">
                
                {/* --- ЛЕВЫЙ САЙДБАР (План курса) - Скрыт на мобилках --- */}
                <aside className="hidden lg:flex flex-col w-1/4 shrink-0">
                    <Link to={`/courses/${lesson.course}`} className="text-sm font-bold text-gray-500 hover:text-primary mb-4 flex items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Назад к курсу
                    </Link>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
                        <div className="bg-base-200 p-4 border-b border-gray-200">
                            <h2 className="font-bold text-gray-800 line-clamp-2">{course?.title || 'Содержание курса'}</h2>
                            {course && (
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Прогресс</span>
                                        <span>{course.progress}%</span>
                                    </div>
                                    <progress className="progress progress-success w-full h-1.5" value={course.progress} max="100"></progress>
                                </div>
                            )}
                        </div>
                        <ul className="max-h-[70vh] overflow-y-auto">
                            {courseLessons.map((l, idx) => (
                                <li key={l.id}>
                                    <Link 
                                        to={`/lesson/${l.id}`}
                                        className={`flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${l.id === lesson.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                                    >
                                        <div className={`mt-0.5 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${l.id === lesson.id ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <span className={`text-sm ${l.id === lesson.id ? 'font-bold text-primary' : 'text-gray-700'}`}>
                                            {l.title}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* --- ПРАВАЯ ЧАСТЬ (Основной контент) --- */}
                <main className="w-full lg:w-3/4 flex flex-col">
                    
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-6">{lesson.title}</h1>

                    {/* Блок Контента (Белая карточка с тенью) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6 flex-1 flex flex-col">
                        
                        {/* Верхняя панель шагов (Stepik Квадратики) */}
                        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-center sm:justify-start gap-2 overflow-x-auto">
                            {lesson.steps?.map((step, index) => {
                                const isActive = index === activeStepIndex;
                                const isPassed = index < activeStepIndex; // Визуально помечаем пройденные
                                
                                let icon = "📝";
                                if (step.step_type === 'video_url' || step.step_type === 'video_file') icon = "▶️";
                                if (step.step_type.includes('simulation')) icon = "🛡️";
                                if (step.step_type === 'quiz') icon = "❓";

                                return (
                                    <button 
                                        key={step.id}
                                        onClick={() => setActiveStepIndex(index)}
                                        className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-in-out border-b-4
                                            ${isActive 
                                                ? 'bg-white border-primary text-primary shadow-sm scale-105' // Текущий
                                                : isPassed 
                                                    ? 'bg-success/10 border-success text-success hover:bg-success/20' // Пройденный
                                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600' // Будущий
                                            }`}
                                        title={step.title || `Шаг ${index + 1}`}
                                    >
                                        {isPassed && !isActive ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <span className="text-lg">{icon}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Само тело шага */}
                        {currentStep ? (
                            <div className="flex-1 animate-fade-in flex flex-col">
                                
                                {/* Заголовок конкретного шага */}
                                {currentStep.title && (
                                    <div className="px-8 pt-8 pb-4">
                                        <h2 className="text-2xl font-bold text-gray-800">{currentStep.title}</h2>
                                    </div>
                                )}

                                {/* Рендер контента */}
                                <div className="flex-1">
                                    {currentStep.step_type === 'simulation_chat' ? (
                                        <div className="py-12 bg-gray-50 flex justify-center">
                                            <FakeMessenger scenario={currentStep.scenario_data} onComplete={handleStepComplete} />
                                        </div>
                                    ) : currentStep.step_type === 'simulation_email' ? (
                                        <div className="py-12 bg-gray-50 flex justify-center">
                                            <FakeEmail scenario={currentStep.scenario_data} onComplete={handleStepComplete} />
                                        </div>
                                    ) : currentStep.step_type === 'video_url' ? (
                                        <div className="flex flex-col">
                                            <div className="w-full bg-black aspect-video relative">
                                                <iframe src={getYoutubeEmbedUrl(currentStep.content)} className="w-full h-full absolute top-0 left-0" frameBorder="0" allowFullScreen></iframe>
                                            </div>
                                            <div className="p-8 prose prose-lg max-w-none prose-headings:text-primary">
                                                <div dangerouslySetInnerHTML={{ __html: currentStep.content }} />
                                            </div>
                                        </div>
                                    ) : currentStep.step_type === 'video_file' ? (
                                        <div className="flex flex-col">
                                            {currentStep.file && (
                                                <div className="w-full bg-black aspect-video flex justify-center items-center">
                                                    <video src={currentStep.file} controls className="max-h-full max-w-full" />
                                                </div>
                                            )}
                                            <div className="p-8 prose prose-lg max-w-none prose-headings:text-primary">
                                                {currentStep.content && <div dangerouslySetInnerHTML={{ __html: currentStep.content }} />}
                                            </div>
                                        </div>
                                    ) : currentStep.step_type === 'quiz' ? (
                                        <div className="flex flex-col items-center justify-center text-center py-20 px-4">
                                            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                                <span className="text-5xl">❓</span>
                                            </div>
                                            <h3 className="text-3xl font-bold mb-4 text-gray-800">Проверка знаний</h3>
                                            <p className="mb-8 text-gray-600 max-w-md">Вам необходимо успешно пройти тестирование, чтобы подтвердить знания и двигаться дальше.</p>
                                            <Link to={`/quiz/lesson/${lesson.id}`} className="btn btn-primary btn-wide btn-lg shadow-lg hover:shadow-xl transition-shadow">
                                                Начать тест
                                            </Link>
                                        </div>
                                    ) : (
                                        /* ТЕКСТОВЫЙ ШАГ */
                                        <div className="p-8 sm:px-12 py-10 prose prose-lg max-w-none text-gray-700 prose-headings:text-gray-900 prose-a:text-blue-600 prose-img:rounded-xl">
                                            {currentStep.content ? (
                                                <div dangerouslySetInnerHTML={{ __html: currentStep.content }} />
                                            ) : (
                                                <p className="text-gray-400 italic text-center py-10">Контент отсутствует</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-20 text-center text-gray-500">В этом уроке пока нет контента.</div>
                        )}
                    </div>

                    {/* Нижняя панель с большой зелёной кнопкой (если это не симуляция и не тест) */}
                    {!isSimulation && currentStep && currentStep.step_type !== 'quiz' && (
                        <div className="flex justify-between items-center bg-transparent mt-2">
                            {/* Кнопка "Назад" */}
                            {activeStepIndex > 0 ? (
                                <button onClick={() => { setActiveStepIndex(activeStepIndex - 1); window.scrollTo(0,0); }} className="btn btn-ghost text-gray-500 hover:text-gray-800">
                                    ← Предыдущий шаг
                                </button>
                            ) : (
                                <div></div> // Пустышка для flex-between
                            )}

                            {/* Главная кнопка "Следующий шаг" */}
                            <button 
                                onClick={() => handleStepComplete(10)} 
                                className="btn btn-success text-white px-8 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                            >
                                {activeStepIndex < lesson.steps.length - 1 ? 'Следующий шаг →' : 'Завершить урок ✔️'}
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default LessonPage;