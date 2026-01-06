import React, { useState } from 'react';
import axios from 'axios';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

const Login = ({ setAuth }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/login', { username, password });
      if (res.data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setAuth(true);
        navigate('/projects');
      }
    } catch (err) {
      if (!err.response) {
        setError('無法連線到後端伺服器，請檢查網路或 Docker 狀態');
      } else {
        setError('帳號或密碼錯誤');
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="card" style={{ width: '400px' }}>
        <h1 style={{ color: '#FFD700', marginBottom: '30px', textAlign: 'center' }}>Database Editor</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#B0B0B0' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#FFD700' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="預設: admin"
              />
            </div>
          </div>
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#B0B0B0' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#FFD700' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="預設: admin"
              />
            </div>
          </div>
          {error && <p style={{ color: '#FF4D4D', marginBottom: '20px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="primary" style={{ width: '100%', padding: '12px' }}>登入</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
