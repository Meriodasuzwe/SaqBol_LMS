import { useEffect, useState } from 'react';
import api from './api';

function Profile() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        api.get('users/me/')
            .then(response => setUser(response.data))
            .catch(err => console.error("Ошибка загрузки профиля", err));
    }, []);

    if (!user) return <div className="text-center mt-10"><span className="loading loading-dots loading-lg"></span></div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-base-100 rounded-box shadow-xl overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-primary to-secondary"></div>
                <div className="px-8 pb-8">
                    <div className="relative -mt-12 mb-4">
                        <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-24 ring ring-primary ring-offset-base-100 ring-offset-2">
                                <span className="text-3xl uppercase">{user.username[0]}</span>
                            </div>
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-bold">{user.username}</h1>
                    <p className="text-gray-500">{user.email || 'Email не указан'}</p>

                    <div className="divider">Статистика обучения</div>

                    <div className="stats shadow w-full border border-base-200">
                        <div className="stat">
                            <div className="stat-title">Курсов пройдено</div>
                            <div className="stat-value text-primary">0</div>
                            <div className="stat-desc">За все время</div>
                        </div>
                        
                        <div className="stat">
                            <div className="stat-title">Активность</div>
                            <div className="stat-value text-secondary">High</div>
                            <div className="stat-desc">Последние 7 дней</div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-2">
                        <button className="btn btn-outline btn-sm">Редактировать профиль</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;