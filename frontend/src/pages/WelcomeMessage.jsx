import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Plus, Edit2, Trash2, Save, X, Eye, 
    MessageSquare, AlertCircle, Info, Tag, 
    UserPlus, CheckCircle, Power, Zap, RefreshCw
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import JourneyPreview from '../components/JourneyPreview';
import { useToast } from '../contexts/ToastContext';
import FlexMessageEditor from '../components/FlexMessageEditor';
import TagInput from '../components/TagInput';

// Helper to parse function field into tags, journey, richMenu
const parseFunctionString = (funcStr = '') => {
    const result = { tags: [], journey: '', richMenu: '' };
    if (!funcStr) return result;

    const tagMatch1 = funcStr.match(/update\(\s*f?['"]set_tag\|(\[[^\]]+\])['"]\s*\)/);
    const tagMatch2 = funcStr.match(/update\(\s*f?['"]set_tag\|([^"']+)['"]\s*\)/);
    let tagStr = '';
    if (tagMatch1) tagStr = tagMatch1[1];
    else if (tagMatch2) tagStr = tagMatch2[1];

    if (tagStr) {
        if (tagStr.startsWith('[') && tagStr.endsWith(']')) {
            try {
                result.tags = JSON.parse(tagStr.replace(/'/g, '"'));
            } catch (e) {
                result.tags = [];
            }
        } else {
            result.tags = [tagStr.replace(/['"]/g, '').trim()].filter(t => t);
        }
    }

    const journeyMatch = funcStr.match(/update\(\s*f?['"]iup\|([^"']+)['"]\s*\)/);
    if (journeyMatch) result.journey = journeyMatch[1];

    const rmMatch = funcStr.match(/update\(\s*f?['"]switch_rm\|([^"']+)['"]\s*\)/);
    if (rmMatch) result.richMenu = rmMatch[1];

    return result;
};

const buildFunctionString = (parsedData) => {
    const baseFunc = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m))';
    const parts = [baseFunc];
    
    if (parsedData.tags && parsedData.tags.length > 0) {
        const formattedTags = `[${parsedData.tags.map(t => `'${t}'`).join(', ')}]`;
        parts.push(`update(f"set_tag|${formattedTags}")`);
    }
    if (parsedData.journey && parsedData.journey.trim()) {
        parts.push(`update("iup|${parsedData.journey.trim()}")`);
    }
    if (parsedData.richMenu && parsedData.richMenu.trim()) {
        parts.push(`update("switch_rm|${parsedData.richMenu.trim()}")`);
    }
    return parts.join(',');
};

export default function WelcomeMessage() {
    const { oaId } = useParams();
    const { showToast } = useToast();

    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal State for Rule Editing
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleNote, setRuleNote] = useState('');
    const [isEnabled, setIsEnabled] = useState(true);
    const [msgRpyList, setMsgRpyList] = useState([]);
    
    // Actions parsed state
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedJourney, setSelectedJourney] = useState('');
    const [selectedRichMenu, setSelectedRichMenu] = useState('');

    // Dropdown Data
    const [tagsList, setTagsList] = useState([]);
    const [projectsList, setProjectsList] = useState([]);
    const [richMenusList, setRichMenusList] = useState([]);

    // Flex Message Editor State
    const [showFlexEditor, setShowFlexEditor] = useState(false);
    const [flexEditorIndex, setFlexEditorIndex] = useState(null);

    // Journey / Message Preview State
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewMessages, setPreviewMessages] = useState([]);

    useEffect(() => {
        fetchDropdownData();
        fetchFollowRules();
    }, [oaId]);

    const fetchDropdownData = async () => {
        try {
            const tagRes = await api.get('/customers/tags');
            if (tagRes.data) setTagsList(tagRes.data);

            const projRes = await api.get('/projects');
            if (projRes.data && Array.isArray(projRes.data)) {
                setProjectsList(projRes.data);
            } else if (projRes.data && Array.isArray(projRes.data.projects)) {
                setProjectsList(projRes.data.projects);
            }

            const rmRes = await api.get('/richmenu/metadata');
            if (rmRes.data && Array.isArray(rmRes.data.menus)) {
                setRichMenusList(rmRes.data.menus);
            } else if (rmRes.data && Array.isArray(rmRes.data.richmenus)) {
                setRichMenusList(rmRes.data.richmenus);
            } else if (rmRes.data && Array.isArray(rmRes.data)) {
                setRichMenusList(rmRes.data);
            }
        } catch (err) {
            console.error("Failed to load dropdown data", err);
        }
    };

    const fetchFollowRules = async () => {
        setLoading(true);
        try {
            const res = await api.get('/rule-designer/follow-rules');
            setRules(res.data.rules || []);
        } catch (err) {
            showToast('載入加入好友設定失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        // Check if there is already an active rule
        const activeRule = rules.find(r => r.content === '*');
        
        setEditingRule(null);
        setRuleNote('加入好友訊息');
        setIsEnabled(!activeRule); // If active rule exists, default to disabled (OFF)
        setMsgRpyList(['感謝您加入我們的官方帳號！']);
        setSelectedTags([]);
        setSelectedJourney('');
        setSelectedRichMenu('');
        setIsEditModalOpen(true);
    };

const cleanNoteTitle = (noteStr = '') => {
    if (!noteStr) return '';
    return noteStr.replace(/^加入好友(?:訊息|設定)(\s*-\s*)?/, '').trim();
};

    const handleOpenEditModal = (rule) => {
        setEditingRule(rule);
        setRuleNote(cleanNoteTitle(rule.note));
        const isRuleActive = rule.content === '*' || (Array.isArray(rule.content) && rule.content.includes('*')) || String(rule.content).includes('*');
        setIsEnabled(isRuleActive);
        
        // Parse msg_rpy
        let parsedRpy = [];
        if (Array.isArray(rule.msg_rpy)) {
            parsedRpy = rule.msg_rpy.map(m => {
                if (typeof m === 'string') {
                    try { return JSON.parse(m); } catch (e) { return m; }
                }
                return m;
            });
        }
        setMsgRpyList(parsedRpy.length > 0 ? parsedRpy : ['']);

        // Parse function
        const parsedFunc = parseFunctionString(rule.function || '');
        setSelectedTags(parsedFunc.tags);
        setSelectedJourney(parsedFunc.journey);
        setSelectedRichMenu(parsedFunc.richMenu);

        setIsEditModalOpen(true);
    };

    const handleToggleRuleStatus = async (rule) => {
        const isRuleActive = rule.content === '*' || (Array.isArray(rule.content) && rule.content.includes('*')) || String(rule.content).includes('*');
        const isActivating = !isRuleActive;
        
        // Single active enforcement in frontend
        if (isActivating) {
            const activeRule = rules.find(r => r.id !== rule.id && (r.content === '*' || (Array.isArray(r.content) && r.content.includes('*')) || String(r.content).includes('*')));
            if (activeRule) {
                Swal.fire({
                    icon: 'warning',
                    title: '無法啟用設定',
                    text: '已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。',
                    confirmButtonColor: '#FFD700',
                    confirmButtonText: '我知道了'
                });
                return;
            }
        } else {
            // Prevent disabling if no other active rule exists
            const otherActiveRules = rules.filter(r => r.id !== rule.id && (r.content === '*' || (Array.isArray(r.content) && r.content.includes('*')) || String(r.content).includes('*')));
            if (rules.length <= 1 || otherActiveRules.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: '無法停用設定',
                    text: '至少需維持一則啟用的加入好友訊息，無法停用此設定。',
                    confirmButtonColor: '#FFD700',
                    confirmButtonText: '我知道了'
                });
                return;
            }
        }

        try {
            const res = await api.post(`/rule-designer/follow-rules/${rule.id}/toggle`, {
                content: isActivating ? '*' : 'OFF'
            });
            showToast(isActivating ? '已啟用加入好友訊息設定' : '已停用加入好友訊息設定', 'success');
            fetchFollowRules();
        } catch (err) {
            const errorMsg = err.response?.data?.error || '修改狀態失敗';
            Swal.fire({ icon: 'error', title: '錯誤', text: errorMsg });
        }
    };

    const handleSaveRule = async () => {
        // Single active check if trying to enable
        if (isEnabled) {
            const activeRule = rules.find(r => (!editingRule || r.id !== editingRule.id) && r.content === '*');
            if (activeRule) {
                Swal.fire({
                    icon: 'warning',
                    title: '無法啟用設定',
                    text: '已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。',
                    confirmButtonColor: '#FFD700',
                    confirmButtonText: '我知道了'
                });
                return;
            }
        }

        // Validate max 5 messages
        const validMsgs = msgRpyList.filter(m => {
            if (typeof m === 'string') return m.trim().length > 0;
            return m && typeof m === 'object';
        });

        if (validMsgs.length === 0) {
            showToast('請設定至少一則歡迎訊息', 'warning');
            return;
        }

        if (validMsgs.length > 5) {
            showToast('歡迎訊息最多只能設定 5 則', 'warning');
            return;
        }

        // Construct function string
        const funcString = buildFunctionString({
            tags: selectedTags,
            journey: selectedJourney,
            richMenu: selectedRichMenu
        });

        const fullNote = ruleNote.startsWith('加入好友訊息') ? ruleNote : `加入好友訊息 - ${ruleNote}`;

        const payload = {
            rule: {
                state_in: ['*'],
                type: 'Follow',
                content: isEnabled ? '*' : 'OFF',
                msg_rpy: validMsgs,
                function: funcString,
                state_out: ['*'],
                note: fullNote
            }
        };

        try {
            if (editingRule) {
                await api.put(`/rule-designer/follow-rules/${editingRule.id}`, payload);
                showToast('加入好友訊息設定更新成功', 'success');
            } else {
                await api.post('/rule-designer/follow-rules', payload);
                showToast('新增加入好友訊息設定成功', 'success');
            }
            setIsEditModalOpen(false);
            fetchFollowRules();
        } catch (err) {
            const errorMsg = err.response?.data?.error || '儲存失敗';
            Swal.fire({ icon: 'error', title: '儲存失敗', text: errorMsg });
        }
    };

    const handleDeleteRule = async (ruleId) => {
        const confirm = await Swal.fire({
            title: '確定要刪除這則加入好友設定嗎？',
            text: '刪除後無法復原',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '確定刪除',
            cancelButtonText: '取消'
        });

        if (confirm.isConfirmed) {
            try {
                await api.delete(`/rule-designer/rules/${ruleId}?type=q_bank`);
                showToast('刪除成功', 'success');
                fetchFollowRules();
            } catch (err) {
                showToast('刪除失敗', 'error');
            }
        }
    };

    // Helper to format preview
    const formatMsgSummary = (msgRpy) => {
        if (!Array.isArray(msgRpy) || msgRpy.length === 0) return '尚未設定訊息';
        return msgRpy.map((m, idx) => {
            if (typeof m === 'string') {
                if (m.startsWith('QA|')) return `[QA 庫引用] ${m}`;
                if (m.startsWith('{') || m.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(m);
                        if (parsed.type === 'flex') return `[Flex 訊息] ${parsed.altText || '圖文選單/訊息'}`;
                    } catch (e) {}
                }
                return `[訊息 ${idx + 1}] ${m.substring(0, 30)}${m.length > 30 ? '...' : ''}`;
            } else if (m && typeof m === 'object') {
                if (m.type === 'flex') return `[Flex 訊息] ${m.altText || '視訊/卡片訊息'}`;
            }
            return `[訊息 ${idx + 1}] 內容自訂`;
        }).join('  |  ');
    };

    return (
        <div style={{ padding: '20px', color: '#fff', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', color: '#FFD700' }}>
                        <UserPlus size={28} /> 加入好友設定
                    </h2>
                    <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>
                        設定 LINE 使用者加入官方帳號時發送的歡迎訊息與 CRM 自動初始化動作（標籤、圖文選單、自動旅程）。
                    </p>
                </div>
                <button
                    onClick={handleOpenCreateModal}
                    style={{
                        backgroundColor: '#FFD700',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '10px 18px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={18} /> 新增加入好友設定
                </button>
            </div>

            {/* Warning Alert Banner */}
            <div style={{ backgroundColor: '#2a2410', borderLeft: '4px solid #FFD700', borderRadius: '6px', padding: '15px', marginBottom: '25px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <AlertCircle size={22} color="#FFD700" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '14px', color: '#eee', lineHeight: '1.6' }}>
                    <strong>提示與約定說明：</strong>
                    <ul style={{ paddingLeft: '20px', marginTop: '5px', marginBottom: 0 }}>
                        <li><strong>單一啟用限制：</strong>同一時間只能啟用一則加入好友訊息設定。當已有啟用的設定時，無法啟用其他設定。</li>
                        <li>若全站沒有任何啟用的設定，系統會維持一則預設加入好友訊息並套用預設圖文選單。</li>
                    </ul>
                </div>
            </div>

            {/* Rules List */}
            {loading ? (
                <LoadingSpinner />
            ) : rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', background: '#222', borderRadius: '8px', color: '#888' }}>
                    <Info size={40} style={{ marginBottom: '10px' }} />
                    <p>目前尚無任何加入好友訊息設定</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {rules.map((rule) => {
                        const isRuleActive = rule.content === '*' || (Array.isArray(rule.content) && rule.content.includes('*')) || String(rule.content).includes('*');
                        const parsedFunc = parseFunctionString(rule.function || '');
                        
                        return (
                            <div 
                                key={rule.id} 
                                style={{ 
                                    backgroundColor: '#222', 
                                    border: isRuleActive ? '2px solid #4CAF50' : '1px solid #333', 
                                    borderRadius: '8px', 
                                    padding: '20px',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ 
                                            backgroundColor: isRuleActive ? '#4CAF50' : '#666', 
                                            color: '#fff', 
                                            padding: '4px 10px', 
                                            borderRadius: '20px', 
                                            fontSize: '12px', 
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            <Power size={14} /> {isRuleActive ? '啟用中 (*)' : '已停用 (OFF)'}
                                        </span>
                                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                                            {cleanNoteTitle(rule.note) || '加入好友設定'}
                                        </h3>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => handleToggleRuleStatus(rule)}
                                            style={{
                                                backgroundColor: isRuleActive ? '#d9534f' : '#5cb85c',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '6px 14px',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isRuleActive ? '停用' : '啟用'}
                                        </button>
                                        <button
                                            onClick={() => handleOpenEditModal(rule)}
                                            style={{
                                                backgroundColor: '#333',
                                                color: '#fff',
                                                border: '1px solid #555',
                                                borderRadius: '4px',
                                                padding: '6px 14px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            <Edit2 size={14} /> 編輯
                                        </button>
                                        {rules.length > 1 && (
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    color: '#ff4d4f',
                                                    border: '1px solid #ff4d4f',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    fontSize: '13px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Summary of Messages & Actions */}
                                <div style={{ fontSize: '14px', color: '#ccc', backgroundColor: '#1a1a1a', padding: '12px 15px', borderRadius: '6px', marginBottom: '10px' }}>
                                    <strong><MessageSquare size={14} inline style={{ marginRight: '5px' }} /> 歡迎訊息內容：</strong>
                                    <span style={{ color: '#FFD700', marginLeft: '8px' }}>
                                        {formatMsgSummary(rule.msg_rpy)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '13px', color: '#aaa' }}>
                                    {parsedFunc.tags.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Tag size={14} color="#4CAF50" />
                                            <span>標籤：{parsedFunc.tags.join(', ')}</span>
                                        </div>
                                    )}
                                    {parsedFunc.richMenu && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Zap size={14} color="#FF9800" />
                                            <span>套用圖文選單：{parsedFunc.richMenu}</span>
                                        </div>
                                    )}
                                    {parsedFunc.journey && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <RefreshCw size={14} color="#00BCD4" />
                                            <span>加入自動旅程：{
                                                (projectsList.find(p => String(p.id || p.project_id) === String(parsedFunc.journey)) || {}).project_name || 
                                                (projectsList.find(p => String(p.id || p.project_id) === String(parsedFunc.journey)) || {}).name || 
                                                `旅程 ${parsedFunc.journey}`
                                            }</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for Create/Edit */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#222', width: '700px', maxHeight: '90vh', borderRadius: '8px', overflowY: 'auto', padding: '25px', border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFD700' }}>
                                {editingRule ? '編輯加入好友設定' : '新增加入好友設定'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Note / Title */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>設定名稱 / 備註：</label>
                            <input 
                                type="text"
                                value={ruleNote}
                                onChange={(e) => setRuleNote(e.target.value)}
                                placeholder="例如：診所新好友歡迎訊息"
                                style={{ width: '100%', padding: '10px', backgroundColor: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px' }}
                            />
                        </div>

                        {/* Enabled Status Toggle */}
                        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label style={{ fontWeight: 'bold' }}>啟用狀態：</label>
                            <button
                                type="button"
                                onClick={() => setIsEnabled(!isEnabled)}
                                style={{
                                    backgroundColor: isEnabled ? '#4CAF50' : '#666',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Power size={16} /> {isEnabled ? '啟用 (content = *)' : '停用 (content = OFF)'}
                            </button>
                        </div>

                        {/* Welcome Messages (1 to 5) */}
                        <div style={{ marginBottom: '25px', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <label style={{ fontWeight: 'bold', color: '#FFD700' }}>歡迎訊息清單 (最多 5 則)：</label>
                                <span style={{ fontSize: '12px', color: '#aaa' }}>{msgRpyList.length} / 5 則</span>
                            </div>

                            {msgRpyList.map((msg, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <textarea
                                        rows={2}
                                        value={typeof msg === 'string' ? msg : JSON.stringify(msg)}
                                        onChange={(e) => {
                                            const updated = [...msgRpyList];
                                            updated[idx] = e.target.value;
                                            setMsgRpyList(updated);
                                        }}
                                        placeholder={`歡迎訊息 ${idx + 1} 內容 (可輸入文字或 QA| 引用)`}
                                        style={{ flex: 1, padding: '8px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = msgRpyList.filter((_, i) => i !== idx);
                                            setMsgRpyList(updated);
                                        }}
                                        disabled={msgRpyList.length === 1}
                                        style={{ backgroundColor: 'transparent', color: '#ff4d4f', border: '1px solid #444', borderRadius: '4px', padding: '0 10px', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {msgRpyList.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => setMsgRpyList([...msgRpyList, ''])}
                                    style={{ backgroundColor: '#333', color: '#fff', border: '1px dashed #666', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', width: '100%' }}
                                >
                                    + 新增一則訊息 ({msgRpyList.length}/5)
                                </button>
                            )}
                        </div>

                        {/* CRM Actions (Tags, Rich Menu, Journey) */}
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#FFD700', marginBottom: '12px' }}>CRM 初始化動作設定：</h4>
                            
                            {/* Tags */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px', color: '#ccc' }}>1. 新增初始標籤 (可多選)：</label>
                                <TagInput
                                    tags={selectedTags}
                                    onChange={(newTags) => setSelectedTags(newTags)}
                                    availableTags={tagsList.map(t => typeof t === 'string' ? t : t.name)}
                                />
                            </div>

                            {/* Rich Menu */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px', color: '#ccc' }}>2. 套用初始圖文選單：</label>
                                <select
                                    value={selectedRichMenu}
                                    onChange={(e) => setSelectedRichMenu(e.target.value)}
                                    style={{ width: '100%', padding: '10px', backgroundColor: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px' }}
                                >
                                    <option value="">-- 不變更圖文選單 --</option>
                                    {richMenusList.map(rm => (
                                        <option key={rm.ui_uuid || rm.id} value={rm.ui_uuid || rm.id}>
                                            {rm.menu_name || rm.name || rm.ui_uuid} {rm.status === 'default' ? '(預設)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Journey */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px', color: '#ccc' }}>3. 加入指定自動旅程：</label>
                                <select
                                    value={selectedJourney}
                                    onChange={(e) => setSelectedJourney(e.target.value)}
                                    style={{ width: '100%', padding: '10px', backgroundColor: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px' }}
                                >
                                    <option value="">-- 不加入自動旅程 --</option>
                                    {projectsList.map(p => {
                                        const projName = p.project_name || p.name || p.title || `旅程 ${p.id || p.project_id}`;
                                        const projId = p.id || p.project_id;
                                        return (
                                            <option key={projId} value={projId}>
                                                {projName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Modal Footer Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                style={{ backgroundColor: '#444', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveRule}
                                style={{ backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                儲存設定
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
