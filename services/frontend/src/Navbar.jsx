import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from './api';
import { toast } from 'react-toastify';

function Navbar({ isLoggedIn, userRole, onLogout }) {
    const isTeacher = userRole === 'teacher' || userRole === 'admin';
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const [user, setUser] = useState(null);

    // Стейты для анкеты препода
    const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
    const [cvText, setCvText] = useState("");
    const [portfolioUrl, setPortfolioUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        if (isLoggedIn) {
            api.get('users/me/')
                .then(res => setUser(res.data))
                .catch(err => console.error("Ошибка загрузки данных в Navbar", err));
        } else {
            setUser(null);
        }
    }, [isLoggedIn]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    const getAvatarUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const baseUrl = 'http://localhost:8000'; 
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    // Отправка заявки на сервер
    const submitAuthorApplication = async () => {
        if (!cvText) {
            toast.warning("Пожалуйста, расскажите немного о своем опыте.");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await api.post('users/apply-teacher/', {
                cv_text: cvText,
                portfolio_url: portfolioUrl
            });
            toast.success("🎓 " + res.data.message);
            setIsAuthorModalOpen(false); // Закрываем модалку при успехе
            setCvText(""); // Очищаем форму
            setPortfolioUrl("");
        } catch (err) {
            if (err.response?.data?.error) {
                toast.error("⚠️ " + err.response.data.error);
            } else {
                toast.error("Произошла ошибка при отправке заявки.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-40 shadow-sm px-4 lg:px-8">
                <div className="navbar-start">
                    <div className="dropdown">
                        <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
                        </div>
                        <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg border border-base-200 bg-base-100 rounded-lg w-52">
                            {isLoggedIn ? (
                                <>
                                    <li><Link to="/courses" className="font-medium">Каталог курсов</Link></li>
                                    <li><Link to="/profile" className="font-medium">Личный кабинет</Link></li>
                                    {isTeacher && <li><Link to="/teacher" className="font-medium">Панель управления</Link></li>}
                                </>
                            ) : (
                                <>
                                    <li><Link to="/login" className="font-medium">Войти</Link></li>
                                    <li><Link to="/register" className="font-medium">Регистрация</Link></li>
                                </>
                            )}
                        </ul>
                    </div>
                    <Link to="/" className="text-xl font-bold tracking-tight text-base-content hover:opacity-80 transition-opacity flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary text-white flex items-center justify-center rounded-md font-black text-sm">SQ</div>
                        SaqBol <span className="font-normal text-base-content/60">LMS</span>
                    </Link>
                </div>

                <div className="navbar-center hidden lg:flex">
                    {isLoggedIn && (
                        <ul className="flex items-center gap-8 font-medium text-sm text-base-content/80">
                            <li><Link to="/courses" className="hover:text-primary transition-colors">Каталог курсов</Link></li>
                            {isTeacher && (
                                 <li>
                                    <Link to="/teacher" className="hover:text-primary transition-colors">
                                         Панель управления
                                    </Link>
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                <div className="navbar-end gap-3">
                    <label className="swap swap-rotate btn btn-ghost btn-circle btn-sm text-base-content/70">
                        <input type="checkbox" onChange={toggleTheme} checked={theme === "dark"} />
                        <svg className="swap-on fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
                        <svg className="swap-off fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
                    </label>

                    {isLoggedIn ? (
                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="avatar transition-opacity hover:opacity-80">
                                <div className="w-9 h-9 rounded-full border border-base-300 bg-base-200 flex items-center justify-center overflow-hidden">
                                    {user?.avatar ? (
                                        <img alt="User" src={getAvatarUrl(user.avatar)} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-bold uppercase text-base-content/60">
                                            {user?.username?.[0] || 'U'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ul tabIndex={0} className="mt-4 z-[1] p-2 shadow-xl border border-base-200 menu menu-sm dropdown-content bg-base-100 rounded-xl w-64">
                                <div className="px-4 py-3 mb-1">
                                    <p className="text-sm font-semibold text-base-content truncate">{user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}</p>
                                    <p className="text-xs text-base-content/50 truncate mt-0.5">{user?.email}</p>
                                </div>
                                <div className="divider my-0 opacity-50"></div>
                                
                                <li className="mt-1">
                                    <Link to="/profile" className="py-2.5 px-4 font-medium rounded-lg text-base-content/80 hover:text-base-content hover:bg-base-200/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        Личный кабинет
                                    </Link>
                                </li>
                                
                                {!isTeacher && (
                                    <li>
                                        <button onClick={() => setIsAuthorModalOpen(true)} className="py-2.5 px-4 font-medium rounded-lg text-primary hover:bg-primary/5 mt-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                            Стать автором
                                        </button>
                                    </li>
                                )}
                                
                                <div className="divider my-1 opacity-50"></div>
                                <li className="mb-1">
                                    <button onClick={onLogout} className="py-2.5 px-4 font-medium text-error hover:bg-error/10 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        Выйти
                                    </button>
                                </li>
                            </ul>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <Link to="/login" className="btn btn-ghost btn-sm font-medium">Войти</Link>
                            <Link to="/register" className="btn btn-primary btn-sm font-medium px-5">Регистрация</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* --- МОДАЛКА "СТАТЬ АВТОРОМ" --- */}
            {isAuthorModalOpen && (
                <div className="fixed inset-0 bg-base-300/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
                    <div className="bg-base-100 rounded-2xl shadow-2xl border border-base-200 w-full max-w-lg p-8 animate-fade-in">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-bold text-2xl text-base-content">Заявка на авторство</h3>
                                <p className="text-sm text-base-content/60 mt-1">Поделитесь своими знаниями со студентами SaqBol LMS.</p>
                            </div>
                            <button onClick={() => setIsAuthorModalOpen(false)} className="btn btn-ghost btn-sm btn-circle text-base-content/50 hover:text-base-content hover:bg-base-200">
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-sm font-semibold text-base-content/80">О себе и вашем опыте <span className="text-error">*</span></span></label>
                                <textarea 
                                    className="textarea textarea-bordered w-full h-28 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm bg-base-50" 
                                    placeholder="Расскажите о вашем опыте. Какие курсы вы планируете создать?"
                                    value={cvText}
                                    onChange={(e) => setCvText(e.target.value)}
                                ></textarea>
                            </div>
                            <div>
                                <label className="label py-0 pb-1.5"><span className="text-sm font-semibold text-base-content/80">Ссылка на профиль / портфолио</span></label>
                                <input 
                                    type="url" 
                                    className="input input-sm input-bordered w-full focus:border-primary focus:ring-1 focus:ring-primary shadow-sm bg-base-50 h-10" 
                                    placeholder="https://linkedin.com/in/ваше-имя (необязательно)"
                                    value={portfolioUrl}
                                    onChange={(e) => setPortfolioUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-base-200">
                            <button className="btn btn-ghost" onClick={() => setIsAuthorModalOpen(false)}>Отмена</button>
                            <button className={`btn btn-primary px-6 shadow-md ${isSubmitting ? 'loading' : ''}`} onClick={submitAuthorApplication} disabled={isSubmitting || !cvText}>
                                Отправить заявку
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navbar;