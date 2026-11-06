import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QuizPage from '../../src/QuizPage.jsx';
import api from '../../src/api';
import '../quiz-preview/preview.css';

function Preview() {
    const [authenticated, setAuthenticated] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [state, setState] = useState(null);
    const [stateError, setStateError] = useState('');
    const [loading, setLoading] = useState(false);
    const readState = async () => {
        setLoading(true);
        setStateError('');
        try {
            const response = await fetch('/__analytics_preview__/state', { cache: 'no-store' });
            if (!response.ok) throw new Error('State unavailable');
            const data = await response.json();
            if (!data.isolated) throw new Error('Expected isolated database');
            setState(data);
        } catch {
            setStateError('Не удалось прочитать тестовую БД. Проверьте, что стенд запущен.');
        } finally { setLoading(false); }
    };

    useEffect(() => {
        async function login() {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            localStorage.removeItem('quiz_attempts_904'); // Only this synthetic origin and fixture.
            const response = await fetch('/__analytics_preview__/bootstrap', { cache: 'no-store' });
            if (!response.ok) throw new Error('Bootstrap unavailable');
            const fixture = await response.json();
            if (!fixture.isolated || fixture.quiz_id !== 904) throw new Error('Expected synthetic fixture');
            const { data } = await api.post(fixture.login.path.replace(/^\//, ''), {
                username: fixture.login.username, password: fixture.login.password,
            });
            localStorage.setItem('access', data.access);
            localStorage.setItem('refresh', data.refresh);
            setAuthenticated(true);
        }
        login().catch(() => setLoginError('Не удалось выполнить тестовый вход через настоящий backend.'));
    }, []);

    return <div className="min-h-screen bg-base-100 text-base-content">
        <aside className="preview-notice" role="note">
            <strong>РУЧНАЯ ПРОВЕРКА · НАСТОЯЩИЙ BACKEND · ИСКУССТВЕННЫЕ ДАННЫЕ</strong>
            <span>QuizPage → API → временная SQLite. Рабочая БД и внешние сервисы не подключены.</span>
            <span>Ответьте на три вопроса; во втором выберите несколько вариантов. Завершите тест, затем нажмите «Прочитать сохранённые ответы» ниже.</span>
            <span>Ограничения настоящего QuizPage сохранены, включая предупреждения при переключении вкладок. Проверяйте запись после сдачи на этой же странице.</span>
        </aside>
        {loginError && <p role="alert" className="m-6 text-red-700">{loginError}</p>}
        {!authenticated && !loginError && <p role="status" className="m-6">Вход в изолированный backend…</p>}
        {authenticated && <MemoryRouter initialEntries={['/quiz/lesson/902?quiz_id=904']}>
            <main className="container mx-auto p-4 lg:p-8">
                <Routes>
                    <Route path="/quiz/lesson/:lessonId" element={<QuizPage />} />
                    <Route path="*" element={<div className="preview-return">
                        <p>Урок не входит в этот стенд.</p>
                        <Link to="/quiz/lesson/902?quiz_id=904">Вернуться к тесту</Link>
                    </div>} />
                </Routes>
            </main>
        </MemoryRouter>}
        <section className="mx-auto max-w-6xl border-t border-base-300 p-4 sm:p-6" aria-labelledby="stored-title">
            <h2 id="stored-title" className="text-xl font-semibold">Диагностика тестовой БД</h2>
            <p className="my-2 text-sm">Это служебный просмотр сохранённых записей, не готовая история попыток приложения. Данные исчезнут после остановки стенда.</p>
            <button type="button" disabled={!authenticated || loading} onClick={readState}
                className="btn btn-primary my-3 focus-visible:outline-2 focus-visible:outline-offset-4">
                {loading ? 'Читаем…' : 'Прочитать сохранённые ответы'}
            </button>
            {stateError && <p role="alert" className="text-red-700">{stateError}</p>}
            {state && <div aria-live="polite">
                <p className="mb-2 text-sm">Оценки сервера: {state.results.map(result => result.score + '%').join(', ') || 'пока нет'}.</p><p className="mb-3 text-sm">Результатов: {state.counts.results}. Записей аналитики: {state.counts.attempts}. Ответов: {state.counts.answers}.</p>
                {state.attempts.length === 0 && <p>Сохранённых ответов пока нет. После сдачи теста нажмите кнопку ещё раз.</p>}
                {state.attempts.map(attempt => <article key={attempt.id} className="my-5 border-t border-base-300 pt-4">
                    <h3 className="font-semibold">Тестовая запись №{attempt.id} · оценка в аналитике: {attempt.score}%</h3>
                    {attempt.answers.map(answer => <div key={answer.question_id} className="my-3">
                        <p>{answer.question_text}</p>
                        <p className="my-1 font-mono text-sm">Сохранённые ID: {JSON.stringify(answer.selected_choice_ids)}</p>
                        <ul className="list-disc pl-6">
                            {answer.selected_choices.map(choice => <li key={choice.id}>{choice.text}</li>)}
                        </ul>
                        {answer.selected_choice_ids.length === 0 && <p className="text-sm">Ничего не выбрано.</p>}
                    </div>)}
                </article>)}
            </div>}
        </section>
        <ToastContainer position="bottom-right" autoClose={4000} />
    </div>;
}

createRoot(document.getElementById('root')).render(<Preview />);
