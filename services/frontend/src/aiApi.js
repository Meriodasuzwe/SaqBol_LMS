import axios from 'axios';

import { setupAxiosInterceptors } from './utils/axiosErrorHandler';

const aiApi = axios.create({
    baseURL: '/ai/', 
});

aiApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('access'); 
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});


setupAxiosInterceptors(aiApi);

export default aiApi;