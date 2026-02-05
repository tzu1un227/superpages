import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Projects from './pages/Projects';
import MessageCenter from './pages/MessageCenter';
import Broadcast from './pages/Broadcast';
import ScheduledEvents from './pages/ScheduledEvents';
import PrizeStatus from './pages/PrizeStatus';
import Statistics from './pages/Statistics';
import AdminPage from './pages/AdminPage';
import api from './api';
import { LayoutDashboard, Clock, LogOut, MessageSquare, BarChart3, Send, Gift, Shield } from 'lucide-react';

const GOOGLE_CLIENT_ID = "909213734319-feblc4e1vhgu7e0r340e43h9aabc8iqf.apps.googleusercontent.com";

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

const PAGE_ROUTE_MAP = {
  'MessageCenter': 'messages',
  'Projects': 'projects',
  'Broadcast': 'broadcast',
  'ScheduledEvents': 'scheduled-events',
  'PrizeStatus': 'prizes',
  'Statistics': 'statistics'
};

const PAGE_ICON_MAP = {
  'MessageCenter': MessageSquare,
  'Projects': LayoutDashboard,
  'Broadcast': Send,
  'ScheduledEvents': Clock,
  'PrizeStatus': Gift,
  'Statistics': BarChart3
};

const MainLayout = () => {
  const { isAuthenticated, logout, user, myOAs, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#111' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAuthenticated && location.pathname !== '/login' && (
        <nav style={{ width: '260px', backgroundColor: '#111', borderRight: '1px solid #333', padding: '30px 20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h2 className="text-yellow" style={{ marginBottom: '40px', fontSize: '24px' }}>SuperPages</h2>

          {user?.role === 'admin' && (
            <div style={{ marginBottom: '20px' }}>
              <Link
                to="/admin"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: location.pathname === '/admin' ? '#333' : '#222'
                }}
                className="nav-link"
              >
                <Shield size={20} className="text-yellow" /> 管理員後台
              </Link>
            </div>
          )}

          <div style={{ flex: 1 }}>
            {myOAs.map(oa => (
              <div key={oa.id} style={{ marginBottom: '25px' }}>
                <div style={{ color: '#888', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', paddingLeft: '12px', textTransform: 'uppercase' }}>
                  {oa.oa_name}
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {oa.pages && oa.pages.map(page => {
                    const RouteIcon = PAGE_ICON_MAP[page.name] || LayoutDashboard;
                    const routePath = PAGE_ROUTE_MAP[page.name] || 'projects';
                    const fullPath = `/oa/${oa.id}/${routePath}`;
                    const isActive = location.pathname.startsWith(fullPath);

                    const displayName = page.name === 'PrizeStatus' ? '抽獎管理' : page.description;

                    return (
                      <li key={page.id} style={{ marginBottom: '5px' }}>
                        <Link
                          to={fullPath}
                          style={{
                            color: 'white',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            backgroundColor: isActive ? '#333' : 'transparent',
                            borderLeft: isActive ? '4px solid #FFD700' : '4px solid transparent'
                          }}
                          className="nav-link"
                        >
                          <RouteIcon size={18} className="text-yellow" /> {displayName}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

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
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          <Route path="/oa/:oaId/messages" element={<ProtectedRoute><MessageCenter /></ProtectedRoute>} />
          <Route path="/oa/:oaId/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/oa/:oaId/broadcast" element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
          <Route path="/oa/:oaId/scheduled-events" element={<ProtectedRoute><ScheduledEvents /></ProtectedRoute>} />
          <Route path="/oa/:oaId/prizes" element={<ProtectedRoute><PrizeStatus /></ProtectedRoute>} />
          <Route path="/oa/:oaId/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />

          <Route path="/" element={
            isAuthenticated && myOAs.length > 0 ? (
              <Navigate to={`/oa/${myOAs[0].id}/${PAGE_ROUTE_MAP[myOAs[0].pages[0]?.name] || 'projects'}`} />
            ) : (
              <Navigate to="/login" />
            )
          } />
        </Routes>
      </main>
    </div>
  );
};

const AppContent = () => {
  return (
    <Router>
      <MainLayout />
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
