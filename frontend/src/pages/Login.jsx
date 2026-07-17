import React, { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Box, Typography, Alert, Paper, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const reason = sessionStorage.getItem('logoutReason');
    if (reason === 'idle') {
      setError('閒置時間過長，請重新登入。');
    } else if (reason === '401') {
      setError('登入憑證已失效，請重新登入。');
    }
    if (reason) {
      sessionStorage.removeItem('logoutReason');
    }
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoggingIn(true);
    setError('');
    try {
      const result = await login(credentialResponse.credential);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message);
        setIsLoggingIn(false);
      }
    } catch (err) {
      setError('登入過程中發生錯誤，請稍後重試');
      setIsLoggingIn(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google 登入失敗，請重試');
    setIsLoggingIn(false);
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f5f5f5">
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Superpages 登入
        </Typography>
        <Typography variant="body1" gutterBottom align="center" sx={{ mb: 3 }}>
          請使用 Google 帳號登入系統
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Box display="flex" justifyContent="center" minHeight="60px" alignItems="center">
          {isLoggingIn ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
              <CircularProgress size={30} />
              <Typography variant="body2" color="textSecondary">
                登入中，請稍候...
              </Typography>
            </Box>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
            />
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
