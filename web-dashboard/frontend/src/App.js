import { GoogleOAuthProvider } from '@react-oauth/google';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminPage from './pages/AdminPage';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TopBar from './components/TopBar';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2962ff', // A vibrant, yet professional blue
    },
    secondary: {
      main: '#ff9800',
    },
    background: {
      default: '#f5f5f7', // A very light grey for a subtle, clean background
      paper: '#ffffff',
    },
    text: {
      primary: '#111827', // Darker text for better contrast
      secondary: '#6b7280',
    },
    neutral: { // Custom color for the sidebar
      dark: '#1f2937',
      main: '#6b7280',
      light: '#e5e7eb',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      color: '#111827',
    },
    h6: {
      fontWeight: 600,
    }
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)', // A softer, more modern shadow
          border: '1px solid #e5e7eb',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
          '&:hover': {
            backgroundColor: alpha('#000000', 0.04),
          },
          '&.Mui-selected': {
            backgroundColor: alpha('#2962ff', 0.08),
            '&:hover': {
              backgroundColor: alpha('#2962ff', 0.12),
            },
          },
        },
      },
    },
  },
});



function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
      {isAuthenticated && <Sidebar />}
      {isAuthenticated && <TopBar />}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/admin" element={isAuthenticated ? <AdminPage /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Box>
    </Box>
  );
}

const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
console.log("Debug: Google Client ID =", clientId);

function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;