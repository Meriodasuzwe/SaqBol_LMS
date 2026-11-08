import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../src/i18n';
import ExamPage from '../../src/exams/ExamPage.jsx';
import Navbar from '../../src/Navbar.jsx';
import api from '../../src/api';
import './preview.css';

function DevPanel() {
    const location = useLocation();
    const attemptId = location.pathname.match(/^\/exams\/attempts\/([^/]+)/)?.[1];
    const [message, setMessage] = useState('');
    const [stored, setStored] = useState(null);
    async function control(command) {
        try {
            const response = await fetch('/__exam_preview__/control', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, attempt_id: attemptId }),
            });
            if (!response.ok) throw new Error();
            setMessage(command === 'deadline_in_five_seconds'
                ? 'Тестовый дедлайн установлен. Обновите страницу: сервер завершит попытку по сохранённым ответам через 5 секунд.'
                : 'Следующий указанный запрос проверит выбранный сбой транспорта.');
        } catch { setMessage('Команда стенда не выполнена. Для дедлайна нужна активная попытка.'); }
    }
    async function readState() {
        try {
            const response = await fetch('/__exam_preview__/state', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (!data.isolated) throw new Error();
            setStored(data);
        } catch { setMessage('Не удалось прочитать временную БД.'); }
    }
    return <details className="exam-preview-dev">
        <summary>Инструменты разработки · изолированный стенд</summary>
        <p>Настоящие API и оценивание работают в одноразовой SQLite. Данные исчезнут при остановке процесса. Это служебная панель, она не входит в приложение.</p>
        <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={readState}>Прочитать сохранённое состояние</button>
            <button type="button" className="btn btn-sm" onClick={() => control('fail_next_save')}>Ошибка следующего сохранения</button>
            <button type="button" className="btn btn-sm" onClick={() => control('fail_next_finish')}>Ошибка следующей сдачи</button>
            <button type="button" className="btn btn-sm" onClick={() => control('lose_next_finish_response')}>Потерять ответ после сдачи</button>
            <button type="button" className="btn btn-sm" disabled={!attemptId} onClick={() => control('deadline_in_five_seconds')}>Тестовый дедлайн через 5 секунд</button>
        </div>
        <p role="status">{message}</p>
        {stored && <pre>{JSON.stringify(stored, null, 2)}</pre>}
    </details>;
}

function Preview() {
    const [authenticated, setAuthenticated] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let live = true;
        async function login() {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            const response = await fetch('/__exam_preview__/bootstrap', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const fixture = await response.json();
            if (!fixture.isolated || fixture.quiz_id !== 904) throw new Error();
            const { data } = await api.post(fixture.login.path.replace(/^\//, ''), {
                username: fixture.login.username, password: fixture.login.password,
            });
            localStorage.setItem('access', data.access);
            localStorage.setItem('refresh', data.refresh);
            if (live) setAuthenticated(true);
        }
        login().catch(() => { if (live) setError('Не удалось войти в изолированный стенд. Проверьте процесс превью.'); });
        return () => { live = false; };
    }, []);
    return <div className="min-h-screen bg-base-100 text-base-content">
        <aside className="exam-preview-notice" role="note">
            <strong>Изолированное превью SAQBol · искусственные данные.</strong>{' '}
            Демонстрация двух профильных предметов. Не официальный банк и не полный научно-педагогический пробник.
        </aside>
        {error && <p className="m-4 text-error" role="alert">{error}</p>}
        {!authenticated && !error && <p className="m-4" role="status">Вход в демонстрацию…</p>}
        {authenticated && <BrowserRouter>
            <Navbar isLoggedIn userRole="student" onLogout={() => window.location.assign('/exams')} />
            <main className="exam-app-main flex-grow min-w-0"><Routes>
                <Route path="/" element={<Navigate to="/exams" replace />} />
                <Route path="/exams" element={<ExamPage />} />
                <Route path="/exams/attempts/:attemptId" element={<ExamPage />} />
                <Route path="/exams/attempts/:attemptId/result" element={<ExamPage />} />
                <Route path="/exams/attempts/:attemptId/review" element={<ExamPage />} />
                <Route path="*" element={<div className="exam-preview-fallback">
                    <h1 className="text-2xl font-semibold">Эта страница не входит в изолированный стенд</h1>
                    <p className="my-4">Превью проверяет только пробное тестирование. Остальные страницы приложения здесь не подменяются данными.</p>
                    <Link className="link link-primary" to="/exams">Вернуться к пробному тестированию</Link>
                </div>} />
            </Routes></main>
            <DevPanel />
        </BrowserRouter>}
        <ToastContainer position="bottom-right" autoClose={4000} />
    </div>;
}

createRoot(document.getElementById('root')).render(<Preview />);
