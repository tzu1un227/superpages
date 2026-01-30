import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Send, Users, Info } from 'lucide-react';
import { Autocomplete, TextField, Chip, Box } from '@mui/material';

function Broadcast() {
    const location = useLocation();
    const [targetType, setTargetType] = useState('all'); // all, tag, ids
    const [tag, setTag] = useState(null); // Changed to null for Autocomplete
    const [selectedUsers, setSelectedUsers] = useState([]); // For ID list selection
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Data sources
    const [availableTags, setAvailableTags] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);

    useEffect(() => {
        setTargetType('all');
        setTag(null);
        setSelectedUsers([]);
        setMessage('');

        // Fetch Tags
        api.get('/tags')
            .then(res => setAvailableTags(res.data))
            .catch(err => console.error('Error fetching tags:', err));

        // Fetch Users
        api.get('/registered-users')
            .then(res => setAvailableUsers(res.data))
            .catch(err => console.error('Error fetching users:', err));

    }, [location.pathname]);

    const handleBroadcast = async () => {
        if (!message.trim()) return;

        let broadcastCmd = '';
        if (targetType === 'all') {
            broadcastCmd = `broadcast_cmd|${message}`;
        } else if (targetType === 'tag') {
            if (!tag) {
                alert('請輸入或選擇標籤');
                return;
            }
            broadcastCmd = `nwcast|${tag}|${message}`;
        } else {
            if (selectedUsers.length === 0) {
                alert('請至少選擇一位用戶');
                return;
            }
            const ids = selectedUsers.map(u => u.user_id).join(',');
            broadcastCmd = `bmcast|${ids}|${message}`;
        }

        try {
            setLoading(true);
            await api.post('/trigger', {
                user: 'yzuadmin', // System/Admin ID for triggering broadcast
                message: broadcastCmd,
                type: 'Sensor',
                api_index: 0
            });
            alert('廣播指令已送出');
            setMessage('');
            if (targetType === 'ids') setSelectedUsers([]);
        } catch (err) {
            alert('廣播失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>群發訊息</h1>
                <p style={{ color: '#B0B0B0' }}>向特定標籤受眾或名單發送大量訊息</p>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>發送對象</label>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button
                            onClick={() => setTargetType('all')}
                            style={{ padding: '10px 20px', backgroundColor: targetType === 'all' ? 'rgba(255, 215, 0, 0.2)' : '#333', border: targetType === 'all' ? '1px solid var(--primary-yellow)' : '1px solid transparent', color: targetType === 'all' ? 'var(--primary-yellow)' : 'white' }}
                        >
                            全體發送
                        </button>
                        <button
                            onClick={() => setTargetType('tag')}
                            style={{ padding: '10px 20px', backgroundColor: targetType === 'tag' ? 'rgba(255, 215, 0, 0.2)' : '#333', border: targetType === 'tag' ? '1px solid var(--primary-yellow)' : '1px solid transparent', color: targetType === 'tag' ? 'var(--primary-yellow)' : 'white' }}
                        >
                            標籤受眾
                        </button>
                        <button
                            onClick={() => setTargetType('ids')}
                            style={{ padding: '10px 20px', backgroundColor: targetType === 'ids' ? 'rgba(255, 215, 0, 0.2)' : '#333', border: targetType === 'ids' ? '1px solid var(--primary-yellow)' : '1px solid transparent', color: targetType === 'ids' ? 'var(--primary-yellow)' : 'white' }}
                        >
                            指定用戶
                        </button>
                    </div>
                </div>

                {targetType === 'tag' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#B0B0B0' }}>選擇或輸入標籤</label>
                        <Autocomplete
                            freeSolo
                            options={availableTags.map(t => t)}
                            value={tag}
                            onChange={(event, newValue) => setTag(newValue)}
                            onInputChange={(event, newInputValue) => setTag(newInputValue)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="例如: VIP, 新客戶..."
                                    variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: 'white',
                                            '& fieldset': { borderColor: '#444' },
                                            '&:hover fieldset': { borderColor: '#666' },
                                            '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' },
                                        },
                                        backgroundColor: '#222',
                                        borderRadius: '8px'
                                    }}
                                />
                            )}
                        />
                    </div>
                )}

                {targetType === 'ids' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#B0B0B0' }}>選擇用戶 (可多選)</label>
                        <Autocomplete
                            multiple
                            id="tags-outlined"
                            options={availableUsers}
                            getOptionLabel={(option) => option.name || option.user_id}
                            value={selectedUsers}
                            onChange={(event, newValue) => setSelectedUsers(newValue)}
                            filterSelectedOptions
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    placeholder="搜尋用戶..."
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: 'white',
                                            '& fieldset': { borderColor: '#444' },
                                            '&:hover fieldset': { borderColor: '#666' },
                                            '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' },
                                        },
                                        backgroundColor: '#222',
                                        borderRadius: '8px'
                                    }}
                                />
                            )}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        key={index}
                                        label={option.name || option.user_id}
                                        {...getTagProps({ index })}
                                        sx={{
                                            backgroundColor: '#333',
                                            color: 'white',
                                            '& .MuiChip-deleteIcon': { color: '#888', '&:hover': { color: '#fff' } }
                                        }}
                                    />
                                ))
                            }
                        />
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>訊息內容</label>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="在此輸入廣播訊息內容..."
                        rows={8}
                        style={{ width: '100%', resize: 'none' }}
                    />
                </div>

                <div style={{ backgroundColor: 'rgba(255, 215, 0, 0.05)', padding: '15px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <Info size={20} className="text-yellow" />
                    <p style={{ fontSize: '13px', color: '#B0B0B0', lineHeight: '1.6' }}>
                        提示：廣播訊息將透過系統轉發至手機端執行。請確保您的伺服器與 Socket 連線正常。大量發送可能需要一些時間完成。
                    </p>
                </div>

                <button
                    onClick={handleBroadcast}
                    className="primary"
                    style={{ padding: '15px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                    disabled={loading}
                >
                    <Send size={20} /> {loading ? '傳送中...' : '開始群發'}
                </button>
            </div>
        </div>
    );
}

export default Broadcast;
