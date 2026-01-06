import api from '../api';
import { BarChart3, Users, MessageSquare, TrendingUp } from 'lucide-react';

function Statistics() {
    const [data, setData] = useState({ follow: [], user: [], message: [] });
    const [loading, setLoading] = useState(true);
    const [startTime, setStartTime] = useState('2025-05-01');
    const [endTime, setEndTime] = useState(new Date().toISOString().split('T')[0]);
    const [groupUnit, setGroupUnit] = useState('day');
    const [activeCategory, setActiveCategory] = useState('message');

    useEffect(() => {
        fetchStats();
    }, [startTime, endTime, groupUnit]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/api/statistics', {
                params: {
                    start_time: startTime,
                    end_time: endTime,
                    group_unit: groupUnit
                }
            });
            setData(resp.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const getSum = (arr) => arr.reduce((acc, curr) => acc + (curr.tag_count || 0), 0);

    const categoryMap = {
        'message': { label: '總訊息量', key: 'message' },
        'follow': { label: '總客戶數', key: 'follow' },
        'user': { label: '有效好友數', key: 'user' }
    };

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ backgroundColor: `${color}22`, padding: '15px', borderRadius: '12px' }}>
                <Icon size={32} style={{ color: color }} />
            </div>
            <div>
                <p style={{ color: '#B0B0B0', fontSize: '14px', marginBottom: '5px' }}>{title}</p>
                <h3 style={{ fontSize: '28px', fontWeight: 'bold' }}>{value.toLocaleString()}</h3>
            </div>
        </div>
    );

    return (
        <div>
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>綜合數據</h1>
                    <p style={{ color: '#B0B0B0' }}>追蹤您的 LINE 官方帳號關鍵指標與統計數據</p>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '12px', color: '#B0B0B0' }}>開始時間</label>
                        <input
                            type="date"
                            className="input"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            style={{ padding: '8px', width: '150px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '12px', color: '#B0B0B0' }}>結束時間</label>
                        <input
                            type="date"
                            className="input"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            style={{ padding: '8px', width: '150px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontSize: '12px', color: '#B0B0B0' }}>統計單位</label>
                        <select
                            className="input"
                            value={groupUnit}
                            onChange={(e) => setGroupUnit(e.target.value)}
                            style={{ padding: '8px', width: '100px' }}
                        >
                            <option value="day">日</option>
                            <option value="week">週</option>
                            <option value="month">月</option>
                            <option value="year">年</option>
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginBottom: '40px' }}>
                <StatCard title="總客戶數" value={getSum(data.follow)} icon={Users} color="#FFD700" />
                <StatCard title="有效好友數" value={getSum(data.user)} icon={TrendingUp} color="#4CAF50" />
                <StatCard title="總訊息量" value={getSum(data.message)} icon={MessageSquare} color="#2196F3" />
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <BarChart3 size={20} className="text-yellow" /> 趨勢分析
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '14px', color: '#B0B0B0' }}>指標分類：</label>
                        <select
                            className="input"
                            value={activeCategory}
                            onChange={(e) => setActiveCategory(e.target.value)}
                            style={{ padding: '5px 10px', width: '150px', background: '#222', border: '1px solid #333', color: '#fff' }}
                        >
                            {Object.entries(categoryMap).map(([key, info]) => (
                                <option key={key} value={key}>{info.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>載入中...</div>
                ) : (
                    <div style={{ padding: '20px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #333', textAlign: 'left' }}>
                                    <th style={{ padding: '12px' }}>時間範圍</th>
                                    <th style={{ padding: '12px' }}>標籤</th>
                                    <th style={{ padding: '12px' }}>指標分類</th>
                                    <th style={{ padding: '12px' }}>數值</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data[activeCategory]?.length > 0 ? (
                                    data[activeCategory].map((item, idx) => (
                                        <tr key={`${activeCategory}-${idx}`} style={{ borderBottom: '1px solid #222' }}>
                                            <td style={{ padding: '12px' }}>{item.group_key}</td>
                                            <td style={{ padding: '12px' }}>{item.tag}</td>
                                            <td style={{ padding: '12px' }}>{categoryMap[activeCategory].label}</td>
                                            <td style={{ padding: '12px' }}>{item.tag_count}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                            此範圍內無數據
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Statistics;
