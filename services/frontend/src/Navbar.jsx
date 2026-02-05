import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Navbar({ isLoggedIn, userRole, onLogout }) {
    // Проверка, является ли юзер учителем (для отображения кнопки AI)
    const isTeacher = userRole === 'teacher' || userRole === 'admin';

    // --- ЛОГИКА ТЕМЫ (СОХРАНЯЕТСЯ В ПАМЯТИ) ---
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

    useEffect(() => {
        // Устанавливаем атрибут на тег <html>
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return (
        <div className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-50 backdrop-blur-md bg-opacity-90 shadow-sm">
            {/* === ЛЕВАЯ ЧАСТЬ: ЛОГОТИП === */}
            <div className="navbar-start">
                <div className="dropdown">
                    {/* Мобильное меню (гамбургер) */}
                    <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
                    </div>
                    <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                        {isLoggedIn ? (
                            <>
                                <li><Link to="/courses">Курсы</Link></li>
                                <li><Link to="/profile">Профиль</Link></li>
                                {isTeacher && <li><Link to="/teacher">Учительская</Link></li>}
                            </>
                        ) : (
                            <>
                                <li><Link to="/login">Войти</Link></li>
                                <li><Link to="/register">Регистрация</Link></li>
                            </>
                        )}
                    </ul>
                </div>
                <Link to="/" className="btn btn-ghost text-xl font-bold text-primary tracking-tighter hover:bg-transparent">
                    SaqBol <span className="text-secondary font-black">LMS</span>
                </Link>
            </div>

            {/* === ЦЕНТР: МЕНЮ (Только на десктопе) === */}
            <div className="navbar-center hidden lg:flex">
                {isLoggedIn && (
                    <ul className="menu menu-horizontal px-1 gap-2 font-medium">
                        <li><Link to="/courses" className="hover:text-primary transition-colors">Все курсы</Link></li>
                        {/* Можно добавить ссылку на "Мои курсы", если есть такая страница */}
                        {isTeacher && (
                             <li>
                                <Link to="/teacher" className="text-secondary hover:bg-secondary/10">
                                    👨‍🏫 AI Лаборатория
                                </Link>
                            </li>
                        )}
                    </ul>
                )}
            </div>

            {/* === ПРАВАЯ ЧАСТЬ: ТЕМА И ПРОФИЛЬ === */}
            <div className="navbar-end gap-2">
                
                {/* Переключатель темы (Sun/Moon) */}
                <label className="swap swap-rotate btn btn-ghost btn-circle btn-sm">
                    <input type="checkbox" onChange={toggleTheme} checked={theme === "dark"} />
                    {/* sun icon */}
                    <svg className="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
                    {/* moon icon */}
                    <svg className="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>
                </label>

                {isLoggedIn ? (
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                            <div className="w-10 rounded-full border border-base-300">
                                {/* Аватар-заглушка */}
                                <img alt="User" src="https://ui-avatars.com/api/?name=User&background=random" />
                            </div>
                        </div>
                        <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 border border-base-200">
                            <li><Link to="/profile" className="justify-between">Профиль</Link></li>
                            <li><button onClick={onLogout} className="text-error font-bold">Выйти</button></li>
                        </ul>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Link to="/login" className="btn btn-ghost btn-sm">Войти</Link>
                        <Link to="/register" className="btn btn-primary btn-sm">Регистрация</Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Navbar;