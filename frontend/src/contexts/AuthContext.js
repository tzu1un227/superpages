import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api'; // Use standardized base URL

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('jwt'));

  const [myOAs, setMyOAs] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);

  // Fetch OAs function
  const fetchMyOAs = async (authToken) => {
    try {
      console.log('Fetching My OAs with token:', authToken ? 'Token present' : 'No token');
      const response = await fetch(`${API_BASE_URL}/my_oas`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('Fetch response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched My OAs:', data);
        setMyOAs(data);
        // Set default account if not set or invalid
        // Check localStorage for saved preference
        const savedAccountId = localStorage.getItem('currentAccountId');
        const savedAccount = data.find(oa => oa.id.toString() === savedAccountId);

        if (savedAccount) {
          setCurrentAccount(savedAccount);
        } else if (data.length > 0) {
          setCurrentAccount(data[0]);
          localStorage.setItem('currentAccountId', data[0].id);
        }
      } else {
        const text = await response.text();
        console.error('Fetch My OAs failed:', text);
      }
    } catch (error) {
      console.error("Failed to fetch My OAs", error);
    }
  };

  const switchAccount = (oaId) => {
    const account = myOAs.find(oa => oa.id === oaId);
    if (account) {
      setCurrentAccount(account);
      localStorage.setItem('currentAccountId', account.id);
    }
  };

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    if (token) {
      try {
        // Decode token to get user info - more robust decoding for Unicode
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        // Check if token is expired
        if (payload.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setUser({
            name: payload.name,
            email: payload.email,
            id: payload.sub, // 'sub' is user_id
            role: payload.role
          });
          // Restore OAs
          fetchMyOAs(token);
        } else {
          // Token is expired
          localStorage.removeItem('jwt');
          setToken(null);
        }
      } catch (error) {
        // Invalid token
        console.error("Failed to decode JWT:", error);
        localStorage.removeItem('jwt');
        setToken(null);
      }
    }
    setIsLoading(false);
  }, []);

  // Login function
  const login = async (googleToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: googleToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('jwt', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        setUser(data.user);
        fetchMyOAs(data.token);
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, message: 'Network error' };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('currentAccountId');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setMyOAs([]);
    setCurrentAccount(null);
  };

  // Get token for API calls
  const getToken = () => {
    return localStorage.getItem('jwt');
  };

  const value = {
    isAuthenticated,
    user,
    isLoading,
    token,
    myOAs,
    currentAccount,
    switchAccount,
    login,
    logout,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
