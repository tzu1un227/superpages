import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Statistics from './pages/Statistics';
import MessageCenter from './pages/MessageCenter';
import Broadcast from './pages/Broadcast';
import ScheduledEvents from './pages/ScheduledEvents';
import PrizeStatus from './pages/PrizeStatus';
import AdminPage from './pages/AdminPage'; // Import Admin Page
import { LayoutDashboard, Clock, LogOut, MessageSquare, BarChart3, Send, Gift, Shield } from 'lucide-react';

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // TODO: Replace with env variable

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/" />;
  return children;
};

const AppContent = () => {
  const { isAuthenticated, logout, user } = useAuth();

  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {isAuthenticated && (
          <nav style={{ width: '260px', backgroundColor: '#111', borderRight: '1px solid #333', padding: '30px 20px', display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-yellow" style={{ marginBottom: '40px', fontSize: '24px' }}>SuperPages</h2>
            <ul style={{ listStyle: 'none', flex: 1 }}>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/statistics" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <BarChart3 size={20} className="text-yellow" /> 綜合數據
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/messages" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <MessageSquare size={20} className="text-yellow" /> 訊息中心
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/projects" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <LayoutDashboard size={20} className="text-yellow" /> 專案與排程
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/broadcast" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <Send size={20} className="text-yellow" /> 群發訊息
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/scheduled-events" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <Clock size={20} className="text-yellow" /> 定時觸發
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/prizes" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <Gift size={20} className="text-yellow" /> 獎品查詢
                </Link>
              </li>
              {user?.role === 'admin' && (
                <li style={{ marginBottom: '15px' }}>
                  <Link to="/admin" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                    <Shield size={20} className="text-yellow" /> 管理員後台
                  </Link>
                </li>
              )}
            </ul>
            <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '20px' }}>
              <div style={{ color: '#888', marginBottom: '10px', fontSize: '0.9em', paddingLeft: '12px' }}>
                {user?.email}
              </div>
              <button onClick={logout} style={{ background: 'transparent', color: '#B0B0B0', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px', cursor: 'pointer', border: 'none' }}>
                <LogOut size={20} /> Logout
              </button>
            </div>
          </nav>
        )}
        <main style={{ flex: 1, backgroundColor: '#1A1A1A', overflowY: 'auto', padding: '40px' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessageCenter /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/broadcast" element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
            <Route path="/scheduled-events" element={<ProtectedRoute><ScheduledEvents /></ProtectedRoute>} />
            <Route path="/prizes" element={<ProtectedRoute><PrizeStatus /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

            <Route path="/" element={<Navigate to={isAuthenticated ? "/statistics" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
