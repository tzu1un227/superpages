import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Plus, Search, Edit2, Trash2, Save, X, Eye, 
    Workflow, MessageSquare, ChevronRight, AlertCircle, 
    PlusCircle, Info, ArrowRight, Layers, FileJson,
    SplitSquareVertical, RefreshCw, Layers as LayersIcon,
    Calendar, Clock, Tag, ChevronDown, ChevronUp, Upload
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import JourneyPreview from '../components/JourneyPreview';
import { useToast } from '../contexts/ToastContext';
import FlexMessageEditor from '../components/FlexMessageEditor';

const BANK_TYPES = [
    { id: 'q_bank', label: 'Q_bank (核心規則)', color: '#FFD700' },
    { id: 'ad_bank', label: 'AD_bank (管理員規則)', color: '#FF9800' },
    { id: 'qa_bank', label: 'QA_bank (回覆庫)', color: '#4CAF50' }
];

// Moved OUTSIDE RuleDesigner to prevent re-creation on every render (fixes focus loss)
const TableCellTextarea = ({ value, onChange }) => {
    const [focused, setFocused] = React.useState(false);
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={(e) => {
                setFocused(true);
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight + 2) + 'px';
            }}
            onBlur={(e) => {
                setFocused(false);
                e.target.style.height = '32px';
            }}
            onInput={(e) => {
                if(focused) {
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight + 2) + 'px';
                }
            }}
            style={{
                width: '100%',
                padding: '6px 8px',
                border: focused ? '1px solid #555' : '1px solid transparent',
                backgroundColor: focused ? '#222' : 'transparent',
                color: '#eee',
                fontSize: '13px',
                transition: 'border 0.2s, background-color 0.2s',
                minWidth: '100px',
                borderRadius: '4px',
                resize: focused ? 'vertical' : 'none',
                overflow: focused ? 'auto' : 'hidden',
                height: focused ? 'auto' : '32px',
                minHeight: '32px',
                fontFamily: 'inherit',
                lineHeight: '20px',
                display: 'block',
                position: focused ? 'relative' : 'static',
                zIndex: focused ? 10 : 1
            }}
            rows={1}
        />
    );
};

// --- Helpers for Simple Mode Logic ---
const parseCheck = (checkArray) => {
    const result = { startDate: '', endDate: '', startTime: '', endTime: '' };
    if (!Array.isArray(checkArray)) return result;

    checkArray.forEach(item => {
        if (!item) return;
        
        // 支援舊格式解析 (相容性)
        if (item.includes('check_date_range')) {
            const match = item.match(/'([^']*)',\s*'([^']*)'/);
            if (match) {
                if (match[1]) result.startDate = match[1];
                if (match[2]) result.endDate = match[2];
            }
        } else if (item.includes('check_time_range')) {
            const match = item.match(/'([^']*)',\s*'([^']*)'/);
            if (match) {
                if (match[1]) result.startTime = match[1];
                if (match[2]) result.endTime = match[2];
            }
        }

        // 新格式解析: sys.now() (支援字串比較與數字比較)
        // Date: sys.now() >= 1746115200 或 sys.now() >= '2026-05-04 00:00:00'
        const dateMatches = [...item.matchAll(/sys\.now\(\)\s*([><]=?)\s*(?:'(\d{4}-\d{2}-\d{2})|(\d{10,}))/g)];
        dateMatches.forEach(m => {
            const op = m[1];
            const dateStr = m[2];
            const ts = m[3];
            
            if (dateStr) {
                if (op.includes('>')) result.startDate = dateStr;
                if (op.includes('<')) result.endDate = dateStr;
            } else if (ts) {
                // 將 Timestamp 轉回 YYYY-MM-DD (考慮本地時區)
                const date = new Date(parseInt(ts) * 1000);
                const Y = date.getFullYear();
                const M = String(date.getMonth() + 1).padStart(2, '0');
                const D = String(date.getDate()).padStart(2, '0');
                const formatted = `${Y}-${M}-${D}`;
                if (op.includes('>')) result.startDate = formatted;
                if (op.includes('<')) result.endDate = formatted;
            }
        });

        // Time: (sys.now() + 28800) % 86400 >= 43200
        const timeMatches = [...item.matchAll(/\(sys\.now\(\)\s*\+\s*\d+\)\s*%\s*86400\s*([><]=?)\s*(\d+)/g)];
        timeMatches.forEach(m => {
            const op = m[1];
            const totalSeconds = parseInt(m[2]);
            const h = Math.floor(totalSeconds / 3600);
            const min = Math.floor((totalSeconds % 3600) / 60);
            const formatted = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            if (op.includes('>')) result.startTime = formatted;
            if (op.includes('<')) result.endTime = formatted;
        });

        // 支援舊格式 (相容性): sys.now()[11:16]
        if (item.includes('sys.now()[11:16]')) {
            const oldMatches = [...item.matchAll(/sys\.now\(\)\[11:16\]\s*([><]=?)\s*'(\d{2}:\d{2})/g)];
            oldMatches.forEach(m => {
                const op = m[1];
                const time = m[2];
                if (op.includes('>')) result.startTime = time;
                if (op.includes('<')) result.endTime = time;
            });
        }
    });
    return result;
};

const stringifyCheck = ({ startDate, endDate, startTime, endTime }) => {
    const checkArray = [];
    
    // Date Logic (使用 Unix Timestamp，因為 sys.now() 是整數)
    if (startDate && endDate) {
        const s = Math.floor(new Date(`${startDate} 00:00:00`).getTime() / 1000);
        const e = Math.floor(new Date(`${endDate} 23:59:59`).getTime() / 1000);
        checkArray.push(`sys.now() >= ${s} and sys.now() <= ${e}`);
    } else if (startDate) {
        const s = Math.floor(new Date(`${startDate} 00:00:00`).getTime() / 1000);
        checkArray.push(`sys.now() >= ${s}`);
    } else if (endDate) {
        const e = Math.floor(new Date(`${endDate} 23:59:59`).getTime() / 1000);
        checkArray.push(`sys.now() <= ${e}`);
    }

    // Time Logic (使用 Modulo 計算當天秒數，假設 UTC+8: 28800s)
    if (startTime || endTime) {
        const getSeconds = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 3600 + m * 60;
        };
        if (startTime && endTime) {
            checkArray.push(`(sys.now() + 28800) % 86400 >= ${getSeconds(startTime)} and (sys.now() + 28800) % 86400 <= ${getSeconds(endTime)}`);
        } else if (startTime) {
            checkArray.push(`(sys.now() + 28800) % 86400 >= ${getSeconds(startTime)}`);
        } else if (endTime) {
            checkArray.push(`(sys.now() + 28800) % 86400 <= ${getSeconds(endTime)}`);
        }
    }
    
    return checkArray;
};

const parseFunction = (funcStr) => {
    if (!funcStr) return { tag: '' };
    const match = funcStr.match(/set_tag\|([^"']+)/);
    return { tag: match ? match[1] : '' };
};

const stringifyFunction = (tag) => {
    if (!tag || !tag.trim()) return '';
    return `update(f"set_tag|${tag.trim()}")`;
};
// --------------------------------------

function RuleDesigner() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    
    // State
    const [bankType, setBankType] = useState('q_bank');
    const [rules, setRules] = useState([]);
    const [draftRules, setDraftRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [rowErrors, setRowErrors] = useState({}); // { rowIndex: ['error1', 'error2'] }
    const [designMode, setDesignMode] = useState('simple'); // 'simple' | 'engineering'
    const [selectedRuleIndex, setSelectedRuleIndex] = useState(null);
    
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [editingRowIndex, setEditingRowIndex] = useState(null);
    const [isUploadingMsg, setIsUploadingMsg] = useState(null);
    const [editingFlexMsgIndex, setEditingFlexMsgIndex] = useState(null);
    const [msgRpyList, setMsgRpyList] = useState([]); 
    const [savingMsg, setSavingMsg] = useState(false);
    
    // Flex Editor State
    const [showFlexEditor, setShowFlexEditor] = useState(false);
    const [flexEditorIndex, setFlexEditorIndex] = useState(null);

    // Initial Load
    useEffect(() => {
        fetchRules();
    }, [bankType, oaId, designMode]);

    useEffect(() => {
        if (designMode === 'simple') {
            setBankType('q_bank');
            setSelectedRuleIndex(null);
        }
    }, [designMode]);

    const fetchRules = async () => {
        setLoading(true);
        setRowErrors({}); // Clear all errors on reload/switch
        try {
            const res = await api.get(`/rule-designer/rules?type=${bankType}`);
            let newRules = res.data.rules || [];
            
            // Parse _updatedAt from note
            newRules = newRules.map(r => {
                const parts = (r.note || '').split('|UPDATED:');
                return {
                    ...r,
                    note: parts[0],
                    _updatedAt: parts.length > 1 ? parts[1] : null
                };
            });

            if (designMode === 'simple') {
                // Filter out '工程用法則'
                newRules = newRules.filter(r => !r.note.includes('工程用法則'));
                
                // Sort by _updatedAt descending
                newRules.sort((a, b) => {
                    const timeA = a._updatedAt ? new Date(a._updatedAt).getTime() : 0;
                    const timeB = b._updatedAt ? new Date(b._updatedAt).getTime() : 0;
                    return timeB - timeA;
                });
            }

            setRules(newRules);
            setDraftRules(JSON.parse(JSON.stringify(newRules)).map(r => ({ ...r, _isDirty: false })));
        } catch (err) {
            showToast('載入規則失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNewRule = () => {
        const isSimple = designMode === 'simple';
        const newRule = ['q_bank', 'ad_bank'].includes(bankType) ? {
            state_in: ['*'],
            type: 'Message',
            content: [''],
            check: [''],
            msg_rpy: [],
            state_out: '00000',
            function: '',
            history: true,
            note: isSimple ? '新規則 (簡易模式)' : '新規則',
            _isDirty: true,
            _isNew: true
        } : {
            tag: 'new_tag',
            msg_rpy: [],
            io: 'Output',
            check: [''],
            function: '',
            ans: [''],
            type: 'Message',
            _isDirty: true,
            _isNew: true
        };
        setDraftRules([newRule, ...draftRules]);
        if (isSimple) {
            setSelectedRuleIndex(0);
        }
    };

    const handleFieldChange = (index, field, value) => {
        const newDrafts = [...draftRules];
        
        // 陣列欄位特殊處理
        if (Array.isArray(value)) {
            newDrafts[index][field] = value;
        } else if (field === 'state_in' || field === 'content' || field === 'check' || field === 'ans') {
            // 以逗號分隔字串轉換為陣列
            newDrafts[index][field] = value.split(',').map(s => s.trim());
        } else {
            newDrafts[index][field] = value;
        }
        
        newDrafts[index]._isDirty = true;
        setDraftRules(newDrafts);
        // Clear errors for this row when user edits
        if (rowErrors[index]) {
            const newErrors = { ...rowErrors };
            delete newErrors[index];
            setRowErrors(newErrors);
        }
    };

    const handleOpenMsgModal = (index) => {
        setEditingRowIndex(index);
        const rawMsg = draftRules[index].msg_rpy || [];
        try {
            const parsedMsg = rawMsg.map(m => (typeof m === 'string' ? JSON.parse(m) : m));
            setMsgRpyList(parsedMsg);
        } catch (e) {
            setMsgRpyList([]);
        }
        setIsMsgModalOpen(true);
    };

    const handleSaveMsgModal = () => {
        if (editingRowIndex === null) return;
        
        for (let i = 0; i < msgRpyList.length; i++) {
            const msg = msgRpyList[i];
            if (msg.OTYPE === 'TextSendMessage') {
                if (!msg.text || !msg.text.trim()) {
                    showToast('文字訊息內容不能為空白', 'error');
                    return;
                }
            } else if (msg.OTYPE === 'ImageSendMessage') {
                if (!msg.original_content_url || !msg.original_content_url.trim()) {
                    showToast('圖片訊息網址不能為空白', 'error');
                    return;
                }
            }
        }
        
        setSavingMsg(true);
        showToast('正在儲存中...', 'info');
        setTimeout(() => {
            const newDrafts = [...draftRules];
            newDrafts[editingRowIndex].msg_rpy = msgRpyList;
            newDrafts[editingRowIndex]._isDirty = true;
            setDraftRules(newDrafts);
            setIsMsgModalOpen(false);
            setEditingRowIndex(null);
            setSavingMsg(false);
        }, 500); // 模擬載入時間 500ms
    };

    // --- Message Editor inside Modal ---
    const handleAddMessage = (type = 'TextSendMessage') => {
        let newMsg = { OTYPE: type };
        if (type === 'TextSendMessage') newMsg.text = '新訊息';
        else if (type === 'FlexSendMessage') {
            newMsg.alt_text = '圖文訊息';
            newMsg.contents = { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '圖文訊息內容' }] } };
        }
        else if (type === 'ImageSendMessage') {
            newMsg.original_content_url = 'https://via.placeholder.com/800x400';
            newMsg.preview_image_url = 'https://via.placeholder.com/800x400';
        }
        setMsgRpyList([...msgRpyList, newMsg]);
    };

    const handleRemoveMessage = (index) => {
        setMsgRpyList(msgRpyList.filter((_, i) => i !== index));
    };

    const handleUpdateMessage = (index, field, value) => {
        const newList = [...msgRpyList];
        newList[index] = { ...newList[index], [field]: value };
        setMsgRpyList(newList);
    };
    // ------------------------------------

    const handleSaveRow = async (index) => {
        // Clear previous errors for this row
        const newErrors = { ...rowErrors };
        delete newErrors[index];
        setRowErrors(newErrors);

        setLoading(true);
        showToast('正在儲存中...', 'info');
        const ruleToSave = { ...draftRules[index] };
        delete ruleToSave._isDirty;
        delete ruleToSave._isNew;
        const nowIso = new Date().toISOString();
        ruleToSave.note = `${ruleToSave.note || ''}|UPDATED:${nowIso}`;
        delete ruleToSave._updatedAt;

        try {
            let res;
            if (ruleToSave.id !== undefined && ruleToSave.id !== null && !draftRules[index]._isNew) {
                res = await api.put(`/rule-designer/rules/${ruleToSave.id}`, {
                    bank_type: bankType,
                    design_mode: designMode,
                    rule: ruleToSave
                });
            } else {
                res = await api.post('/rule-designer/rules', {
                    bank_type: bankType,
                    design_mode: designMode,
                    rule: ruleToSave
                });
            }

            if (res.data.status === 'success') {
                showToast('規則已儲存', 'success');
                const newDrafts = [...draftRules];
                newDrafts[index]._isDirty = false;
                newDrafts[index]._isNew = false;
                newDrafts[index]._updatedAt = nowIso;
                if (res.data.id) newDrafts[index].id = res.data.id;
                setDraftRules(newDrafts);
                // Optionally re-fetch to ensure sync with DB, but local update is enough for now
                fetchRules();
                if (designMode === 'simple') {
                    setSelectedRuleIndex(null);
                }
            }
        } catch (err) {
            // Handle validation errors from backend
            if (err.response && err.response.status === 400 && err.response.data&& err.response.data.errors) {
                const updatedErrors = { ...rowErrors };
                updatedErrors[index] = err.response.data.errors;
                setRowErrors(updatedErrors);
                
                const errorDetails = err.response.data.errors.join('\n');
                showToast(`偵錯發現 ${err.response.data.errors.length} 個問題:\n${errorDetails}`, 'error');
            } else {
                showToast('儲存失敗', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRow = async (index) => {
        const ruleTarget = draftRules[index];
        if (ruleTarget._isNew) {
            // 如果是剛新增還沒存過，直接拔除 draft
            const newDrafts = [...draftRules];
            newDrafts.splice(index, 1);
            setDraftRules(newDrafts);
            // Clear errors: remove this index and shift subsequent indices
            const newErrors = {};
            Object.entries(rowErrors).forEach(([k, v]) => {
                const ki = parseInt(k);
                if (ki < index) newErrors[ki] = v;
                else if (ki > index) newErrors[ki - 1] = v;
            });
            setRowErrors(newErrors);
            if (designMode === 'simple') {
                setSelectedRuleIndex(null);
            }
            return;
        }

        if (!window.confirm(`確定要刪除規則 ${ruleTarget.id} 嗎？`)) return;
        setLoading(true);
        showToast('正在刪除中...', 'info');
        try {
            await api.delete(`/rule-designer/rules/${ruleTarget.id}?type=${bankType}`);
            showToast('規則已刪除', 'success');
            const newDrafts = [...draftRules];
            newDrafts.splice(index, 1);
            setDraftRules(newDrafts);
            // Clear errors: remove this index and shift subsequent indices
            const newErrors = {};
            Object.entries(rowErrors).forEach(([k, v]) => {
                const ki = parseInt(k);
                if (ki < index) newErrors[ki] = v;
                else if (ki > index) newErrors[ki - 1] = v;
            });
            setRowErrors(newErrors);
            fetchRules();
            if (designMode === 'simple') {
                setSelectedRuleIndex(null);
            }
        } catch (err) {
            showToast('刪除失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const matchesSearch = (r, search) => {
        const lowSearch = search.toLowerCase();
        const note = r.note || '';
        const tag = r.tag || '';
        const content = Array.isArray(r.content) ? r.content.join(' ') : (r.content || '');
        const stateIn = Array.isArray(r.state_in) ? r.state_in.join(' ') : (r.state_in || '');
        const stateOut = r.state_out || '';
        
        return note.toLowerCase().includes(lowSearch) || 
               tag.toLowerCase().includes(lowSearch) || 
               content.toLowerCase().includes(lowSearch) ||
               stateIn.toLowerCase().includes(lowSearch) ||
               stateOut.toLowerCase().includes(lowSearch);
    };

    const previewPayload = useMemo(() => {
        return msgRpyList.map(m => {
            if (m.Line) return m.Line;
            return m;
        });
    }, [msgRpyList]);

    // (TableCellTextarea is now defined outside the component)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <MessageSquare size={32} className="text-yellow" />
                        {designMode === 'simple' ? '關鍵字回覆' : '法則表設計'}
                    </h1>
                    <p style={{ color: '#B0B0B0' }}>
                        {designMode === 'simple' ? '設定當用戶輸入特定關鍵字時，系統自動回覆的內容。' : '在表格中直接瀏覽、編輯法則與 QA 規則'}
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {designMode === 'engineering' && BANK_TYPES.map(bank => (
                        <button
                            key={bank.id}
                            onClick={() => { setBankType(bank.id); }}
                            style={{
                                padding: '8px 20px',
                                border: 'none',
                                borderRadius: '20px',
                                backgroundColor: bankType === bank.id ? bank.color : '#222',
                                color: bankType === bank.id ? '#000' : '#888',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {bank.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '5px' }}>
                <button
                    onClick={() => { setDesignMode('simple'); setSelectedRuleIndex(null); }}
                    style={{
                        padding: '10px 24px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: designMode === 'simple' ? '3px solid var(--primary-yellow)' : '3px solid transparent',
                        color: designMode === 'simple' ? 'var(--primary-yellow)' : '#888',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s'
                    }}
                >
                    簡易模式
                </button>
                <button
                    onClick={() => { setDesignMode('engineering'); setSelectedRuleIndex(null); }}
                    style={{
                        padding: '10px 24px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: designMode === 'engineering' ? '3px solid var(--primary-yellow)' : '3px solid transparent',
                        color: designMode === 'engineering' ? 'var(--primary-yellow)' : '#888',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s'
                    }}
                >
                    工程模式
                </button>
            </div>

            {/* Toolbar */}
            {!(designMode === 'simple' && selectedRuleIndex !== null) && (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, position: 'relative', maxWidth: '400px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input 
                            type="text" 
                            placeholder={designMode === 'simple' ? '搜尋關鍵字回覆...' : '搜尋規則 (姓名, Tag, 內容, 狀態)...'}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '35px', width: '100%', fontSize: '13px', borderRadius: '8px', backgroundColor: '#222', border: '1px solid #333', color: '#fff' }}
                        />
                    </div>
                    <button 
                        onClick={handleNewRule}
                        className="primary" 
                        style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', gap: '6px', alignItems: 'center' }}
                    >
                        <Plus size={16} /> {designMode === 'simple' ? '建立關鍵字回覆' : '新增空白列'}
                    </button>
                </div>
            )}

            {/* Task View for Simple Mode */}
            {designMode === 'simple' && selectedRuleIndex === null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '40px' }}>
                    {draftRules.map((rule, idx) => {
                        if (searchTerm && !matchesSearch(rule, searchTerm)) return null;
                        
                        const checkData = parseCheck(rule.check);
                        const funcData = parseFunction(rule.function);
                        const msgCount = Array.isArray(rule.msg_rpy) ? rule.msg_rpy.length : 0;
                        const isEnabled = !!rule.history; // Using history as enabled status
                        
                        return (
                            <div 
                                key={rule.id || `task-${idx}`} 
                                className="card" 
                                style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    padding: '20px', 
                                    cursor: 'pointer', 
                                    border: rule._isDirty ? '1px solid var(--primary-yellow)' : '1px solid #333',
                                    transition: 'border 0.2s, background-color 0.2s',
                                    opacity: isEnabled ? 1 : 0.6
                                }} 
                                onClick={() => setSelectedRuleIndex(idx)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111'}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{rule.note || '(未命名關鍵字)'}</h3>
                                        {!isEnabled && <span style={{ backgroundColor: '#333', color: '#aaa', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>未啟用</span>}
                                        {rule._isNew && <span style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)', color: '#FFD700', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>新建立</span>}
                                        {rule._isDirty && <span style={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>未儲存</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '20px', color: '#888', fontSize: '13px', flexWrap: 'wrap' }}>
                                        <span><span style={{ color: '#aaa' }}>觸發關鍵字:</span> {Array.isArray(rule.content) ? rule.content.join(', ') : (rule.content || '無')}</span>
                                        {(checkData.startDate || checkData.endDate) && <span><span style={{ color: '#aaa' }}>生效期間:</span> {checkData.startDate || '不限'} ~ {checkData.endDate || '不限'}</span>}
                                        {(checkData.startTime || checkData.endTime) && <span><span style={{ color: '#aaa' }}>每日時段:</span> {checkData.startTime || '不限'} ~ {checkData.endTime || '不限'}</span>}
                                        {funcData.tag && <span><span style={{ color: '#aaa' }}>自動上標:</span> {funcData.tag}</span>}
                                        <span><span style={{ color: '#aaa' }}>回覆內容:</span> {msgCount} 則訊息</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    {rule._updatedAt && <span style={{ color: '#666', fontSize: '11px', textAlign: 'right' }}>更新時間:<br/>{new Date(rule._updatedAt).toLocaleString()}</span>}
                                    <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isEnabled} 
                                            onChange={e => {
                                                handleFieldChange(idx, 'history', e.target.checked);
                                                // Trigger auto-save immediately on toggle
                                                setTimeout(() => handleSaveRow(idx), 0);
                                            }} 
                                        />
                                        <span style={{ fontSize: '13px', color: '#ccc' }}>啟用狀態</span>
                                    </label>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(idx); }} className="secondary" disabled={loading} style={{ color: '#ff4d4d', padding: '6px 12px', background: 'transparent', border: '1px solid #ff4d4d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {loading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> 刪除中...</> : '刪除'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {draftRules.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#888', backgroundColor: '#111', borderRadius: '8px', border: '1px dashed #333' }}>
                            <MessageSquare size={48} style={{ color: '#444', marginBottom: '15px' }} />
                            <p style={{ fontSize: '16px' }}>尚未建立任何關鍵字回覆</p>
                            <p style={{ fontSize: '14px', marginTop: '5px' }}>點擊右上角「建立關鍵字回覆」開始設定。</p>
                        </div>
                    )}
                </div>
            )}

            {/* Edit View for Simple Mode */}
            {designMode === 'simple' && selectedRuleIndex !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
                    {(() => {
                        const idx = selectedRuleIndex;
                        const rule = draftRules[idx];
                        if (!rule) return null;
                        const checkData = parseCheck(rule.check);
                        const funcData = parseFunction(rule.function);
                        const msgCount = Array.isArray(rule.msg_rpy) ? rule.msg_rpy.length : 0;
                        const isEnabled = !!rule.history;
                        
                        return (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button onClick={() => setSelectedRuleIndex(null)} className="secondary" style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'transparent', border: 'none', color: '#888' }}>
                                        <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} /> 返回列表
                                    </button>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleDeleteRow(idx)} className="secondary" disabled={loading} style={{ color: '#ff4d4d', background: 'transparent', border: '1px solid #ff4d4d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />} 刪除此關鍵字
                                        </button>
                                        {rule._isDirty && <button onClick={() => handleSaveRow(idx)} className="primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />} 儲存設定
                                        </button>}
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                                    {/* Left Column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {/* 基本與觸發條件 */}
                                        <div className="card">
                                            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={18} className="text-yellow" /> 基本資訊</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                <div>
                                                    <label className="label">關鍵字名稱 (內部備註用途)</label>
                                                    <input type="text" disabled={loading} value={rule.note || ''} onChange={e => handleFieldChange(idx, 'note', e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '14px', opacity: loading ? 0.6 : 1 }} placeholder="請輸入名稱" />
                                                </div>
                                                <div>
                                                    <label className="label">觸發關鍵字 (多個關鍵字請用逗號分隔)</label>
                                                    <input type="text" disabled={loading} value={Array.isArray(rule.content) ? rule.content.join(', ') : (rule.content || '')} onChange={e => handleFieldChange(idx, 'content', e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '14px', opacity: loading ? 0.6 : 1 }} placeholder="例如: 優惠, 折扣, 促銷" />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
                                                    <input type="checkbox" disabled={loading} id="rule-enabled" checked={isEnabled} onChange={e => handleFieldChange(idx, 'history', e.target.checked)} style={{ width: '16px', height: '16px', opacity: loading ? 0.6 : 1 }} />
                                                    <label htmlFor="rule-enabled" style={{ cursor: 'pointer', color: '#ccc', flex: 1 }}>啟用此關鍵字回覆</label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 回覆內容 */}
                                        <div className="card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={18} className="text-yellow" /> 回覆內容</h3>
                                                <span style={{ fontSize: '13px', color: msgCount > 0 ? '#4CAF50' : '#888', backgroundColor: msgCount > 0 ? 'rgba(76, 175, 80, 0.1)' : 'transparent', padding: '4px 8px', borderRadius: '4px' }}>
                                                    已設定 {msgCount} 則訊息
                                                </span>
                                            </div>
                                            
                                            {msgCount > 0 ? (
                                                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                                                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {rule.msg_rpy.map((m, i) => {
                                                            let typeLabel = '未知';
                                                            const otype = (typeof m === 'string' ? JSON.parse(m) : m).OTYPE || (typeof m === 'string' ? JSON.parse(m) : m).Line?.OTYPE;
                                                            if (otype === 'TextSendMessage') typeLabel = '文字訊息';
                                                            else if (otype === 'ImageSendMessage') typeLabel = '圖片訊息';
                                                            else if (otype === 'FlexSendMessage') typeLabel = '圖文訊息';
                                                            return <li key={i}>{typeLabel}</li>;
                                                        })}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px dashed #333', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                                                    尚未設定任何回覆訊息
                                                </div>
                                            )}
                                            
                                            <button onClick={() => handleOpenMsgModal(idx)} disabled={loading} className="secondary" style={{ width: '100%', padding: '12px', borderStyle: 'dashed', backgroundColor: 'transparent', opacity: loading ? 0.6 : 1 }}>
                                                <Edit2 size={16} /> {msgCount > 0 ? '編輯回覆訊息內容' : '新增回覆訊息'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Right Column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {/* 生效條件 */}
                                        <div className="card">
                                            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} className="text-yellow" /> 生效條件</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                <div>
                                                    <label className="label">生效日期區間 (留空白為不限制)</label>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <input type="date" disabled={loading} value={checkData.startDate} onChange={e => handleFieldChange(idx, 'check', stringifyCheck({ ...checkData, startDate: e.target.value }))} style={{ flex: 1, padding: '10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', opacity: loading ? 0.6 : 1 }} />
                                                        <span style={{ color: '#666' }}>~</span>
                                                        <input type="date" disabled={loading} value={checkData.endDate} onChange={e => handleFieldChange(idx, 'check', stringifyCheck({ ...checkData, endDate: e.target.value }))} style={{ flex: 1, padding: '10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', opacity: loading ? 0.6 : 1 }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="label">每日生效時段 (留空白為全天)</label>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <input type="time" disabled={loading} value={checkData.startTime} onChange={e => handleFieldChange(idx, 'check', stringifyCheck({ ...checkData, startTime: e.target.value }))} style={{ flex: 1, padding: '10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', opacity: loading ? 0.6 : 1 }} />
                                                        <span style={{ color: '#666' }}>~</span>
                                                        <input type="time" disabled={loading} value={checkData.endTime} onChange={e => handleFieldChange(idx, 'check', stringifyCheck({ ...checkData, endTime: e.target.value }))} style={{ flex: 1, padding: '10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', opacity: loading ? 0.6 : 1 }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 觸發後動作 */}
                                        <div className="card">
                                            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={18} className="text-yellow" /> 觸發後動作</h3>
                                            <div>
                                                <label className="label">自動上標 (限填一個標籤)</label>
                                                <input type="text" disabled={loading} value={funcData.tag} onChange={e => handleFieldChange(idx, 'function', stringifyFunction(e.target.value))} style={{ width: '100%', padding: '10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', opacity: loading ? 0.6 : 1 }} placeholder="例如: 已互動" />
                                                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#888' }}>當用戶觸發此關鍵字時，將自動為該用戶貼上此標籤。</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Table Area (Engineering Mode) */}
            <div className="card" style={{ flex: 1, padding: 0, overflow: 'auto', display: designMode === 'engineering' ? 'flex' : 'none', flexDirection: 'column' }}>
                {loading && draftRules.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <LoadingSpinner size={32} message="載入法則中..." />
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1a1a', zIndex: 10, boxShadow: '0 1px 0 #333' }}>
                            <tr style={{ color: '#888', fontSize: '13px' }}>
                                <th style={{ padding: '12px', width: '60px' }}>ID</th>
                                {['q_bank', 'ad_bank'].includes(bankType) ? (
                                    <>
                                        {designMode === 'engineering' && <th style={{ padding: '4px', width: '8%' }}>state_in</th>}
                                        <th style={{ padding: '4px', width: designMode === 'simple' ? '25%' : '15%' }}>{designMode === 'simple' ? '使用者輸入' : 'content'}</th>
                                        <th style={{ padding: '4px', width: '12%' }}>{designMode === 'simple' ? '備註說明' : 'note'}</th>
                                        {designMode === 'engineering' && (
                                            <>
                                                <th style={{ padding: '4px', width: '8%' }}>state_out</th>
                                                <th style={{ padding: '4px', width: '10%' }}>check</th>
                                                <th style={{ padding: '4px', width: '10%' }}>function</th>
                                                <th style={{ padding: '4px', width: '8%' }}>type</th>
                                                <th style={{ padding: '4px', width: '6%' }}>history</th>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <th style={{ padding: '4px', width: '15%' }}>{designMode === 'simple' ? '標籤' : 'tag'}</th>
                                        {designMode === 'engineering' && <th style={{ padding: '4px', width: '10%' }}>io</th>}
                                        {designMode === 'engineering' && <th style={{ padding: '4px', width: '10%' }}>check</th>}
                                        <th style={{ padding: '4px', width: '15%' }}>{designMode === 'simple' ? '回應內容' : 'ans'}</th>
                                        {designMode === 'engineering' && <th style={{ padding: '4px', width: '10%' }}>function</th>}
                                        {designMode === 'engineering' && <th style={{ padding: '4px', width: '8%' }}>type</th>}
                                    </>
                                )}
                                <th style={{ padding: '4px', width: '10%' }}>{designMode === 'simple' ? '回覆訊息' : 'msg_rpy'}</th>
                                <th style={{ padding: '4px', width: '100px', textAlign: 'right' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {draftRules.map((rule, idx) => {
                                if (searchTerm && !matchesSearch(rule, searchTerm)) return null;
                                
                                const msgCount = Array.isArray(rule.msg_rpy) ? rule.msg_rpy.length : 0;
                                const trStyle = {
                                    borderBottom: '1px solid #222',
                                    backgroundColor: rule._isDirty ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                    transition: 'background 0.2s'
                                };

                                return (
                                    <tr key={rule.id || `draft-${idx}`} style={trStyle}>
                                        <td style={{ padding: '12px', color: '#666', fontSize: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                                {rule._isNew ? <span style={{ color: '#FFD700' }}>[新]</span> : rule.id}
                                                {rowErrors[idx] && rowErrors[idx].length > 0 && (
                                                    <div style={{ position: 'relative' }} title={rowErrors[idx].join('\n')}>
                                                        <AlertCircle size={16} style={{ color: '#ff4d4d', cursor: 'help' }} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        
                                        {['q_bank', 'ad_bank'].includes(bankType) ? (
                                            <>
                                                {designMode === 'engineering' && (
                                                    <td style={{ padding: '4px' }}>
                                                        <TableCellTextarea 
                                                            value={Array.isArray(rule.state_in) ? rule.state_in.join(', ') : (rule.state_in || '')}
                                                            onChange={val => handleFieldChange(idx, 'state_in', val)}
                                                        />
                                                    </td>
                                                )}
                                                <td style={{ padding: '4px' }}>
                                                    <TableCellTextarea 
                                                        value={Array.isArray(rule.content) ? rule.content.join(', ') : (rule.content || '')}
                                                        onChange={val => handleFieldChange(idx, 'content', val)}
                                                    />
                                                </td>
                                                <td style={{ padding: '4px' }}>
                                                    <TableCellTextarea 
                                                        value={rule.note || ''}
                                                        onChange={val => handleFieldChange(idx, 'note', val)}
                                                    />
                                                </td>
                                                {designMode === 'engineering' && (
                                                    <>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={rule.state_out || ''}
                                                                onChange={val => handleFieldChange(idx, 'state_out', val)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={Array.isArray(rule.check) ? rule.check.join(', ') : (rule.check || '')}
                                                                onChange={val => handleFieldChange(idx, 'check', val)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={rule.function || ''}
                                                                onChange={val => handleFieldChange(idx, 'function', val)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={rule.type || ''}
                                                                onChange={val => handleFieldChange(idx, 'type', val)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px', textAlign: 'center' }}>
                                                            <input 
                                                                type="checkbox"
                                                                checked={!!rule.history}
                                                                onChange={e => handleFieldChange(idx, 'history', e.target.checked)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </td>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ padding: '4px' }}>
                                                    <TableCellTextarea 
                                                        value={rule.tag || ''}
                                                        onChange={val => handleFieldChange(idx, 'tag', val)}
                                                    />
                                                </td>
                                                {designMode === 'engineering' && (
                                                    <td style={{ padding: '4px' }}>
                                                        <TableCellTextarea 
                                                            value={rule.io || ''}
                                                            onChange={val => handleFieldChange(idx, 'io', val)}
                                                        />
                                                    </td>
                                                )}
                                                {designMode === 'engineering' && (
                                                    <td style={{ padding: '4px' }}>
                                                        <TableCellTextarea 
                                                            value={Array.isArray(rule.check) ? rule.check.join(', ') : (rule.check || '')}
                                                            onChange={val => handleFieldChange(idx, 'check', val)}
                                                        />
                                                    </td>
                                                )}
                                                <td style={{ padding: '4px' }}>
                                                    <TableCellTextarea 
                                                        value={Array.isArray(rule.ans) ? rule.ans.join(', ') : (rule.ans || '')}
                                                        onChange={val => handleFieldChange(idx, 'ans', val)}
                                                    />
                                                </td>
                                                {designMode === 'engineering' && (
                                                    <>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={rule.function || ''}
                                                                onChange={val => handleFieldChange(idx, 'function', val)}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '4px' }}>
                                                            <TableCellTextarea 
                                                                value={rule.type || ''}
                                                                onChange={val => handleFieldChange(idx, 'type', val)}
                                                            />
                                                        </td>
                                                    </>
                                                )}
                                            </>
                                        )}
                                        
                                        <td style={{ padding: '8px' }}>
                                            <button 
                                                onClick={() => handleOpenMsgModal(idx)}
                                                className="secondary" 
                                                style={{ 
                                                    padding: '6px 12px', fontSize: '11px', width: '100%', 
                                                    backgroundColor: msgCount > 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                    color: msgCount > 0 ? '#4CAF50' : '#aaa',
                                                    border: `1px solid ${msgCount > 0 ? 'rgba(76, 175, 80, 0.3)' : '#333'}`,
                                                    height: '32px'
                                                }}
                                            >
                                                編輯訊息 ({msgCount}則)
                                            </button>
                                        </td>
                                        
                                        <td style={{ padding: '8px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {/* Error banner for this row */}
                                                {rowErrors[idx] && rowErrors[idx].length > 0 && (
                                                    <div style={{
                                                        backgroundColor: 'rgba(255, 77, 77, 0.1)',
                                                        border: '1px solid rgba(255, 77, 77, 0.3)',
                                                        borderRadius: '6px',
                                                        padding: '6px 8px',
                                                        fontSize: '11px',
                                                        color: '#ff6b6b',
                                                        textAlign: 'left',
                                                        maxWidth: '200px'
                                                    }}>
                                                        {rowErrors[idx].map((err, ei) => (
                                                            <div key={ei} style={{ display: 'flex', gap: '4px', alignItems: 'flex-start', marginBottom: ei < rowErrors[idx].length - 1 ? '3px' : 0 }}>
                                                                <AlertCircle size={10} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                                <span>{err}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    {rule._isDirty && (
                                                        <button onClick={() => handleSaveRow(idx)} className="primary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                                            <Save size={14} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteRow(idx)} className="secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#ff4d4d', backgroundColor: 'transparent', border: 'none' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Message Editor Modal (reusing previous editor logic) */}
            {isMsgModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'stretch', padding: '40px' }}>
                    
                    <div className="card" style={{ flex: 1, maxWidth: '900px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        {/* Modal Header */}
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <MessageSquare size={18} className="text-yellow" />
                                編輯回應訊息
                                <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                                    (規則 ID: {draftRules[editingRowIndex]?.id || '新建'})
                                </span>
                            </h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setIsMsgModalOpen(false)} className="secondary" style={{ background: 'transparent', color: '#fff' }}>取消</button>
                                <button onClick={handleSaveMsgModal} className="primary" disabled={savingMsg} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {savingMsg && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                                    確認並儲存
                                </button>
                            </div>
                        </div>

                        {/* Modal Body (2 columns: Editor | Preview) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', flex: 1, minHeight: 0 }}>
                            {/* Editor Column */}
                            <div style={{ padding: '20px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>訊息封包清單</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleAddMessage('TextSendMessage')} disabled={savingMsg} style={{ fontSize: '11px', padding: '4px 8px', opacity: savingMsg ? 0.6 : 1 }} className="secondary">+ 文字</button>
                                        <button onClick={() => handleAddMessage('ImageSendMessage')} disabled={savingMsg} style={{ fontSize: '11px', padding: '4px 8px', opacity: savingMsg ? 0.6 : 1 }} className="secondary">+ 圖片</button>
                                        <button onClick={() => handleAddMessage('FlexSendMessage')} disabled={savingMsg} style={{ fontSize: '11px', padding: '4px 8px', opacity: savingMsg ? 0.6 : 1 }} className="secondary">+ 圖文訊息</button>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {msgRpyList.map((msg, idx) => {
                                        let typeLabel = msg.OTYPE || (msg.Line?.OTYPE);
                                        if (typeLabel === 'TextSendMessage') typeLabel = '文字訊息';
                                        if (typeLabel === 'ImageSendMessage') typeLabel = '圖片訊息';
                                        if (typeLabel === 'FlexSendMessage') typeLabel = '圖文訊息';
                                        return (
                                        <div key={idx} className="card" style={{ padding: '15px', backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <span>#{idx + 1}</span>
                                                    <span style={{ color: '#FFD700' }}>{typeLabel}</span>
                                                </span>
                                                <Trash2 size={16} className="text-red" style={{ cursor: savingMsg ? 'not-allowed' : 'pointer', opacity: savingMsg ? 0.3 : 0.7, pointerEvents: savingMsg ? 'none' : 'auto' }} onClick={() => handleRemoveMessage(idx)} />
                                            </div>
                                            
                                            {/* Editor for Text */}
                                            {(msg.OTYPE === 'TextSendMessage' || msg.Line?.OTYPE === 'TextSendMessage') && (
                                                <textarea 
                                                    disabled={savingMsg}
                                                    value={msg.text || msg.Line?.text || ''}
                                                    onChange={e => handleUpdateMessage(idx, 'text', e.target.value)}
                                                    rows={3}
                                                    style={{ width: '100%', fontSize: '13px', backgroundColor: '#000', border: '1px solid #333', padding: '10px', borderRadius: '6px', opacity: savingMsg ? 0.6 : 1 }}
                                                    placeholder="輸入文字內容..."
                                                />
                                            )}
                                            
                                            {/* Editor for Image */}
                                            {(msg.OTYPE === 'ImageSendMessage' || msg.Line?.OTYPE === 'ImageSendMessage') && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                                        pointerEvents: isUploadingMsg === `image_${idx}` ? 'none' : 'auto',
                                                        width: '100%',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {isUploadingMsg === `image_${idx}` ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                                        {isUploadingMsg === `image_${idx}` ? '上傳中...' : '上傳圖片'}
                                                        <input 
                                                            type="file" 
                                                            disabled={savingMsg || isUploadingMsg === `image_${idx}`}
                                                            accept="image/*"
                                                            onChange={async e => {
                                                                const file = e.target.files[0];
                                                                if (!file) return;
                                                                if (file.size > 1024 * 1024) {
                                                                    alert('錯誤：圖片大小不可超過 1MB');
                                                                    return;
                                                                }
                                                                setIsUploadingMsg(`image_${idx}`);
                                                                const formData = new FormData();
                                                                formData.append('file', file);
                                                                try {
                                                                    const res = await api.post('/upload/github', formData, {
                                                                        headers: { 'Content-Type': 'multipart/form-data' }
                                                                    });
                                                                    if (res.data && res.data.url) {
                                                                        handleUpdateMessage(idx, 'original_content_url', res.data.url);
                                                                        handleUpdateMessage(idx, 'preview_image_url', res.data.url);
                                                                    }
                                                                } catch (err) {
                                                                    alert('圖片上傳失敗');
                                                                    console.error(err);
                                                                } finally {
                                                                    setIsUploadingMsg(null);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                    </label>
                                                </div>
                                            )}

                                            {/* Editor for 圖文訊息 */}
                                            {(msg.OTYPE === 'FlexSendMessage' || msg.Line?.OTYPE === 'FlexSendMessage') && (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', color: '#888' }}>請使用視覺化編輯器編輯圖文訊息內容</span>
                                                    </div>
                                                    <button 
                                                        disabled={savingMsg}
                                                        onClick={() => { setFlexEditorIndex(idx); setShowFlexEditor(true); }}
                                                        className="secondary" 
                                                        style={{ width: '100%', fontSize: '13px', padding: '12px', backgroundColor: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', border: '1px dashed rgba(255, 215, 0, 0.5)', opacity: savingMsg ? 0.6 : 1 }}
                                                    >
                                                        <Layers size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                                        打開視覺化編輯器
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                    {msgRpyList.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#555', border: '1px dashed #333', borderRadius: '8px', backgroundColor: '#111' }}>
                                            這條規則目前沒有設定任何回應訊息。
                                            <br />請點擊右上方按鈕新增。
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Preview Column */}
                            <div style={{ backgroundColor: '#000', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '15px', borderBottom: '1px solid #222', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa' }}>
                                    <Eye size={16} /> 即時預覽
                                </div>
                                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                                    <div style={{ border: '1px solid #333', borderRadius: '12px', overflow: 'hidden', height: '100%', minHeight: '500px' }}>
                                        <JourneyPreview steps={previewPayload} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Flex Editor Nested Modal */}
            {showFlexEditor && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                    <div style={{ width: '55%', minWidth: '800px', height: '100%', backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                        <button 
                            onClick={() => setShowFlexEditor(false)}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: '#333', border: 'none', color: '#fff', borderRadius: '50%', padding: '8px', cursor: 'pointer', zIndex: 10 }}
                        >
                            <X size={20} />
                        </button>
                        <FlexMessageEditor 
                            initialContent={msgRpyList[flexEditorIndex]?.contents || msgRpyList[flexEditorIndex]?.Line?.contents}
                            onSave={(json) => {
                                handleUpdateMessage(flexEditorIndex, 'contents', JSON.parse(json));
                            }}
                            onCancel={() => setShowFlexEditor(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default RuleDesigner;
