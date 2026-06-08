import React from 'react';
import { Radar } from 'lucide-react';

const SocialRadar = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
      <Radar size={64} color="var(--primary-yellow)" style={{ marginBottom: '20px' }} />
      <h1 style={{ fontSize: '2em', marginBottom: '10px' }}>網路聲量雷達</h1>
      <h2 style={{ color: '#FFD700', letterSpacing: '2px' }}>施工中...</h2>
      <p style={{ marginTop: '20px', color: '#888' }}>未來規劃完成後才開始動工</p>
    </div>
  );
};

export default SocialRadar;
