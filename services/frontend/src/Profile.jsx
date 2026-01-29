import { useEffect, useState } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

function Profile() {
    const [user, setUser] = useState(null);
    const [results, setResults] = useState([]); 
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Загружаем профиль И результаты тестов параллельно
        const fetchData = async () => {
            try {
                const userRes = await api.get('users/me/');
                const resultsRes = await api.get('quizzes/my-results/'); 
                
                setUser(userRes.data);
                setResults(resultsRes.data);
            } catch (err) {
                console.error("Ошибка загрузки данных", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="text-center mt-20"><span className="loading loading-dots loading-lg text-primary"></span></div>;

    // Вычисляем статистику
    const totalTests = results.length;
    const averageScore = totalTests > 0 
        ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / totalTests) 
        : 0;

    // Определяем цвет среднего балла
    const getScoreColor = (score) => {
        if (score >= 80) return 'text-success';
        if (score >= 50) return 'text-warning';
        return 'text-error';
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Карточка профиля */}
            <div className="bg-base-100 rounded-2xl shadow-xl overflow-hidden mb-8 border border-base-200">
                <div className="h-32 bg-gradient-to-r from-primary to-accent relative">
                     {/* Декор */}
                     <div className="absolute top-0 right-0 p-4 opacity-20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10v6"/><path d="M20 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M15 14a5 5 0 0 0-10 0"/></svg>
                     </div>
                </div>
                
                <div className="px-8 pb-8">
                    <div className="relative -mt-12 mb-6 flex justify-between items-end">
                        <div className="avatar placeholder ring ring-base-100 ring-offset-2 rounded-full">
                            <div className="bg-neutral text-neutral-content rounded-full w-24">
                                <span className="text-3xl uppercase font-bold">{user?.username?.[0]}</span>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-ghost" onClick={() => navigate('/login')}>Выйти</button>
                    </div>
                    
                    <h1 className="text-3xl font-bold">{user?.username}</h1>
                    <p className="text-base-content/60 mb-6">{user?.email || 'Email не указан'}</p>

                    <div className="stats shadow w-full bg-base-200/50 border border-base-200">
                        <div className="stat">
                            <div className="stat-figure text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                            </div>
                            <div className="stat-title">Тестов сдано</div>
                            <div className="stat-value">{totalTests}</div>
                            <div className="stat-desc">Всего попыток</div>
                        </div>
                        
                        <div className="stat">
                            <div className="stat-figure text-secondary">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </div>
                            <div className="stat-title">Средний балл</div>
                            <div className={`stat-value ${getScoreColor(averageScore)}`}>{averageScore}%</div>
                            <div className="stat-desc">Успеваемость</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* История результатов */}
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                История обучения
            </h2>
            
            {results.length === 0 ? (
                <div className="alert">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>Вы пока не прошли ни одного теста. Самое время начать!</span>
                    <div>
                        <button className="btn btn-sm btn-primary" onClick={() => navigate('/courses')}>К курсам</button>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-sm border border-base-200">
                    <table className="table table-zebra w-full">
                        {/* head */}
                        <thead className="bg-base-200">
                            <tr>
                                <th>Курс</th>
                                <th>Урок</th>
                                <th>Дата</th>
                                <th className="text-right">Результат</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((result) => (
                                <tr key={result.id} className="hover">
                                    <td className="font-bold text-xs sm:text-sm text-base-content/70">
                                        {result.course_title || 'Курс'}
                                    </td>
                                    <td className="font-medium">
                                        {result.lesson_title || 'Тест'}
                                    </td>
                                    <td className="text-sm opacity-70">
                                        {new Date(result.completed_at).toLocaleDateString()}
                                    </td>
                                    <td className="text-right">
                                        <div className={`badge badge-lg ${result.score >= 80 ? 'badge-success' : result.score >= 50 ? 'badge-warning' : 'badge-error'} gap-2 text-white`}>
                                            {result.score}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default Profile;