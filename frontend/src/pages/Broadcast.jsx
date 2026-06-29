import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import api from '../api';
import {
    Send, Users, Info, Plus, Search, Filter,
    ChevronRight, ChevronLeft, Save, Trash2, Edit2,
    Eye, Clock, CheckCircle2, FileText, AlertCircle,
    Monitor, Layout, Type, Image as ImageIcon, Video,
    X, Check, ExternalLink, RefreshCcw, HelpCircle
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

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary caught an error inside Broadcast:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', margin: '20px', borderRadius: '12px', backgroundColor: '#1a0000', color: '#ffaaaa', border: '1px solid #ff4444', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <h2 style={{ color: '#ff4444', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}><AlertCircle size={32} /> 偵測到廣播模組崩潰 (UI Crash)</h2>
                    <div style={{ backgroundColor: '#2a0000', padding: '20px', borderRadius: '8px', marginBottom: '25px' }}>
                        <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>系統偵測到渲染錯誤：</p>
                        <p style={{ fontSize: '15px', opacity: 0.9 }}>這通常是因為資料庫中存在格式不完整的舊訊息所導致。請不要擔心，您可以將下方的錯誤資訊複製並提供給開發人員修復。</p>
                    </div>

                    <div style={{ backgroundColor: '#000', padding: '25px', overflowX: 'auto', borderRadius: '8px', border: '1px solid #444', position: 'relative' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: 'var(--primary-yellow)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>錯誤追蹤碼 (Error Stack)</h4>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', color: '#00ff00', fontFamily: 'monospace', maxHeight: '400px', overflowY: 'auto' }}>
                            {this.state.error && this.state.error.toString()}\n\n
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
                        <button 
                            onClick={() => window.location.reload()} 
                            style={{ padding: '12px 30px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <RefreshCcw size={18} /> 重新整理頁面
                        </button>
                        <button 
                            onClick={() => {
                                const text = `${this.state.error && this.state.error.toString()}\n\n${this.state.errorInfo && this.state.errorInfo.componentStack}`;
                                navigator.clipboard.writeText(text);
                                alert('錯誤資訊已複製到剪貼簿！');
                            }} 
                            style={{ padding: '12px 30px', backgroundColor: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            複製錯誤資訊
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
function BroadcastContent() {
    const { oaId } = useParams();
    const location = useLocation();
    const { showToast } = useToast();

    // View state
    const [view, setView] = useState(location.state?.presetTarget ? 'create' : 'list'); 
    const [listTab, setListTab] = useState('all'); // all, scheduled, draft, sent
    const [allBroadcasts, setAllBroadcasts] = useState([]);
    
    // Compute filtered broadcasts locally instead of refetching
    const broadcasts = React.useMemo(() => {
        if (listTab === 'all') return allBroadcasts;
        return allBroadcasts.filter(bc => bc.status === listTab);
    }, [allBroadcasts, listTab]);

    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

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
    const [isUploadingMsg, setIsUploadingMsg] = useState(null);

    // Data sources
    const [availableTags, setAvailableTags] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);

    const fetchIdRef = useRef(0);
    const [lastActionTime, setLastActionTime] = useState(0);

    // Automatically poll list every 2 seconds if there is a 'sending' broadcast,
    // OR if there was any save/send/schedule action within the last 10 seconds.
    useEffect(() => {
        const hasSending = allBroadcasts.some(bc => bc.status === 'sending');
        const isRecentlyActive = lastActionTime > 0 && (Date.now() - lastActionTime < 10000);
        
        if (!hasSending && !isRecentlyActive) return;

        const interval = setInterval(() => {
            fetchBroadcasts();
        }, 2000);

        let timeout;
        if (!hasSending && isRecentlyActive) {
            timeout = setTimeout(() => {
                setLastActionTime(0); // Trigger re-evaluation to turn off polling
            }, 10000 - (Date.now() - lastActionTime));
        }

        return () => {
            clearInterval(interval);
            if (timeout) clearTimeout(timeout);
        };
    }, [allBroadcasts, lastActionTime]);

    useEffect(() => {
        fetchBroadcasts();
        fetchTags();
        fetchUsers();
    }, [oaId]); // removed listTab from dependencies

    const fetchBroadcasts = async () => {
        const currentFetchId = ++fetchIdRef.current;
        if (allBroadcasts.length === 0) setLoading(true);
        try {
            // Fetch without status to get all and hit the preloaded cache perfectly
            const res = await api.get('/broadcast/');
            if (currentFetchId === fetchIdRef.current) {
                setAllBroadcasts(res.data.broadcasts || []);
            }
        } catch (err) {
            console.error('Error fetching broadcasts:', err);
        } finally {
            if (currentFetchId === fetchIdRef.current) {
                setLoading(false);
            }
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
            
            // Check for passed state from CustomerCenter
            if (location.state && location.state.presetTarget) {
                const preset = location.state.presetTarget;
                if (preset.type === 'ids' && preset.value) {
                    const idList = preset.value.split(',');
                    const sUsers = idList.map(id => {
                        const trimmedId = (id && typeof id === 'string') ? id.trim() : id;
                        const found = (res.data || []).find(u => u.user_id === trimmedId);
                        return found || { user_id: trimmedId, name: trimmedId };
                    });
                    setFormData(prev => ({
                        ...prev,
                        target_type: 'ids',
                        target_value: preset.value,
                        selectedUsers: sUsers,
                        name: preset.name || prev.name || `新群發 ${new Date().toLocaleDateString()}`,
                        status: 'draft'
                    }));
                    if (preset.autoStep2) {
                        setTimeout(() => setStep(2), 300);
                    }
                }
                // Clear state so it doesn't trigger again on refresh
                window.history.replaceState({}, document.title);
            }
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
            scheduled_at: '',
            status: 'draft'
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

    const handleDelete = async (id, name) => {
        if (!window.confirm(`確定要刪除群發紀錄「${name}」嗎？（若為預約中，排程也將一併移除）`)) return;
        setDeletingId(id);
        try {
            await api.delete(`/broadcast/${id}`);
            setLastActionTime(Date.now()); // Trigger active polling
            showToast(`「${name}」已刪除`, 'success');
            fetchBroadcasts();
        } catch (err) {
            showToast('刪除失敗: ' + err.message, 'error');
        } finally {
            setDeletingId(null);
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
            }
            showToast('草稿已儲存', 'success');
            setLastActionTime(Date.now()); // Trigger active polling
            setListTab('all'); // Land on All tab
            setView('list'); // Jump back to All Broadcasts page
            fetchBroadcasts(); // Update list immediately
        } catch (err) {
            showToast('儲存失敗: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const finishBroadcast = async () => {
        if (formData.send_type === 'scheduled') {
            if (!formData.scheduled_at) {
                showToast('請選擇預約時間', 'warning');
                return;
            }
            const scheduledTime = new Date(formData.scheduled_at).getTime();
            if (scheduledTime <= Date.now()) {
                showToast('預約時間不能早於或等於現在時間，請選擇未來的時間', 'warning');
                return;
            }
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
                    showToast(`第 ${i + 1} 則圖文訊息內容未設定`, 'warning');
                    return;
                }
                // Deep validation for Flex links/return text
                const contents = msg.contents;
                const bubbles = (contents && contents.type === 'carousel') ? contents.contents : [contents];
                for (let j = 0; j < bubbles.length; j++) {
                    const bubble = bubbles[j];
                    if (!bubble) continue;
                    const bubbleNum = (contents && contents.type === 'carousel') ? `卡片 #${j + 1}: ` : '';
                    if (bubble.hero?.action) {
                        const val = bubble.hero.action.uri || bubble.hero.action.data || bubble.hero.action.text || '';
                        if (!val.trim()) {
                            showToast(`第 ${i + 1} 則圖文訊息 ${bubbleNum}圖片點擊內容不能為空`, 'warning');
                            return;
                        }
                    }
                    const footerContents = bubble.footer?.contents || [];
                    const buttons = footerContents.filter(c => c && c.type === 'button');
                    for (let k = 0; k < buttons.length; k++) {
                        const btn = buttons[k];
                        const val = btn.action?.uri || btn.action?.data || btn.action?.text || '';
                        if (!val.trim()) {
                            showToast(`第 ${i + 1} 則圖文訊息 ${bubbleNum}按鈕 #${k + 1} 文字或連結不能為空`, 'warning');
                            return;
                        }
                    }
                }
            }
        }

        setExecuting(true);
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
                // Set status to 'sending' if immediate, so that it displays with sending status immediately
                status: formData.send_type === 'scheduled' ? 'scheduled' : 'sending'
            };

            let bcId = formData.id;
            let createRes = null;
            if (bcId) {
                await api.put(`/broadcast/${bcId}`, payload);
            } else {
                createRes = await api.post('/broadcast/', payload);
                bcId = createRes?.data?.id;
            }

            if (!bcId) {
                let debugInfo = createRes ? `狀態: ${createRes.status}, 回傳: ${JSON.stringify(createRes.data)}` : '未執行 API';
                throw new Error(`後端未回傳廣播任務 ID，無法執行。除錯資訊：${debugInfo}`);
            }

            // 3. Initiate sending/scheduling (Background Execution)
            api.post(`/broadcast/${bcId}/execute`)
                .then(() => {
                    // Update status in list view once completed in background
                    fetchBroadcasts();
                })
                .catch(err => {
                    console.error("Execute failed:", err);
                    showToast("群發發送或排程失敗，請確認後重試", "error");
                });

            showToast(formData.send_type === 'scheduled' ? '已成功預約排程！' : '已開始發送群發訊息！', 'success');
            setLastActionTime(Date.now()); // Trigger active polling
            setListTab('all'); // Ensure we always land on "All" tab to see the newly created task instantly!
            setView('list');
            fetchBroadcasts();
        } catch (err) {
            let errorMsg = err.response?.data?.message || err.message;
            if (err.message === 'Network Error') {
                errorMsg = '網路連線錯誤或請求逾時。這通常是因為受眾人數過多或網路不穩定，請確認後重試。';
            }
            showToast('操作失敗: ' + errorMsg, 'error');
        } finally {
            setExecuting(false);
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
                <input type="text" disabled={(formData.status === 'sent' || formData.status === 'scheduled')} value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例如: 2024 春季特賣通知" style={{ width: '100%', opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }} />
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
                            disabled={(formData.status === 'sent' || formData.status === 'scheduled')}
                            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }}
                        >
                            {type.id === 'all' ? <Users size={16} /> : type.id === 'tag' ? <Filter size={16} /> : <Search size={16} />}
                            {type.label}
                        </button>
                    ))}
                </div>

                {formData.target_type === 'tag' && (
                    <Autocomplete
                        freeSolo
                        disabled={(formData.status === 'sent' || formData.status === 'scheduled')}
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
                        disabled={(formData.status === 'sent' || formData.status === 'scheduled')}
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
                        <p style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary-yellow)' }}>{(stats?.count || 0).toLocaleString()}</p>
                    </div>
                    <div>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>好友總數</p>
                        <p style={{ fontSize: '28px', fontWeight: 'bold' }}>{(stats?.total || 0).toLocaleString()}</p>
                    </div>
                </div>

                <div style={{ marginTop: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#888' }}>
                        <span>推播覆蓋率</span>
                        <span>{stats?.ratio || 0}%</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${stats?.ratio || 0}%`,
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
                {formData.messages.map((msg, idx) => {
                    if (!msg) return null;
                    return (
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
                            {formData.messages.length > 1 && !(formData.status === 'sent' || formData.status === 'scheduled') && (
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
                                    disabled={(formData.status === 'sent' || formData.status === 'scheduled')}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }}
                                    onClick={() => {
                                        const currentMsg = formData.messages[idx];
                                        const hasContent = currentMsg.text || currentMsg.original_content_url || (currentMsg.contents && currentMsg.contents.type);
                                        if (hasContent && currentMsg.OTYPE !== type.id) {
                                            if (!window.confirm("確定要切換訊息類別嗎？目前輸入的內容將會遺失。")) {
                                                return;
                                            }
                                        }
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
                                    value={msg.text || ''}
                                    disabled={(formData.status === 'sent' || formData.status === 'scheduled')}
                                    onChange={e => {
                                        const newMsgs = [...formData.messages];
                                        newMsgs[idx].text = e.target.value;
                                        setFormData({ ...formData, messages: newMsgs });
                                    }}
                                    style={{ width: '100%', minHeight: '120px', backgroundColor: '#111', opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }}
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
                                        background: isUploadingMsg === `image_${idx}` ? '#555' : 'var(--primary-yellow)',
                                        color: isUploadingMsg === `image_${idx}` ? '#888' : '#000',
                                        borderRadius: '4px',
                                        cursor: isUploadingMsg === `image_${idx}` ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        pointerEvents: isUploadingMsg === `image_${idx}` ? 'none' : 'auto'
                                    }}>
                                        {isUploadingMsg === `image_${idx}` ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />}
                                        {isUploadingMsg === `image_${idx}` ? '上傳中...' : '上傳'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            disabled={isUploadingMsg === `image_${idx}`}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                if (file.size > 5 * 1024 * 1024) {
                                                    alert('圖片大小不可超過 5 MB');
                                                    e.target.value = '';
                                                    return;
                                                }
                                                setIsUploadingMsg(`image_${idx}`);
                                                const uploadData = new FormData();
                                                uploadData.append('file', file);
                                                try {
                                                    const res = await api.post('/upload/github', uploadData);
                                                    const msgs = [...formData.messages];
                                                    msgs[idx].original_content_url = res.data.url;
                                                    msgs[idx].preview_image_url = res.data.url;
                                                    setFormData({ ...formData, messages: msgs });
                                                } catch (err) {
                                                    const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                    showToast('哎呀，上傳失敗了：' + errorMsg, 'error');
                                                } finally {
                                                    setIsUploadingMsg(null);
                                                    e.target.value = ''; // Reset input to allow re-uploading same file
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                                {msg.original_content_url && (
                                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                        <img src={msg.original_content_url} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} alt="預覽圖片" />
                                    </div>
                                )}
                            </div>
                        )}

                        {msg.OTYPE === 'VideoSendMessage' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        影片連結 (.mp4)
                                        <Tooltip title={<div style={{ padding: '4px' }}>˙可以將影片上傳至 YouTube 或其他雲端空間，並在此貼上影片網址。<br/>˙若必須直接上傳影片檔，請先使用線上壓縮工具將影片壓縮至 5MB 以內。</div>} placement="top" arrow>
                                            <HelpCircle size={16} style={{ cursor: 'help', color: '#888' }} />
                                        </Tooltip>
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input type="text" value={msg.original_content_url || ''} disabled={(formData.status === 'sent' || formData.status === 'scheduled')} onChange={e => {
                                            const msgs = [...formData.messages];
                                            msgs[idx].original_content_url = e.target.value;
                                            setFormData({ ...formData, messages: msgs });
                                        }} placeholder="https://..." style={{ flex: 1, opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }} />
                                        {!(formData.status === 'sent' || formData.status === 'scheduled') && (
                                            <label style={{
                                                padding: '8px 12px', background: isUploadingMsg === `video_${idx}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `video_${idx}` ? '#888' : '#000', borderRadius: '4px',
                                                cursor: isUploadingMsg === `video_${idx}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `video_${idx}` ? 'none' : 'auto'
                                            }}>
                                                {isUploadingMsg === `video_${idx}` ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />} {isUploadingMsg === `video_${idx}` ? '上傳中...' : '上傳'}
                                                <input type="file" accept="video/*" style={{ display: 'none' }} disabled={isUploadingMsg === `video_${idx}`} onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    if (file.size > 50 * 1024 * 1024) {
                                                        alert('影片大小不可超過 50 MB');
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    setIsUploadingMsg(`video_${idx}`);
                                                    const uploadData = new FormData();
                                                    uploadData.append('file', file);
                                                    try {
                                                        const res = await api.post('/upload/github', uploadData);
                                                        const msgs = [...formData.messages];
                                                        msgs[idx].original_content_url = res.data.url;
                                                        setFormData({ ...formData, messages: msgs });
                                                    } catch (err) {
                                                        const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                        showToast('哎呀，上傳失敗了：' + errorMsg, 'error');
                                                    } finally {
                                                        setIsUploadingMsg(null);
                                                        e.target.value = '';
                                                    }
                                                }} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="label">預覽圖連結 (.jpg)</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input type="text" value={msg.preview_image_url || ''} disabled={(formData.status === 'sent' || formData.status === 'scheduled')} onChange={e => {
                                            const msgs = [...formData.messages];
                                            msgs[idx].preview_image_url = e.target.value;
                                            setFormData({ ...formData, messages: msgs });
                                        }} placeholder="https://..." style={{ flex: 1, opacity: (formData.status === 'sent' || formData.status === 'scheduled') ? 0.7 : 1 }} />
                                        {!(formData.status === 'sent' || formData.status === 'scheduled') && (
                                            <label style={{
                                                padding: '8px 12px', background: isUploadingMsg === `video_preview_${idx}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `video_preview_${idx}` ? '#888' : '#000', borderRadius: '4px',
                                                cursor: isUploadingMsg === `video_preview_${idx}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `video_preview_${idx}` ? 'none' : 'auto'
                                            }}>
                                                {isUploadingMsg === `video_preview_${idx}` ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />} {isUploadingMsg === `video_preview_${idx}` ? '上傳中...' : '上傳'}
                                                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingMsg === `video_preview_${idx}`} onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    if (file.size > 1 * 1024 * 1024) {
                                                        alert('預覽圖大小不可超過 1 MB，建議壓到 500 KB 以下');
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    setIsUploadingMsg(`video_preview_${idx}`);
                                                    const uploadData = new FormData();
                                                    uploadData.append('file', file);
                                                    try {
                                                        const res = await api.post('/upload/github', uploadData);
                                                        const msgs = [...formData.messages];
                                                        msgs[idx].preview_image_url = res.data.url;
                                                        setFormData({ ...formData, messages: msgs });
                                                    } catch (err) {
                                                        const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                        showToast('哎呀，上傳失敗了：' + errorMsg, 'error');
                                                    } finally {
                                                        setIsUploadingMsg(null);
                                                        e.target.value = '';
                                                    }
                                                }} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                                {msg.original_content_url && (
                                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                        <video controls poster={msg.preview_image_url || ''} src={msg.original_content_url} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                                    </div>
                                )}
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
                                        {(formData.status === 'sent' || formData.status === 'scheduled') ? <Eye size={16} /> : <Edit2 size={16} />} {(formData.status === 'sent' || formData.status === 'scheduled') ? '檢視內容' : '開啟編輯器'}
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
                    );
                })}

                {formData.messages.length < 5 && !(formData.status === 'sent' || formData.status === 'scheduled') && (
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
                        <span style={{ fontWeight: 'bold' }}>{(stats?.count || 0).toLocaleString()} 人</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>訊息組成</span>
                        <span style={{ fontWeight: 'bold' }}>{(formData.messages || []).length} 則混合訊息</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>執行方式</span>
                        <span style={{ fontWeight: 'bold' }}>
                            {formData.send_type === 'immediate' ? '立即發送' : `預約 (於 ${formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString() : '未設定時間'})`}
                        </span>
                    </div>
                </div>

                <div style={{ marginTop: '25px', display: 'flex', gap: '15px' }}>
                    <button className="secondary" style={{ flex: 1 }} onClick={() => setIsPreviewOpen(true)}><Eye size={18} /> 視覺預覽</button>
                    <button className="secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={saveDraft} disabled={loading}>
                        {loading ? <CircularProgress size={16} color="inherit" /> : <Save size={18} />}
                        {loading ? '儲存中...' : '存為草稿'}
                    </button>
                </div>
            </div>
        </div>
    );

    if (view === 'create') {
        return (
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0, border: 'none', cursor: 'pointer' }}>← 返回廣播列表</button>
                        <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            {(formData.status === 'sent' || formData.status === 'scheduled') ? <Eye size={32} /> : formData.id ? <Edit2 size={32} /> : <Plus size={32} />}
                            {(formData.status === 'sent' || formData.status === 'scheduled') ? '查看廣播內容' : formData.id ? '編輯廣播草稿' : '新建群發任務'}
                        </h1>
                    </div>
                    {!(formData.status === 'sent' || formData.status === 'scheduled') && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={saveDraft} disabled={loading}>
                                {loading ? <CircularProgress size={16} color="inherit" /> : <Save size={18} />}
                                {loading ? '儲存中...' : '儲存草稿'}
                            </button>
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

                <div style={{ minHeight: '400px', opacity: (formData.status === 'sent' || formData.status === 'scheduled') && step !== 1 ? 0.9 : 1, pointerEvents: ((formData.status === 'sent' || formData.status === 'scheduled') && step === 3) ? 'none' : 'auto' }}>
                    {step === 1 && renderStep1 && renderStep1()}
                    {step === 2 && renderStep2 && renderStep2()}
                    {step === 3 && renderStep3 && renderStep3()}
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
                        ) : !(formData.status === 'sent' || formData.status === 'scheduled') && (
                            <button className="primary" onClick={finishBroadcast} disabled={executing} style={{ padding: '10px 50px', backgroundColor: formData.send_type === 'immediate' ? '#4CAF50' : 'var(--primary-yellow)', color: '#000', opacity: executing ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                {executing && <CircularProgress size={16} color="inherit" />}
                                {executing ? '處理中...' : (formData.send_type === 'immediate' ? '立即發送群發' : '確認預約排程')}
                            </button>
                        )}
                        {(formData.status === 'sent' || formData.status === 'scheduled') && step === 3 && (
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
                            readOnly={(formData.status === 'sent' || formData.status === 'scheduled')}
                        />
                    </DialogContent>
                    <DialogActions sx={{ borderTop: '1px solid #333', p: 2 }}>
                        <Button onClick={() => {
                            const currentMsg = formData.messages[editingMsgIndex];
                            if (!(formData.status === 'sent' || formData.status === 'scheduled') && currentMsg && currentMsg.OTYPE === 'FlexSendMessage') {
                                const contents = currentMsg.contents;
                                const bubbles = (contents && contents.type === 'carousel') ? contents.contents : [contents];
                                for (let j = 0; j < bubbles.length; j++) {
                                    const bubble = bubbles[j];
                                    if (!bubble) continue;
                                    const cardNum = j + 1;
                                    const cardPrefix = contents.type === 'carousel' ? `卡片 #${cardNum}: ` : '';

                                    if (bubble.hero?.action) {
                                        const action = bubble.hero.action;
                                        const val = action.uri || action.data || action.text || '';
                                        if (!val.trim()) {
                                            const typeLabel = action.type === 'uri' ? '連結' : '回傳文字';
                                            showToast(`${cardPrefix}圖片點擊的${typeLabel}不能為空`, 'warning');
                                            return;
                                        }
                                    }

                                    const footerContents = bubble.footer?.contents || [];
                                    const buttons = footerContents.filter(c => c && c.type === 'button');
                                    for (let k = 0; k < buttons.length; k++) {
                                        const btn = buttons[k];
                                        const val = btn.action?.uri || btn.action?.data || btn.action?.text || '';
                                        if (!val.trim()) {
                                            const typeLabel = btn.action?.type === 'uri' ? '連結' : '回傳文字';
                                            showToast(`${cardPrefix}按鈕 #${k + 1} 的${typeLabel}不能為空`, 'warning');
                                            return;
                                        }
                                    }
                                }
                            }
                            setIsFlexEditorOpen(false);
                        }} sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>{(formData.status === 'sent' || formData.status === 'scheduled') ? '關閉' : '完成並返回'}</Button>
                    </DialogActions>
                </Dialog>

                <Modal open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}>
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 'auto', outline: 'none'
                    }}>
                        <JourneyPreview
                            steps={(formData.messages || []).filter(m => m != null).map(m => {
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
                                            backgroundColor: bc.status === 'sent' ? 'rgba(76, 175, 80, 0.1)' : bc.status === 'sending' ? 'rgba(33, 150, 243, 0.1)' : bc.status === 'scheduled' ? 'rgba(255, 193, 7, 0.1)' : 'rgba(176, 176, 176, 0.1)',
                                            color: bc.status === 'sent' ? '#4CAF50' : bc.status === 'sending' ? '#2196F3' : bc.status === 'scheduled' ? '#FFC107' : '#B0B0B0',
                                            border: `1px solid ${bc.status === 'sent' ? '#4CAF50' : bc.status === 'sending' ? '#2196F3' : bc.status === 'scheduled' ? '#FFC107' : '#B0B0B0'}40`
                                        }}>
                                            {bc.status === 'sent' ? '已發送' : bc.status === 'sending' ? '發送中...' : bc.status === 'scheduled' ? '已排程' : '草稿'}
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
                                    <Tooltip title="刪除廣播"><IconButton onClick={() => handleDelete(bc.id, bc.name || '未命名任務')} disabled={deletingId === bc.id} sx={{ color: deletingId === bc.id ? '#888' : '#ff4d4d' }}>{deletingId === bc.id ? <CircularProgress size={18} sx={{ color: '#888' }} /> : <Trash2 size={18} />}</IconButton></Tooltip>
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
                                                        {type === 'TextSendMessage' ? '文字訊息' :
                                                            type === 'FlexSendMessage' ? '圖文訊息' :
                                                                type === 'ImageSendMessage' ? '圖片訊息' : '影片訊息'}
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

            {/* Deleting Overlay */}
            {deletingId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'
                }}>
                    <CircularProgress size={48} sx={{ color: '#ff4d4d' }} />
                    <p style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>刪除中...</p>
                    <p style={{ color: '#999', fontSize: '14px' }}>請稍候</p>
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
                            steps={(previewBcMessages || []).map(m => {
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

export default function Broadcast(props) {
    return (
        <ErrorBoundary>
            <BroadcastContent {...props} />
        </ErrorBoundary>
    );
}
