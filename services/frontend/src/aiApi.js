import axios from 'axios';

// Этот инстанс смотрит специально на шлюз AI
const aiApi = axios.create({
    baseURL: '/ai/', // Nginx перенаправит это в FastAPI
});

// Добавляем перехватчик (Interceptor), который автоматически вставляет токен
aiApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('access'); // Берем токен, полученный от Django
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; // Прикрепляем к запросу
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default aiApi;