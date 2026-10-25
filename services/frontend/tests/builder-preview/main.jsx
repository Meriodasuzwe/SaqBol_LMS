import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, Link, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'katex/dist/katex.min.css';
import i18n from '../../src/i18n';
import CourseBuilder from '../../src/CourseBuilder/CourseBuilder.jsx';
import './preview.css';

function Destination() {
    const location = useLocation();
    return <section className="p-8 space-y-3">
        <h1 className="text-xl font-bold">Изолированная заглушка перехода</h1>
        <p>Путь: <code>{location.pathname}</code>. Настоящая страница курса здесь не подключена.</p>
        <Link className="link text-blue-600" to="/teacher/course/901/builder">Вернуться в конструктор</Link>
    </section>;
}

function Preview() {
    const toolbar = useRef(null);
    const [revision, setRevision] = useState(0);
    const [language, setLanguage] = useState('ru');
    const [theme, setTheme] = useState('light');
    const [error, setError] = useState('');
    useEffect(() => { i18n.changeLanguage(language); document.documentElement.lang = language; }, [language]);
    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            document.documentElement.style.setProperty('--navbar-height', `${entry.target.getBoundingClientRect().height}px`);
        });
        observer.observe(toolbar.current);
        return () => { observer.disconnect(); document.documentElement.style.removeProperty('--navbar-height'); };
    }, []);
    async function reset() {
        setError('');
        try {
            const response = await fetch('/__builder_preview__/reset', { method: 'POST', credentials: 'omit' });
            if (!response.ok) throw new Error('Не удалось сбросить искусственные данные.');
            setRevision(value => value + 1);
        } catch (failure) { setError(failure.message); }
    }
    return <I18nextProvider i18n={i18n}>
        <aside ref={toolbar} className="builder-preview-toolbar" aria-label="Настройки изолированного превью">
            <div>
                <strong>КОНСТРУКТОР · ИСКУССТВЕННЫЕ ДАННЫЕ</strong>
                <p>Настоящий CourseBuilder. Сохранение только в памяти этого локального превью; рабочая БД и API отключены.</p>
            </div>
            <div className="builder-preview-controls">
                <label>Язык <select value={language} onChange={event => setLanguage(event.target.value)}>
                    <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
                </select></label>
                <label>Тема <select value={theme} onChange={event => setTheme(event.target.value)}>
                    <option value="light">Light</option><option value="dark">Dark</option>
                </select></label>
                <button type="button" onClick={() => setRevision(value => value + 1)}>Повторно открыть</button>
                <button type="button" onClick={reset}>Сбросить фикстуру</button>
                <a href="/__builder_preview__/state" target="_blank" rel="noreferrer">Данные и запросы</a>
            </div>
            {error && <p role="alert">{error}</p>}
        </aside>
        <MemoryRouter key={revision} initialEntries={['/teacher/course/901/builder']}>
            <Routes>
                <Route path="/teacher/course/:courseId/builder" element={<CourseBuilder />} />
                <Route path="*" element={<Destination />} />
            </Routes>
        </MemoryRouter>
        <ToastContainer position="bottom-right" autoClose={4000} theme={theme} />
    </I18nextProvider>;
}

createRoot(document.getElementById('root')).render(<Preview />);
