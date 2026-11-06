import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../src/i18n';
import QuizPage from '../../src/QuizPage.jsx';
import api from '../../src/api';
import '../quiz-preview/preview.css';

function Preview() {
    const [authenticated, setAuthenticated] = useState(false);
    const [error, setError] = useState('');
    const [stored, setStored] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        async function login() {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            const response = await fetch('/__analytics_preview__/bootstrap', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const fixture = await response.json();
            if (!fixture.isolated || fixture.quiz_id !== 904) throw new Error();
            const { data } = await api.post(fixture.login.path.replace(/^\//, ''), {
                username: fixture.login.username, password: fixture.login.password,
            });
            localStorage.setItem('access', data.access);
            localStorage.setItem('refresh', data.refresh);
            setAuthenticated(true);
        }
        login().catch(() => setError('Не удалось запустить тестовый вход. Проверьте процесс превью.'));
    }, []);
    async function readStored() {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/__analytics_preview__/state', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (!data.isolated) throw new Error();
            setStored(data);
        } catch { setError('Не удалось прочитать временную БД.'); }
        finally { setLoading(false); }
    }
    return <div className="min-h-screen bg-base-100 text-base-content">
        <aside className="preview-notice" role="note">
            <strong>SAQBol · проверка интеграции · искусственные данные</strong>
            <span>Настоящий QuizPage → API → Django → временная SQLite. 30 + 20 вопросов только для разработки; это не официальный учебный материал и не полный КТ.</span>
            <span>Выберите ответы, перейдите к вопросу 50 и завершите. Пропуски разрешены. Ниже можно прочитать фактически сохранённые баллы и ответы.</span>
        </aside>
        {error && <p role="alert" className="m-4 text-error">{error}</p>}
        {!authenticated && !error && <p role="status" className="m-4">Вход в изолированный backend…</p>}
        {authenticated && <MemoryRouter initialEntries={['/quiz/lesson/902?quiz_id=904']}>
            <main className="container mx-auto p-4 lg:p-8"><Routes>
                <Route path="/quiz/lesson/:lessonId" element={<QuizPage />} />
                <Route path="*" element={<div className="preview-return"><p>Урок не входит в этот тестовый стенд.</p><Link to="/quiz/lesson/902?quiz_id=904">Вернуться к пробнику</Link></div>} />
            </Routes></main>
        </MemoryRouter>}
        <section className="mx-auto max-w-6xl border-t border-base-300 p-4 sm:p-6" aria-labelledby="stored-title">
            <h2 id="stored-title" className="text-xl font-semibold">Проверка сохранения во временной БД</h2>
            <p className="my-2 text-sm">Служебный просмотр стенда, не новая страница истории. После остановки процесса эти искусственные данные исчезнут.</p>
            <button type="button" className="btn btn-primary my-3 focus-visible:outline-2 focus-visible:outline-offset-4" disabled={!authenticated || loading} onClick={readStored}>
                {loading ? 'Читаем…' : 'Прочитать сохранённый результат'}
            </button>
            {stored && <div aria-live="polite">
                <p>Результатов: {stored.counts.results}. Попыток: {stored.counts.attempts}. Ответов: {stored.counts.answers}.</p>
                {stored.results.map(result => <article key={result.id} className="my-4 border-t border-base-300 pt-4">
                    <h3 className="font-semibold">Сохранено: {result.scoring_details.earned_points} из {result.scoring_details.max_points} баллов</h3>
                    <p className="my-2 text-sm break-all">Версия правил: {result.scoring_details.scoring_version}</p>
                    <details><summary className="cursor-pointer py-2 focus-visible:outline-2">Сохранённые ответы и баллы по вопросам</summary>
                        <ul className="space-y-3 py-3">{stored.attempts.find(attempt => attempt.result_id === result.id)?.answers.map(answer => <li key={answer.id}>
                            <p>Вопрос {answer.position + 1}: {answer.earned_points} из {answer.max_points}</p>
                            <p className="text-sm break-words">{answer.question_text}</p>
                            <p className="text-sm">Выбранные варианты: {answer.selected_choice_ids.join(', ') || 'пропущено'}</p>
                        </li>)}</ul>
                    </details>
                </article>)}
                {stored.counts.results === 0 && <p className="my-2">Пока нет сохранённых сдач.</p>}
            </div>}
        </section>
        <ToastContainer position="bottom-right" autoClose={4000} />
    </div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
