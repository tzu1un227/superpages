import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Send, User, Search, Tag } from 'lucide-react';

function MessageCenter() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setUsers([]);
        setSelectedUser(null);
        setMessages([]);
        fetchUsers();
    }, [location.pathname]);

    useEffect(() => {
        if (selectedUser) {
            fetchHistory(selectedUser);
        }
    }, [selectedUser]);

    const fetchUsers = async () => {
        try {
            const resp = await api.get('/users');
            setUsers(resp.data);
            if (resp.data.length > 0 && !selectedUser) {
                setSelectedUser(resp.data[0].user_id);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        }
    };

    const fetchHistory = async (userId) => {
        try {
            const resp = await api.get(`/history/${userId}`);
            setMessages(resp.data);
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || !selectedUser) return;
        try {
            setLoading(true);
            await api.post('/trigger', {
                user: selectedUser,
                message: `MSG|${input}`,
                type: 'Sensor',
                api_index: 0
            });
            // Optimistically add to messages
            setMessages([...messages, { content: input, timestamp: new Date(), category: 'Message', user_id: 'yzuadmin' }]);
            setInput('');
        } catch (err) {
            alert('發送失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = async () => {
        if (!tagInput.trim() || !selectedUser) return;
        try {
            await api.post('/trigger', {
                user: selectedUser,
                message: `set_tag|${tagInput}`,
                type: 'Sensor',
                api_index: 0
            });
            alert(`已新增標籤: ${tagInput}`);
            setTagInput('');
            setTimeout(fetchUsers, 1000); // Small delay for server to update
        } catch (err) {
            alert('新增標籤失敗');
        }
    };

    const handleDeleteTag = async (tagName) => {
        if (!selectedUser) return;
        if (!window.confirm(`確定要刪除標籤 [${tagName}] 嗎？`)) return;
        try {
            await api.post('/trigger', {
                user: selectedUser,
                message: `del_tag|${tagName}`,
                type: 'Sensor',
                api_index: 0
            });
            alert(`已刪除標籤: ${tagName}`);
            setTimeout(fetchUsers, 1000); // Small delay for server to update
        } catch (err) {
            alert('刪除標籤失敗');
        }
    };

    const getCurrentUserTags = () => {
        const user = users.find(u => u.user_id === selectedUser);
        if (!user || !user.tags) return [];

        let tagsInput = user.tags;
        let tagList = [];

        // If backend combined multiple rows with '|'
        const rawParts = typeof tagsInput === 'string' ? tagsInput.split('|') : [tagsInput];

        rawParts.forEach(part => {
            if (!part) return;
            const trimmed = String(part).trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) tagList.push(...parsed);
                    else tagList.push(parsed);
                } catch (e) {
                    trimmed.slice(1, -1).split(',').forEach(s => tagList.push(s.trim().replace(/^["']|["']$/g, '')));
                }
            } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                trimmed.slice(1, -1).split(',').forEach(s => tagList.push(s.trim().replace(/^["']|["']$/g, '')));
            } else if (trimmed.includes(',')) {
                trimmed.split(',').forEach(s => tagList.push(s.trim()));
            } else {
                tagList.push(trimmed);
            }
        });

        // Unique and filter empty
        return [...new Set(tagList.map(t => String(t).trim()).filter(t => t && t !== 'null' && t !== 'undefined'))];
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '20px' }}>
            {/* User Sidebar */}
            <div className="card" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '15px' }}>
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                        placeholder="搜尋用戶 ID..."
                        style={{ width: '100%', paddingLeft: '35px' }}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {users.map(u => (
                        <div
                            key={u.user_id}
                            onClick={() => setSelectedUser(u.user_id)}
                            style={{
                                padding: '12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginBottom: '8px',
                                backgroundColor: selectedUser === u.user_id ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                                border: selectedUser === u.user_id ? '1px solid var(--primary-yellow)' : '1px solid transparent'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ backgroundColor: '#333', padding: '8px', borderRadius: '50%' }}>
                                    <User size={18} />
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <p style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || u.user_id}</p>
                                    <p style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.last_message || '尚無訊息'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
                {selectedUser ? (
                    <>
                        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', marginBottom: '5px' }}>{users.find(u => u.user_id === selectedUser)?.name || selectedUser}</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                    {getCurrentUserTags().map((t, i) => (
                                        <span key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            backgroundColor: '#333',
                                            color: '#FFD700',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            border: '1px solid rgba(255, 215, 0, 0.3)'
                                        }}>
                                            {t}
                                            <button
                                                onClick={() => handleDeleteTag(t)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ff4d4f',
                                                    padding: '0',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    placeholder="新標籤..."
                                    style={{ width: '120px', padding: '6px 12px', fontSize: '12px' }}
                                />
                                <button
                                    onClick={handleAddTag}
                                    style={{ padding: '6px 15px', fontSize: '12px', backgroundColor: 'var(--primary-yellow)', color: 'black' }}
                                >
                                    新增
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {messages.filter(m => {
                                // Filter out system commands from view
                                if (m.category === 'Sensor') {
                                    const c = m.content || '';
                                    if (c.startsWith('cron|') || c.startsWith('set_tag|') || c.startsWith('del_tag|')) return false;
                                }
                                return true;
                            }).map((m, i) => {
                                const isAdmin = m.user_id === 'yzuadmin' || m.category === 'Sensor' || m.category === 'Response';
                                let displayContent = m.content;
                                if (isAdmin && displayContent.startsWith('MSG|')) {
                                    displayContent = displayContent.substring(4);
                                }

                                return (
                                    <div key={i} style={{
                                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                                        maxWidth: '70%',
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        backgroundColor: isAdmin ? 'var(--primary-yellow)' : '#333',
                                        color: isAdmin ? 'black' : 'white',
                                    }}>
                                        <p style={{ fontSize: '14px' }}>{displayContent}</p>
                                        <p style={{ fontSize: '10px', marginTop: '5px', opacity: 0.6 }}>{new Date(m.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', gap: '15px' }}>
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                                placeholder="輸入訊息..."
                                style={{ flex: 1 }}
                            />
                            <button
                                onClick={sendMessage}
                                className="primary"
                                style={{ padding: '0 25px' }}
                                disabled={loading}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                        請選擇一個用戶開始對話
                    </div>
                )}
            </div>
        </div>
    );
}

export default MessageCenter;
