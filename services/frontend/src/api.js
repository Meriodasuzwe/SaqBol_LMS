import axios from 'axios';

import { setupAxiosInterceptors } from './utils/axiosErrorHandler'; 
import { setupAuthInterceptors } from './utils/authInterceptors';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/',
});

setupAuthInterceptors(api, {
    refreshClient: axios.create({ baseURL: api.defaults.baseURL }),
    storage: localStorage,
    onSessionExpired: () => window.dispatchEvent(new Event('auth:expired')),
});

// 👇 Включаем автоматическую обработку ошибок (ответ от сервера)
setupAxiosInterceptors(api);

export default api;
