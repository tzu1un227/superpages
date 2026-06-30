import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import api from '../api';

const UserAvatar = ({ userId, picUrl, size = 40, style = {} }) => {
    const [imgSrc, setImgSrc] = useState(picUrl);
    const [status, setStatus] = useState(picUrl ? 'loading' : 'failed');

    useEffect(() => {
        setImgSrc(picUrl);
        setStatus(picUrl ? 'loading' : 'failed');
    }, [picUrl]);

    const handleError = async () => {
        if (status === 'refreshing' || status === 'failed') return;
        
        setStatus('refreshing');
        setImgSrc(null);

        if (!userId) {
            setStatus('failed');
            return;
        }

        try {
            const res = await api.post(`/customers/${userId}/refresh-profile`);
            const newUrl = res.data?.picture_url;
            if (newUrl) {
                setImgSrc(newUrl);
                setStatus('loading');
            } else {
                setStatus('failed');
            }
        } catch (err) {
            console.error('Failed to refresh profile picture:', err);
            setStatus('failed');
        }
    };

    const containerStyle = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: '#444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        ...style
    };

    const showPlaceholder = status !== 'loaded';

    return (
        <div style={containerStyle}>
            {showPlaceholder && (
                <User size={size * 0.6} color="#aaa" />
            )}
            {imgSrc && (status === 'loading' || status === 'loaded') && (
                <img
                    src={imgSrc}
                    alt="avatar"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: status === 'loaded' ? 'static' : 'absolute',
                        opacity: status === 'loaded' ? 1 : 0
                    }}
                    onLoad={() => setStatus('loaded')}
                    onError={handleError}
                />
            )}
        </div>
    );
};

export default UserAvatar;
