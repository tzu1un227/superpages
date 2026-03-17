import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Plus, Search, Edit2, Trash2, Save, X, Eye, 
    Workflow, MessageSquare, ChevronRight, AlertCircle, 
    PlusCircle, Info, ArrowRight, Layers, FileJson,
    SplitSquareVertical, RefreshCw, Layers as LayersIcon
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import JourneyPreview from '../components/JourneyPreview';
import { useToast } from '../contexts/ToastContext';
import FlexMessageEditor from '../components/FlexMessageEditor';

const BANK_TYPES = [
    { id: 'q_bank', label: 'Q_bank (核心規則)', color: '#FFD700' },
    { id: 'qa_bank', label: 'QA_bank (回覆庫)', color: '#4CAF50' }
];

function RuleDesigner() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    
    // State
    const [bankType, setBankType] = useState('q_bank');
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRule, setSelectedRule] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Editor State
    const [editedRule, setEditedRule] = useState(null);
    const [msgRpyList, setMsgRpyList] = useState([]); // Decomposed msg_rpy
    const [showFlexEditor, setShowFlexEditor] = useState(false);
    const [flexEditorIndex, setFlexEditorIndex] = useState(null);

    // Initial Load
    useEffect(() => {
        fetchRules();
    }, [bankType, oaId]);

    const fetchRules = async (reselectId = null) => {
        setLoading(true);
        try {
            const res = await api.get(`/rule-designer/rules?type=${bankType}`);
            const newRules = res.data.rules || [];
            setRules(newRules);
            if (reselectId) {
                const found = newRules.find(r => r.id === reselectId);
                if (found) {
                    setSelectedRule(found);
                    setEditedRule(JSON.parse(JSON.stringify(found)));
                    
                    // Decompose msg_rpy
                    try {
                        const rawMsg = found.msg_rpy || [];
                        const parsedMsg = rawMsg.map(m => (typeof m === 'string' ? JSON.parse(m) : m));
                        setMsgRpyList(parsedMsg);
                    } catch (e) {
                        setMsgRpyList([]);
                    }
                }
            }
        } catch (err) {
            showToast('載入規則失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRule = (rule) => {
        setSelectedRule(rule);
        setEditedRule(JSON.parse(JSON.stringify(rule)));
        
        // Decompose msg_rpy
        try {
            const rawMsg = rule.msg_rpy || [];
            const parsedMsg = rawMsg.map(m => (typeof m === 'string' ? JSON.parse(m) : m));
            setMsgRpyList(parsedMsg);
        } catch (e) {
            setMsgRpyList([]);
        }
        setIsEditing(false);
    };

    const handleNewRule = () => {
        const newRule = bankType === 'q_bank' ? {
            state_in: ['*'],
            type: 'Message',
            content: [''],
            check: [''],
            msg_rpy: [],
            state_out: '00000',
            function: '',
            history: true,
            note: '新規則'
        } : {
            tag: 'new_tag',
            msg_rpy: [],
            io: 'Output',
            check: [''],
            function: '',
            ans: [''],
            type: 'Message'
        };
        setSelectedRule(null);
        setEditedRule(newRule);
        setMsgRpyList([]);
        setIsEditing(true);
    };

    const handleAddMessage = (type = 'TextSendMessage') => {
        let newMsg = { OTYPE: type };
        if (type === 'TextSendMessage') newMsg.text = '新訊息';
        else if (type === 'FlexSendMessage') {
            newMsg.alt_text = 'Flex Message';
            newMsg.contents = { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'Flex Content' }] } };
        }
        else if (type === 'ImageSendMessage') {
            newMsg.original_content_url = 'https://via.placeholder.com/800x400';
            newMsg.preview_image_url = 'https://via.placeholder.com/800x400';
        }

        const newList = [...msgRpyList, newMsg];
        setMsgRpyList(newList);
        setEditedRule({ ...editedRule, msg_rpy: newList });
    };

    const handleRemoveMessage = (index) => {
        const newList = msgRpyList.filter((_, i) => i !== index);
        setMsgRpyList(newList);
        setEditedRule({ ...editedRule, msg_rpy: newList });
    };

    const handleUpdateMessage = (index, field, value) => {
        const newList = [...msgRpyList];
        newList[index] = { ...newList[index], [field]: value };
        setMsgRpyList(newList);
        setEditedRule({ ...editedRule, msg_rpy: newList });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Recompose msg_rpy
            const ruleToSave = { ...editedRule, msg_rpy: msgRpyList };
            let res;
            if (ruleToSave.id) {
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
                setIsEditing(false);
                await fetchRules(ruleToSave.id || res.data.id);
            }
        } catch (err) {
            showToast('儲存失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除此規則嗎？')) return;
        setLoading(true);
        try {
            await api.delete(`/rule-designer/rules/${id}?type=${bankType}`);
            showToast('規則已刪除', 'success');
            setSelectedRule(null);
            setEditedRule(null);
            fetchRules();
        } catch (err) {
            showToast('刪除失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredRules = useMemo(() => {
        if (!searchTerm) return rules;
        const lowSearch = searchTerm.toLowerCase();
        return rules.filter(r => {
            const note = r.note || '';
            const tag = r.tag || '';
            const content = Array.isArray(r.content) ? r.content.join(' ') : '';
            const stateIn = Array.isArray(r.state_in) ? r.state_in.join(' ') : '';
            const stateOut = r.state_out || '';
            
            return note.toLowerCase().includes(lowSearch) || 
                   tag.toLowerCase().includes(lowSearch) || 
                   content.toLowerCase().includes(lowSearch) ||
                   stateIn.toLowerCase().includes(lowSearch) ||
                   stateOut.toLowerCase().includes(lowSearch);
        });
    }, [rules, searchTerm]);

    const previewPayload = useMemo(() => {
        return msgRpyList.map(m => {
            // JourneyPreview expects steps to have OTYPE at root level, but our DB stores them as {Line: {...}} often?
            // Wait, questionnaire.py serializes as {"Line": {"OTYPE": "...", ...}}
            // app.py create_qa_entry serializes as json.dumps(m)
            // Projects.jsx JourneyPreview expects: [{ OTYPE: 'FlexSendMessage', contents: previewJson }]
            // Let's normalize it for the preview components
            if (m.Line) return m.Line;
            return m;
        });
    }, [msgRpyList]);

    // Simple Flowchart View (Rule Connections)
    const FlowchartView = () => {
        // Find connections for Q_bank: state_in -> state_out
        if (bankType !== 'q_bank') return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Flowchart 僅支援 Q_bank</div>;
        
        return (
            <div style={{ padding: '20px', overflow: 'auto', height: '100%', backgroundColor: '#000' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', justifyContent: 'center' }}>
                    {rules.slice(0, 50).map(r => (
                        <div key={r.id} style={{ 
                            padding: '12px', 
                            border: '1px solid #333', 
                            borderRadius: '8px', 
                            backgroundColor: '#222',
                            minWidth: '150px',
                            position: 'relative',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '10px', color: '#FFD700', marginBottom: '5px' }}>{r.state_in.join(', ')}</div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{r.note || r.content[0] || '無名稱'}</div>
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
                                <ArrowRight size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {r.state_out}
                            </div>
                        </div>
                    ))}
                    {rules.length > 50 && <div style={{ color: '#444', alignSelf: 'center' }}>+ {rules.length - 50} more...</div>}
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Workflow size={32} className="text-yellow" />
                        法則表設計
                    </h1>
                    <p style={{ color: '#B0B0B0' }}>編輯核心回應規則與 QA 資料庫，支援分解訊息與預覽</p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {BANK_TYPES.map(bank => (
                        <button
                            key={bank.id}
                            onClick={() => { setBankType(bank.id); setSelectedRule(null); setEditedRule(null); }}
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

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr 320px', flex: 1, minHeight: 0, gap: '20px' }}>
                
                {/* Left: Rule List */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #333' }}>
                        <div className="search-box" style={{ width: '100%', position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                            <input 
                                type="text" 
                                placeholder="搜尋規則..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '35px', width: '100%', fontSize: '13px' }}
                            />
                        </div>
                        <button 
                            onClick={handleNewRule}
                            className="primary" 
                            style={{ width: '100%', marginTop: '10px', fontSize: '13px', padding: '8px' }}
                        >
                            <Plus size={16} /> 新增規則
                        </button>
                    </div>
                    
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading && rules.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}><LoadingSpinner size={24} /></div>
                        ) : filteredRules.map(r => (
                            <div 
                                key={r.id}
                                onClick={() => handleSelectRule(r)}
                                style={{
                                    padding: '12px 15px',
                                    borderBottom: '1px solid #222',
                                    cursor: 'pointer',
                                    backgroundColor: selectedRule?.id === r.id ? '#333' : 'transparent',
                                    borderLeft: selectedRule?.id === r.id ? '4px solid var(--primary-yellow)' : '4px solid transparent',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '12px', color: bankType === 'q_bank' ? '#FFD700' : '#4CAF50', fontWeight: 'bold' }}>
                                        {bankType === 'q_bank' ? r.state_in[0] : r.tag}
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#666' }}>ID: {r.id}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.note || (bankType === 'q_bank' ? (r.content && r.content[0]) : '') || '(末命名)'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Middle: Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {isEditing ? <Edit2 size={18} /> : <Eye size={18} />}
                                {editedRule ? (isEditing ? '編輯規則' : '規則詳情') : '請選擇或建立規則'}
                            </h3>
                            {editedRule && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {!isEditing ? (
                                        <button onClick={() => setIsEditing(true)} className="secondary" style={{ padding: '5px 12px' }}>編輯</button>
                                    ) : (
                                        <>
                                            <button onClick={() => { setIsEditing(false); handleSelectRule(selectedRule); }} className="secondary" style={{ padding: '5px 12px', background: 'transparent' }}>取消</button>
                                            <button onClick={handleSave} className="primary" style={{ padding: '5px 12px' }}>儲存</button>
                                        </>
                                    )}
                                    <button onClick={() => handleDelete(editedRule.id)} className="secondary" style={{ padding: '5px', color: '#ff4d4d' }}><Trash2 size={18} /></button>
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                            {!editedRule ? (
                                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#444' }}>
                                    <LayersIcon size={64} opacity={0.3} />
                                    <p style={{ marginTop: '15px' }}>點選左側規則進行編輯</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Core Fields */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        {bankType === 'q_bank' ? (
                                            <>
                                                <div>
                                                    <label className="label">流入狀態 (state_in)</label>
                                                    <input 
                                                        type="text" 
                                                        disabled={!isEditing} 
                                                        value={editedRule.state_in.join(', ')} 
                                                        onChange={e => setEditedRule({ ...editedRule, state_in: e.target.value.split(',').map(s => s.trim()) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">匹配內容 (content)</label>
                                                    <input 
                                                        type="text" 
                                                        disabled={!isEditing} 
                                                        value={editedRule.content.join(', ')} 
                                                        onChange={e => setEditedRule({ ...editedRule, content: e.target.value.split(',').map(s => s.trim()) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">備註名稱 (note)</label>
                                                    <input 
                                                        type="text" 
                                                        disabled={!isEditing} 
                                                        value={editedRule.note || ''} 
                                                        onChange={e => setEditedRule({ ...editedRule, note: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">跳轉狀態 (state_out)</label>
                                                    <input 
                                                        type="text" 
                                                        disabled={!isEditing} 
                                                        value={editedRule.state_out} 
                                                        onChange={e => setEditedRule({ ...editedRule, state_out: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <label className="label">識別標籤 (Tag)</label>
                                                    <input 
                                                        type="text" 
                                                        disabled={!isEditing} 
                                                        value={editedRule.tag} 
                                                        onChange={e => setEditedRule({ ...editedRule, tag: e.target.value })}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Message Reply List */}
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <h4 style={{ margin: 0, fontSize: '14px', color: '#888' }}>回應訊息內容 (msg_rpy)</h4>
                                            {isEditing && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleAddMessage('TextSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ 文字</button>
                                                    <button onClick={() => handleAddMessage('ImageSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ 圖片</button>
                                                    <button onClick={() => handleAddMessage('FlexSendMessage')} style={{ fontSize: '11px', padding: '4px 8px' }} className="secondary">+ Flex</button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            {msgRpyList.map((msg, idx) => (
                                                <div key={idx} className="card" style={{ padding: '15px', backgroundColor: '#222', border: '1px solid #333' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#444', borderRadius: '4px' }}>
                                                            #{idx + 1} - {msg.OTYPE || (msg.Line?.OTYPE)}
                                                        </span>
                                                        {isEditing && (
                                                            <Trash2 size={16} className="text-red" style={{ cursor: 'pointer' }} onClick={() => handleRemoveMessage(idx)} />
                                                        )}
                                                    </div>
                                                    
                                                    {/* Editor for Text */}
                                                    {(msg.OTYPE === 'TextSendMessage' || msg.Line?.OTYPE === 'TextSendMessage') && (
                                                        <textarea 
                                                            disabled={!isEditing}
                                                            value={msg.text || msg.Line?.text || ''}
                                                            onChange={e => handleUpdateMessage(idx, 'text', e.target.value)}
                                                            rows={3}
                                                            style={{ width: '100%', fontSize: '13px' }}
                                                        />
                                                    )}
                                                    
                                                    {/* Editor for Image */}
                                                    {(msg.OTYPE === 'ImageSendMessage' || msg.Line?.OTYPE === 'ImageSendMessage') && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <input 
                                                                type="text" 
                                                                placeholder="圖片原圖網址" 
                                                                disabled={!isEditing}
                                                                value={msg.original_content_url || msg.Line?.original_content_url || ''}
                                                                onChange={e => handleUpdateMessage(idx, 'original_content_url', e.target.value)}
                                                            />
                                                            <input 
                                                                type="text" 
                                                                placeholder="預覽圖網址" 
                                                                disabled={!isEditing}
                                                                value={msg.preview_image_url || msg.Line?.preview_image_url || ''}
                                                                onChange={e => handleUpdateMessage(idx, 'preview_image_url', e.target.value)}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Editor for Flex */}
                                                    {(msg.OTYPE === 'FlexSendMessage' || msg.Line?.OTYPE === 'FlexSendMessage') && (
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px', backgroundColor: '#181818', padding: '8px', borderRadius: '4px' }}>
                                                                Flex 訊息內容為 JSON 結構。
                                                                <button 
                                                                    onClick={() => { setFlexEditorIndex(idx); setShowFlexEditor(true); }}
                                                                    className="secondary" 
                                                                    style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px' }}
                                                                >
                                                                    打開視覺化編輯器
                                                                </button>
                                                            </div>
                                                            <textarea 
                                                                disabled={!isEditing}
                                                                value={typeof (msg.contents || msg.Line?.contents) === 'string' ? (msg.contents || msg.Line?.contents) : JSON.stringify(msg.contents || msg.Line?.contents, null, 2)}
                                                                onChange={e => {
                                                                    try {
                                                                        const val = JSON.parse(e.target.value);
                                                                        handleUpdateMessage(idx, 'contents', val);
                                                                    } catch {
                                                                        handleUpdateMessage(idx, 'contents', e.target.value);
                                                                    }
                                                                }}
                                                                rows={5}
                                                                style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {msgRpyList.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#444', border: '1px dashed #333', borderRadius: '8px' }}>暫無回應訊息</div>}
                                        </div>
                                    </div>
                                    
                                    <div style={{ height: '40px' }}></div> {/* Spacer */}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Flowchart (Optional small area) */}
                    <div className="card" style={{ height: '200px', padding: 0, position: 'relative' }}>
                        <div style={{ padding: '8px 15px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <SplitSquareVertical size={16} className="text-yellow" />
                             <span style={{ fontSize: '13px', fontWeight: 'bold' }}>規則流程圖覽</span>
                        </div>
                        <FlowchartView />
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, backgroundColor: '#111' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #333', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <Eye size={16} /> 訊息預覽
                    </div>
                    <div style={{ flex: 1, padding: '10px', overflow: 'hidden' }}>
                        <div style={{ 
                            height: '100%', 
                            borderRadius: '12px', 
                            overflow: 'hidden', 
                            border: '1px solid #333',
                            backgroundColor: '#000'
                        }}>
                             <JourneyPreview steps={previewPayload} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Flex Editor Modal */}
            {showFlexEditor && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', padding: '40px' }}>
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
                                // showToast('Flex 內容已更新', 'success');
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
