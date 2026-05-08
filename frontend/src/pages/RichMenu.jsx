import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import {
    Plus, Trash2, Save, Image as ImageIcon, Settings,
    MousePointer2, Move, Maximize, Check, X, AlertCircle,
    ChevronDown, ChevronUp, ExternalLink, MessageSquare,
    CreditCard, Repeat, Eye, Edit2, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, Filter, Calendar, RotateCcw, Shield,
    HelpCircle, Link as LinkIcon, Unlink, Clock, FileText, Send
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { Tooltip as MuiTooltip } from '@mui/material';
import TagInput from '../components/TagInput';
import { API_BASE_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';

// Styled or aliased Tooltip to avoid conflict
const Tooltip = ({ title, children }) => {
    if (!title) return children;
    return <MuiTooltip title={title} arrow placement="top">{children}</MuiTooltip>;
};

const ACTION_TYPES = [
    { value: 'message', label: '傳送文字', icon: MessageSquare },
    { value: 'uri', label: '開啟連結', icon: ExternalLink },
    { value: 'richmenuswitch', label: '切換選單', icon: Repeat },
];

const HELP_CONTENT = {
    list: {
        title: "圖文選單管理",
        content: "這裡可以管理 LINE OA 的圖文選單。系統提供「建立 -> 草稿 -> 發佈」完整生命週期。已發佈的選單將同步至 LINE API，為確保線上穩定性，發佈後內容將鎖定不可編輯。"
    },
    workflow: {
        title: "發佈與編輯限制",
        content: "草稿階段：可自由修改圖片與區塊點擊行為。已發佈階段：內容鎖定，僅可進行連結、設為預設或設定定時切換。若需修改內容，請刪除後重新建立。"
    },
    linking: {
        title: "連結與預設機制",
        content: "「設為預設」：讓全體未被個別標籤或連結的用戶看到此選單。「連結 (Link)」：強制將此選單連結至全體用戶，覆蓋原本的預設狀態。"
    }
};

function RichMenu() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    const [menus, setMenus] = useState([]);
    const [metadata, setMetadata] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('list'); // 'list', 'edit', 'permissions'
    const [currentMenu, setCurrentMenu] = useState(null);
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [allAliases, setAllAliases] = useState([]);
    const [viewOnly, setViewOnly] = useState(false);
    const [menuSearch, setMenuSearch] = useState('');
    const [mappings, setMappings] = useState([]);
    const [savingMappings, setSavingMappings] = useState(false);
    const { myOAs, currentAccount } = useAuth();
    const navigate = useNavigate();
    const [selectedOAId, setSelectedOAId] = useState(oaId || 'all');

    // Initial menu state
    const emptyMenu = {
        size: { width: 2500, height: 1686 },
        name: '未命名選單',
        chatBarText: '開啟選單',
        alias: '',
        areas: [],
        status: 'draft',
        start_time: '',
        end_time: ''
    };

    const scale = 0.2;

    useEffect(() => {
        if (view === 'list') {
            fetchData();
        } else if (view === 'permissions') {
            fetchMappings();
            if (menus.length === 0) fetchMenus();
        }
    }, [view, oaId, selectedOAId]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchMenus(), fetchMetadata()]);
        setLoading(false);
    };

    const fetchMenus = async () => {
        try {
            const endpoint = selectedOAId === 'all' ? '/richmenu/all' : '/richmenu/';
            const res = await api.get(endpoint);
            setMenus(res.data.richmenus || []);
        } catch (err) {
            console.error('Failed to fetch menus:', err);
        }
    };

    const fetchMetadata = async () => {
        try {
            const res = await api.get('/richmenu/metadata');
            setMetadata(res.data || []);
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };

    const fetchMappings = async () => {
        try {
            const res = await api.get('/richmenu/permissions');
            setMappings(res.data.mappings || []);
        } catch (err) {
            console.error('Failed to fetch mappings:', err);
        }
    };

    const saveMappings = async () => {
        setSavingMappings(true);
        try {
            await api.post('/richmenu/permissions', { mappings });
            showToast('權限設定已儲存', 'success');
        } catch (err) {
            showToast('儲存失敗', 'error');
        } finally {
            setSavingMappings(false);
        }
    };

    const handleCreateNew = () => {
        setCurrentMenu({ ...emptyMenu });
        setBackgroundImage(null);
        setViewOnly(false);
        setView('edit');
    };

    const fetchImageWithAuth = async (richMenuId) => {
        try {
            const response = await api.get(`/richmenu/${richMenuId}/image`, { responseType: 'blob' });
            return URL.createObjectURL(response.data);
        } catch (err) {
            return null;
        }
    };

    const handleEditMenu = async (item, isMetadata = false) => {
        setLoading(true);
        try {
            if (isMetadata) {
                const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
                setCurrentMenu({
                    ...emptyMenu,
                    ...data,
                    id: item.id,
                    status: item.status,
                    richMenuId: item.rich_menu_id,
                    start_time: item.start_time || '',
                    end_time: item.end_time || '',
                    name: item.name,
                    chatBarText: item.chat_bar_text
                });
                setViewOnly(item.status === 'published');
                setBackgroundImage(null);
                if (item.rich_menu_id) {
                    const imageUrl = await fetchImageWithAuth(item.rich_menu_id);
                    setBackgroundImage(imageUrl);
                }
            } else {
                setCurrentMenu({
                    ...emptyMenu,
                    richMenuId: item.richMenuId,
                    name: item.name,
                    chatBarText: item.chatBarText,
                    size: item.size,
                    areas: item.areas,
                    status: 'published'
                });
                setViewOnly(true);
                const imageUrl = await fetchImageWithAuth(item.richMenuId);
                setBackgroundImage(imageUrl);
            }
            setView('edit');
            setSelectedAreaIndex(null);
        } catch (err) {
            showToast('載入失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        if (viewOnly) return;
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('錯誤：必須為圖片檔 (JPEG/PNG)', 'error');
            return;
        }

        if (file.size > 1024 * 1024) {
            showToast('錯誤：檔案大小不可大於 1MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const { width, height } = img;
                const isValidSize = (width === 2500 && (height === 1686 || height === 843));
                if (!isValidSize) {
                    showToast('錯誤：圖片尺寸必須為 2500x1686 或 2500x843px', 'error');
                    return;
                }

                setBackgroundImage(event.target.result);
                setCurrentMenu({
                    ...currentMenu,
                    imageFile: file,
                    size: { width, height }
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const saveAsDraft = async () => {
        if (viewOnly) return;
        setLoading(true);
        try {
            const payload = {
                id: currentMenu.id,
                name: currentMenu.name,
                chat_bar_text: currentMenu.chatBarText,
                status: 'draft',
                start_time: currentMenu.start_time || null,
                end_time: currentMenu.end_time || null,
                data: JSON.stringify({
                    size: currentMenu.size,
                    areas: currentMenu.areas,
                    name: currentMenu.name,
                    chatBarText: currentMenu.chatBarText
                })
            };
            await api.post('/richmenu/metadata', payload);
            showToast('草稿已儲存', 'success');
            setView('list');
        } catch (err) {
            showToast('儲存草稿失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const publishToLine = async () => {
        if (viewOnly) return;
        if (!backgroundImage) {
            showToast('同步至 LINE 必須上傳底圖', 'warning');
            return;
        }
        
        setLoading(true);
        try {
            const metaData = {
                size: { width: Math.round(currentMenu.size.width), height: Math.round(currentMenu.size.height) },
                selected: false,
                name: currentMenu.name.substring(0, 300),
                chatBarText: currentMenu.chatBarText.substring(0, 14),
                areas: currentMenu.areas.map(a => ({
                    bounds: { x: Math.round(a.bounds.x), y: Math.round(a.bounds.y), width: Math.round(a.bounds.width), height: Math.round(a.bounds.height) },
                    action: a.action
                }))
            };

            const createRes = await api.post('/richmenu/', metaData);
            const richMenuId = createRes.data.richMenuId;

            if (currentMenu.imageFile) {
                const formData = new FormData();
                formData.append('image', currentMenu.imageFile);
                await api.post(`/richmenu/${richMenuId}/image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            const payload = {
                id: currentMenu.id,
                name: currentMenu.name,
                chat_bar_text: currentMenu.chatBarText,
                status: 'published',
                rich_menu_id: richMenuId,
                start_time: currentMenu.start_time || null,
                end_time: currentMenu.end_time || null,
                data: JSON.stringify(metaData)
            };
            await api.post('/richmenu/metadata', payload);

            showToast('選單已成功同步至 LINE！', 'success');
            setView('list');
        } catch (err) {
            showToast('發佈失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const deleteMenu = async (id, isMetadata = false) => {
        if (!window.confirm('確定要刪除嗎？')) return;
        try {
            if (isMetadata) {
                await api.delete(`/richmenu/metadata/${id}`);
            } else {
                await api.delete(`/richmenu/${id}`);
            }
            fetchData();
            showToast('已刪除', 'success');
        } catch (err) {
            showToast('刪除失敗', 'error');
        }
    };

    const setDefault = async (id) => {
        setLoading(true);
        try {
            await api.post(`/richmenu/set-default/${id}`);
            fetchData();
            showToast('已設為預設選單', 'success');
        } catch (err) {
            showToast('設定失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const linkToAll = async (id) => {
        setLoading(true);
        try {
            await api.post(`/richmenu/link/${id}`);
            showToast('已成功連結至所有用戶', 'success');
        } catch (err) {
            showToast('連結失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUnsetDefault = async () => {
        if (!window.confirm('確定要解除全域預設選單嗎？')) return;
        setLoading(true);
        try {
            await api.delete('/richmenu/set-default');
            fetchData();
            showToast('已解除預設', 'success');
        } catch (err) {
            showToast('解除失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const addArea = () => {
        if (viewOnly) return;
        const newArea = {
            bounds: { x: 0, y: 0, width: 800, height: 800 },
            action: { type: 'message', text: '預設文字' }
        };
        setCurrentMenu({ ...currentMenu, areas: [...currentMenu.areas, newArea] });
        setSelectedAreaIndex(currentMenu.areas.length);
    };

    const updateAreaBounds = (index, bounds) => {
        if (viewOnly) return;
        const newAreas = [...currentMenu.areas];
        if (newAreas[index]) {
            newAreas[index].bounds = { ...newAreas[index].bounds, ...bounds };
            setCurrentMenu({ ...currentMenu, areas: newAreas });
        }
    };

    const updateAreaAction = (index, action) => {
        if (viewOnly) return;
        const newAreas = [...currentMenu.areas];
        if (newAreas[index]) {
            newAreas[index].action = { ...newAreas[index].action, ...action };
            setCurrentMenu({ ...currentMenu, areas: newAreas });
        }
    };

    // Rendering Helpers
    const RichMenuPreview = ({ menuId }) => {
        const [url, setUrl] = useState(null);
        useEffect(() => {
            let active = true;
            if (menuId) {
                fetchImageWithAuth(menuId).then(blobUrl => {
                    if (active) setUrl(blobUrl);
                });
            }
            return () => { active = false; if (url) URL.revokeObjectURL(url); };
        }, [menuId]);

        return url ? <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} style={{ opacity: 0.3 }} />;
    };

    // Combined and Grouped logic
    const combinedList = React.useMemo(() => {
        const list = [
            ...metadata.map(m => ({ ...m, isMetadata: true })),
            ...menus.filter(rm => !metadata.some(m => m.rich_menu_id === rm.richMenuId)).map(rm => ({ ...rm, isMetadata: false }))
        ].sort((a, b) => {
            const timeA = a.isMetadata ? new Date(a.created_at).getTime() : 0;
            const timeB = b.isMetadata ? new Date(b.created_at).getTime() : 0;
            // Fallback to richMenuId if times are same (0)
            if (timeB === timeA) {
                return (b.richMenuId || b.rich_menu_id || '').localeCompare(a.richMenuId || a.rich_menu_id || '');
            }
            return timeB - timeA;
        });
        return list;
    }, [metadata, menus]);

    const getSortedMenus = () => {
        let filtered = combinedList;
        if (menuSearch.trim()) {
            const q = menuSearch.toLowerCase().trim();
            filtered = filtered.filter(m => 
                (m.name && m.name.toLowerCase().includes(q)) || 
                ((m.rich_menu_id || m.richMenuId) && (m.rich_menu_id || m.richMenuId).toLowerCase().includes(q))
            );
        }
        return filtered;
    };

    const groupedMenus = React.useMemo(() => {
        const sorted = getSortedMenus();
        if (selectedOAId !== 'all') {
            const label = myOAs.find(oa => oa.id.toString() === selectedOAId.toString())?.oa_name || '當前帳號';
            return { [label]: sorted.filter(m => m.oa_id?.toString() === selectedOAId.toString() || !m.oa_id) };
        }
        
        const groups = {};
        sorted.forEach(m => {
            const oa = myOAs.find(o => o.id.toString() === m.oa_id?.toString());
            const groupName = m.oa_name || oa?.oa_name || '未知名稱';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(m);
        });
        return groups;
    }, [combinedList, selectedOAId, menuSearch, myOAs]);

    if (view === 'edit') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0 }}>← 返回列表</button>
                        <h1 style={{ fontSize: '28px' }}>
                            {viewOnly ? '查看選單' : currentMenu.id ? '編輯草稿' : '新增選單'}
                            {currentMenu.status === 'published' && <span style={{ marginLeft: '10px', fontSize: '14px', backgroundColor: '#4CAF50', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>已發佈</span>}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        {!viewOnly && (
                            <>
                                <button onClick={saveAsDraft} className="secondary" disabled={loading}><Save size={18} /> 儲存草稿</button>
                                <button onClick={publishToLine} className="primary" disabled={loading}><Send size={18} /> {loading ? '同步中...' : '同步至 LINE'}</button>
                            </>
                        )}
                        {viewOnly && currentMenu.richMenuId && (
                            <button onClick={() => linkToAll(currentMenu.richMenuId)} className="primary"><LinkIcon size={18} /> 立即連結</button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px', flex: 1, minHeight: 0 }}>
                    <div className="card" style={{ overflow: 'auto', padding: '40px', backgroundColor: '#000', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        <div style={{
                            position: 'relative', width: `${currentMenu.size.width * scale}px`, height: `${currentMenu.size.height * scale}px`,
                            backgroundColor: '#222', border: '1px solid #444', backgroundSize: 'cover',
                            backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none', flexShrink: 0
                        }} onClick={() => setSelectedAreaIndex(null)}>
                            {!backgroundImage && !viewOnly && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                                    <ImageIcon size={48} /><p>請上傳底圖 (2500x1686/843)</p>
                                    <input type="file" onChange={handleImageUpload} style={{ marginTop: '10px' }} accept="image/*" />
                                </div>
                            )}
                            {currentMenu.areas.map((area, idx) => {
                                const { bounds } = area;
                                return (
                                    <div key={idx} style={{
                                        position: 'absolute', left: `${bounds.x * scale}px`, top: `${bounds.y * scale}px`, width: `${bounds.width * scale}px`, height: `${bounds.height * scale}px`,
                                        border: selectedAreaIndex === idx ? '3px solid #FFD700' : '2px solid rgba(255, 215, 0, 0.5)',
                                        backgroundColor: selectedAreaIndex === idx ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.1)',
                                        cursor: viewOnly ? 'pointer' : 'move', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', zIndex: selectedAreaIndex === idx ? 10 : 1
                                    }} onClick={(e) => { e.stopPropagation(); setSelectedAreaIndex(idx); }}>
                                        {idx + 1}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                        <div className="card">
                            <h3>基本設定</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                <div><label className="label">選單名稱</label><input type="text" disabled={viewOnly} value={currentMenu.name} onChange={e => setCurrentMenu({ ...currentMenu, name: e.target.value })} /></div>
                                <div><label className="label">聊天欄標題</label><input type="text" disabled={viewOnly} value={currentMenu.chatBarText} onChange={e => setCurrentMenu({ ...currentMenu, chatBarText: e.target.value })} /></div>
                            </div>
                        </div>

                        <div className="card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> 排程設定</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                <div><label className="label">開始時間</label><input type="datetime-local" value={currentMenu.start_time} onChange={e => setCurrentMenu({ ...currentMenu, start_time: e.target.value })} /></div>
                                <div><label className="label">結束時間</label><input type="datetime-local" value={currentMenu.end_time} onChange={e => setCurrentMenu({ ...currentMenu, end_time: e.target.value })} /></div>
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3>區塊設定 ({currentMenu.areas.length})</h3>
                                {!viewOnly && <button onClick={addArea} className="secondary" style={{ padding: '5px 10px' }}><Plus size={16} /></button>}
                            </div>
                            {selectedAreaIndex !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <select value={currentMenu.areas[selectedAreaIndex].action.type} disabled={viewOnly} onChange={e => updateAreaAction(selectedAreaIndex, { type: e.target.value })}>
                                        {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    {currentMenu.areas[selectedAreaIndex].action.type === 'message' && (
                                        <input type="text" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].action.text || ''} onChange={e => updateAreaAction(selectedAreaIndex, { text: e.target.value })} placeholder="訊息內容" />
                                    )}
                                    {currentMenu.areas[selectedAreaIndex].action.type === 'uri' && (
                                        <input type="text" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].action.uri || ''} onChange={e => updateAreaAction(selectedAreaIndex, { uri: e.target.value })} placeholder="https://..." />
                                    )}
                                </div>
                            ) : (
                                <p style={{ color: '#666', textAlign: 'center', fontSize: '14px' }}>點擊預覽區塊進行設定</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'permissions') {
        return (
            <div>
                <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '20px' }}>← 返回列表</button>
                <h1>標籤權限控管</h1>
                <div className="card" style={{ marginTop: '20px' }}>
                    <table style={{ width: '100%' }}>
                        <thead><tr><th>標籤</th><th>對應選單</th><th>操作</th></tr></thead>
                        <tbody>
                            {mappings.map((m, idx) => (
                                <tr key={idx}>
                                    <td><input type="text" value={m.tag} onChange={e => { const n = [...mappings]; n[idx].tag = e.target.value; setMappings(n); }} /></td>
                                    <td>
                                        <select value={m.richMenuId} onChange={e => { const n = [...mappings]; n[idx].richMenuId = e.target.value; setMappings(n); }}>
                                            <option value="">選擇選單...</option>
                                            {menus.map(menu => <option key={menu.richMenuId} value={menu.richMenuId}>{menu.name}</option>)}
                                        </select>
                                    </td>
                                    <td><button onClick={() => setMappings(mappings.filter((_, i) => i !== idx))}><Trash2 size={16} /></button></td>
                                </tr>
                            ))}
                            <tr><td colSpan="3"><button onClick={() => setMappings([...mappings, { tag: '', richMenuId: '' }])} className="secondary" style={{ width: '100%', borderStyle: 'dashed' }}><Plus size={16} /> 新增</button></td></tr>
                        </tbody>
                    </table>
                    <button onClick={saveMappings} className="primary" style={{ marginTop: '20px' }} disabled={savingMappings}><Save size={18} /> 儲存權限</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                            圖文選單
                            <Tooltip title={HELP_CONTENT.list.content}>
                                <HelpCircle size={20} style={{ color: '#888', cursor: 'pointer' }} />
                            </Tooltip>
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '14px', color: '#888' }}>選擇帳號:</label>
                            <select 
                                value={selectedOAId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedOAId(val);
                                    if (val !== 'all') navigate(`/oa/${val}/richmenu`);
                                }}
                                style={{ padding: '6px 12px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '14px', outline: 'none' }}
                            >
                                <option value="all">全部帳號 (依照分類顯示)</option>
                                {myOAs.map(oa => <option key={oa.id} value={oa.id}>{oa.oa_name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ position: 'relative', marginLeft: '20px' }}>
                        <Filter size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <input
                            type="text"
                            placeholder="搜尋選單名稱或 ID..."
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                            style={{ padding: '10px 12px 10px 34px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '8px', color: 'white', fontSize: '13px', width: '240px', outline: 'none' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={() => setView('permissions')} className="secondary"><Shield size={18} /> 權限控管</button>
                    <button onClick={handleUnsetDefault} className="secondary" style={{ color: '#ff4d4d' }}><RotateCcw size={18} /> 重置預設</button>
                    <button onClick={handleCreateNew} className="primary"><Plus size={20} /> 新增選單</button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {Object.entries(groupedMenus).map(([oaName, oaMenus]) => (
                    <div key={oaName}>
                        <h2 style={{ fontSize: '20px', color: 'var(--primary-yellow)', marginBottom: '20px', borderLeft: '4px solid var(--primary-yellow)', paddingLeft: '15px' }}>
                            {oaName} ({oaMenus.length})
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                            {oaMenus.map((item, idx) => {
                                const isDraft = item.isMetadata && item.status === 'draft';
                                const isPublished = (item.isMetadata && item.status === 'published') || !item.isMetadata;
                                const rid = item.rich_menu_id || item.richMenuId;
                                const isDefault = item.status === 'default';

                                return (
                                    <div key={idx} className="card" style={{ border: isDefault ? '2px solid #FFD700' : '1px solid #333' }}>
                                        <div style={{ height: '150px', backgroundColor: '#111', borderRadius: '8px', marginBottom: '15px', position: 'relative', overflow: 'hidden' }}>
                                            <RichMenuPreview menuId={rid} />
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: isDraft ? '#FF9800' : '#4CAF50', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                                {isDraft ? '草稿' : '已發佈'}
                                            </div>
                                            {isDefault && <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#FFD700', color: 'black', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>預設</div>}
                                        </div>
                                        <h4 style={{ marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h4>
                                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                                            {item.isMetadata ? `更新於 ${new Date(item.created_at).toLocaleString()}` : `ID: ${rid?.slice(-8)}`}
                                        </p>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => handleEditMenu(item, item.isMetadata)} className="secondary" style={{ flex: 1, padding: '8px' }}>
                                                {isDraft ? <Edit2 size={14} /> : <Eye size={14} />} {isDraft ? '編輯' : '查看'}
                                            </button>
                                            {isPublished && rid && (
                                                <>
                                                    <Tooltip title="立即將此選單連結至所有用戶 (Link)">
                                                        <button onClick={() => linkToAll(rid)} className="secondary" style={{ padding: '8px', color: 'var(--primary-yellow)', borderColor: 'var(--primary-yellow)' }}>
                                                            <LinkIcon size={16} />
                                                        </button>
                                                    </Tooltip>
                                                    {!isDefault && (
                                                        <Tooltip title="設為全域預設選單 (Set Default)">
                                                            <button onClick={() => setDefault(rid)} className="secondary" style={{ padding: '8px' }}>
                                                                <Check size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                </>
                                            )}
                                            <button onClick={() => deleteMenu(item.isMetadata ? item.id : item.richMenuId, item.isMetadata)} style={{ padding: '8px', color: '#ff4d4d', border: '1px solid #444', background: 'none' }}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RichMenu;
