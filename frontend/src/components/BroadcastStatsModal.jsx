import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, CircularProgress, Typography, Chip, Tooltip, IconButton, Divider
} from '@mui/material';
import {
    BarChart2, RefreshCcw, X, Users, Eye, MousePointer,
    TrendingUp, Video, ShieldAlert, Tag, GitBranch, ArrowRight
} from 'lucide-react';
import api from '../api';

export default function BroadcastStatsModal({ open, onClose, broadcast }) {
    const [period, setPeriod] = useState('7d');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    const fetchStats = async (selectedPeriod = period, forceRefresh = false) => {
        if (!broadcast || !broadcast.id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/broadcasts/${broadcast.id}/stats`, {
                params: { period: selectedPeriod, refresh: forceRefresh }
            });
            setStats(res.data);
        } catch (err) {
            console.error("Failed to fetch broadcast stats:", err);
            setError(err.response?.data?.error || "讀取統計數據失敗");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && broadcast) {
            fetchStats(period);
        }
    }, [open, broadcast, period]);

    const line = stats?.line_stats || {};
    const crm = stats?.crm_stats || {};

    const formatVal = (val, suffix = '') => {
        if (val === null || val === undefined) return '—';
        return `${typeof val === 'number' ? val.toLocaleString() : val}${suffix}`;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: '#181818',
                    color: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #333'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid #2a2a2a' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <BarChart2 size={24} style={{ color: 'var(--primary-yellow)' }} />
                    <Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>
                            群發數據統計 & 後續轉換紀錄
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888', display: 'flex', alignItems: 'center', gap: 1 }}>
                            {broadcast?.name} • 發送時間：{stats?.sent_at ? new Date(stats.sent_at).toLocaleString() : (broadcast?.scheduled_at ? new Date(broadcast.scheduled_at).toLocaleString() : (broadcast?.created_at ? new Date(broadcast.created_at).toLocaleString() : '—'))}
                            <Chip
                                label={line.api_type === 'unit' ? 'Unit API (推送)' : 'Request ID API (廣播)'}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#aaa', height: '20px', fontSize: '11px' }}
                            />
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: '#888' }}><X size={20} /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ py: 3 }}>
                {/* 期間切換 & 手動刷新 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 1, backgroundColor: '#222', p: '4px', borderRadius: '8px' }}>
                        {[
                            { key: '1d', label: '1天' },
                            { key: '3d', label: '3天' },
                            { key: '7d', label: '7天' },
                            { key: '30d', label: '30天' }
                        ].map(p => (
                            <Button
                                key={p.key}
                                size="small"
                                onClick={() => setPeriod(p.key)}
                                sx={{
                                    bgcolor: period === p.key ? 'var(--primary-yellow)' : 'transparent',
                                    color: period === p.key ? '#000' : '#888',
                                    fontWeight: period === p.key ? 'bold' : 'normal',
                                    minWidth: '60px',
                                    '&:hover': { bgcolor: period === p.key ? 'var(--primary-yellow)' : 'rgba(255,255,255,0.05)' }
                                }}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </Box>
                    <Button
                        size="small"
                        onClick={() => fetchStats(period, true)}
                        disabled={loading}
                        startIcon={<RefreshCcw size={14} />}
                        sx={{ color: '#aaa', border: '1px solid #333' }}
                    >
                        重新抓取數據
                    </Button>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress sx={{ color: 'var(--primary-yellow)' }} />
                    </Box>
                ) : error ? (
                    <Box sx={{ p: 4, bgcolor: 'rgba(255,0,0,0.1)', color: '#ff8888', borderRadius: '8px', textAlign: 'center' }}>
                        {error}
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/*區塊 1: LINE 官方互動 (11 個指標) */}
                        <Box>
                            <Typography variant="subtitle1" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                LINE 官方互動指標 (11 項)
                            </Typography>

                            {/* 4 大基礎人數指標 */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 2 }}>
                                <Box sx={{ bgcolor: '#222', p: 2, borderRadius: '8px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>1. 預估送出人數</Typography>
                                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', mt: 0.5 }}>
                                        {formatVal(line.estimated_send, ' 人')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: '#222', p: 2, borderRadius: '8px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>
                                        2. 實際送達數 {line.api_type === 'unit' && '(不提供)'}
                                    </Typography>
                                    <Typography variant="h5" sx={{ color: line.delivered !== null ? '#4CAF50' : '#666', fontWeight: 'bold', mt: 0.5 }}>
                                        {formatVal(line.delivered, ' 人')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: '#222', p: 2, borderRadius: '8px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>3. 訊息開啟人數</Typography>
                                    <Typography variant="h5" sx={{ color: '#2196F3', fontWeight: 'bold', mt: 0.5 }}>
                                        {formatVal(line.unique_impression, ' 人')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: '#222', p: 2, borderRadius: '8px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>5. 連結點擊人數</Typography>
                                    <Typography variant="h5" sx={{ color: '#FF9800', fontWeight: 'bold', mt: 0.5 }}>
                                        {formatVal(line.unique_click, ' 人')}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* 比率指標列 (4. 開啟率, 6. 點擊率, 7. 開啟後點擊率) */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 2 }}>
                                <Box sx={{ bgcolor: 'rgba(33, 150, 243, 0.08)', p: 2, borderRadius: '8px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                                    <Typography variant="caption" sx={{ color: '#90CAF9' }}>
                                        4. 開啟率 {line.api_type === 'unit' && '(以送出對象為母數)'}
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#90CAF9', fontWeight: 'bold' }}>
                                        {formatVal(line.impression_rate, '%')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: 'rgba(255, 152, 0, 0.08)', p: 2, borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                                    <Typography variant="caption" sx={{ color: '#FFCC80' }}>
                                        6. 點擊率 {line.api_type === 'unit' && '(以送出對象為母數)'}
                                    </Typography>
                                    <Typography variant="h6" sx={{ color: '#FFCC80', fontWeight: 'bold' }}>
                                        {formatVal(line.click_rate, '%')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: 'rgba(156, 39, 176, 0.08)', p: 2, borderRadius: '8px', border: '1px solid rgba(156, 39, 176, 0.2)' }}>
                                    <Typography variant="caption" sx={{ color: '#CE93D8' }}>7. 開啟後點擊率 (CTOR)</Typography>
                                    <Typography variant="h6" sx={{ color: '#CE93D8', fontWeight: 'bold' }}>
                                        {formatVal(line.click_through_open_rate, '%')}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* 影音與參考指標列 (8. 影音播放, 9. 影音完成, 10. 影音完成率, 11. 帳號封鎖變化) */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                                <Box sx={{ bgcolor: '#1e1e1e', p: 1.5, borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                                    <Typography variant="caption" sx={{ color: '#777' }}>8. 影音播放人數</Typography>
                                    <Typography variant="body1" sx={{ color: '#aaa', fontWeight: 'bold' }}>
                                        {formatVal(line.unique_media_played, ' 人')}
                                    </Typography>
                                </Box>
                                <Box sx={{ bgcolor: '#1e1e1e', p: 1.5, borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                                    <Typography variant="caption" sx={{ color: '#777' }}>9. 影音完成播放人數</Typography>
                                    <Typography variant="body1" sx={{ color: '#aaa', fontWeight: 'bold' }}>
                                        {formatVal(line.unique_media_played_100_percent, ' 人')}
                                    </Typography>
                                </Box>
                                <Box sx={{ bgcolor: '#1e1e1e', p: 1.5, borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                                    <Typography variant="caption" sx={{ color: '#777' }}>10. 影音完成率</Typography>
                                    <Typography variant="body1" sx={{ color: '#aaa', fontWeight: 'bold' }}>
                                        {formatVal(line.media_completion_rate, '%')}
                                    </Typography>
                                </Box>
                                <Box sx={{ bgcolor: '#1e1e1e', p: 1.5, borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                                    <Typography variant="caption" sx={{ color: '#777' }}>11. 帳號封鎖數變化 (參考)</Typography>
                                    <Typography variant="body1" sx={{ color: '#aaa', fontWeight: 'bold' }}>
                                        {formatVal(line.block_change, ' 人')}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        <Divider sx={{ borderColor: '#333' }} />

                        {/* 區塊 2: CRM 後續關聯行為 (6 個指標) */}
                        <Box>
                            <Typography variant="subtitle1" sx={{ color: '#4CAF50', fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                CRM 後續關聯行為指標 (6 項)
                            </Typography>

                            {/* 3 大核心轉換卡片 (5. 有後續行為 & 6. 後續行為率, 1. 新增任一標籤, 3. 加入任一旅程) */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                                <Box sx={{ bgcolor: 'rgba(76, 175, 80, 0.12)', p: 2.5, borderRadius: '10px', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                                    <Typography variant="caption" sx={{ color: '#81C784', fontWeight: 'bold' }}>
                                        5 & 6. 有後續行為人數 / 後續行為率
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1 }}>
                                        <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                                            {formatVal(crm.has_behavior_count, ' 人')}
                                        </Typography>
                                        <Typography variant="h6" sx={{ color: '#81C784', fontWeight: 'bold' }}>
                                            ({formatVal(crm.behavior_rate, '%')})
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ bgcolor: '#222', p: 2.5, borderRadius: '10px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>1. 新增任一標籤人數</Typography>
                                    <Typography variant="h4" sx={{ color: '#FFF', fontWeight: 'bold', mt: 1 }}>
                                        {formatVal(crm.tag_any_count, ' 人')}
                                    </Typography>
                                </Box>

                                <Box sx={{ bgcolor: '#222', p: 2.5, borderRadius: '10px', border: '1px solid #333' }}>
                                    <Typography variant="caption" sx={{ color: '#888' }}>3. 加入任一旅程人數</Typography>
                                    <Typography variant="h4" sx={{ color: '#FFF', fontWeight: 'bold', mt: 1 }}>
                                        {formatVal(crm.journey_any_count, ' 人')}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* 2 大內嵌明細數據對應 (2. 各標籤新增人數 & 4. 各旅程加入人數) */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                                {/* 2. 各標籤新增人數明細 */}
                                <Box sx={{ bgcolor: '#1e1e1e', p: 2, borderRadius: '8px', border: '1px solid #2e2e2e' }}>
                                    <Typography variant="body2" sx={{ color: '#ccc', fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Tag size={16} color="#888" /> 2. 各標籤新增人數對應
                                    </Typography>
                                    {crm.tag_breakdown && crm.tag_breakdown.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '180px', overflowY: 'auto' }}>
                                            {crm.tag_breakdown.map((t, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#262626', px: 1.5, py: 1, borderRadius: '4px' }}>
                                                    <Typography variant="caption" sx={{ color: '#eee' }}>{t.tag_name}</Typography>
                                                    <Chip label={`${t.count} 人`} size="small" sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#81C784', height: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>尚無標籤新增紀錄</Typography>
                                    )}
                                </Box>

                                {/* 4. 各旅程加入人數明細 */}
                                <Box sx={{ bgcolor: '#1e1e1e', p: 2, borderRadius: '8px', border: '1px solid #2e2e2e' }}>
                                    <Typography variant="body2" sx={{ color: '#ccc', fontWeight: 'bold', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <GitBranch size={16} color="#888" /> 4. 各旅程加入人數對應
                                    </Typography>
                                    {crm.journey_breakdown && crm.journey_breakdown.length > 0 ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '180px', overflowY: 'auto' }}>
                                            {crm.journey_breakdown.map((j, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#262626', px: 1.5, py: 1, borderRadius: '4px' }}>
                                                    <Typography variant="caption" sx={{ color: '#eee' }}>{j.journey_name}</Typography>
                                                    <Chip label={`${j.count} 人`} size="small" sx={{ bgcolor: 'rgba(33, 150, 243, 0.2)', color: '#90CAF9', height: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic' }}>尚無旅程加入紀錄</Typography>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid #2a2a2a', p: 2 }}>
                <Button onClick={onClose} sx={{ color: '#aaa', fontWeight: 'bold' }}>關閉</Button>
            </DialogActions>
        </Dialog>
    );
}
