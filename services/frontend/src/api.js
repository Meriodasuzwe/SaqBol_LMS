import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8001/api/', // Адрес твоего Django
});

// Автоматически подставляем токен в каждый запрос, если он есть
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;