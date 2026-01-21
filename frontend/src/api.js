import axios from 'axios';

const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
        const { protocol, hostname, port } = window.location;
        // Case 1: Host Nginx 5016 -> Docker 9016, Host Nginx 5017 -> Docker 9017
        if (port === '5016') {
            return `${protocol}//${hostname}:5017`;
        }
        // Case 2: Direct Docker access
        if (port === '9016') {
            return `${protocol}//${hostname}:9017`;
        }
    }
    // Default: use the same origin with /api prefix (works if Nginx proxies /api)
    return '';
};

export const API_BASE_URL = getBaseURL() ? `${getBaseURL()}/api` : '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

export default api;
