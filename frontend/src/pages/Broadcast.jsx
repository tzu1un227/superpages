import React, { useState } from 'react';
import api from '../api';
import { Send, Users, Info } from 'lucide-react';

function Broadcast() {
    const [targetType, setTargetType] = useState('all'); // all, tag, ids
    const [tag, setTag] = useState('');
    const [ids, setIds] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleBroadcast = async () => {
        if (!message.trim()) return;

        let broadcastCmd = '';
        if (targetType === 'all') {
            broadcastCmd = `broadcast_cmd|${message}`;
        } else if (targetType === 'tag') {
            broadcastCmd = `nwcast|${tag}|${message}`;
        } else {
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
                            指定 ID 列表
                        </button>
                    </div>
                </div>

                {targetType === 'tag' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#B0B0B0' }}>輸入標籤名稱</label>
                        <input
                            value={tag}
                            onChange={e => setTag(e.target.value)}
                            placeholder="例如: VIP, 新客戶..."
                            style={{ width: '100%' }}
                        />
                    </div>
                )}

                {targetType === 'ids' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: '#B0B0B0' }}>輸入 User IDs (以逗號分隔)</label>
                        <textarea
                            value={ids}
                            onChange={e => setIds(e.target.value)}
                            placeholder="U123456..., U789012..."
                            rows={4}
                            style={{ width: '100%', resize: 'none' }}
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
