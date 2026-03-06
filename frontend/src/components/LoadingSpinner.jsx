import React from 'react';

const LoadingSpinner = ({ fullScreen = false, message = '正在載入中...' }) => {
    const spinnerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '20px',
        width: '100%',
        height: fullScreen ? '100vh' : '100%',
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        backgroundColor: fullScreen ? 'rgba(0,0,0,0.7)' : 'transparent',
        zIndex: 9999,
    };

    const circleStyle = {
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 215, 0, 0.1)',
        borderTop: '4px solid #FFD700',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    };

    const messageStyle = {
        color: '#FFD700',
        fontSize: '18px',
        fontWeight: '600',
        letterSpacing: '1px',
        textShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
    };

    return (
        <div style={spinnerStyle}>
            <style>
                {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
            </style>
            <div style={circleStyle}></div>
            {message && <div style={messageStyle}>{message}</div>}
        </div>
    );
};

export default LoadingSpinner;
