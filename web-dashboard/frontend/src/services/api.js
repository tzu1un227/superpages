import { useAuth } from '../contexts/AuthContext';

// API base URL - In production, this proxies via Nginx /api prefix
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

// Helper function to get headers with JWT
const getHeaders = () => {
  const token = localStorage.getItem('jwt');

  // Extract OA ID from URL if present (format: /oa/:oaId/...)
  const match = window.location.pathname.match(/\/oa\/(\d+)/);
  const oaId = match ? match[1] : null;

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(oaId && { 'X-OA-ID': oaId }),
  };
};

// Generic API call function
const apiCall = async (url, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token invalid, logout user
    localStorage.removeItem('jwt');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'API call failed');
  }

  return response.json();
};

// API functions
export const fetchUserTrend = (params) => apiCall('/dashboard/user_trend', { method: 'GET' }, params);
export const fetchResponses = (params) => apiCall('/dashboard/responses', { method: 'GET' }, params);

// Export apiCall for custom use
export { apiCall };