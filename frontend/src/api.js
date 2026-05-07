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
const pendingRequests = new Map();
const originalGet = api.get;

api.get = async function(url, config) {
    // Exclude certain auth/user specific URLs from caching or things that need extreme real-time
    const noCacheUrls = ['/auth/me', '/auth/my-oas'];
    let shouldCache = !config?._bypassCache && !noCacheUrls.some(u => url.includes(u));

    // Never cache binary data like images or files in this simple JSON cache
    if (config?.responseType === 'blob' || config?.responseType === 'arraybuffer') {
        shouldCache = false;
    }

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

    // Strip cache-busting parameters (_t, timestamp) to ensure cache hits
    const cleanParams = { ...(config?.params || {}) };
    delete cleanParams._t;
    delete cleanParams.timestamp;
    delete cleanParams.t;

    const cacheKey = oaId + '|' + url + '|' + JSON.stringify(cleanParams);

    if (shouldCache) {
        if (apiCache.has(cacheKey)) {
            const cached = apiCache.get(cacheKey);
            // Background refresh if data is older than 5 seconds
            if (Date.now() - cached.timestamp > 5000) {
                // If not already refreshing
                if (!pendingRequests.has(cacheKey)) {
                    const promise = originalGet.call(api, url, { ...config, _bypassCache: true }).then(res => {
                        apiCache.set(cacheKey, { data: res, timestamp: Date.now() });
                        pendingRequests.delete(cacheKey);
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('apiCacheUpdated', { detail: { url } }));
                        }
                        return res;
                    }).catch(err => {
                        pendingRequests.delete(cacheKey);
                        throw err;
                    });
                    pendingRequests.set(cacheKey, promise);
                }
            }
            // Return cloned response
            return Promise.resolve({ ...cached.data, data: JSON.parse(JSON.stringify(cached.data.data)) });
        }
        
        // Request Deduplication: If already fetching, return the existing promise
        if (pendingRequests.has(cacheKey)) {
            const res = await pendingRequests.get(cacheKey);
            return { ...res, data: JSON.parse(JSON.stringify(res.data)) };
        }
    }

    const promise = originalGet.call(api, url, config);
    if (shouldCache) {
        pendingRequests.set(cacheKey, promise);
    }
    
    try {
        const res = await promise;
        if (shouldCache) {
            apiCache.set(cacheKey, { data: res, timestamp: Date.now() });
            pendingRequests.delete(cacheKey);
            return { ...res, data: JSON.parse(JSON.stringify(res.data)) };
        }
        return res;
    } catch (err) {
        if (shouldCache) {
            pendingRequests.delete(cacheKey);
        }
        throw err;
    }
};

// Response interceptor to invalidate cache on mutations
api.interceptors.response.use(
    (response) => {
        const method = response.config.method?.toLowerCase() || '';
        if (['post', 'put', 'patch', 'delete'].includes(method)) {
            // Exclude read receipts or non-mutating POSTs from clearing cache
            if (response.config.url?.endsWith('/read') || response.config.url?.includes('/read')) {
                return response;
            }
            // Simply clear all cache on any mutation to guarantee freshness
            apiCache.clear();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('apiCacheInvalidated'));
                
                // Immediately reload data in the background instead of waiting for navigation
                let currentOaId = '';
                const match = window.location.pathname.match(/\/oa\/(\d+)/);
                if (match) currentOaId = match[1];
                if (currentOaId) {
                    preloadPagesData(currentOaId, true);
                }
            }
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Preload function to be called after login or after edits
export const preloadPagesData = (oaId, force = false) => {
    if (!oaId) return;
    
    // Group endpoints by priority to prevent slamming the server and DB connection limits.
    // Chunk 1: Most critical, heavy, and frequently used pages
    const chunk1 = [
        '/registered-users', 
        '/tags', 
        '/questionnaire/groups', 
        '/customers'
    ];
    
    // Chunk 2: Secondary data
    const chunk2 = [
        '/projects', 
        '/broadcast/', 
        '/scheduled-events', 
        '/users'
    ];
    
    // Chunk 3: Less frequently accessed tabs
    const chunk3 = [
        '/richmenu', 
        '/statistics', 
        '/questionnaire/list', 
        '/tickets', 
        '/game-status', 
        '/db/tables'
    ];
    
    const prefetchChunk = async (urls) => {
        await Promise.allSettled(urls.map(url => {
            const cacheKey = oaId + '|' + url + '|{}';
            if (force || !apiCache.has(cacheKey)) {
                // By using api.get instead of originalGet, it automatically leverages deduplication
                // and sets the cache properly when done.
                return api.get(url, { headers: { 'X-OA-ID': oaId }, silent: true, _bypassCache: force })
                    .then(res => {
                        // Special nested prefetching for projects
                        if (url === '/projects' && Array.isArray(res?.data) && res.data.length > 0) {
                            const firstProjectId = res.data[0].project_id || res.data[0].id;
                            if (firstProjectId) {
                                api.get(`/schedules?project_id=${firstProjectId}`, { headers: { 'X-OA-ID': oaId }, silent: true, _bypassCache: force });
                                api.get(`/projects/${firstProjectId}/users`, { headers: { 'X-OA-ID': oaId }, silent: true, _bypassCache: force });
                            }
                        }
                    })
                    .catch(err => console.warn(`Preload failed for ${url}:`, err.message));
            }
            return Promise.resolve();
        }));
    };

    // Execute prefetching in staggered chunks (sequentially)
    prefetchChunk(chunk1)
        .then(() => prefetchChunk(chunk2))
        .then(() => prefetchChunk(chunk3));
};

export default api;
