import { toast } from 'react-toastify';

export const setupAxiosInterceptors = (axiosInstance) => {

    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {

            // 1. Ошибка сети
            if (!error.response) {
                toast.error("🌐 Ошибка сети. Проверьте подключение или сервер недоступен.", {
                    toastId: 'network-error', // один тост на все сетевые ошибки
                });
                return Promise.reject(error);
            }

            const status = error.response.status;

            // 2. Ошибки сервера (500+)
            if (status >= 500) {
                toast.error(" Ошибка сервера. Мы уже решаем этот вопрос!", {
                    toastId: 'server-error',
                });
                return Promise.reject(error);
            }

            // 3. Клиентские ошибки (400–499)
            switch (status) {
                case 400: {
                    const data = error.response.data;
                    const message = data.detail || JSON.stringify(data);
                    // 400 могут быть разные — не дедублируем, каждый информативен
                    toast.warning(`Ошибка данных: ${message.substring(0, 100)}`);
                    break;
                }

                case 401:
                    // toastId гарантирует что сколько бы запросов ни упало с 401
                    // юзер увидит ровно ОДИН тост
                    toast.info(" Сессия истекла. Пожалуйста, войдите снова.", {
                        toastId: 'session-expired',
                    });
                    break;

                case 403:
                    toast.error("⛔ Доступ запрещён!", {
                        toastId: 'forbidden',
                    });
                    break;

                case 404:
                    // 404 часто летят на фоновые запросы — тихо игнорируем
                    // раскомментируй если нужно показывать:
                    // toast.warn("🔍 Ресурс не найден (404).", { toastId: 'not-found' });
                    break;

                default:
                    toast.error("Произошла ошибка при запросе.", {
                        toastId: `error-${status}`,
                    });
            }

            return Promise.reject(error);
        }
    );
};