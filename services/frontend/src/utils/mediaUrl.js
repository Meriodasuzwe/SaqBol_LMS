export function getMediaUrl(path, apiBaseUrl = import.meta.env?.VITE_API_URL || '/api/', origin = window.location.origin) {
    if (!path) return null;
    if (/^(https?:|blob:)/i.test(path)) return path;
    const apiOrigin = new URL(apiBaseUrl, origin).origin;
    return new URL(path.startsWith('/') ? path : `/${path}`, apiOrigin).href;
}
