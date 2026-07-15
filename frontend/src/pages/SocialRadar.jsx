import React from 'react';
import { Radar } from 'lucide-react';

const SocialRadar = () => {
  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff' }}>
      <Radar size={64} color="var(--primary-yellow)" style={{ marginBottom: '20px' }} />
      <h1 style={{ fontSize: '2em', marginBottom: '10px' }}>網路聲量雷達</h1>
      <h2 style={{ color: '#FFD700', letterSpacing: '2px' }}>施工中...</h2>
    </div>
  );
};

export default SocialRadar;
