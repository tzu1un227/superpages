import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Trophy, Square, Gift, PlusCircle, RefreshCw } from 'lucide-react';

const API_BASE_URL = 'http://localhost:9017/api';

const PrizeStatus = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputValue, setInputValue] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/tickets`);
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
        } else if (actionType === '捐出獎品' || actionType === '新增獎品') {
            if (!content.trim()) {
                alert('請輸入內容');
                return;
            }
            message = `${actionType}|${content}`;
        }

        try {
            await axios.post(`${API_BASE_URL}/trigger`, {
                user: 'yzuadmin',
                message: message,
                api_index: 0,
                type: 'message'
            });
            alert(`已發送指令: ${message}`);
            if (actionType === '捐出獎品' || actionType === '新增獎品') {
                setInputValue('');
            }
        } catch (err) {
            console.error('Error triggering action:', err);
            alert('發生錯誤，請稍後再試');
        }
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="text-yellow" style={{ fontSize: '28px', fontWeight: '600' }}>中獎獎品查詢</h1>
                <button
                    onClick={fetchTickets}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} /> 重新整理
                </button>
            </div>

            <div className="card" style={{ marginBottom: '30px' }}>
                <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '20px' }}>遊戲控制</h2>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <button
                        onClick={() => handleAction('啟動遊戲')}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#22C55E' }}
                    >
                        <Play size={18} /> 啟動遊戲
                    </button>
                    <button
                        onClick={() => handleAction('抽大獎')}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EAB308' }}
                    >
                        <Trophy size={18} /> 抽大獎
                    </button>
                    <button
                        onClick={() => handleAction('關閉遊戲')}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EF4444' }}
                    >
                        <Square size={18} /> 關閉遊戲
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                        <label style={{ color: '#B0B0B0', fontSize: '14px' }}>輸入獎品內容</label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="例如: 威秀電影票兩張"
                            className="form-input"
                            style={{ padding: '10px' }}
                        />
                    </div>
                    <button
                        onClick={() => handleAction('捐出獎品', inputValue)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Gift size={18} /> 捐出獎品
                    </button>
                    <button
                        onClick={() => handleAction('新增獎品', inputValue)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8B5CF6' }}
                    >
                        <PlusCircle size={18} /> 新增獎品
                    </button>
                </div>
            </div>

            <div className="card">
                <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '20px' }}>獎品列表</h2>

                {loading ? (
                    <div style={{ color: '#B0B0B0', textAlign: 'center', padding: '40px' }}>載入中...</div>
                ) : error ? (
                    <div style={{ color: '#EF4444', textAlign: 'center', padding: '40px' }}>{error}</div>
                ) : tickets.length === 0 ? (
                    <div style={{ color: '#B0B0B0', textAlign: 'center', padding: '40px' }}>目前沒有獎品資料</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #333' }}>
                                    <th style={{ textAlign: 'left', padding: '15px', color: '#B0B0B0' }}>ID</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: '#B0B0B0' }}>獎品名稱</th>
                                    <th style={{ textAlign: 'left', padding: '15px', color: '#B0B0B0' }}>中獎使用者 (User ID)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((ticket) => (
                                    <tr key={ticket.id} style={{ borderBottom: '1px solid #222' }}>
                                        <td style={{ padding: '15px', color: 'white' }}>{ticket.id}</td>
                                        <td style={{ padding: '15px', color: 'white' }}>{ticket.name}</td>
                                        <td style={{ padding: '15px', color: '#EAB308', fontFamily: 'monospace' }}>{ticket.user_id || '尚未有人中獎'}</td>
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
