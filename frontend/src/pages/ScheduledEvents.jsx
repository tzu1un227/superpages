import React, { useState, useEffect } from 'react';
import api from '../api';
import { Clock, Plus, Trash2, Send, Calendar } from 'lucide-react';

function ScheduledEvents() {
    const [events, setEvents] = useState([]);
    const [targetUserId, setTargetUserId] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [messageType, setMessageType] = useState('Sensor');
    const [intervalHours, setIntervalHours] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/api/scheduled-events');
            setEvents(res.data);
        } catch (err) {
            setError('無法取得定時事件列表');
        }
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        if (!targetUserId || !messageContent || !intervalHours) {
            alert('請填寫完整資訊');
            return;
        }

        try {
            setLoading(true);
            await api.post('/api/scheduled-events', {
                target_user_id: targetUserId,
                message_content: messageContent,
                message_type: messageType,
                interval_hours: parseFloat(intervalHours)
            });
            setTargetUserId('');
            setMessageContent('');
            setIntervalHours('');
            fetchEvents();
        } catch (err) {
            alert('建立失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm('確定要刪除此定時事件嗎？')) return;
        try {
            await api.delete(`/api/scheduled-events/${id}`);
            fetchEvents();
        } catch (err) {
            alert('刪除失敗');
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>定時觸發事件管理</h1>
                <p style={{ color: '#B0B0B0' }}>設定每隔一段時間自動發送訊息指令</p>
            </div>

            {error && (
                <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', color: '#FF4D4D', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
                    {error}
                </div>
            )}

            <div className="card" style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Plus size={20} className="text-yellow" /> 新增定時事件
                </h3>
                <form onSubmit={handleCreateEvent} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>目標 User ID</label>
                        <input
                            type="text"
                            value={targetUserId}
                            onChange={e => setTargetUserId(e.target.value)}
                            placeholder="U123456..."
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>訊息內容</label>
                        <input
                            type="text"
                            value={messageContent}
                            onChange={e => setMessageContent(e.target.value)}
                            placeholder="例如: MSG|你好"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>類型 (Type)</label>
                        <input
                            type="text"
                            value={messageType}
                            onChange={e => setMessageType(e.target.value)}
                            placeholder="預設: Sensor"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>觸發間隔 (小時)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={intervalHours}
                            onChange={e => setIntervalHours(e.target.value)}
                            placeholder="如: 1"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <button type="submit" className="primary" disabled={loading} style={{ padding: '10px 20px' }}>
                        {loading ? '建立中...' : '儲存事件'}
                    </button>
                </form>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={20} className="text-yellow" /> 事件排程清單
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>目標用戶</th>
                                <th>訊息內容</th>
                                <th>類型</th>
                                <th>間隔 (時)</th>
                                <th>最後執行時間</th>
                                <th>狀態</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length > 0 ? events.map((ev) => (
                                <tr key={ev.event_id}>
                                    <td>{ev.event_id}</td>
                                    <td>{ev.target_user_id}</td>
                                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.message_content}</td>
                                    <td>{ev.message_type}</td>
                                    <td>{ev.interval_hours}</td>
                                    <td style={{ color: '#B0B0B0' }}>{ev.last_executed_at ? new Date(ev.last_executed_at).toLocaleString() : '尚未執行'}</td>
                                    <td>
                                        {ev.is_enabled ? (
                                            <span style={{ color: '#4CAF50' }}>● 啟用中</span>
                                        ) : (
                                            <span style={{ color: '#666' }}>○ 已停用</span>
                                        )}
                                    </td>
                                    <td>
                                        <Trash2
                                            size={18}
                                            style={{ cursor: 'pointer', color: '#FF4D4D' }}
                                            onClick={() => handleDeleteEvent(ev.event_id)}
                                        />
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>目前無任何定時事件。</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ScheduledEvents;
