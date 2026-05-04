import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Plus, Search, Edit2, Trash2, Save, X, Eye, 
    Workflow, MessageSquare, ChevronRight, AlertCircle, 
    PlusCircle, Info, ArrowRight, Layers, FileJson,
    SplitSquareVertical, RefreshCw, Layers as LayersIcon,
    Calendar, Clock, Tag, ChevronDown, ChevronUp
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
    
    // Modal State for msg_rpy
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [editingRowIndex, setEditingRowIndex] = useState(null);
    const [msgRpyList, setMsgRpyList] = useState([]); 
    
    // Flex Editor State
    const [showFlexEditor, setShowFlexEditor] = useState(false);
    const [flexEditorIndex, setFlexEditorIndex] = useState(null);

    // Initial Load
    useEffect(() => {
        fetchRules();
    }, [bankType, oaId]);

    const fetchRules = async () => {
        setLoading(true);
        setRowErrors({}); // Clear all errors on reload/switch
        try {
            const res = await api.get(`/rule-designer/rules?type=${bankType}`);
            const newRules = res.data.rules || [];
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
        // 為了將畫面拉到最上方，可以延遲觸發捲動，或由使用者自行往上捲
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
        const newDrafts = [...draftRules];
        newDrafts[editingRowIndex].msg_rpy = msgRpyList;
        newDrafts[editingRowIndex]._isDirty = true;
        setDraftRules(newDrafts);
        setIsMsgModalOpen(false);
        setEditingRowIndex(null);
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
        const ruleToSave = { ...draftRules[index] };
        delete ruleToSave._isDirty;
        delete ruleToSave._isNew;

        try {
            let res;
            if (ruleToSave.id !== undefined && ruleToSave.id !== null && !draftRules[index]._isNew) {
                res = await api.put(`/rule-designer/rules/${ruleToSave.id}`, {
                    bank_type: bankType,
                    rule: ruleToSave
                });
            } else {
                res = await api.post('/rule-designer/rules', {
                    bank_type: bankType,
                    rule: ruleToSave
                });
            }

            if (res.data.status === 'success') {
                showToast('規則已儲存', 'success');
                const newDrafts = [...draftRules];
                newDrafts[index]._isDirty = false;
                newDrafts[index]._isNew = false;
                if (res.data.id) newDrafts[index].id = res.data.id;
                setDraftRules(newDrafts);
                fetchRules();
            }
        } catch (err) {
            // Handle validation errors from backend
            if (err.response && err.response.status === 400 && err.response.data&& err.response.data.errors) {
                const updatedErrors = { ...rowErrors };
                updatedErrors[index] = err.response.data.errors;
                setRowErrors(updatedErrors);
                showToast(`偵錯發現 ${err.response.data.errors.length} 個問題，請修正後再儲存`, 'error');
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
            return;
        }

        if (!window.confirm(`確定要刪除規則 ${ruleTarget.id} 嗎？`)) return;
        setLoading(true);
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
                        <Workflow size={32} className="text-yellow" />
                        法則表設計
                    </h1>
                    <p style={{ color: '#B0B0B0' }}>在表格中直接瀏覽、編輯法則與 QA 規則</p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {BANK_TYPES.map(bank => (
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
                    onClick={() => setDesignMode('simple')}
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
                    onClick={() => setDesignMode('engineering')}
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
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div className="search-box" style={{ flex: 1, position: 'relative', maxWidth: '400px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input 
                        type="text" 
                        placeholder="搜尋規則 (姓名, Tag, 內容, 狀態)..." 
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
                    <Plus size={16} />新增空白列
                </button>
            </div>

            {/* Task View for Simple Mode */}
            {designMode === 'simple' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px', paddingBottom: '40px' }}>
                    {draftRules.map((rule, idx) => {
                        if (searchTerm && !matchesSearch(rule, searchTerm)) return null;
                        
                        const checkData = parseCheck(rule.check);
                        const funcData = parseFunction(rule.function);
                        const msgCount = Array.isArray(rule.msg_rpy) ? rule.msg_rpy.length : 0;
                        
                        return (
                            <div key={rule.id || `task-${idx}`} className="card" style={{ 
                                padding: '20px', 
                                border: rule._isDirty ? '1px solid var(--primary-yellow)' : '1px solid #333',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                            {rule._isNew ? <span style={{ color: '#FFD700' }}>[新任務]</span> : `任務 ID: ${rule.id}`}
                                        </div>
                                        <input 
                                            type="text"
                                            placeholder="請輸入任務標題 (備註)"
                                            value={rule.note || ''}
                                            onChange={e => handleFieldChange(idx, 'note', e.target.value)}
                                            style={{ 
                                                fontSize: '18px', 
                                                fontWeight: 'bold', 
                                                width: '100%', 
                                                background: 'transparent', 
                                                border: 'none', 
                                                color: '#fff',
                                                padding: '4px 0',
                                                borderBottom: '1px solid #222'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {rule._isDirty && (
                                            <button onClick={() => handleSaveRow(idx)} className="primary" style={{ padding: '6px', borderRadius: '50%' }}>
                                                <Save size={16} />
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteRow(idx)} style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Keyword Setting */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <MessageSquare size={16} style={{ color: '#888', flexShrink: 0 }} />
                                        <input 
                                            type="text"
                                            placeholder="設定觸發關鍵字 (用逗號分隔)"
                                            value={Array.isArray(rule.content) ? rule.content.join(', ') : (rule.content || '')}
                                            onChange={e => handleFieldChange(idx, 'content', e.target.value)}
                                            style={{ flex: 1, fontSize: '13px', padding: '6px 10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                        />
                                    </div>

                                    {/* Effective Period */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Calendar size={16} style={{ color: '#888', flexShrink: 0 }} />
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flex: 1 }}>
                                            <input 
                                                type="date"
                                                value={checkData.startDate}
                                                onChange={e => {
                                                    const newCheck = stringifyCheck({ ...checkData, startDate: e.target.value });
                                                    handleFieldChange(idx, 'check', newCheck);
                                                }}
                                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                            />
                                            <span style={{ color: '#666' }}>~</span>
                                            <input 
                                                type="date"
                                                value={checkData.endDate}
                                                onChange={e => {
                                                    const newCheck = stringifyCheck({ ...checkData, endDate: e.target.value });
                                                    handleFieldChange(idx, 'check', newCheck);
                                                }}
                                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Daily Time */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Clock size={16} style={{ color: '#888', flexShrink: 0 }} />
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flex: 1 }}>
                                            <input 
                                                type="time"
                                                value={checkData.startTime}
                                                onChange={e => {
                                                    const newCheck = stringifyCheck({ ...checkData, startTime: e.target.value });
                                                    handleFieldChange(idx, 'check', newCheck);
                                                }}
                                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                            />
                                            <span style={{ color: '#666' }}>~</span>
                                            <input 
                                                type="time"
                                                value={checkData.endTime}
                                                onChange={e => {
                                                    const newCheck = stringifyCheck({ ...checkData, endTime: e.target.value });
                                                    handleFieldChange(idx, 'check', newCheck);
                                                }}
                                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Tag Setting */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Tag size={16} style={{ color: '#888', flexShrink: 0 }} />
                                        <input 
                                            type="text"
                                            placeholder="設定完成標籤 (限填一個)"
                                            value={funcData.tag}
                                            onChange={e => {
                                                const newFunc = stringifyFunction(e.target.value);
                                                handleFieldChange(idx, 'function', newFunc);
                                            }}
                                            style={{ flex: 1, fontSize: '13px', padding: '6px 10px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '4px', color: '#eee' }}
                                        />
                                    </div>
                                </div>

                                {/* Message Editor & Button */}
                                <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '12px', color: msgCount > 0 ? '#4CAF50' : '#888' }}>
                                        已設定 {msgCount} 則回覆訊息
                                    </div>
                                    <button 
                                        onClick={() => handleOpenMsgModal(idx)}
                                        className="secondary"
                                        style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Edit2 size={14} /> 編輯訊息內容
                                    </button>
                                </div>
                            </div>
                        );
                    })}
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
                                                    border: `1px solid ${msgCount > 0 ? 'rgba(76, 175, 80, 0.3)' : '#333'}`
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
                    
                    <div className="card" style={{ flex: 1, maxWidth: '1200px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        {/* Modal Header */}
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <MessageSquare size={18} className="text-yellow" />
                                編輯回應訊息
                                <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                                    (法則 ID: {draftRules[editingRowIndex]?.id || '新建'})
                                </span>
                            </h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setIsMsgModalOpen(false)} className="secondary" style={{ background: 'transparent', color: '#fff' }}>取消</button>
                                <button onClick={handleSaveMsgModal} className="primary">確認並套用至表格</button>
                            </div>
                        </div>

                        {/* Modal Body (2 columns: Editor | Preview) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', flex: 1, minHeight: 0 }}>
                            {/* Editor Column */}
                            <div style={{ padding: '20px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>訊息封包清單</h4>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleAddMessage('TextSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ 文字</button>
                                        <button onClick={() => handleAddMessage('ImageSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ 圖片</button>
                                        <button onClick={() => handleAddMessage('FlexSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ 圖文訊息</button>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {msgRpyList.map((msg, idx) => (
                                        <div key={idx} className="card" style={{ padding: '15px', backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <span>#{idx + 1}</span>
                                                    <span style={{ color: '#FFD700' }}>{msg.OTYPE || (msg.Line?.OTYPE)}</span>
                                                </span>
                                                <Trash2 size={16} className="text-red" style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveMessage(idx)} />
                                            </div>
                                            
                                            {/* Editor for Text */}
                                            {(msg.OTYPE === 'TextSendMessage' || msg.Line?.OTYPE === 'TextSendMessage') && (
                                                <textarea 
                                                    value={msg.text || msg.Line?.text || ''}
                                                    onChange={e => handleUpdateMessage(idx, 'text', e.target.value)}
                                                    rows={3}
                                                    style={{ width: '100%', fontSize: '13px', backgroundColor: '#000', border: '1px solid #333', padding: '10px', borderRadius: '6px' }}
                                                    placeholder="輸入文字內容..."
                                                />
                                            )}
                                            
                                            {/* Editor for Image */}
                                            {(msg.OTYPE === 'ImageSendMessage' || msg.Line?.OTYPE === 'ImageSendMessage') && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <input 
                                                        type="text" 
                                                        placeholder="圖片原圖網址 (original_content_url)" 
                                                        value={msg.original_content_url || msg.Line?.original_content_url || ''}
                                                        onChange={e => handleUpdateMessage(idx, 'original_content_url', e.target.value)}
                                                        style={{ width: '100%', fontSize: '12px', backgroundColor: '#000', border: '1px solid #333', padding: '8px', borderRadius: '4px' }}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="預覽圖網址 (preview_image_url)" 
                                                        value={msg.preview_image_url || msg.Line?.preview_image_url || ''}
                                                        onChange={e => handleUpdateMessage(idx, 'preview_image_url', e.target.value)}
                                                        style={{ width: '100%', fontSize: '12px', backgroundColor: '#000', border: '1px solid #333', padding: '8px', borderRadius: '4px' }}
                                                    />
                                                </div>
                                            )}

                                            {/* Editor for 圖文訊息 */}
                                            {(msg.OTYPE === 'FlexSendMessage' || msg.Line?.OTYPE === 'FlexSendMessage') && (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', color: '#888' }}>JSON Payload</span>
                                                        <button 
                                                            onClick={() => { setFlexEditorIndex(idx); setShowFlexEditor(true); }}
                                                            className="secondary" 
                                                            style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', border: '1px solid rgba(255, 215, 0, 0.3)' }}
                                                        >
                                                            <Layers size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                            打開視覺化編輯器
                                                        </button>
                                                    </div>
                                                    <textarea 
                                                        value={typeof (msg.contents || msg.Line?.contents) === 'string' ? (msg.contents || msg.Line?.contents) : JSON.stringify(msg.contents || msg.Line?.contents, null, 2)}
                                                        onChange={e => {
                                                            try {
                                                                const val = JSON.parse(e.target.value);
                                                                handleUpdateMessage(idx, 'contents', val);
                                                            } catch {
                                                                handleUpdateMessage(idx, 'contents', e.target.value);
                                                            }
                                                        }}
                                                        rows={6}
                                                        style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#000', border: '1px solid #333', padding: '10px', borderRadius: '6px' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
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
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', padding: '40px' }}>
                    <div style={{ flex: 1, backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
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
                                setShowFlexEditor(false);    
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
