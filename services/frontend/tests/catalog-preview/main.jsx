import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../src/i18n';
import CourseList from '../../src/CourseList.jsx';
import { setPreviewScene } from './apiStub';
import './preview.css';

i18n.changeLanguage('ru');

function DestinationStub() {
    const location = useLocation();
    return <section className="catalog-preview-destination">
        <h1>Изолированная заглушка перехода</h1>
        <p>Открыт путь: <code>{location.pathname}{location.search}</code></p>
        <p>Настоящие карточка курса, регистрация и рабочие API здесь не подключены.</p>
        <Link to="/courses">Вернуться в синтетический каталог</Link>
    </section>;
}

function Preview() {
    const [language, setLanguage] = useState('ru');
    const [theme, setTheme] = useState('light');
    const [scene, setScene] = useState('baseline');
    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
    useEffect(() => { document.documentElement.lang = language; i18n.changeLanguage(language); }, [language]);
    function changeScene(value) { setPreviewScene(value); setScene(value); }

    return <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/courses']}>
            <div className="min-h-screen bg-base-100 text-base-content flex flex-col" data-catalog-preview>
                <aside className="catalog-preview-controls" aria-label="Isolated preview controls">
                    <div><strong>ИЗОЛИРОВАННЫЙ КАТАЛОГ · ИСКУССТВЕННЫЕ ДАННЫЕ</strong>
                        <p>Только дизайн. Курсы, цены, рейтинг и обложки — синтетические. Onboarding скрыт только в preview.</p>
                    </div>
                    <div className="catalog-preview-selects">
                        <label>Язык <select value={language} onChange={event => setLanguage(event.target.value)}>
                            <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
                        </select></label>
                        <label>Тема <select value={theme} onChange={event => setTheme(event.target.value)}>
                            <option value="light">Light</option><option value="dark">Dark</option>
                        </select></label>
                        <label>Фикстура <select value={scene} onChange={event => changeScene(event.target.value)}>
                            <option value="baseline">Baseline: все состояния</option><option value="guest">Без записей на курсы</option>
                            <option value="empty">Пустой каталог</option><option value="slow">Медленный ответ</option><option value="error">Ошибка API</option>
                        </select></label>
                    </div>
                </aside>
                <main className="container mx-auto p-4 lg:p-8 flex-grow">
                    <Routes>
                        <Route path="/courses" element={<CourseList key={scene} />} />
                        <Route path="/courses/:id" element={<DestinationStub />} />
                        <Route path="*" element={<DestinationStub />} />
                    </Routes>
                </main>
            </div>
        </MemoryRouter>
    </I18nextProvider>;
}

createRoot(document.getElementById('root')).render(<Preview />);
