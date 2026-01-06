import axios from 'axios';

const getBaseURL = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // Fallback to dynamic detection for Docker deployments across computers
    if (typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.hostname}:9017`;
    }
    return 'http://localhost:9017';
};

const api = axios.create({
    baseURL: getBaseURL(),
});

export default api;
