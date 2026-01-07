import React, { useState, useEffect } from 'react';
import api from '../api';
import { Play, Trophy, Square, Gift, PlusCircle, RefreshCw } from 'lucide-react';

const PrizeStatus = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputValue, setInputValue] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/tickets');
            setTickets(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching tickets:', err);
            setError('無法取得獎品資料');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleAction = async (actionType, content = '') => {
        let message = '';
        if (['啟動遊戲', '抽大獎', '關閉遊戲'].includes(actionType)) {
            message = actionType;
        } else if (actionType === '捐出獎品') {
            if (!content.trim()) {
                alert('請輸入獎品 ID');
                return;
            }
            message = `捐出|${content}`;
        } else if (actionType === '新增獎品') {
            if (!content.trim()) {
                alert('請輸入獎品 ID');
                return;
            }
            message = `新增獎品|${content}`;
        }

        try {
            await api.post('/api/trigger', {
                user: 'yzuadmin',
                message: message,
                api_index: 0,
                type: 'Message'
            });
            alert(`已發送指令: ${message}`);
            if (actionType === '捐出獎品' || actionType === '新增獎品') {
                setInputValue('');
            }
        } catch (err) {
            console.error('Error triggering action:', err);
            alert('發生錯誤: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>中獎獎品查詢</h1>
                <button
                    onClick={fetchTickets}
                    className="secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} /> 重新整理
                </button>
            </div>

            <div className="card" style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>遊戲控制</h3>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <button
                        onClick={() => handleAction('啟動遊戲')}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#22C55E', color: 'white', border: 'none' }}
                    >
                        <Play size={18} /> 啟動遊戲
                    </button>
                    <button
                        onClick={() => handleAction('抽大獎')}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EAB308', color: 'white', border: 'none' }}
                    >
                        <Trophy size={18} /> 抽大獎
                    </button>
                    <button
                        onClick={() => handleAction('關閉遊戲')}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EF4444', color: 'white', border: 'none' }}
                    >
                        <Square size={18} /> 關閉遊戲
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                        <label style={{ color: '#B0B0B0', fontSize: '13px' }}>輸入獎品 ID</label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="例如: 1"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <button
                        onClick={() => handleAction('捐出獎品', inputValue)}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Gift size={18} /> 捐出獎品
                    </button>
                    <button
                        onClick={() => handleAction('新增獎品', inputValue)}
                        className="primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8B5CF6', color: 'white', border: 'none' }}
                    >
                        <PlusCircle size={18} /> 新增獎品
                    </button>
                </div>
            </div>

            <div className="card">
                <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>獎品列表</h3>

                {loading ? (
                    <div style={{ color: '#B0B0B0', textAlign: 'center', padding: '40px' }}>載入中...</div>
                ) : error ? (
                    <div style={{ color: '#EF4444', textAlign: 'center', padding: '40px' }}>{error}</div>
                ) : tickets.length === 0 ? (
                    <div style={{ color: '#B0B0B0', textAlign: 'center', padding: '40px' }}>目前沒有獎品資料</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>ID</th>
                                    <th style={{ textAlign: 'left' }}>獎品名稱</th>
                                    <th style={{ textAlign: 'left' }}>中獎使用者 (User ID)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((ticket) => (
                                    <tr key={ticket.id}>
                                        <td style={{ fontWeight: '600' }}>{ticket.id}</td>
                                        <td>{ticket.name}</td>
                                        <td style={{ color: 'var(--primary-yellow)', fontFamily: 'monospace' }}>{ticket.user_id || '尚未有人中獎'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrizeStatus;
