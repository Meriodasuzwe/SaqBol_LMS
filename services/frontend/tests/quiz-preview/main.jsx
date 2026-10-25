import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import QuizPage from '../../src/QuizPage.jsx';
import './preview.css';

function Preview() {
    return (
        <MemoryRouter initialEntries={['/quiz/lesson/9001?quiz_id=9002']}>
            <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
                <div className="preview-notice" role="note">
                    <strong>ИЗОЛИРОВАННЫЙ UI-PREVIEW · ИСКУССТВЕННЫЕ ДАННЫЕ</strong>
                    <span>10 синтетических вопросов. Отправка и результат имитируются только для проверки дизайна. Рабочие сервисы не подключены.</span>
                </div>
                <main className="container mx-auto p-4 lg:p-8 flex-grow">
                    <Routes>
                        <Route path="/quiz/lesson/:lessonId" element={<QuizPage />} />
                        <Route path="*" element={
                            <div className="preview-return">
                                <p>Возврат из теста: изолированная заглушка урока.</p>
                                <Link to="/quiz/lesson/9001?quiz_id=9002">Вернуться к синтетическому тесту</Link>
                            </div>
                        } />
                    </Routes>
                </main>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </MemoryRouter>
    );
}

createRoot(document.getElementById('root')).render(<Preview />);
