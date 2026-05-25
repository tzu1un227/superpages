import React from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const Toast = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none'
        }}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onClose }) => {
    const icons = {
        success: <CheckCircle2 size={18} color="#4CAF50" />,
        error: <AlertCircle size={18} color="#F44336" />,
        warning: <AlertTriangle size={18} color="#FFC107" />,
        info: <Info size={18} color="#2196F3" />
    };

    const bgColors = {
        success: 'rgba(76, 175, 80, 0.15)',
        error: 'rgba(244, 67, 54, 0.15)',
        warning: 'rgba(255, 193, 7, 0.15)',
        info: 'rgba(33, 150, 243, 0.15)'
    };

    const borderColors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FFC107',
        info: '#2196F3'
    };

    return (
        <div style={{
            minWidth: '300px',
            maxWidth: '450px',
            backgroundColor: '#1E1E1E',
            border: `1px solid ${borderColors[toast.type] || '#333'}`,
            borderLeft: `4px solid ${borderColors[toast.type] || '#333'}`,
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            pointerEvents: 'auto',
            animation: 'slideIn 0.3s ease-out forwards',
            color: '#fff'
        }}>
            <div style={{ marginTop: '2px' }}>
                {icons[toast.type] || <Info size={18} />}
            </div>
            <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                {toast.message}
            </div>
            <button
                onClick={onClose}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
            >
                <X size={16} />
            </button>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Toast;
