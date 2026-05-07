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

// Request interceptor to add Authorization token and X-OA-ID
api.interceptors.request.use(
    (config) => {
        // JWT Token
        const token = localStorage.getItem('jwt');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // X-OA-ID from URL
        // Match format /oa/:oaId/...
        if (typeof window !== 'undefined') {
            const match = window.location.pathname.match(/\/oa\/(\d+)/);
            if (match) {
                config.headers['X-OA-ID'] = match[1];
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Custom Request Cache
const apiCache = new Map();
const originalGet = api.get;

api.get = async function(url, config) {
    // Exclude certain auth/user specific URLs from caching or things that need extreme real-time
    const noCacheUrls = ['/auth/me', '/auth/my-oas', '/stats'];
    const shouldCache = !config?._bypassCache && !noCacheUrls.some(u => url.includes(u));

    // Include X-OA-ID in cache key manually since interceptor adds it later
    let oaId = '';
    if (typeof window !== 'undefined') {
        const match = window.location.pathname.match(/\/oa\/(\d+)/);
        if (match) oaId = match[1];
    }
    
    // Explicit oaId in config for preloading
    if (config?.headers && config.headers['X-OA-ID']) {
        oaId = config.headers['X-OA-ID'];
    }

    const cacheKey = oaId + '|' + url + '|' + JSON.stringify(config?.params || {});

    if (shouldCache && apiCache.has(cacheKey)) {
        const cached = apiCache.get(cacheKey);
        // Background refresh if data is older than 5 seconds
        if (Date.now() - cached.timestamp > 5000) {
            originalGet.call(api, url, { ...config, _bypassCache: true }).then(res => {
                apiCache.set(cacheKey, { data: res, timestamp: Date.now() });
                // Optional: Fire a custom event here if you want components to auto-update
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('apiCacheUpdated', { detail: { url } }));
                }
            }).catch(() => {});
        }
        // Return cloned response to prevent UI from mutating the cached object directly
        return Promise.resolve({ ...cached.data, data: JSON.parse(JSON.stringify(cached.data.data)) });
    }

    const res = await originalGet.call(api, url, config);
    if (shouldCache) {
        apiCache.set(cacheKey, { data: res, timestamp: Date.now() });
    }
    return { ...res, data: JSON.parse(JSON.stringify(res.data)) };
};

// Response interceptor to invalidate cache on mutations
api.interceptors.response.use(
    (response) => {
        const method = response.config.method.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method)) {
            // Simply clear all cache on any mutation to guarantee freshness
            apiCache.clear();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('apiCacheInvalidated'));
            }
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Preload function to be called after login
export const preloadPagesData = (oaId) => {
    if (!oaId) return;
    
    const endpointsToPreload = [
        '/projects',
        '/broadcast/',
        '/richmenu',
        '/registered-users',
        '/tags'
    ];
    
    endpointsToPreload.forEach(url => {
        const cacheKey = oaId + '|' + url + '|{}';
        if (!apiCache.has(cacheKey)) {
            originalGet.call(api, url, { headers: { 'X-OA-ID': oaId }, _bypassCache: true })
                .then(res => {
                    apiCache.set(cacheKey, { data: res, timestamp: Date.now() });
                })
                .catch(err => console.warn(`Preload failed for ${url}:`, err.message));
        }
    });
};

export default api;
