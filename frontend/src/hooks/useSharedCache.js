import { useState, useEffect, useCallback } from 'react';
import api from '../api';

// Global cache object
// Format: { [key]: { data: any, isLoading: boolean, error: any, promise: Promise, timestamp: number } }
const globalCache = {};

// Listeners to notify components when cache updates
const listeners = {};

const notifyListeners = (key) => {
    if (listeners[key]) {
        listeners[key].forEach(listener => listener(globalCache[key]));
    }
};

/**
 * Preload data in the background
 */
export const preloadData = async (key, url) => {
    if (!key || !url) return;
    
    // If already preloading or loaded recently, skip
    if (globalCache[key] && (globalCache[key].isLoading || globalCache[key].data)) {
        // If data is older than 5 mins, we might want to refresh, but for now just skip
        return globalCache[key].promise;
    }

    const promise = api.get(url).then(res => res.data);
    globalCache[key] = { promise, data: null, error: null, isLoading: true, timestamp: Date.now() };
    notifyListeners(key);

    try {
        const data = await promise;
        globalCache[key] = { ...globalCache[key], data, isLoading: false, timestamp: Date.now() };
        notifyListeners(key);
        return data;
    } catch (error) {
        globalCache[key] = { ...globalCache[key], error, isLoading: false, timestamp: Date.now() };
        notifyListeners(key);
        throw error;
    }
};

/**
 * Hook to use cached data
 */
export function useSharedCache(key, url, dependencies = []) {
    // Determine initial state
    const getInitialState = () => {
        if (!key || !globalCache[key]) {
            return { data: null, isLoading: !!key, error: null, isValidating: !!key };
        }
        return {
            data: globalCache[key].data,
            isLoading: globalCache[key].isLoading && !globalCache[key].data, // Only show full loading if no data
            error: globalCache[key].error,
            isValidating: globalCache[key].isLoading
        };
    };

    const [state, setState] = useState(getInitialState);

    // Register listener for external cache updates (like preloads)
    useEffect(() => {
        if (!key) return;

        const listener = (newCacheState) => {
            setState({
                data: newCacheState.data,
                isLoading: newCacheState.isLoading && !newCacheState.data,
                error: newCacheState.error,
                isValidating: newCacheState.isLoading
            });
        };

        if (!listeners[key]) listeners[key] = new Set();
        listeners[key].add(listener);

        return () => {
            listeners[key].delete(listener);
        };
    }, [key]);

    const executeFetch = useCallback(async (force = false) => {
        if (!key || !url) {
            setState(s => ({ ...s, isLoading: false, isValidating: false }));
            return;
        }

        const currentCache = globalCache[key];
        
        // If not forcing and we have data, we just return it (and maybe background refresh)
        if (!force && currentCache && currentCache.data) {
            setState(s => ({ ...s, data: currentCache.data, isLoading: false, isValidating: false }));
            return currentCache.data;
        }

        // Background refresh vs hard loading
        const isHardLoading = !currentCache?.data;
        
        setState(s => ({ ...s, isLoading: isHardLoading, isValidating: true, error: null }));
        
        const promise = api.get(url).then(res => res.data);
        globalCache[key] = { 
            promise, 
            data: currentCache?.data || null, 
            error: null, 
            isLoading: true, 
            timestamp: Date.now() 
        };
        notifyListeners(key);

        try {
            const data = await promise;
            globalCache[key] = { promise, data, error: null, isLoading: false, timestamp: Date.now() };
            notifyListeners(key);
            return data;
        } catch (error) {
            globalCache[key] = { ...globalCache[key], error, isLoading: false, timestamp: Date.now() };
            notifyListeners(key);
            throw error;
        }
    }, [key, url, ...dependencies]);

    // Initial fetch if no cache
    useEffect(() => {
        if (key && url) {
            if (!globalCache[key] || !globalCache[key].data) {
                executeFetch();
            } else {
                // If we already have data, we just sync our state
                setState({
                    data: globalCache[key].data,
                    isLoading: false,
                    error: globalCache[key].error,
                    isValidating: globalCache[key].isLoading
                });
            }
        }
    }, [key, url, executeFetch]);

    // Update local data manually (e.g. optimistic UI updates)
    const mutate = useCallback((newData, shouldRevalidate = true) => {
        if (!key) return;
        
        if (typeof newData === 'function') {
            const currentData = globalCache[key]?.data;
            newData = newData(currentData);
        }
        
        if (newData !== undefined) {
            globalCache[key] = { ...globalCache[key], data: newData };
            notifyListeners(key);
        }

        if (shouldRevalidate) {
            executeFetch(true);
        }
    }, [key, executeFetch]);

    return { ...state, mutate, refresh: () => executeFetch(true) };
}
