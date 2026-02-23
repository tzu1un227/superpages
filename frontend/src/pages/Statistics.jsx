import React, { useState, useEffect } from 'react';
import api from '../api';
import {
    Users,
    TrendingUp,
    MessageSquare,
    Download,
    ChevronLeft,
    ChevronRight,
    Filter,
    CheckCircle2,
    Circle,
    BarChart3
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { downloadCSV } from '../utils/csvUtils';

const StatCard = ({ title, value, icon: Component, color }) => (
    <div style={{
        background: '#222', padding: '20px', borderRadius: '12px', border: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: '20px'
    }}>
        <div style={{ backgroundColor: `${color}22`, padding: '15px', borderRadius: '12px' }}>
            <Component size={32} style={{ color: color }} />
        </div>
        <div>
            <p style={{ color: '#B0B0B0', fontSize: '14px', marginBottom: '5px' }}>{title}</p>
            <h3 style={{ fontSize: '28px', fontWeight: 'bold' }}>{value.toLocaleString()}</h3>
        </div>
    </div>
);

const Statistics = () => {
    const [globalData, setGlobalData] = useState({ follow: [], user: [], message: [], total_counts: {} });
    const [lineInsight, setLineInsight] = useState(null);
    const [keywordData, setKeywordData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statsDateRange, setStatsDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [groupUnit, setGroupUnit] = useState('day');
    const [activeCategory, setActiveCategory] = useState('message');
    const [selectedTags, setSelectedTags] = useState([]);
    const [keywordPage, setKeywordPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const categoryMap = {
        'message': { label: '總訊息量', key: 'message', color: '#2196F3' },
        'follow': { label: '新增好友數', key: 'follow', color: '#FFD700' },
        'user': { label: '有效好友數', key: 'user', color: '#4CAF50' }
    };

    const colors = [
        '#2196F3', '#4CAF50', '#FFD700', '#F44336', '#9C27B0',
        '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63'
    ];

    useEffect(() => {
        fetchStats();
    }, [statsDateRange, groupUnit]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const resp = await api.get('/statistics', {
                params: {
                    start_time: statsDateRange.start,
                    end_time: statsDateRange.end,
                    group_unit: groupUnit
                }
            });
            setGlobalData(resp.data);
            setLineInsight(resp.data.line_insight);

            const kwResp = await api.get('/statistics/keywords', {
                params: {
                    start_time: statsDateRange.start,
                    end_time: statsDateRange.end,
                    limit: 100
                }
            });
            setKeywordData(kwResp.data);
            setKeywordPage(1);

            // Auto-select tags if category changes or data loaded
            const currentData = resp.data[activeCategory] || [];
            const tags = [...new Set(currentData.map(item => item.tag))];
            setSelectedTags(tags);
        } catch (err) {
            console.error('Error fetching global stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const availableTags = React.useMemo(() => {
        const currentData = globalData[activeCategory] || [];
        return [...new Set(currentData.map(item => item.tag))];
    }, [globalData, activeCategory]);

    const chartData = React.useMemo(() => {
        const currentData = globalData[activeCategory] || [];
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
    }, [globalData, activeCategory, selectedTags]);

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

    const getGlobalSum = (arr) => (arr || []).reduce((acc, curr) => acc + (curr.tag_count || 0), 0);

    const handleDownloadTrend = () => {
        const currentData = globalData[activeCategory] || [];
        const filteredData = currentData.filter(item => selectedTags.includes(item.tag));
        const formattedData = filteredData.map(item => ({
            '時間範圍': item.group_key,
            '標籤': item.tag,
            '分類': categoryMap[activeCategory].label,
            '數值': item.tag_count
        }));
        downloadCSV(formattedData, `trend_analysis_${statsDateRange.start}_${statsDateRange.end}.csv`);
    };

    const handleDownloadKeywords = () => {
        const formattedData = keywordData.map(item => ({
            '關鍵字': item.keyword,
            '出現次數': item.count
        }));
        downloadCSV(formattedData, `keyword_ranking_${statsDateRange.start}_${statsDateRange.end}.csv`);
    };

    return (
        <div className="container py-8 px-4" style={{ maxWidth: '1400px', margin: '0 auto', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>綜合數據分析</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#B0B0B0' }}>統計單位:</span>
                        <select
                            className="input"
                            value={groupUnit}
                            onChange={(e) => setGroupUnit(e.target.value)}
                            style={{ padding: '6px 12px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                        >
                            <option value="day">日</option>
                            <option value="week">週</option>
                            <option value="month">月</option>
                            <option value="year">年</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', color: '#B0B0B0' }}>時間範圍:</span>
                        <input
                            type="date"
                            value={statsDateRange.start}
                            onChange={e => setStatsDateRange({ ...statsDateRange, start: e.target.value })}
                            style={{ padding: '6px 10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                        />
                        <span style={{ color: '#666' }}>~</span>
                        <input
                            type="date"
                            value={statsDateRange.end}
                            onChange={e => setStatsDateRange({ ...statsDateRange, end: e.target.value })}
                            style={{ padding: '6px 10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <StatCard
                    title="總好友數"
                    value={lineInsight?.followers || 0}
                    icon={Users}
                    color="#FF5722"
                />
                <StatCard
                    title="有效好友數"
                    value={globalData.total_counts?.user || 0}
                    icon={TrendingUp}
                    color="#4CAF50"
                />
                <StatCard title="新增好友數" value={globalData.total_counts?.follow || 0} icon={TrendingUp} color="#FFD700" />
                <StatCard title="總訊息量" value={globalData.total_counts?.message || 0} icon={MessageSquare} color="#2196F3" />
            </div>

            <div className="card" style={{ marginBottom: '40px', padding: '25px', background: 'var(--secondary-black)', borderRadius: '16px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, fontSize: '20px' }}>
                        <BarChart3 size={24} className="text-yellow" /> 趨勢變化分析
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '14px', color: '#B0B0B0' }}>指標分類：</label>
                            <select
                                className="input"
                                value={activeCategory}
                                onChange={(e) => {
                                    const newCat = e.target.value;
                                    setActiveCategory(newCat);
                                    const tags = [...new Set(globalData[newCat]?.map(item => item.tag) || [])];
                                    setSelectedTags(tags);
                                }}
                                style={{ padding: '6px 12px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                            >
                                {Object.entries(categoryMap).map(([key, info]) => (
                                    <option key={key} value={key}>{info.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleDownloadTrend}
                            className="secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #444' }}
                        >
                            <Download size={18} /> 下載 CSV 報表
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '15px', background: '#111', borderRadius: '12px' }}>
                    <div
                        onClick={handleSelectAll}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                            padding: '6px 14px', borderRadius: '25px',
                            background: selectedTags.length === availableTags.length ? '#333' : 'transparent',
                            border: '1px solid #444', transition: 'all 0.2s', fontSize: '14px'
                        }}
                    >
                        {selectedTags.length === availableTags.length ? <CheckCircle2 size={16} className="text-yellow" /> : <Circle size={16} />}
                        <span>全選標籤</span>
                    </div>
                    {availableTags.map((tag, idx) => (
                        <div
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                padding: '6px 14px', borderRadius: '25px',
                                background: selectedTags.includes(tag) ? `${colors[idx % colors.length]}22` : 'transparent',
                                border: `1px solid ${selectedTags.includes(tag) ? colors[idx % colors.length] : '#444'}`,
                                transition: 'all 0.2s', fontSize: '14px'
                            }}
                        >
                            {selectedTags.includes(tag) ? <CheckCircle2 size={16} style={{ color: colors[idx % colors.length] }} /> : <Circle size={16} />}
                            <span>{tag}</span>
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        數據加載中...
                    </div>
                ) : chartData.length > 0 ? (
                    <div style={{ height: '450px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="name" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: '#222', border: '1px solid #444', color: '#fff' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                {availableTags.map((tag, idx) => (
                                    selectedTags.includes(tag) && (
                                        <Line
                                            key={tag}
                                            type="monotone"
                                            dataKey={tag}
                                            stroke={colors[idx % colors.length]}
                                            activeDot={{ r: 6 }}
                                            strokeWidth={3}
                                            dot={{ r: 4 }}
                                        />
                                    )
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        此時段內無相關統計數據
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '25px', background: 'var(--secondary-black)', borderRadius: '16px', border: '1px solid #333' }}>
                <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px' }}>
                        <MessageSquare size={24} className="text-yellow" /> 用戶熱門關鍵字 (Top {keywordData.length})
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {Math.ceil(keywordData.length / ITEMS_PER_PAGE) > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', padding: '6px', borderRadius: '10px' }}>
                                <button
                                    onClick={() => setKeywordPage(p => Math.max(1, p - 1))}
                                    disabled={keywordPage === 1}
                                    style={{ background: 'transparent', border: 'none', color: keywordPage === 1 ? '#444' : '#fff', cursor: keywordPage === 1 ? 'default' : 'pointer' }}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span style={{ fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
                                    {keywordPage} / {Math.ceil(keywordData.length / ITEMS_PER_PAGE)}
                                </span>
                                <button
                                    onClick={() => setKeywordPage(p => Math.min(Math.ceil(keywordData.length / ITEMS_PER_PAGE), p + 1))}
                                    disabled={keywordPage === Math.ceil(keywordData.length / ITEMS_PER_PAGE)}
                                    style={{ background: 'transparent', border: 'none', color: keywordPage === Math.ceil(keywordData.length / ITEMS_PER_PAGE) ? '#444' : '#fff', cursor: keywordPage === Math.ceil(keywordData.length / ITEMS_PER_PAGE) ? 'default' : 'pointer' }}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={handleDownloadKeywords}
                            className="secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #444' }}
                        >
                            <Download size={18} /> 下載排名報表
                        </button>
                    </div>
                </div>
                {loading ? (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        數據加載中...
                    </div>
                ) : keywordData.length > 0 ? (
                    <div style={{ height: '450px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={keywordData.slice((keywordPage - 1) * ITEMS_PER_PAGE, keywordPage * ITEMS_PER_PAGE)}
                                margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#888" fontSize={12} />
                                <YAxis dataKey="keyword" type="category" width={100} stroke="#888" fontSize={12} />
                                <Tooltip
                                    cursor={{ fill: '#ffffff11' }}
                                    contentStyle={{ background: '#222', border: '1px solid #444', color: '#fff' }}
                                />
                                <Bar dataKey="count" fill="#FFD700" radius={[0, 6, 6, 0]} barSize={24} name="出現次數" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                        此範圍內查無關鍵字紀錄
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;
