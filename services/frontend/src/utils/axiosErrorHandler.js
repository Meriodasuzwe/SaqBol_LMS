import { toast } from 'react-toastify';

// Эта функция будет вызываться, когда сервер пришлет ошибку
export const setupAxiosInterceptors = (axiosInstance) => {
    
    axiosInstance.interceptors.response.use(
        (response) => {
            // Если ответ успешный (200-299), просто пропускаем его дальше
            return response;
        },
        (error) => {
            // Если ошибка...
            
            const expectedError = 
                error.response && 
                error.response.status >= 400 && 
                error.response.status < 500;

            // 1. Ошибка сети (сервер выключен, нет интернета)
            if (!error.response) {
                toast.error("🌐 Ошибка сети. Проверьте подключение или сервер недоступен.");
                return Promise.reject(error);
            }

            // 2. Ошибки сервера (500, 502, 504)
            if (error.response.status >= 500) {
                toast.error("🔥 Ошибка сервера. Мы уже чиним!");
                // Здесь можно отправить лог в Sentry
                return Promise.reject(error);
            }

            // 3. Клиентские ошибки (400, 401, 403, 404)
            if (expectedError) {
                const status = error.response.status;

                switch (status) {
                    case 400:
                        // Пытаемся достать текст ошибки из Django
                        // Django часто шлет { detail: "..." } или { field: ["..."] }
                        const data = error.response.data;
                        const message = data.detail || JSON.stringify(data);
                        toast.warning(`Ошибка данных: ${message.substring(0, 100)}`); 
                        break;
                    
                    case 401:
                        toast.info("🔐 Сессия истекла. Пожалуйста, войдите снова.");
                        // Тут можно сделать redirect на /login, если нужно
                        // window.location.href = '/login'; 
                        break;

                    case 403:
                        toast.error("⛔ Доступ запрещен!");
                        break;
                    
                    case 404:
                        toast.warn("🔍 Ресурс не найден (404).");
                        break;
                    
                    default:
                        toast.error("Произошла ошибка при запросе.");
                }
            }

            return Promise.reject(error);
        }
    );
};