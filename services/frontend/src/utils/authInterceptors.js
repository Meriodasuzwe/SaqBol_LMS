import { CanceledError } from 'axios';

const publicAuthPath = /(?:^|\/)users\/(?:login|register|google-login|telegram-auth|token\/refresh|verify-email|resend-verification|password-reset|password-reset-confirm)\/(?:\?.*)?$/;

export function setupAuthInterceptors(api, { refreshClient, storage, onSessionExpired }) {
    let refreshPromise = null;

    const expireSession = () => {
        storage.removeItem('access');
        storage.removeItem('refresh');
        onSessionExpired();
    };

    api.interceptors.request.use((config) => {
        const token = storage.getItem('access');
        config.skipAuth = publicAuthPath.test(config.url || '');
        if (token && !config.skipAuth) {
            config.headers.Authorization = `Bearer ${token}`;
        } else {
            delete config.headers.Authorization;
        }
        return config;
    });

    api.interceptors.response.use((response) => response, async (error) => {
        const request = error.config;
        if (error.response?.status !== 401 || !request || request.skipAuth || !request.headers.Authorization) {
            throw error;
        }

        if (request.authRetried) {
            if (request.headers.Authorization === `Bearer ${storage.getItem('access')}`) expireSession();
            throw error;
        }
        request.authRetried = true;

        // Another request may already have refreshed the token while this response was in flight.
        const currentToken = storage.getItem('access');
        if (currentToken && request.headers.Authorization !== `Bearer ${currentToken}`) {
            return api(request);
        }

        const refreshToken = storage.getItem('refresh');
        if (!refreshToken) {
            if (currentToken) expireSession();
            throw error;
        }

        if (!refreshPromise) {
            refreshPromise = refreshClient.post('users/token/refresh/', { refresh: refreshToken })
                .then(({ data }) => {
                    // Do not restore a session after logout or overwrite a new login.
                    if (storage.getItem('refresh') !== refreshToken) throw new CanceledError('Session changed');
                    if (!data.access) throw new Error('Token refresh returned no access token');
                    storage.setItem('access', data.access);
                    if (data.refresh) storage.setItem('refresh', data.refresh);
                    return data.access;
                })
                .catch((refreshError) => {
                    if ([400, 401].includes(refreshError.response?.status) && storage.getItem('refresh') === refreshToken) {
                        expireSession();
                    }
                    throw refreshError;
                })
                .finally(() => { refreshPromise = null; });
        }

        await refreshPromise;
        return api(request);
    });
}
