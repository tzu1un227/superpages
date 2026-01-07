import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Statistics from './pages/Statistics';
import MessageCenter from './pages/MessageCenter';
import Broadcast from './pages/Broadcast';
import ScheduledEvents from './pages/ScheduledEvents';
import PrizeStatus from './pages/PrizeStatus';
import { LayoutDashboard, Clock, LogOut, MessageSquare, BarChart3, Send, Gift } from 'lucide-react';

function App() {
  const [auth, setAuth] = useState(!!localStorage.getItem('user'));

  const logout = () => {
    localStorage.removeItem('user');
    setAuth(false);
  };

  const ProtectedRoute = ({ children }) => {
    return auth ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {auth && (
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
            </ul>
            <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '20px' }}>
              <button onClick={logout} style={{ background: 'transparent', color: '#B0B0B0', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px' }}>
                <LogOut size={20} /> Logout
              </button>
            </div>
          </nav>
        )}
        <main style={{ flex: 1, backgroundColor: '#1A1A1A', overflowY: 'auto', padding: '40px' }}>
          <Routes>
            <Route path="/login" element={<Login setAuth={setAuth} />} />
            <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessageCenter /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/broadcast" element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
            <Route path="/scheduled-events" element={<ProtectedRoute><ScheduledEvents /></ProtectedRoute>} />
            <Route path="/prizes" element={<ProtectedRoute><PrizeStatus /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to={auth ? "/statistics" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
