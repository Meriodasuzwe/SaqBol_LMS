import axios from 'axios';

// Мы используем относительный путь. 
// Браузер сам подставит домен, на котором открыт сайт (localhost:80).
// Nginx перехватит запрос на /api/ и отправит его в Django.
const api = axios.create({
    baseURL: '/api/', 
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access');
    // console.log("Интерцептор видит токен:", token); // Можно раскомментировать для отладки
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }
    return config;
});

export default api;