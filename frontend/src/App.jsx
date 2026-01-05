import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Schedules from './pages/Schedules';
import { LayoutDashboard, Clock, LogOut } from 'lucide-react';

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
          <nav style={{ width: '260px', backgroundColor: '#111', borderRight: '1px solid #333', padding: '30px 20px' }}>
            <h2 className="text-yellow" style={{ marginBottom: '40px', fontSize: '24px' }}>Admin Panel</h2>
            <ul style={{ listStyle: 'none' }}>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/projects" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <LayoutDashboard size={20} className="text-yellow" /> Projects
                </Link>
              </li>
              <li style={{ marginBottom: '15px' }}>
                <Link to="/schedules" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px' }} className="nav-link">
                  <Clock size={20} className="text-yellow" /> Schedules
                </Link>
              </li>
              <li style={{ marginTop: '50px' }}>
                <button onClick={logout} style={{ background: 'transparent', color: '#B0B0B0', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px' }}>
                  <LogOut size={20} /> Logout
                </button>
              </li>
            </ul>
          </nav>
        )}
        <main style={{ flex: 1, backgroundColor: '#1A1A1A', overflowY: 'auto' }}>
          <Routes>
            <Route path="/login" element={<Login setAuth={setAuth} />} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to={auth ? "/projects" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
