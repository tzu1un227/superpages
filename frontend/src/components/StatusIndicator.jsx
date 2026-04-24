import React from 'react';
import { CircularProgress } from '@mui/material';

const StatusIndicator = ({ message, progress }) => (
    <div style={{
        position: 'fixed',
        bottom: '30px', // 改為右下角，避免遮擋導航
        right: '30px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minWidth: '280px',
        borderLeft: '4px solid var(--primary-yellow)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <CircularProgress size={22} sx={{ color: 'var(--primary-yellow)' }} />
            <span style={{ fontSize: '15px', color: '#fff', fontWeight: '600', letterSpacing: '0.5px' }}>{message}</span>
        </div>
        {progress > 0 && (
            <div style={{ width: '100%', height: '6px', backgroundColor: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-yellow)', transition: 'width 0.3s ease' }} />
            </div>
        )}
        {progress > 0 && (
            <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
                {Math.round(progress)}%
            </div>
        )}
    </div>
);

export default StatusIndicator;
