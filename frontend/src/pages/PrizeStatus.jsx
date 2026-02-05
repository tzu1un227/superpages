import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Play, Trophy, Square, Gift, PlusCircle, RefreshCw, Trash2, Users, Receipt } from 'lucide-react';

const PrizeStatus = () => {
    const location = useLocation();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [idInput, setIdInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [gameStatus, setGameStatus] = useState('UNKNOWN');
    const [activeTab, setActiveTab] = useState('prizes'); // 'prizes' or 'users'
    const [registeredUsers, setRegisteredUsers] = useState([]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await api.get('/tickets');
            setTickets(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching tickets:', err);
            setError('無法取得獎品資料');
        } finally {
            setLoading(false);
        }
    };

    const fetchGameStatus = async () => {
        try {
            const response = await api.get('/game-status');
            setGameStatus(response.data.status);
        } catch (err) {
            console.error('Error fetching game status:', err);
        }
    };

    const fetchRegisteredUsers = async () => {
        try {
            const response = await api.get('/registered-users?source=person_table');
            setRegisteredUsers(response.data);
        } catch (err) {
            console.error('Error fetching registered users:', err);
        }
    };



    const handleDeleteTicket = async (id) => {
        if (!window.confirm('確定要刪除此獎品嗎？')) return;
        try {
            await api.delete(`/tickets/${id}`);
            fetchTickets(); // Refresh list
        } catch (err) {
            console.error('Error deleting ticket:', err);
            alert('刪除失敗');
        }
    };

    useEffect(() => {
        setTickets([]);
        fetchTickets();
        fetchGameStatus();
        fetchRegisteredUsers();
        const interval = setInterval(fetchGameStatus, 5000);
        return () => clearInterval(interval);
    }, [location.pathname]);

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
                alert('請輸入獎品名稱');
                return;
            }
            message = `新增獎品|${content}`;
        }

        try {
            await api.post('/trigger', {
                user: 'yzuadmin',
                message: message,
                api_index: 0,
                type: 'Message'
            });
            alert(`已發送指令: ${message}`);
            if (actionType === '捐出獎品') {
                setIdInput('');
            } else if (actionType === '新增獎品') {
                setNameInput('');
            }

            // Wait a moment for backend/socket to process, then refresh status
            setTimeout(() => {
                fetchGameStatus();
                fetchTickets(); // Also refresh tickets as they might change
            }, 1000);
        } catch (err) {
            console.error('Error triggering action:', err);
            alert('發生錯誤: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>抽獎管理</h1>
                    <div style={{
                        padding: '4px 12px',
                        borderRadius: '16px',
                        backgroundColor: gameStatus === 'RUN' || gameStatus === 'RUNNING' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: gameStatus === 'RUN' || gameStatus === 'RUNNING' ? '#22C55E' : '#EF4444',
                        border: `1px solid ${gameStatus === 'RUN' || gameStatus === 'RUNNING' ? '#22C55E' : '#EF4444'}`,
                        fontSize: '14px',
                        fontWeight: '500'
                    }}>
                        {gameStatus === 'RUN' || gameStatus === 'RUNNING' ? '遊戲進行中' : '遊戲未開始'}
                    </div>
                </div>
                <button
                    onClick={fetchTickets}
                    className="secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} /> 重新整理
                </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #333' }}>
                <button
                    onClick={() => setActiveTab('prizes')}
                    style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'prizes' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'prizes' ? 'white' : '#B0B0B0',
                        padding: '10px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px'
                    }}
                >
                    <Receipt size={18} /> 獎品狀態
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'users' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: activeTab === 'users' ? 'white' : '#B0B0B0',
                        padding: '10px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '16px'
                    }}
                >
                    <Users size={18} /> 已註冊名單 ({registeredUsers.length})
                </button>
            </div>

            {
                activeTab === 'prizes' ? (
                    <>
                        <div className="card" style={{ marginBottom: '30px' }}>
                            <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>遊戲控制</h3>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px', borderBottom: '1px solid #333', pb: '30px' }}>
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

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                                {/* Donate Prize Group */}
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', backgroundColor: '#181818', padding: '15px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                        <label style={{ color: '#B0B0B0', fontSize: '13px' }}>捐出獎品 (輸入 ID)</label>
                                        <input
                                            type="text"
                                            value={idInput}
                                            onChange={(e) => setIdInput(e.target.value)}
                                            placeholder="例如: 1"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleAction('捐出獎品', idInput)}
                                        className="primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Gift size={18} /> 捐出獎品
                                    </button>
                                </div>

                                {/* Add Prize Group */}
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', backgroundColor: '#181818', padding: '15px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                        <label style={{ color: '#B0B0B0', fontSize: '13px' }}>新增獎品 (輸入名稱)</label>
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            placeholder="例如: 驚喜禮包"
                                            style={{ width: '100%' }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleAction('新增獎品', nameInput)}
                                        className="primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#8B5CF6', color: 'white', border: 'none' }}
                                    >
                                        <PlusCircle size={18} /> 新增獎品
                                    </button>
                                </div>
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
                                                <th style={{ textAlign: 'center', width: '80px' }}>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tickets.map((ticket) => (
                                                <tr key={ticket.id}>
                                                    <td style={{ fontWeight: '600' }}>{ticket.id}</td>
                                                    <td>{ticket.name}</td>
                                                    <td style={{ color: 'var(--primary-yellow)', fontFamily: 'monospace' }}>{ticket.user_id || '尚未有人中獎'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => handleDeleteTicket(ticket.id)}
                                                            className="icon-btn danger"
                                                            title="刪除"
                                                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="card">
                        <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>已註冊名單</h3>
                        {registeredUsers.length === 0 ? (
                            <div style={{ color: '#B0B0B0', textAlign: 'center', padding: '40px' }}>目前沒有已註冊的使用者</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                                {registeredUsers.map((user) => (
                                    <div key={user.user_id} style={{
                                        backgroundColor: '#181818',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{user.name}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default PrizeStatus;
