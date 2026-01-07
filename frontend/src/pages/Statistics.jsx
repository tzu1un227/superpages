import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api';
import { BarChart3, Users, MessageSquare, TrendingUp, CheckCircle2, Circle } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

function Statistics() {
    const [data, setData] = useState({ follow: [], user: [], message: [] });
    const [loading, setLoading] = useState(true);
    const [startTime, setStartTime] = useState('2025-05-01');
    const [endTime, setEndTime] = useState(new Date().toISOString().split('T')[0]);
    const [groupUnit, setGroupUnit] = useState('day');
    const [activeCategory, setActiveCategory] = useState('message');
    const [selectedTags, setSelectedTags] = useState([]);

    const fetchStats = useCallback(async () => {
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

            // Auto-select all tags initially when data is fetched
            const currentData = resp.data[activeCategory] || [];
            const tags = [...new Set(currentData.map(item => item.tag))];
            setSelectedTags(tags);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    }, [startTime, endTime, groupUnit, activeCategory]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Available tags for the active category
    const availableTags = useMemo(() => {
        const currentData = data[activeCategory] || [];
        return [...new Set(currentData.map(item => item.tag))];
    }, [data, activeCategory]);

    // Data formatted for Recharts
    const chartData = useMemo(() => {
        const currentData = data[activeCategory] || [];
        const groupMap = {};

        currentData.forEach(item => {
            if (!groupMap[item.group_key]) {
                groupMap[item.group_key] = { name: item.group_key };
            }
            if (selectedTags.includes(item.tag)) {
                groupMap[item.group_key][item.tag] = item.tag_count;
            }
        });

        return Object.values(groupMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [data, activeCategory, selectedTags]);

    const handleTagToggle = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleSelectAll = () => {
        if (selectedTags.length === availableTags.length) {
            setSelectedTags([]);
        } else {
            setSelectedTags(availableTags);
        }
    };

    const getSum = (arr) => arr.reduce((acc, curr) => acc + (curr.tag_count || 0), 0);

    const categoryMap = {
        'message': { label: '總訊息量', key: 'message', color: '#2196F3' },
        'follow': { label: '總客戶數', key: 'follow', color: '#FFD700' },
        'user': { label: '有效好友數', key: 'user', color: '#4CAF50' }
    };

    // Color palette for multiple lines
    const colors = [
        '#2196F3', '#4CAF50', '#FFD700', '#F44336', '#9C27B0',
        '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63'
    ];

    const StatCard = ({ title, value, icon: Component, color }) => (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ backgroundColor: `${color}22`, padding: '15px', borderRadius: '12px' }}>
                <Component size={32} style={{ color: color }} />
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

            <div className="card" style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <BarChart3 size={20} className="text-yellow" /> 趨勢分析
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '14px', color: '#B0B0B0' }}>指標分類：</label>
                        <select
                            className="input"
                            value={activeCategory}
                            onChange={(e) => {
                                setActiveCategory(e.target.value);
                                // Refresh selected tags for the new category
                                const tags = [...new Set(data[e.target.value]?.map(item => item.tag) || [])];
                                setSelectedTags(tags);
                            }}
                            style={{ padding: '5px 10px', width: '150px', background: '#222', border: '1px solid #333', color: '#fff' }}
                        >
                            {Object.entries(categoryMap).map(([key, info]) => (
                                <option key={key} value={key}>{info.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '15px', background: '#1a1a1a', borderRadius: '8px' }}>
                    <div
                        onClick={handleSelectAll}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                            padding: '6px 12px', borderRadius: '20px',
                            background: selectedTags.length === availableTags.length ? '#333' : 'transparent',
                            border: '1px solid #444', transition: 'all 0.2s'
                        }}
                    >
                        {selectedTags.length === availableTags.length ? <CheckCircle2 size={16} className="text-yellow" /> : <Circle size={16} />}
                        <span style={{ fontSize: '13px' }}>全選</span>
                    </div>
                    {availableTags.map((tag, idx) => (
                        <div
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                padding: '6px 12px', borderRadius: '20px',
                                background: selectedTags.includes(tag) ? `${colors[idx % colors.length]}22` : 'transparent',
                                border: `1px solid ${selectedTags.includes(tag) ? colors[idx % colors.length] : '#444'}`,
                                transition: 'all 0.2s'
                            }}
                        >
                            {selectedTags.includes(tag) ? <CheckCircle2 size={16} style={{ color: colors[idx % colors.length] }} /> : <Circle size={16} />}
                            <span style={{ fontSize: '13px' }}>{tag}</span>
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>載入中...</div>
                ) : chartData.length > 0 ? (
                    <div style={{ height: '400px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="name" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: '#222', border: '1px solid #444', color: '#fff' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Legend />
                                {availableTags.map((tag, idx) => (
                                    selectedTags.includes(tag) && (
                                        <Line
                                            key={tag}
                                            type="monotone"
                                            dataKey={tag}
                                            stroke={colors[idx % colors.length]}
                                            activeDot={{ r: 8 }}
                                            strokeWidth={2}
                                        />
                                    )
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        此範圍內或勾選標籤下無數據
                    </div>
                )}
            </div>

            <div className="card">
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>數據詳情</h3>
                </div>
                <div style={{ padding: '0px', overflowX: 'auto' }}>
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
                                data[activeCategory]
                                    .filter(item => selectedTags.includes(item.tag))
                                    .map((item, idx) => (
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
            </div>
        </div>
    );
}

export default Statistics;
