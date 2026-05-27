import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
    BarChart3,
    Send,
    Tag
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

const parseTags = (tagStr) => {
    if (!tagStr) return ['未分類'];
    let str = tagStr;
    if (typeof str !== 'string') {
        if (Array.isArray(str)) return str.map(String);
        str = String(str);
    }
    let tagList = [];
    if (str.startsWith('[') && str.endsWith(']')) {
        try {
            tagList = JSON.parse(str.replace(/'/g, '"'));
            if (!Array.isArray(tagList)) tagList = [tagList];
        } catch (e) {
            tagList = str.replace(/[\[\]"']/g, '').split(',').map(t => t.trim());
        }
    } else if (str.includes('|')) {
        tagList = str.split('|').map(t => t.trim());
    } else {
        tagList = [str.trim()];
    }
    return tagList.filter(Boolean);
};


const StatCard = ({ title, value, loading, icon: Component, color }) => (
    <div style={{
        background: '#222', padding: '20px', borderRadius: '12px', border: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: '20px'
    }}>
        <div style={{ backgroundColor: `${color}22`, padding: '15px', borderRadius: '12px' }}>
            <Component size={32} style={{ color: color }} />
        </div>
        <div style={{ flex: 1 }}>
            <p style={{ color: '#B0B0B0', fontSize: '14px', marginBottom: '5px' }}>{title}</p>
            {loading ? (
                <div style={{
                    width: '80px',
                    height: '34px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s infinite ease-in-out'
                }}>
                    <style>{`
                        @keyframes pulse {
                            0% { opacity: 1; }
                            50% { opacity: 0.5; }
                            100% { opacity: 1; }
                        }
                    `}</style>
                </div>
            ) : (
                <h3 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </h3>
            )}
        </div>
    </div>
);

const Statistics = () => {
    const { oaId } = useParams();
    const [globalData, setGlobalData] = useState({ follow: [], user: [], message: [], total_counts: {} });
    const [lineInsight, setLineInsight] = useState(null);
    const [quotaConsumption, setQuotaConsumption] = useState(null);
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

    // 關鍵字排行標籤篩選狀態
    const [keywordTag, setKeywordTag] = useState('');  // '' = 全部
    const [keywordAvailableTags, setKeywordAvailableTags] = useState([]);
    const [keywordLoading, setKeywordLoading] = useState(false);

    const categoryMap = {
        'message': { label: '總訊息量', key: 'message', color: '#2196F3' },
        'follow': { label: '新增好友數', key: 'follow', color: '#FFD700' },
        'unfollow': { label: '封鎖/解除數', key: 'unfollow', color: '#F44336' },
        'user': { label: '有效好友數', key: 'user', color: '#4CAF50' }
    };

    const colors = [
        '#2196F3', '#4CAF50', '#FFD700', '#F44336', '#9C27B0',
        '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63'
    ];

    // 初次載入時抓取可用標籤列表
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const resp = await api.get('/tags');
                setKeywordAvailableTags(resp.data || []);
            } catch (err) {
                console.error('Error fetching tags for keyword filter:', err);
            }
        };
        fetchTags();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [statsDateRange, groupUnit, oaId]);

    // 關鍵字排行：當標籤篩選或日期範圍變化時重新抓取
    useEffect(() => {
        fetchKeywords();
    }, [keywordTag, statsDateRange, oaId]);

    const fetchKeywords = async () => {
        setKeywordLoading(true);
        try {
            const params = {
                start_time: statsDateRange.start,
                end_time: statsDateRange.end,
                limit: 100
            };
            if (keywordTag) params.tag = keywordTag;
            const kwResp = await api.get('/statistics/keywords', { params });
            setKeywordData(kwResp.data);
            setKeywordPage(1);
        } catch (err) {
            console.error('Error fetching keywords:', err);
        } finally {
            setKeywordLoading(false);
        }
    };

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
            setQuotaConsumption(resp.data.quota_consumption);

            // Auto-select tags if category changes or data loaded
            const currentData = resp.data[activeCategory] || [];
            const tags = new Set();
            currentData.forEach(item => {
                parseTags(item.tag).forEach(t => tags.add(t));
            });
            setSelectedTags([...tags]);
        } catch (err) {
            console.error('Error fetching global stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const parsedCategoryData = React.useMemo(() => {
        const rawData = globalData[activeCategory] || [];
        const processed = [];
        rawData.forEach(item => {
            const tags = parseTags(item.tag);
            tags.forEach(t => {
                processed.push({ ...item, tag: t });
            });
        });
        return processed;
    }, [globalData, activeCategory]);

    const availableTags = React.useMemo(() => {
        return [...new Set(parsedCategoryData.map(item => item.tag))];
    }, [parsedCategoryData]);

    const chartData = React.useMemo(() => {
        const groupMap = {};

        parsedCategoryData.forEach(item => {
            if (!groupMap[item.group_key]) {
                groupMap[item.group_key] = { name: item.group_key };
            }
            if (selectedTags.includes(item.tag)) {
                // Sum counts in case multiple items resolve to the same tag on the same date
                groupMap[item.group_key][item.tag] = (groupMap[item.group_key][item.tag] || 0) + item.tag_count;
            }
        });

        return Object.values(groupMap).sort((a, b) => a.name.localeCompare(b.name));
    }, [parsedCategoryData, selectedTags]);

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
        const filteredData = parsedCategoryData.filter(item => selectedTags.includes(item.tag));
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
                    loading={loading}
                    icon={Users}
                    color="#FF5722"
                />
                <StatCard title="有效好友數" value={globalData.total_counts?.user || 0} loading={loading} icon={TrendingUp} color="#4CAF50" />
                <StatCard title="本月推播用量" value={quotaConsumption?.totalUsage !== undefined ? quotaConsumption.totalUsage : '-'} loading={loading} icon={Send} color="#9C27B0" />
                <StatCard title="新增好友數" value={globalData.total_counts?.follow || 0} loading={loading} icon={TrendingUp} color="#FFD700" />
                <StatCard title="封鎖/解除數" value={globalData.total_counts?.unfollow || 0} loading={loading} icon={Users} color="#F44336" />
                <StatCard title="總訊息量" value={globalData.total_counts?.message || 0} loading={loading} icon={MessageSquare} color="#2196F3" />
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
                                    const rawData = globalData[newCat] || [];
                                    const tags = new Set();
                                    rawData.forEach(item => {
                                        parseTags(item.tag).forEach(t => tags.add(t));
                                    });
                                    setSelectedTags([...tags]);
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
                <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                {/* 關鍵字排行標籤篩選區 */}
                {keywordAvailableTags.length > 0 && (
                    <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px 15px', background: '#111', borderRadius: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '13px', marginRight: '4px' }}>
                            <Tag size={14} /> 標籤篩選：
                        </div>
                        <div
                            onClick={() => setKeywordTag('')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                padding: '5px 14px', borderRadius: '20px',
                                background: !keywordTag ? '#FFD70022' : 'transparent',
                                border: `1px solid ${!keywordTag ? '#FFD700' : '#444'}`,
                                color: !keywordTag ? '#FFD700' : '#aaa',
                                transition: 'all 0.2s', fontSize: '13px'
                            }}
                        >
                            {!keywordTag ? <CheckCircle2 size={14} style={{ color: '#FFD700' }} /> : <Circle size={14} />}
                            全部
                        </div>
                        {keywordAvailableTags.map((tag, idx) => (
                            <div
                                key={tag}
                                onClick={() => setKeywordTag(keywordTag === tag ? '' : tag)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                    padding: '5px 14px', borderRadius: '20px',
                                    background: keywordTag === tag ? `${colors[idx % colors.length]}22` : 'transparent',
                                    border: `1px solid ${keywordTag === tag ? colors[idx % colors.length] : '#444'}`,
                                    color: keywordTag === tag ? colors[idx % colors.length] : '#aaa',
                                    transition: 'all 0.2s', fontSize: '13px'
                                }}
                            >
                                {keywordTag === tag ? <CheckCircle2 size={14} style={{ color: colors[idx % colors.length] }} /> : <Circle size={14} />}
                                {tag}
                            </div>
                        ))}
                        {keywordLoading && (
                            <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>篩選中...</span>
                        )}
                    </div>
                )}
                {(loading || keywordLoading) ? (
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
