import axios from 'axios';

import { setupAxiosInterceptors } from './utils/axiosErrorHandler'; 

const api = axios.create({
    baseURL: '/api/', 
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }
    return config;
});

// 👇 Включаем автоматическую обработку ошибок (ответ от сервера)
setupAxiosInterceptors(api);

export default api;