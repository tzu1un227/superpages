import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import api from '../api';
import {
    Send, Users, Info, Plus, Search, Filter,
    ChevronRight, ChevronLeft, Save, Trash2, Edit2,
    Eye, Clock, CheckCircle2, FileText, AlertCircle,
    Monitor, Layout, Type, Image as ImageIcon, Video,
    X, Check, ExternalLink, RefreshCcw
} from 'lucide-react';
import {
    Autocomplete, TextField, Chip, Box, CircularProgress,
    Tabs, Tab, Modal, IconButton, Button, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, Divider
} from '@mui/material';
import FlexMessageEditor from '../components/FlexMessageEditor';
import JourneyPreview from '../components/JourneyPreview';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

function Broadcast() {
    const { oaId } = useParams();
    const location = useLocation();
    const { showToast } = useToast();

    // View state
    const [view, setView] = useState('list'); // 'list' or 'create'
    const [listTab, setListTab] = useState('all'); // all, scheduled, draft, sent
    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Wizard state
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        target_type: 'all',
        target_value: '',
        selectedUsers: [],
        messages: [{ OTYPE: 'TextSendMessage', text: '' }],
        send_type: 'immediate',
        scheduled_at: ''
    });

    // Analytics state
    const [stats, setStats] = useState({ count: 0, total: 0, ratio: 0 });
    const [statsLoading, setStatsLoading] = useState(false);

    // Editor state
    const [isFlexEditorOpen, setIsFlexEditorOpen] = useState(false);
    const [editingMsgIndex, setEditingMsgIndex] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    // Separate state for list-view preview
    const [previewBcMessages, setPreviewBcMessages] = useState(null);

    // Data sources
    const [availableTags, setAvailableTags] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);

    useEffect(() => {
        fetchBroadcasts();
        fetchTags();
        fetchUsers();
    }, [oaId, listTab]);

    const fetchBroadcasts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/broadcast/', { params: { status: listTab } });
            setBroadcasts(res.data.broadcasts || []);
        } catch (err) {
            console.error('Error fetching broadcasts:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTags = async () => {
        try {
            const res = await api.get('/tags');
            const uniqueTags = new Set();
            res.data.forEach(t => {
                if (typeof t === 'string') {
                    // Handle potential list formats like ['tag1'] or ["tag1", "tag2"]
                    if (t.startsWith('[') && t.endsWith(']')) {
                        try {
                            // Try JSON parse first
                            const parsed = JSON.parse(t.replace(/'/g, '"'));
                            if (Array.isArray(parsed)) {
                                parsed.forEach(pt => uniqueTags.add(pt.toString().trim()));
                            } else {
                                uniqueTags.add(t.replace(/[\[\]'"]/g, '').trim());
                            }
                        } catch {
                            // Fallback: strip brackets and quotes, then split by comma
                            t.replace(/[\[\]'"]/g, '').split(',').forEach(pt => {
                                if (pt.trim()) uniqueTags.add(pt.trim());
                            });
                        }
                    } else {
                        uniqueTags.add(t.trim());
                    }
                } else if (Array.isArray(t)) {
                    t.forEach(pt => uniqueTags.add(pt.toString().trim()));
                } else if (t) {
                    uniqueTags.add(t.toString().trim());
                }
            });
            setAvailableTags(Array.from(uniqueTags).filter(t => t !== '').sort());
        } catch (err) { console.error('Error fetching tags:', err); }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/registered-users');
            setAvailableUsers(res.data || []);
        } catch (err) { console.error('Error fetching users:', err); }
    };

    useEffect(() => {
        if (view === 'create' && step === 1) {
            const timer = setTimeout(updateStats, 500);
            return () => clearTimeout(timer);
        }
    }, [formData.target_type, formData.target_value, formData.selectedUsers, view]);

    const updateStats = async () => {
        let val = formData.target_value;
        if (formData.target_type === 'ids') {
            val = formData.selectedUsers.map(u => u.user_id).join(',');
        }
        if (formData.target_type !== 'all' && !val) {
            setStats({ count: 0, total: 0, ratio: 0 });
            return;
        }

        setStatsLoading(true);
        try {
            const res = await api.post('/broadcast/audience-count', {
                target_type: formData.target_type,
                target_value: val
            });
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    const handleCreateNew = () => {
        setFormData({
            id: null,
            name: `新群發 ${new Date().toLocaleDateString()}`,
            target_type: 'all',
            target_value: '',
            selectedUsers: [],
            messages: [{ OTYPE: 'TextSendMessage', text: '' }],
            send_type: 'immediate',
            scheduled_at: ''
        });
        setStep(1);
        setView('create');
    };

    const fetchMessagesByTag = async (tag) => {
        try {
            const res = await api.get(`/qa-bank/${tag}`);
            let fetchedMessages = res.data.msg_rpy || [];
            // Normalize messages: ensure they are objects, parse if stringified JSON
            return fetchedMessages.map(m => {
                if (typeof m === 'string') {
                    try { return JSON.parse(m); } catch { return { OTYPE: 'TextSendMessage', text: m }; } // Fallback to text if not valid JSON
                }
                return m;
            });
        } catch (err) {
            console.error('Error fetching messages by tag:', err);
            return [{ OTYPE: 'TextSendMessage', text: '' }];
        }
    };

    const handleEdit = async (bc) => {
        if (bc.status !== 'draft') {
            alert('只有草稿狀態的任務可以編輯');
            return;
        }
        setLoading(true);
        try {
            const messages = bc.message_tag ? await fetchMessagesByTag(bc.message_tag) : [
                { OTYPE: 'TextSendMessage', text: '' }
            ];

            // Backward compatibility and snake_case mapping
            const mappedMessages = messages.map(msg => {
                if (msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage') {
                    return {
                        ...msg,
                        original_content_url: msg.original_content_url || msg.originalUrl || '',
                        preview_image_url: msg.preview_image_url || msg.previewUrl || ''
                    };
                }
                if (msg.OTYPE === 'FlexSendMessage') {
                    return {
                        ...msg,
                        alt_text: msg.alt_text || '您有一則新訊息',
                        contents: msg.contents || (msg.text ? JSON.parse(msg.text) : {})
                    };
                }
                return msg;
            });

            // Map IDs back to full user objects from availableUsers
            let selectedUsers = [];
            if (bc.target_type === 'ids' && bc.target_value) {
                const idList = bc.target_value.split(',');
                selectedUsers = idList.map(id => {
                    const found = availableUsers.find(u => u.user_id === id.trim?.() || u.user_id === id);
                    return found || { user_id: id, name: id };
                });
            }

            setFormData({
                ...bc,
                messages: mappedMessages,
                selectedUsers: selectedUsers,
                send_type: bc.send_type || 'immediate'
            });
            setStep(1);
            setView('create');
        } catch (err) {
            alert('無法載入訊息內容: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewSent = async (bc) => {
        setLoading(true);
        try {
            const messages = bc.message_tag ? await fetchMessagesByTag(bc.message_tag) : [
                { OTYPE: 'TextSendMessage', text: '[無法讀取內容]' }
            ];

            const mappedMessages = messages.map(msg => {
                if (msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage') {
                    return {
                        ...msg,
                        original_content_url: msg.original_content_url || msg.originalUrl || '',
                        preview_image_url: msg.preview_image_url || msg.previewUrl || ''
                    };
                }
                if (msg.OTYPE === 'FlexSendMessage') {
                    return {
                        ...msg,
                        alt_text: msg.alt_text || '您有一則新訊息',
                        contents: msg.contents || (msg.text ? JSON.parse(msg.text) : {})
                    };
                }
                return msg;
            });

            if (view === 'create') {
                // inside the create view, open inline preview
                setFormData({ ...bc, messages: mappedMessages });
                setIsPreviewOpen(true);
            } else {
                // In list view, open detail view (wizard with step 1, read-only)
                const idList = (bc.target_type === 'ids' && bc.target_value) ? bc.target_value.split(',') : [];
                const selectedUsers = idList.map(id => {
                    const found = availableUsers.find(u => u.user_id === id.trim?.() || u.user_id === id);
                    return found || { user_id: id, name: id };
                });

                setFormData({
                    ...bc,
                    messages: mappedMessages,
                    selectedUsers: selectedUsers,
                    send_type: bc.send_type || 'immediate'
                });
                setStep(1);
                setView('create');
            }
        } catch (err) {
            alert('無法載入預覽內容: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此群發記錄嗎？（若為預約中，排程也將一併移除）')) return;
        setLoading(true);
        try {
            await api.delete(`/broadcast/${id}`);
            fetchBroadcasts();
        } catch (err) {
            alert('刪除失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveDraft = async () => {
        setLoading(true);
        try {
            // Reuse existing tag if available, or create a unique one for new broadcasts
            let msgTag = formData.message_tag;
            if (!msgTag) {
                msgTag = `bc_${Date.now()}`;
            }

            // Validation: Comprehensive check for all message types
            for (let i = 0; i < formData.messages.length; i++) {
                const msg = formData.messages[i];
                if (msg.OTYPE === 'TextSendMessage') {
                    if (!msg.text || !msg.text.trim()) {
                        alert(`第 ${i + 1} 則文字訊息內容不能為空`);
                        setLoading(false);
                        return;
                    }
                } else if (msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage' || msg.OTYPE === 'AudioSendMessage') {
                    if (!msg.original_content_url) {
                        alert(`第 ${i + 1} 則訊息網址（URL）不能為空`);
                        setLoading(false);
                        return;
                    }
                } else if (msg.OTYPE === 'FlexSendMessage') {
                    if (!msg.contents || (typeof msg.contents === 'object' && Object.keys(msg.contents).length === 0)) {
                        alert(`第 ${i + 1} 則 Flex 訊息內容未設定`);
                        setLoading(false);
                        return;
                    }
                    // Deep validation for Flex links/return text
                    const contents = msg.contents;
                    const bubbles = contents.type === 'carousel' ? contents.contents : [contents];
                    for (let j = 0; j < bubbles.length; j++) {
                        const bubble = bubbles[j];
                        const bubbleNum = contents.type === 'carousel' ? `卡片 #${j + 1}: ` : '';
                        if (bubble.hero?.action) {
                            const val = bubble.hero.action.uri || bubble.hero.action.data || bubble.hero.action.text || '';
                            if (!val.trim()) {
                                alert(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}圖片點擊內容不能為空`);
                                setLoading(false);
                                return;
                            }
                        }
                        const footerContents = bubble.footer?.contents || [];
                        const buttons = footerContents.filter(c => c.type === 'button');
                        for (let k = 0; k < buttons.length; k++) {
                            const btn = buttons[k];
                            const val = btn.action?.uri || btn.action?.data || btn.action?.text || '';
                            if (!val.trim()) {
                                alert(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}按鈕 #${k + 1} 文字或連結不能為空`);
                                setLoading(false);
                                return;
                            }
                        }
                    }
                }
            }

            await api.post('/qa-bank', {
                tag: msgTag,
                msg_rpy: formData.messages,
                type: 'Sensor'
            });

            const payload = {
                ...formData,
                status: 'draft',
                message_tag: msgTag,
                target_value: formData.target_type === 'ids' ? formData.selectedUsers.map(u => u.user_id).join(',') : formData.target_value
            };

            if (formData.id) {
                await api.put(`/broadcast/${formData.id}`, payload);
            } else {
                const res = await api.post('/broadcast/', payload);
                setFormData({ ...formData, id: res.data.id, message_tag: msgTag });
            }
            showToast('草稿已儲存', 'success');
        } catch (err) {
            showToast('儲存失敗: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const finishBroadcast = async () => {
        if (formData.send_type === 'scheduled' && !formData.scheduled_at) {
            showToast('請選擇預約時間', 'warning');
            return;
        }

        // Validation: Comprehensive check for all message types
        for (let i = 0; i < formData.messages.length; i++) {
            const msg = formData.messages[i];
            if (msg.OTYPE === 'TextSendMessage') {
                if (!msg.text || !msg.text.trim()) {
                    showToast(`第 ${i + 1} 則文字訊息內容不能為空`, 'warning');
                    return;
                }
                if (msg.text.length > 3000) {
                    showToast(`第 ${i + 1} 則文字訊息內容不能超過 3000 字`, 'warning');
                    return;
                }
            } else if (msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage' || msg.OTYPE === 'AudioSendMessage') {
                if (!msg.original_content_url) {
                    showToast(`第 ${i + 1} 則訊息網址（URL）不能為空`, 'warning');
                    return;
                }
            } else if (msg.OTYPE === 'FlexSendMessage') {
                if (!msg.contents || (typeof msg.contents === 'object' && Object.keys(msg.contents).length === 0)) {
                    showToast(`第 ${i + 1} 則 Flex 訊息內容未設定`, 'warning');
                    return;
                }
                // Deep validation for Flex links/return text
                const contents = msg.contents;
                const bubbles = contents.type === 'carousel' ? contents.contents : [contents];
                for (let j = 0; j < bubbles.length; j++) {
                    const bubble = bubbles[j];
                    const bubbleNum = contents.type === 'carousel' ? `卡片 #${j + 1}: ` : '';
                    if (bubble.hero?.action) {
                        const val = bubble.hero.action.uri || bubble.hero.action.data || bubble.hero.action.text || '';
                        if (!val.trim()) {
                            showToast(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}圖片點擊內容不能為空`, 'warning');
                            return;
                        }
                    }
                    const footerContents = bubble.footer?.contents || [];
                    const buttons = footerContents.filter(c => c.type === 'button');
                    for (let k = 0; k < buttons.length; k++) {
                        const btn = buttons[k];
                        const val = btn.action?.uri || btn.action?.data || btn.action?.text || '';
                        if (!val.trim()) {
                            showToast(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}按鈕 #${k + 1} 文字或連結不能為空`, 'warning');
                            return;
                        }
                    }
                }
            }
        }

        setLoading(true);
        try {
            // 1. Save messages to QA_bank (reuse tag)
            const msgTag = formData.message_tag || `bc_${Date.now()}`;
            await api.post('/qa-bank', {
                tag: msgTag,
                msg_rpy: formData.messages,
                type: 'Sensor'
            });

            // 2. Prepare payload
            const payload = {
                ...formData,
                message_tag: msgTag,
                target_value: formData.target_type === 'ids' ? formData.selectedUsers.map(u => u.user_id).join(',') : formData.target_value,
                // Do NOT set status: 'sent' here. Let /execute handle it.
                // If it's sent, the backend execute endpoint will return 400 'already sent'.
                status: formData.send_type === 'scheduled' ? 'scheduled' : (formData.status || 'draft')
            };

            let bcId = formData.id;
            if (bcId) {
                await api.put(`/broadcast/${bcId}`, payload);
            } else {
                const res = await api.post('/broadcast/', payload);
                bcId = res.data.id;
            }

            // 3. Initiate sending/scheduling
            await api.post(`/broadcast/${bcId}/execute`);

            showToast(formData.send_type === 'scheduled' ? '已成功預約發送！' : '群發訊息已成功送出！', 'success');
            setView('list');
            fetchBroadcasts();
        } catch (err) {
            showToast('操作失敗: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    const openMessageEditor = (idx) => {
        setEditingMsgIndex(idx);
        const type = formData.messages[idx].OTYPE;
        if (type === 'FlexSendMessage' || type === 'ImageSendMessage' || type === 'VideoSendMessage') {
            setIsFlexEditorOpen(true);
        }
    };

    const handleFlexSave = (json) => {
        const newMsgs = [...formData.messages];
        if (newMsgs[editingMsgIndex].OTYPE === 'TextSendMessage') return;

        // For Flex, json is the bubble/carousel.
        // For Image/Video, we might just store URLs?
        // Actually FlexMessageEditor handles Flex structure.

        newMsgs[editingMsgIndex] = {
            ...newMsgs[editingMsgIndex],
            contents: JSON.parse(json)
        };
        setFormData({ ...formData, messages: newMsgs });
    };

    const renderStep1 = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div>
                <label className="label">群發名稱</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例如: 2024 春季特賣通知" style={{ width: '100%' }} />
            </div>

            <div>
                <label className="label">選擇發送對象</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    {[
                        { id: 'all', label: '全部好友' },
                        { id: 'tag', label: '標籤受眾' },
                        { id: 'ids', label: '指定用戶' }
                    ].map(type => (
                        <button key={type.id}
                            onClick={() => setFormData({ ...formData, target_type: type.id })}
                            className={formData.target_type === type.id ? 'primary' : 'secondary'}
                            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            {type.id === 'all' ? <Users size={16} /> : type.id === 'tag' ? <Filter size={16} /> : <Search size={16} />}
                            {type.label}
                        </button>
                    ))}
                </div>

                {formData.target_type === 'tag' && (
                    <Autocomplete
                        freeSolo
                        options={availableTags}
                        value={formData.target_value}
                        onChange={(e, val) => setFormData({ ...formData, target_value: val })}
                        onInputChange={(e, val) => setFormData({ ...formData, target_value: val })}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="選擇或搜尋標籤..."
                                sx={{
                                    '& .MuiInputBase-input': { color: '#fff' },
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { borderColor: '#444' },
                                        '&:hover fieldset': { borderColor: '#666' },
                                    }
                                }}
                            />
                        )}
                    />
                )}

                {formData.target_type === 'ids' && (
                    <Autocomplete
                        multiple
                        options={availableUsers}
                        getOptionLabel={(opt) => opt.name || opt.user_id}
                        value={formData.selectedUsers}
                        onChange={(e, val) => setFormData({ ...formData, selectedUsers: val })}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="搜尋並選擇用戶..."
                                sx={{
                                    '& .MuiInputBase-input': { color: '#fff' },
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { borderColor: '#444' },
                                        '&:hover fieldset': { borderColor: '#666' },
                                    }
                                }}
                            />
                        )}
                        renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                                <Chip
                                    variant="outlined"
                                    label={option.name || option.user_id}
                                    {...getTagProps({ index })}
                                    sx={{ color: '#fff', borderColor: '#555' }}
                                />
                            ))
                        }
                    />
                )}
            </div>

            <div style={{ backgroundColor: '#222', padding: '25px', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#B0B0B0' }}><Users size={18} /> 受眾預估</h4>
                    {statsLoading && <CircularProgress size={16} color="inherit" />}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>預計發送人數</p>
                        <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary-yellow)' }}>{stats.count.toLocaleString()}</p>
                    </div>
                    <div>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>好友總數</p>
                        <p style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total.toLocaleString()}</p>
                    </div>
                </div>

                <div style={{ marginTop: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#888' }}>
                        <span>推播覆蓋率</span>
                        <span>{stats.ratio}%</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${stats.ratio}%`,
                            height: '100%',
                            backgroundColor: 'var(--primary-yellow)',
                            transition: 'width 0.5s ease-out'
                        }} />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}><Layout size={20} /> 訊息序列</h3>
                <span style={{ color: '#666', fontSize: '14px' }}>最多 5 則訊息</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {formData.messages.map((msg, idx) => (
                    <div key={idx} className="card" style={{
                        position: 'relative',
                        border: '1px solid #444',
                        padding: '20px',
                        backgroundColor: '#1E1E1E'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    backgroundColor: 'var(--primary-yellow)', color: '#000',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 'bold'
                                }}>{idx + 1}</div>
                                <span style={{ fontWeight: 'bold' }}>
                                    {msg.OTYPE === 'TextSendMessage' ? '文字訊息' :
                                        msg.OTYPE === 'ImageSendMessage' ? '圖片訊息' :
                                            msg.OTYPE === 'VideoSendMessage' ? '影片訊息' : 'Flex 訊息'}
                                </span>
                            </div>
                            {formData.messages.length > 1 && (
                                <Tooltip title="移除此訊息">
                                    <IconButton onClick={() => {
                                        const newMsgs = formData.messages.filter((_, i) => i !== idx);
                                        setFormData({ ...formData, messages: newMsgs });
                                    }} sx={{ color: '#ff4d4d' }}>
                                        <Trash2 size={18} />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            {[
                                { id: 'TextSendMessage', label: '文字', icon: <Type size={14} /> },
                                { id: 'ImageSendMessage', label: '圖片', icon: <ImageIcon size={14} /> },
                                { id: 'VideoSendMessage', label: '影片', icon: <Video size={14} /> },
                                { id: 'FlexSendMessage', label: 'Flex', icon: <Layout size={14} /> }
                            ].map(type => (
                                <button key={type.id}
                                    className={msg.OTYPE === type.id ? 'primary' : 'secondary'}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                    onClick={() => {
                                        const newMsgs = [...formData.messages];
                                        const baseContent = (type.id === 'FlexSendMessage') ? { type: 'bubble', contents: [] } : '';
                                        newMsgs[idx] = {
                                            OTYPE: type.id,
                                            text: '',
                                            original_content_url: '',
                                            preview_image_url: '',
                                            alt_text: '您有一則新訊息',
                                            contents: baseContent
                                        };
                                        setFormData({ ...formData, messages: newMsgs });
                                    }}
                                >
                                    {type.icon} {type.label}
                                </button>
                            ))}
                        </div>

                        {msg.OTYPE === 'TextSendMessage' && (
                            <>
                                <textarea
                                    value={msg.text}
                                    onChange={e => {
                                        const newMsgs = [...formData.messages];
                                        newMsgs[idx].text = e.target.value;
                                        setFormData({ ...formData, messages: newMsgs });
                                    }}
                                    style={{ width: '100%', minHeight: '120px', backgroundColor: '#111' }}
                                    placeholder="請輸入訊息內容..."
                                />
                                <div style={{ fontSize: '11px', color: (msg.text || '').length > 3000 ? '#ff4d4d' : '#666', textAlign: 'right', marginTop: '5px' }}>
                                    {(msg.text || '').length} / 3000
                                </div>
                            </>
                        )}

                        {msg.OTYPE === 'ImageSendMessage' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label className="label">圖片連結</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="text" value={msg.original_content_url || ''} onChange={e => {
                                        const msgs = [...formData.messages];
                                        msgs[idx].original_content_url = e.target.value;
                                        msgs[idx].preview_image_url = e.target.value;
                                        setFormData({ ...formData, messages: msgs });
                                    }} placeholder="https://..." style={{ flex: 1 }} />
                                    <label style={{
                                        padding: '8px 12px',
                                        background: 'var(--primary-yellow)',
                                        color: '#000',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}>
                                        <Plus size={16} /> 上傳
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const uploadData = new FormData();
                                                uploadData.append('file', file);
                                                try {
                                                    const res = await api.post('/upload/github', uploadData);
                                                    const msgs = [...formData.messages];
                                                    msgs[idx].original_content_url = res.data.url;
                                                    msgs[idx].preview_image_url = res.data.url;
                                                    setFormData({ ...formData, messages: msgs });
                                                } catch (err) {
                                                    showToast('上傳失敗', 'error');
                                                } finally {
                                                    e.target.value = ''; // Reset input to allow re-uploading same file
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {msg.OTYPE === 'VideoSendMessage' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <label className="label">影片連結 (.mp4)</label>
                                    <input type="text" value={msg.original_content_url || ''} onChange={e => {
                                        const msgs = [...formData.messages];
                                        msgs[idx].original_content_url = e.target.value;
                                        setFormData({ ...formData, messages: msgs });
                                    }} placeholder="https://..." style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label className="label">預覽圖連結 (.jpg)</label>
                                    <input type="text" value={msg.preview_image_url || ''} onChange={e => {
                                        const msgs = [...formData.messages];
                                        msgs[idx].preview_image_url = e.target.value;
                                        setFormData({ ...formData, messages: msgs });
                                    }} placeholder="https://..." style={{ width: '100%' }} />
                                </div>
                            </div>
                        )}

                        {msg.OTYPE === 'FlexSendMessage' && (
                            <div style={{
                                padding: '25px', textAlign: 'center', backgroundColor: '#111',
                                borderRadius: '8px', border: '1px dashed #333'
                            }}>
                                <p style={{ color: '#666', marginBottom: '15px', fontSize: '14px' }}>使用視覺化編輯器設定 Flex 訊息內容</p>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <button className="secondary" onClick={() => openMessageEditor(idx)}>
                                        <Edit2 size={16} /> 開啟編輯器
                                    </button>
                                </div>
                                {msg.contents && (
                                    <div style={{ marginTop: '20px', backgroundColor: '#8CAEC5', padding: '15px', borderRadius: '8px', transform: 'scale(0.8)', transformOrigin: 'top center' }}>
                                        <JourneyPreview steps={[{ OTYPE: 'FlexSendMessage', contents: msg.contents }]} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {formData.messages.length < 5 && (
                    <button
                        className="secondary"
                        style={{
                            borderStyle: 'dashed',
                            padding: '20px',
                            backgroundColor: '#fff',
                            color: '#000',
                            fontWeight: 'bold'
                        }}
                        onClick={() => {
                            setFormData({ ...formData, messages: [...formData.messages, { OTYPE: 'TextSendMessage', text: '' }] });
                        }}
                    >
                        <Plus size={20} /> 新增下一則訊息
                    </button>
                )}
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="card">
                <h4 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={20} /> 發送排程</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button
                            className={formData.send_type === 'immediate' ? 'primary' : 'secondary'}
                            style={{ flex: 1, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            onClick={() => setFormData({ ...formData, send_type: 'immediate' })}
                        >
                            <Send size={18} /> 立即發送
                        </button>
                        <button
                            className={formData.send_type === 'scheduled' ? 'primary' : 'secondary'}
                            style={{ flex: 1, padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            onClick={() => setFormData({ ...formData, send_type: 'scheduled' })}
                        >
                            <Clock size={18} /> 排程發送
                        </button>
                    </div>

                    {formData.send_type === 'scheduled' && (
                        <div style={{ backgroundColor: '#222', padding: '15px', borderRadius: '8px' }}>
                            <label className="label">預約發送時間</label>
                            <input
                                type="datetime-local"
                                value={formData.scheduled_at}
                                onChange={e => setFormData({ ...formData, scheduled_at: e.target.value })}
                                style={{ width: '100%', padding: '12px' }}
                            />
                            <p style={{ color: '#666', fontSize: '12px', marginTop: '10px' }}>
                                <Info size={12} /> 系統將於指定時間自動將任務加入廣播佇列
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ backgroundColor: 'rgba(255, 215, 0, 0.03)', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
                <h4 style={{ marginBottom: '20px', color: 'var(--primary-yellow)' }}>廣播摘要確認</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>發送受眾</span>
                        <span style={{ fontWeight: 'bold' }}>
                            {formData.target_type === 'all' ? '全體好友' :
                                formData.target_type === 'tag' ? `標籤 [${formData.target_value}]` :
                                    `${formData.selectedUsers.length} 位指定用戶`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>受眾人數</span>
                        <span style={{ fontWeight: 'bold' }}>{stats.count.toLocaleString()} 人</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>訊息組成</span>
                        <span style={{ fontWeight: 'bold' }}>{formData.messages.length} 則混合訊息</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>執行方式</span>
                        <span style={{ fontWeight: 'bold' }}>
                            {formData.send_type === 'immediate' ? '立即發送' : `預約 (於 ${new Date(formData.scheduled_at).toLocaleString()})`}
                        </span>
                    </div>
                </div>

                <div style={{ marginTop: '25px', display: 'flex', gap: '15px' }}>
                    <button className="secondary" style={{ flex: 1 }} onClick={() => setIsPreviewOpen(true)}><Eye size={18} /> 視覺預覽</button>
                    <button className="secondary" style={{ flex: 1 }} onClick={saveDraft}><Save size={18} /> 存為草稿</button>
                </div>
            </div>
        </div>
    );

    if (view === 'create') {
        const isViewOnly = formData.status === 'sent' || formData.status === 'scheduled';
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0, border: 'none', cursor: 'pointer' }}>← 返回廣播列表</button>
                        <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {isViewOnly ? <Eye size={32} /> : formData.id ? <Edit2 size={32} /> : <Plus size={32} />}
                            {isViewOnly ? '查看廣播內容' : formData.id ? '編輯廣播草稿' : '新建群發任務'}
                        </h1>
                    </div>
                    {!isViewOnly && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="secondary" onClick={saveDraft} disabled={loading}><Save size={18} /> 儲存草稿</button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '50px' }}>
                    {[
                        { step: 1, label: '設定受眾' },
                        { step: 2, label: '編輯訊息' },
                        { step: 3, label: '確認發送' }
                    ].map(s => (
                        <div key={s.step} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ height: '4px', backgroundColor: step >= s.step ? 'var(--primary-yellow)' : '#333', borderRadius: '2px', transition: 'background-color 0.3s' }} />
                            <span style={{ fontSize: '13px', textAlign: 'center', color: step === s.step ? 'white' : '#666' }}>{s.label}</span>
                        </div>
                    ))}
                </div>

                <div style={{ minHeight: '400px', opacity: isViewOnly && step !== 1 ? 0.7 : 1, pointerEvents: isViewOnly ? 'none' : 'auto' }}>
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                </div>

                <div style={{
                    position: 'fixed', bottom: 0, left: '260px', right: 0,
                    backgroundColor: '#111', padding: '20px 40px',
                    borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between',
                    zIndex: 100
                }}>
                    <button className="secondary" disabled={step === 1} onClick={() => setStep(step - 1)} style={{ padding: '10px 25px' }}><ChevronLeft size={18} /> 上一步</button>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        {step < 3 ? (
                            <button className="primary" onClick={() => {
                                if (step === 2) {
                                    for (let i = 0; i < formData.messages.length; i++) {
                                        const msg = formData.messages[i];
                                        if (msg.OTYPE === 'TextSendMessage') {
                                            if (!msg.text || !msg.text.trim()) {
                                                alert(`第 ${i + 1} 則文字訊息內容不能為空`);
                                                return;
                                            }
                                            if (msg.text.length > 3000) {
                                                alert(`第 ${i + 1} 則文字訊息內容不能超過 3000 字`);
                                                return;
                                            }
                                        } else if (msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage' || msg.OTYPE === 'AudioSendMessage') {
                                            if (!msg.original_content_url) {
                                                alert(`第 ${i + 1} 則訊息網址（URL）不能為空`);
                                                return;
                                            }
                                        } else if (msg.OTYPE === 'FlexSendMessage') {
                                            if (!msg.contents || (typeof msg.contents === 'object' && Object.keys(msg.contents).length === 0)) {
                                                alert(`第 ${i + 1} 則 Flex 訊息內容未設定`);
                                                return;
                                            }
                                        }
                                    }
                                }
                                setStep(step + 1);
                            }} style={{ padding: '10px 40px' }}>下一步 <ChevronRight size={18} /></button>
                        ) : !isViewOnly && (
                            <button className="primary" onClick={finishBroadcast} disabled={loading} style={{ padding: '10px 50px', backgroundColor: formData.send_type === 'immediate' ? '#4CAF50' : 'var(--primary-yellow)', color: '#000' }}>
                                {formData.send_type === 'immediate' ? '立即發送群發' : '確認預約排程'}
                            </button>
                        )}
                        {isViewOnly && step === 3 && (
                            <button className="secondary" onClick={() => setView('list')}>關閉查看</button>
                        )}
                    </div>
                </div>

                {/* Modals */}
                <Dialog
                    open={isFlexEditorOpen}
                    onClose={() => setIsFlexEditorOpen(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{ sx: { bgcolor: '#222', color: '#fff' } }}
                >
                    <DialogTitle sx={{ borderBottom: '1px solid #333' }}>Flex 訊息編輯器</DialogTitle>
                    <DialogContent sx={{ p: 0, height: '700px' }}>
                        <FlexMessageEditor
                            initialContent={formData.messages[editingMsgIndex]?.contents}
                            onSave={handleFlexSave}
                        />
                    </DialogContent>
                    <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
                        <Button onClick={() => setIsFlexEditorOpen(false)} sx={{ color: '#888' }}>完成並返回</Button>
                    </DialogActions>
                </Dialog>

                <Modal open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 'auto', outline: 'none'
                    }}>
                        <JourneyPreview
                            steps={formData.messages.map(m => {
                                if (m.OTYPE === 'TextSendMessage') return { OTYPE: m.OTYPE, text: m.text };
                                if (m.OTYPE === 'FlexSendMessage') return { OTYPE: 'FlexSendMessage', contents: m.contents };
                                return {
                                    OTYPE: m.OTYPE,
                                    originalUrl: m.original_content_url || m.originalUrl,
                                    previewUrl: m.preview_image_url || m.previewUrl
                                };
                            })}
                        />
                    </Box>
                </Modal>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '10px' }}>群發訊息中心</h1>
                    <p style={{ color: '#B0B0B0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={16} /> 您可以建立、排程或追蹤所有官方帳號群發任務
                    </p>
                </div>
                <button className="primary" onClick={handleCreateNew} style={{ padding: '12px 25px', fontSize: '16px' }}><Plus size={20} /> 建立群發</button>
            </div>

            <Box sx={{ borderBottom: 1, borderColor: '#333', mb: '40px' }}>
                <Tabs value={listTab} onChange={(e, val) => setListTab(val)} textColor="inherit" TabIndicatorProps={{ style: { backgroundColor: 'var(--primary-yellow)', height: '3px' } }}>
                    <Tab label={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layout size={18} /> 全部廣播</span>} value="all" sx={{ py: 2, fontSize: '15px', color: '#888', '&.Mui-selected': { color: 'white' } }} />
                    <Tab label={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> 預約中</span>} value="scheduled" sx={{ py: 2, fontSize: '15px', color: '#888', '&.Mui-selected': { color: 'white' } }} />
                    <Tab label={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> 草稿箱</span>} value="draft" sx={{ py: 2, fontSize: '15px', color: '#888', '&.Mui-selected': { color: 'white' } }} />
                    <Tab label={<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18} /> 已成功發送</span>} value="sent" sx={{ py: 2, fontSize: '15px', color: '#888', '&.Mui-selected': { color: 'white' } }} />
                </Tabs>
            </Box>

            {loading ? (
                <LoadingSpinner message="載入廣播資料中..." />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                    {broadcasts.map(bc => (
                        <div key={bc.id} className="card" style={{
                            display: 'flex', flexDirection: 'column', gap: '20px',
                            padding: '25px', border: '1px solid #333',
                            transition: 'transform 0.2s, border-color 0.2s',
                            '&:hover': { borderColor: '#555', transform: 'translateY(-2px)' }
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '20px', marginBottom: '8px', color: '#FFF' }}>{bc.name}</h4>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{
                                            padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px',
                                            backgroundColor: bc.status === 'sent' ? 'rgba(76, 175, 80, 0.1)' : bc.status === 'scheduled' ? 'rgba(255, 193, 7, 0.1)' : 'rgba(176, 176, 176, 0.1)',
                                            color: bc.status === 'sent' ? '#4CAF50' : bc.status === 'scheduled' ? '#FFC107' : '#B0B0B0',
                                            border: `1px solid ${bc.status === 'sent' ? '#4CAF50' : bc.status === 'scheduled' ? '#FFC107' : '#B0B0B0'}40`
                                        }}>
                                            {bc.status === 'sent' ? 'SENT' : bc.status === 'scheduled' ? 'SCHEDULED' : 'DRAFT'}
                                        </div>
                                        <span style={{ color: '#555', fontSize: '13px' }}>{new Date(bc.created_at).toLocaleDateString()} 建立</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {bc.status === 'draft' ? (
                                        <Tooltip title="編輯草稿"><IconButton onClick={() => handleEdit(bc)} sx={{ color: 'var(--primary-yellow)' }}><Edit2 size={18} /></IconButton></Tooltip>
                                    ) : (
                                        <Tooltip title="查看詳情"><IconButton onClick={() => handlePreviewSent(bc)} sx={{ color: '#888' }}><Eye size={18} /></IconButton></Tooltip>
                                    )}
                                    <Tooltip title="刪除廣播"><IconButton onClick={() => handleDelete(bc.id)} sx={{ color: '#ff4d4d' }}><Trash2 size={18} /></IconButton></Tooltip>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', backgroundColor: '#181818', padding: '15px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ backgroundColor: '#222', p: 1, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                                        <Users size={16} color="#666" />
                                    </div>
                                    <div>
                                        <p style={{ color: '#666', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>發送目標</p>
                                        <p style={{ fontSize: '13px', color: '#BBB' }}>{bc.target_type === 'all' ? '全體好友' : bc.target_type === 'tag' ? `標籤: ${bc.target_value}` : '名單選擇'}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ backgroundColor: '#222', p: 1, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                                        <Clock size={16} color="#666" />
                                    </div>
                                    <div>
                                        <p style={{ color: '#666', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>預計時間</p>
                                        <p style={{ fontSize: '13px', color: '#BBB' }}>{bc.scheduled_at ? new Date(bc.scheduled_at).toLocaleDateString() : '立即發送'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Message Preview */}
                            <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                                <p style={{ color: '#666', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>訊息內容預覽</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {(() => {
                                        try {
                                            const msgs = bc.messages || [];
                                            return msgs.slice(0, 3).map((m, i) => {
                                                const type = m.OTYPE;
                                                return (
                                                    <div key={i} style={{
                                                        backgroundColor: '#222', padding: '6px 10px', borderRadius: '4px', border: '1px solid #333',
                                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#BBB',
                                                        maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                                                    }}>
                                                        {type === 'TextSendMessage' ? <Type size={14} /> :
                                                            type === 'ImageSendMessage' ? <ImageIcon size={14} /> :
                                                                type === 'VideoSendMessage' ? <Video size={14} /> : <Layout size={14} />}
                                                        {type === 'TextSendMessage' ? (m.text?.substring(0, 20) + (m.text?.length > 20 ? '...' : '')) :
                                                            type === 'FlexSendMessage' ? 'Flex 訊息' :
                                                                type === 'ImageSendMessage' ? '圖片' : '影片'}
                                                    </div>
                                                );
                                            });
                                        } catch (e) { return null; }
                                    })()}
                                    {(bc.messages?.length > 3) && (
                                        <div style={{ padding: '6px', fontSize: '12px', color: '#555' }}>+{bc.messages.length - 3} 則...</div>
                                    )}
                                </div>
                            </div>

                            {bc.status === 'scheduled' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FFC107', fontSize: '13px', backgroundColor: 'rgba(255,193,7,0.05)', padding: '10px', borderRadius: '6px' }}>
                                    <Clock size={14} />
                                    <span>預計於 {new Date(bc.scheduled_at).toLocaleString()} 自動發送</span>
                                </div>
                            )}
                        </div>
                    ))}
                    {broadcasts.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '150px 0', border: '2px dashed #333', borderRadius: '15px' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                                <FileText size={80} style={{ color: '#333' }} />
                                <Plus size={24} style={{ position: 'absolute', bottom: 0, right: 0, color: 'var(--primary-yellow)' }} />
                            </div>
                            <h3 style={{ color: '#666', fontSize: '20px', marginBottom: '10px' }}>尚無廣播訊息記錄</h3>
                            <p style={{ color: '#444' }}>點擊右上角「建立群發」開始設計您的推播任務</p>
                        </div>
                    )}
                </div>
            )}

            {/* List-view preview modal */}
            {previewBcMessages && (
                <Modal open={Boolean(previewBcMessages)} onClose={() => setPreviewBcMessages(null)}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 'auto', outline: 'none', backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '20px',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>訊息內容預覽</span>
                            <IconButton onClick={() => setPreviewBcMessages(null)} sx={{ color: '#888' }}><X size={18} /></IconButton>
                        </div>
                        <JourneyPreview
                            steps={previewBcMessages.map(m => {
                                if (m.OTYPE === 'TextSendMessage') return { OTYPE: m.OTYPE, text: m.text };
                                if (m.OTYPE === 'FlexSendMessage') return { OTYPE: 'FlexSendMessage', contents: m.contents };
                                return {
                                    OTYPE: m.OTYPE,
                                    originalUrl: m.original_content_url || m.originalUrl,
                                    previewUrl: m.preview_image_url || m.previewUrl
                                };
                            })}
                        />
                    </Box>
                </Modal>
            )}
        </div>
    );
}

export default Broadcast;
