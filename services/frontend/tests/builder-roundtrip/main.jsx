import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'katex/dist/katex.min.css';
import i18n from '../../src/i18n';
import api from '../../src/api';
import CourseBuilder from '../../src/CourseBuilder/CourseBuilder.jsx';
import '../builder-preview/preview.css';

function Roundtrip() {
    const toolbar = useRef(null);
    const [revision, setRevision] = useState(0);
    const [authenticated, setAuthenticated] = useState(false);
    const [error, setError] = useState('');
    const [faultStatus, setFaultStatus] = useState('');
    const failNextSave = async () => {
        try {
            const response = await fetch('/__builder_roundtrip__/fail-next-save', { method: 'POST' });
            if (!response.ok) throw new Error('Unavailable');
            setFaultStatus('Включён однократный искусственный сбой после записи шага. Ожидается откат БД; после сбоя можно повторить сохранение.');
        } catch { setFaultStatus('Не удалось включить искусственный сбой.'); }
    };
    useEffect(() => {
        i18n.changeLanguage('ru');
        const observer = new ResizeObserver(([entry]) => {
            document.documentElement.style.setProperty('--navbar-height', `${entry.target.getBoundingClientRect().height}px`);
        });
        observer.observe(toolbar.current);
        return () => { observer.disconnect(); document.documentElement.style.removeProperty('--navbar-height'); };
    }, []);
    useEffect(() => {
        async function login() {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            const response = await fetch('/__builder_roundtrip__/bootstrap');
            if (!response.ok) throw new Error('Изолированный backend недоступен.');
            const fixture = await response.json();
            if (!fixture.isolated) throw new Error('Нужна изолированная тестовая среда.');
            const { data } = await api.post(fixture.login.path.replace(/^\//, ''), {
                username: fixture.login.username, password: fixture.login.password,
            });
            localStorage.setItem('access', data.access);
            localStorage.setItem('refresh', data.refresh);
            setAuthenticated(true);
        }
        login().catch(() => setError('Не удалось войти искусственным автором через настоящий backend.'));
    }, []);
    return <I18nextProvider i18n={i18n}>
        <aside ref={toolbar} className="builder-preview-toolbar" aria-label="Сквозная проверка CNT-03">
            <strong>CNT-03 · НАСТОЯЩИЙ BACKEND · ИСКУССТВЕННЫЕ ДАННЫЕ</strong>
            <p>CourseBuilder → api.js / JWT → Django → временная SQLite. Контейнер без сети; рабочая БД отключена.</p>
            <div className="builder-preview-controls">
                <span>{authenticated ? 'Вход выполнен: тестовый преподаватель, без прав staff.' : 'Вход в изолированный backend…'}</span>
                <button disabled={!authenticated} onClick={() => setRevision(value => value + 1)}>Повторно открыть из БД</button>
                <button disabled={!authenticated} onClick={failNextSave}>Тест: сбой следующего сохранения</button>
                <a href="/__builder_roundtrip__/state" target="_blank" rel="noreferrer">Состояние тестовой БД</a>
            </div>
            {faultStatus && <p role="status">{faultStatus}</p>}
            {error && <p role="alert">{error}</p>}
        </aside>
        {authenticated && <MemoryRouter key={revision} initialEntries={['/teacher/course/901/builder']}>
            <Routes><Route path="/teacher/course/:courseId/builder" element={<CourseBuilder />} /><Route path="*" element={<p>Этот переход не входит в проверку CNT-03.</p>} /></Routes>
        </MemoryRouter>}
        <ToastContainer position="bottom-right" autoClose={4000} theme="light" />
    </I18nextProvider>;
}
createRoot(document.getElementById('root')).render(<Roundtrip />);
