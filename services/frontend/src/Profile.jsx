import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';
import { Award, Download, Briefcase, ArrowRight } from 'lucide-react'; // 🔥 Добавили Briefcase и ArrowRight
import { useTranslation } from 'react-i18next';

function Profile() {
    const { t, i18n } = useTranslation();
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const [activityYear, setActivityYear] = useState(new Date().getFullYear());

    const navigate = useNavigate();

    // Функция для определения локали для дат
    const getDateLocale = () => {
        if (i18n.language === 'en') return 'en-US';
        if (i18n.language === 'kk') return 'kk-KZ';
        return 'ru-RU';
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userRes = await api.get('users/me/');
                setUser(userRes.data);

                const resultsRes = await api.get('quizzes/my-results/');
                setResults(resultsRes.data);

                const catRes = await api.get('courses/categories/');
                setCategories(catRes.data);
                if (catRes.data.length > 0) setSelectedCategory(catRes.data[0].id);

                const coursesRes = await api.get('courses/my_courses/');
                setMyCourses(coursesRes.data);

                const certRes = await api.get('courses/certificates/my/').catch(() => ({ data: [] }));
                setCertificates(certRes.data);

            } catch (err) {
                console.error("Ошибка загрузки профиля:", err);
                toast.error(t('profile.profileLoadError') || "Ошибка загрузки профиля");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [t]);

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('avatar', file);
        setUser(prev => ({ ...prev, avatar: URL.createObjectURL(file) }));
        try {
            const res = await api.patch('users/me/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setUser(res.data);
            toast.success(t('profile.avatarUpdateSuccess') || "Аватар обновлен");
        } catch (err) {
            toast.error(t('profile.avatarUpdateError') || "Ошибка при обновлении аватара");
        }
    };

    const getMediaUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('blob:')) return path;
        return `http://localhost:8000${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const handleCreateCourse = async () => {
        setIsCreating(true);
        try {
            const res = await api.post('courses/', {
                title: newCourseTitle, description: "Описание...", category: selectedCategory, price: 0
            });
            setIsModalOpen(false);
            navigate(`/teacher/course/${res.data.id}/builder`);
        } catch (err) {
            toast.error(t('profile.courseCreateError') || "Ошибка создания курса");
        } finally {
            setIsCreating(false);
        }
    };

    const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
    const totalTests = results.length;
    const averageScore = totalTests > 0
        ? Math.round(results.reduce((acc, c) => acc + c.score, 0) / totalTests)
        : 0;

    const inProgressCourses = myCourses.filter(c => !c.is_completed).length;
    const totalStudents = isTeacher
        ? myCourses.reduce((acc, c) => acc + (c.enrolled_students_count || 0), 0)
        : null;

    const isFakeEmail = user?.email?.includes('@telegram.fake') || user?.email?.includes('@telegram.com');
    const displaySubtext = isFakeEmail ? `@${user?.username} (Telegram)` : user?.email;

    const activityMap = useMemo(() => {
        const map = {};
        results.forEach(r => {
            if (r.completed_at) {
                const date = new Date(r.completed_at).toISOString().split('T')[0];
                map[date] = (map[date] || 0) + 1;
            }
        });
        const endDate = new Date(activityYear, 11, 31);
        const days = [];
        for (let i = 364; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({ date: dateStr, count: map[dateStr] || 0 });
        }
        return days;
    }, [results, activityYear]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="loading loading-spinner text-blue-600"></span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-base-content animate-fade-in">

            {/* ── ШАПКА ПРОФИЛЯ ── */}
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden mb-6">
                <div className="h-32 bg-base-200/50 border-b border-base-200"></div>
                <div className="px-8 pb-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end relative -mt-12">
                    <div className="relative shrink-0 group">
                        <div className="w-28 h-28 rounded-full border-4 border-base-100 shadow-sm bg-base-200 overflow-hidden flex items-center justify-center">
                            {user?.avatar ? (
                                <img src={getMediaUrl(user?.avatar)} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-semibold uppercase text-base-content/40">
                                    {user?.username?.[0] || 'U'}
                                </span>
                            )}
                        </div>
                        <label htmlFor="avatar-upload"
                            className="absolute bottom-1 right-1 p-2 bg-base-100 border border-base-300 rounded-full cursor-pointer hover:bg-base-200 transition-colors shadow-sm text-base-content/70 z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                            </svg>
                        </label>
                        <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>
                    <div className="flex-1 pb-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-base-content">
                                {user?.first_name || user?.username} {user?.last_name}
                            </h1>
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                {isTeacher ? (t('profile.roleTeacher') || 'Преподаватель') : (t('profile.roleStudent') || 'Студент')}
                            </span>
                        </div>
                        <p className="text-sm text-base-content/50 mt-1">{displaySubtext}</p>
                    </div>
                    <div className="pb-2">
                        <Link to="/settings" className="btn btn-sm btn-outline border-base-300 text-base-content/80 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 font-medium">
                            {t('profile.settingsBtn') || 'Настройки'}
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── АКТИВНОСТЬ ── */}
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 mb-6 flex flex-col md:flex-row gap-8">
                <div className="flex-1 overflow-x-auto">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        {t('profile.learningActivity') || 'Активность'}
                        <span className="text-xs font-normal text-base-content/50 border border-base-300 rounded px-2 py-0.5">
                            {t('profile.testsPerYear', { count: totalTests }) || `${totalTests} тестов за год`}
                        </span>
                    </h3>
                    <div className="pb-2 min-w-max">
                        <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                            {activityMap.map((day, idx) => {
                                let bg = "bg-gray-200 dark:bg-base-300";
                                if (day.count === 1) bg = "bg-emerald-300 dark:bg-emerald-800";
                                if (day.count === 2) bg = "bg-emerald-400 dark:bg-emerald-600";
                                if (day.count >= 3) bg = "bg-emerald-500 dark:bg-emerald-500";
                                return (
                                    <div key={idx}
                                        className={`w-[11px] h-[11px] rounded-[2px] transition-colors cursor-pointer hover:ring-1 hover:ring-base-content/30 ${bg}`}
                                        title={`${new Date(day.date).toLocaleDateString(getDateLocale())}: ${day.count} ${t('profile.testsWord') || 'тестов'}`} />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* ── ЛЕВАЯ КОЛОНКА ── */}
                <div className="xl:col-span-1 space-y-6">
                    
                    {/* 🔥 БЛОК: КАБИНЕТ РУКОВОДИТЕЛЯ (B2B) 🔥 */}
                    <div 
                        onClick={() => navigate('/corporate/dashboard')}
                        className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg border border-indigo-500 p-6 text-white relative overflow-hidden group cursor-pointer hover:shadow-indigo-500/30 transition-all"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 group-hover:scale-110 transition-transform"></div>
                        <div className="relative z-10 flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm shrink-0">
                                <Briefcase size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">{t('profile.headsoffice')}</h3>
                                <p className="text-indigo-100 text-xs mt-0.5">{t('profile.headsanalytic')}</p>
                            </div>
                        </div>
                        <div className="relative z-10 mt-4 flex justify-between items-center text-sm font-medium text-white/90 group-hover:text-white">
                            <span>{t('profile.gotodashboard')}</span>
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>

                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
                        <h3 className="text-sm font-semibold mb-4">{t('profile.performanceTitle') || 'Успеваемость'}</h3>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="p-4 rounded-xl border border-base-200 bg-base-50/50">
                                <div className="text-xs text-base-content/50 mb-1">{t('profile.totalTestsLabel') || 'Пройдено тестов'}</div>
                                <div className="text-2xl font-bold">{totalTests}</div>
                            </div>
                            <div className="p-4 rounded-xl border border-base-200 bg-base-50/50">
                                <div className="text-xs text-base-content/50 mb-1">{t('profile.averageScoreLabel') || 'Средний балл'}</div>
                                <div className={`text-2xl font-bold ${averageScore >= 70 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                                    {averageScore}%
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl border border-base-200 bg-base-50/50">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-xs text-base-content/50">
                                    {isTeacher ? (t('profile.studentsInCourses') || 'Студентов на курсах') : (t('profile.coursesInProgress') || 'Курсов в процессе')}
                                </div>
                                <div className="text-lg font-bold">
                                    {isTeacher ? (totalStudents ?? '—') : inProgressCourses}
                                </div>
                            </div>
                            {!isTeacher && myCourses.length > 0 && (
                                <div className="w-full bg-base-200 rounded-full h-1.5 mt-1">
                                    <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.round((inProgressCourses / myCourses.length) * 100)}%` }} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6">
                        <h3 className="text-sm font-semibold mb-4">{t('profile.recentResultsTitle') || 'Последние результаты'}</h3>
                        {results.length === 0 ? (
                            <p className="text-sm text-base-content/50">{t('profile.noData') || 'Нет данных'}</p>
                        ) : (
                            <div className="space-y-1">
                                {results.slice(0, 5).map(r => (
                                    <div key={r.id} className="py-3 px-2 -mx-2 rounded-lg hover:bg-base-50 dark:hover:bg-base-200 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="truncate pr-3 flex-1">
                                                <p className="text-sm font-medium truncate">{r.quiz_title || t('profile.untitledQuiz')}</p>
                                                <p className="text-[11px] text-base-content/50 mt-0.5">
                                                    {r.completed_at ? new Date(r.completed_at).toLocaleDateString(getDateLocale()) : '—'}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 font-bold text-xs px-2 py-1 rounded border ${r.score >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'}`}>
                                                {r.score}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-base-200 rounded-full h-1">
                                            <div className={`h-1 rounded-full transition-all duration-500 ${r.score >= 70 ? 'bg-emerald-500' : r.score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                style={{ width: `${r.score}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── ПРАВАЯ КОЛОНКА ── */}
                <div className="xl:col-span-2 space-y-6">
                    {/* КУРСЫ */}
                    <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-6 sm:p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">
                                {isTeacher ? (t('profile.manageCourses') || 'Управление курсами') : (t('profile.myLearning') || 'Мое обучение')}
                            </h3>
                            {isTeacher && (
                                <button onClick={() => setIsModalOpen(true)}
                                    className="btn btn-sm rounded-md shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-0">
                                    {t('profile.createCourseBtn') || 'Создать курс'}
                                </button>
                            )}
                        </div>

                        {myCourses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {myCourses.map(course => (
                                    <div key={course.id} className="p-5 rounded-xl border border-base-200 bg-base-50/50 hover:bg-base-100 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col">
                                        <div className="text-[10px] font-bold text-base-content/40 mb-2 uppercase tracking-widest">
                                            {/* ✅ Динамический перевод категории */}
                                            {t(`categories.${course.category_title}`, { defaultValue: course.category_title })}
                                        </div>
                                        <h4 className="font-semibold mb-4 line-clamp-2 text-sm group-hover:text-blue-600 transition-colors">
                                            {course.title}
                                        </h4>
                                        <div className="flex justify-between items-center mt-auto pt-4 border-t border-base-200">
                                            <Link to={`/courses/${course.id}`} className="text-xs font-bold text-blue-600 hover:underline">
                                                {isTeacher ? (t('profile.viewCourse') || 'Смотреть курс') : (t('profile.continueCourse') || 'Продолжить обучение')}
                                            </Link>
                                            {isTeacher && (
                                                <Link to={`/teacher/course/${course.id}/builder`} className="text-xs font-semibold px-2.5 py-1.5 border border-base-300 rounded text-base-content/70 hover:bg-base-200 transition-colors">
                                                    {t('profile.editorBtn') || 'Редактор'}
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 border border-dashed border-base-300 rounded-xl bg-base-50/50">
                                <p className="text-sm font-medium text-base-content/50 mb-4">{t('profile.noActiveCourses') || 'У вас пока нет активных курсов'}</p>
                                {!isTeacher && (
                                    <Link to="/courses" className="btn btn-sm btn-outline border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 shadow-sm">
                                        {t('profile.goToCatalogBtn') || 'Перейти в каталог'}
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ✅ СЕРТИФИКАТЫ */}
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-6 sm:p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-3">
                                    <span className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                                        <Award size={22} />
                                    </span>
                                    {t('profile.myAchievements') || 'Мои достижения'}
                                </h3>
                                <p className="text-sm text-base-content/50 mt-1">{t('profile.officialDocs') || 'Официальные документы'}</p>
                            </div>
                        </div>

                        {certificates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                {certificates.map(cert => (
                                    <div key={cert.id} className="relative group rounded-2xl bg-gradient-to-br from-base-300 to-base-200 p-[1px] hover:from-amber-400 hover:to-orange-500 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-amber-500/10">
                                        
                                        <div className="bg-base-100 rounded-[15px] p-5 h-full flex flex-col relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-extrabold text-base leading-tight pr-4 group-hover:text-amber-600 transition-colors">
                                                    {cert.course_title}
                                                </h4>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md shrink-0">
                                                    {t('profile.verifiedBadge') || 'Подтвержден'}
                                                </span>
                                            </div>

                                            <div className="w-full aspect-[1.414/1] bg-base-200/50 rounded-xl mb-4 overflow-hidden relative group/img border border-base-200">
                                                {cert.file ? (
                                                    <img src={getMediaUrl(cert.file)} alt="Certificate" className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover/img:scale-105" />
                                                ) : (
                                                    <div className="flex items-center justify-center w-full h-full text-base-content/10">
                                                        <Award size={64} />
                                                    </div>
                                                )}
                                                
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                                                    <a href={getMediaUrl(cert.file)} target="_blank" rel="noreferrer" download 
                                                       className="px-6 py-2.5 bg-white text-black hover:bg-amber-400 hover:text-black font-bold rounded-full text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg">
                                                        <Download size={16} /> {t('profile.downloadBtn') || 'Скачать'}
                                                    </a>
                                                    <Link to={`/verify/${cert.id}`} className="text-white/80 font-medium text-xs hover:text-white underline underline-offset-4 transition-colors">
                                                        {t('profile.verificationPage') || 'Страница верификации'}
                                                    </Link>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-auto pt-4 border-t border-base-200/60 flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mb-0.5">{t('profile.issueDate') || 'Выдан'}</p>
                                                    <p className="text-xs font-semibold text-base-content">{new Date(cert.issued_at).toLocaleDateString(getDateLocale())}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mb-0.5">{t('profile.docId') || 'ID документа'}</p>
                                                    <p className="text-[10px] font-mono text-base-content/70">{cert.id.split('-')[0].toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed border-base-200 rounded-2xl bg-base-50/50 relative z-10">
                                <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Award size={32} className="text-base-content/20" />
                                </div>
                                <h4 className="text-base font-bold text-base-content mb-1">{t('profile.noCertificates') || 'Нет сертификатов'}</h4>
                                <p className="text-sm font-medium text-base-content/50 max-w-sm mx-auto">
                                    {t('profile.certPrompt') || 'Пройдите курс до конца, чтобы получить свой первый сертификат.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Модалка создания курса */}
            {isModalOpen && isTeacher && (
                <div className="fixed inset-0 bg-base-300/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                     <div className="bg-base-100 rounded-2xl shadow-xl border border-base-200 w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4">{t('profile.newCourseModalTitle') || 'Новый курс'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">{t('profile.courseNameLabel') || 'Название курса'}</span></label>
                                <input type="text" className="input input-sm input-bordered w-full" value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-xs font-medium text-base-content/70">{t('profile.categoryLabel') || 'Категория'}</span></label>
                                <select className="select select-sm select-bordered w-full" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                                    {categories.map(cat => (
                                        // ✅ Динамический перевод категории в селекторе
                                        <option key={cat.id} value={cat.id}>{t(`categories.${cat.title}`, { defaultValue: cat.title })}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-sm btn-ghost" onClick={() => setIsModalOpen(false)}>{t('profile.cancelBtn') || 'Отмена'}</button>
                            <button className={`btn btn-sm bg-blue-600 text-white border-0 ${isCreating ? 'loading' : ''}`} onClick={handleCreateCourse} disabled={isCreating || !newCourseTitle}>
                                {t('profile.createBtn') || 'Создать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;