import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import {
    Plus, Trash2, Save, Image as ImageIcon, Settings,
    MousePointer2, Move, Maximize, Check, X, AlertCircle,
    ChevronDown, ChevronUp, ExternalLink, MessageSquare,
    CreditCard, Repeat, Eye, Edit2, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, Filter, Calendar, RotateCcw
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { Tooltip as MuiTooltip } from '@mui/material';
import TagInput from '../components/TagInput';
import { API_BASE_URL } from '../api';

// Styled or aliased Tooltip to avoid conflict
const Tooltip = ({ title, children }) => {
    if (!title) return children;
    return <MuiTooltip title={title} arrow placement="top">{children}</MuiTooltip>;
};

const ACTION_TYPES = [
    { value: 'message', label: '傳送文字', icon: MessageSquare },
    { value: 'uri', label: '跳轉網頁', icon: ExternalLink },
    { value: 'postback', label: 'Postback', icon: CreditCard },
    { value: 'richmenuswitch', label: '切換選單', icon: Repeat },
];

function RichMenu() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('list'); // 'list' or 'edit'
    const [currentMenu, setCurrentMenu] = useState(null);
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [allAliases, setAllAliases] = useState([]);
    const [viewOnly, setViewOnly] = useState(false);

    // Initial menu state
    const emptyMenu = {
        size: { width: 2500, height: 1686 },
        selected: false,
        name: '未命名選單',
        chatBarText: '開啟選單',
        alias: '',
        areas: []
    };

    const scale = 0.2; // Preview scale

    useEffect(() => {
        if (view === 'list') {
            fetchMenus();
        }
    }, [view, oaId]);

    // Clean up object URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (backgroundImage && backgroundImage.startsWith('blob:')) {
                URL.revokeObjectURL(backgroundImage);
            }
        };
    }, [backgroundImage]);

    const fetchMenus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/richmenu/');
            setMenus(res.data.richmenus || []);
        } catch (err) {
            console.error('Failed to fetch menus:', err);
            const status = err.response?.status;
            const detail = err.response?.data?.message || err.message;
            if (status === 400 && detail?.includes('token')) {
                showToast('載入圖文選單失敗：尚未設定 LINE Token，請至專案設定中配置', 'error');
            } else {
                showToast(`載入圖文選單失敗：${detail}`, 'error');
            }
        }

        // Aliases 獨立載入，失敗不影響主頁面
        try {
            const aliasRes = await api.get('/richmenu/aliases');
            setAllAliases((aliasRes.data.aliases || []).map(a => a.richMenuAliasId));
        } catch (err) {
            console.warn('Failed to fetch aliases (non-blocking):', err);
        }

        setLoading(false);
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
            console.error('Failed to fetch image with auth:', err);
            showToast('載入圖片失敗', 'error');
            return null;
        }
    };

    const handleEditMenu = async (menu) => {
        setLoading(true);
        try {
            setCurrentMenu({ ...menu });
            setViewOnly(true);
            const imageUrl = await fetchImageWithAuth(menu.richMenuId);
            setBackgroundImage(imageUrl);
            setView('edit');
            setSelectedAreaIndex(null);
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
        setCurrentMenu({
            ...currentMenu,
            areas: [...currentMenu.areas, newArea]
        });
        setSelectedAreaIndex(currentMenu.areas.length);
    };

    const removeArea = (index) => {
        if (viewOnly) return;
        const newAreas = currentMenu.areas.filter((_, i) => i !== index);
        setCurrentMenu({ ...currentMenu, areas: newAreas });
        setSelectedAreaIndex(null); // Reset selection to be safe
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
            const updatedAction = { ...newAreas[index].action, ...action };
            
            // Special handling for tags array
            if (action.tags) {
                updatedAction.tags = action.tags;
            }

            // Auto-fill data for richmenuswitch
            if (updatedAction.type === 'richmenuswitch' && action.richMenuAliasId) {
                updatedAction.data = `switch-to-${action.richMenuAliasId}`;
            }
            newAreas[index].action = updatedAction;
            setCurrentMenu({ ...currentMenu, areas: newAreas });
        }
    };

    const extractTagsFromValue = (type, value) => {
        if (!value || typeof value !== 'string') return { cleanValue: value, tags: [] };
        
        // 1. tag_true format: tag_true|tag1,tag2|content
        if (value.startsWith('tag_true|')) {
            const parts = value.split('|');
            if (parts.length >= 3) {
                const tags = parts[1].split(',').map(t => t.trim()).filter(t => t);
                const content = parts.slice(2).join('|');
                return { cleanValue: content, tags };
            }
            // Fallback for tag_true|content
            return { cleanValue: value.replace('tag_true|', ''), tags: [] };
        }

        // 2. Redirect URL format: /api/redirect?url=...&tags=...
        if (type === 'uri' && value.includes('/redirect?')) {
            const urlMatch = value.match(/[?&]url=([^&]*)/);
            const tagsMatch = value.match(/[?&]tags=([^&#]*)/);
            if (urlMatch && urlMatch[1]) {
                const cleanValue = decodeURIComponent(urlMatch[1]);
                const tags = tagsMatch && tagsMatch[1] ? decodeURIComponent(tagsMatch[1]).split(',').map(t => t.trim()).filter(t => t) : [];
                return { cleanValue, tags };
            }
        }

        return { cleanValue: value, tags: [] };
    };

    const handleImageUpload = (e) => {
        if (viewOnly) return;
        const file = e.target.files[0];
        if (!file) return;

        // 1. Check file type
        if (!file.type.startsWith('image/')) {
            showToast('錯誤：必須為圖片檔 (JPEG/PNG)', 'error');
            return;
        }

        // 2. Check file size (1MB)
        if (file.size > 1024 * 1024) {
            showToast('錯誤：檔案大小不可大於 1MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 3. Check dimensions
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
                    size: { width, height } // Sync menu size with image
                });
            };
            img.onerror = () => showToast('錯誤：無法讀取圖片', 'error');
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const getValidationErrors = () => {
        const errors = [];
        if (!currentMenu) return ["系統錯誤"];
        if (!currentMenu.name?.trim()) errors.push("請輸入選單名稱");
        if (!currentMenu.chatBarText?.trim()) errors.push("請輸入聊天欄標題");
        if (!backgroundImage) errors.push("請上傳底圖");
        if (currentMenu.areas.length === 0) errors.push("請至少新增一個區塊");

        currentMenu.areas.forEach((a, idx) => {
            const { type } = a.action;
            const prefix = `區塊 ${idx + 1}: `;
            if (type === 'message' && !a.action.text?.trim()) errors.push(prefix + "請輸入訊息文字");
            if (type === 'uri' && !a.action.uri?.trim()) errors.push(prefix + "請輸入網址");
            if (type === 'postback' && !a.action.data?.trim()) errors.push(prefix + "請輸入 Postback 資料");
            if (type === 'richmenuswitch' && !a.action.richMenuAliasId?.trim()) errors.push(prefix + "請選擇目標別名");
        });
        return errors;
    };

    const isFormValid = () => getValidationErrors().length === 0;

    const saveMenu = async () => {
        if (viewOnly) return;
        const errors = getValidationErrors();
        if (errors.length > 0) {
            showToast(`無法儲存：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '...' : ''}`, 'warning');
            return;
        }
        if (currentMenu.chatBarText.length > 14) {
            showToast('聊天欄標題長度不能超過 14 個字', 'warning');
            return;
        }

        setLoading(true);
        try {
            const metaData = {
                size: {
                    width: Math.round(currentMenu.size.width),
                    height: Math.round(currentMenu.size.height)
                },
                selected: currentMenu.selected || false,
                name: currentMenu.name.substring(0, 300),
                chatBarText: currentMenu.chatBarText.substring(0, 14),
                areas: currentMenu.areas.map(a => {
                    const action = { ...a.action };
                    const tags = action.tags || [];
                    
                    if (tags.length > 0) {
                        const tagString = tags.join(',');
                        if (action.type === 'message') {
                            action.text = `tag_true|${tagString}|${action.text}`;
                        } else if (action.type === 'postback') {
                            action.data = `tag_true|${tagString}|${action.data}`;
                        } else if (action.type === 'uri') {
                            const finalVal = action.uri.startsWith('http') ? action.uri : `https://${action.uri}`;
                            
                            // Force HTTPS for redirect because LINE requires it for Rich Menu URIs
                            let base = API_BASE_URL.startsWith('http') 
                                ? API_BASE_URL.replace(/\/$/, '') 
                                : window.location.origin + (API_BASE_URL.startsWith('/') ? '' : '/') + API_BASE_URL.replace(/\/$/, '');
                            
                            if (base.startsWith('http:')) {
                                base = base.replace('http:', 'https:');
                            }
                            
                            const redirectBase = base + '/redirect';
                            
                            // Rich Menu URIs are static in LINE's servers, they don't support <%m.user_id%> templates.
                            // We remove it to avoid "invalid uri" errors. 
                            // Note: Tagging for static URIs in Rich Menu will not have userId context unless using LIFF.
                            action.uri = `${redirectBase}?url=${encodeURIComponent(finalVal)}&tags=${encodeURIComponent(tagString)}&oaId=${oaId}`;
                        }
                    } else if (action.type === 'uri' && action.uri && !action.uri.startsWith('http')) {
                        // Ensure normal URIs also have a valid scheme
                        action.uri = `https://${action.uri}`;
                    }
                    // Remove temporary UI state
                    delete action.tags;

                    return {
                        bounds: {
                            x: Math.round(a.bounds.x),
                            y: Math.round(a.bounds.y),
                            width: Math.round(a.bounds.width),
                            height: Math.round(a.bounds.height)
                        },
                        action
                    };
                })
            };

            const createRes = await api.post('/richmenu/', metaData);
            const richMenuId = createRes.data.richMenuId;

            if (currentMenu.imageFile) {
                const formData = new FormData();
                formData.append('image', currentMenu.imageFile);
                await api.post(`/richmenu/${richMenuId}/image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                showToast('建立新選單時必須上傳底圖！', 'warning');
                setLoading(false);
                return;
            }

            const safeAlias = (currentMenu.alias || currentMenu.name).toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 32);
            if (safeAlias) {
                try {
                    await api.post('/richmenu/alias', {
                        richMenuAliasId: safeAlias,
                        richMenuId: richMenuId
                    });
                } catch (aliasErr) {
                    console.warn('Alias creation failed:', aliasErr);
                    showToast('別名建立失敗，可能已被使用', 'warning');
                }
            }

            showToast('圖文選單已成功同步至 Line！', 'success');
            setView('list');
        } catch (err) {
            console.error('Save failed details:', err.response?.data);
            const errorInfo = err.response?.data;
            let msg = '儲存失敗';
            if (errorInfo?.message) msg += `: ${errorInfo.message}`;
            if (errorInfo?.line_error) msg += `\nLine API 錯誤: ${JSON.stringify(errorInfo.line_error)}`;
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const deleteMenu = async (id) => {
        if (!window.confirm('確定要刪除此圖文選單嗎？')) return;
        try {
            await api.delete(`/richmenu/${id}`);
            fetchMenus();
            showToast('圖文選單已成功刪除！', 'success');
        } catch (err) {
            showToast('刪除失敗', 'error');
        }
    };

    const setDefault = async (id) => {
        setLoading(true);
        try {
            await api.post(`/richmenu/set-default/${id}`);
            fetchMenus();
            showToast('已成功設為預設選單！', 'success');
        } catch (err) {
            showToast('設定失敗: ' + (err.response?.data?.line_error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const getSortedMenus = () => {
        // Sort by richMenuId (UUID) descending to show recent ones first if possible, 
        // or just alphabetical as requested. 
        return [...menus].sort((a, b) => b.richMenuId.localeCompare(a.richMenuId));
    };

    // Drag & Resize logic
    const [dragInfo, setDragInfo] = useState(null);
    useEffect(() => {
        if (viewOnly) return;
        const handleGlobalMouseMove = (e) => {
            if (!dragInfo) return;
            const dx = (e.clientX - dragInfo.startX) / scale;
            const dy = (e.clientY - dragInfo.startY) / scale;
            const newBounds = { ...dragInfo.initialBounds };

            if (dragInfo.type === 'move') {
                newBounds.x = Math.max(0, Math.min(currentMenu.size.width - newBounds.width, Math.round(dragInfo.initialBounds.x + dx)));
                newBounds.y = Math.max(0, Math.min(currentMenu.size.height - newBounds.height, Math.round(dragInfo.initialBounds.y + dy)));
            } else if (dragInfo.type === 'resize') {
                newBounds.width = Math.max(10, Math.min(currentMenu.size.width - newBounds.x, Math.round(dragInfo.initialBounds.width + dx)));
                newBounds.height = Math.max(10, Math.min(currentMenu.size.height - newBounds.y, Math.round(dragInfo.initialBounds.height + dy)));
            }
            updateAreaBounds(dragInfo.index, newBounds);
        };
        const handleGlobalMouseUp = () => setDragInfo(null);
        if (dragInfo) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [dragInfo, viewOnly]);

    const AreaBox = ({ area, index, isSelected, onSelect }) => {
        const { bounds } = area;
        const style = {
            position: 'absolute',
            left: `${bounds.x * scale}px`,
            top: `${bounds.y * scale}px`,
            width: `${bounds.width * scale}px`,
            height: `${bounds.height * scale}px`,
            border: isSelected ? '3px solid #FFD700' : '2px solid rgba(255, 215, 0, 0.5)',
            backgroundColor: isSelected ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.1)',
            cursor: viewOnly ? 'pointer' : 'move',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '12px', zIndex: isSelected ? 10 : 1,
            userSelect: 'none', boxSizing: 'border-box'
        };
        const onMouseDown = (e, type) => {
            e.stopPropagation();
            onSelect(index);
            if (viewOnly) return;
            if (!bounds) return;
            setDragInfo({ index, type, startX: e.clientX, startY: e.clientY, initialBounds: { ...bounds } });
        };
        return (
            <div style={style} onMouseDown={(e) => onMouseDown(e, 'move')}>
                {index + 1}
                {isSelected && !viewOnly && (
                    <div onMouseDown={(e) => onMouseDown(e, 'resize')} style={{ position: 'absolute', bottom: 0, right: 0, width: 15, height: 15, backgroundColor: '#FFD700', cursor: 'nwse-resize', zIndex: 11 }} />
                )}
            </div>
        );
    };

    // Helper component for previews in list
    const RichMenuPreview = ({ menuId }) => {
        const [url, setUrl] = useState(null);
        useEffect(() => {
            let active = true;
            fetchImageWithAuth(menuId).then(blobUrl => {
                if (active) setUrl(blobUrl);
            });
            return () => {
                active = false;
                if (url) URL.revokeObjectURL(url);
            };
        }, [menuId]);

        return url ? <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} style={{ opacity: 0.3 }} />;
    };

    if (view === 'edit') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0 }}>← 返回列表</button>
                        <h1 style={{ fontSize: '28px' }}>{viewOnly ? '查看圖文選單' : '編輯圖文選單'}</h1>
                    </div>
                    {!viewOnly && (
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <Tooltip title={!isFormValid() ? getValidationErrors().join(' | ') : ''}>
                                <button
                                    onClick={saveMenu}
                                    className="primary"
                                    disabled={loading}
                                    style={{
                                        opacity: !isFormValid() ? 0.6 : 1,
                                        cursor: !isFormValid() ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <Save size={18} /> {loading ? '儲存中...' : '儲存並同步'}
                                </button>
                            </Tooltip>
                        </div>
                    )}
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
                                    <ImageIcon size={48} /><p>請上傳底圖 (2500x1686，≤1MB)</p>
                                    <input type="file" onChange={handleImageUpload} style={{ marginTop: '10px' }} accept="image/*" />
                                </div>
                            )}
                            {currentMenu.areas.map((area, idx) => (
                                <AreaBox key={idx} index={idx} area={area} isSelected={selectedAreaIndex === idx} onSelect={setSelectedAreaIndex} />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '15px' }}>選單設定</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div><label className="label">選單名稱</label><input type="text" disabled={viewOnly} value={currentMenu.name} onChange={e => setCurrentMenu({ ...currentMenu, name: e.target.value })} /></div>
                                <div><label className="label">選單別名</label><input type="text" disabled={viewOnly} value={currentMenu.alias || ''} placeholder="例如: main_menu" onChange={e => setCurrentMenu({ ...currentMenu, alias: e.target.value })} /></div>
                                <div><label className="label">聊天欄標題</label><input type="text" disabled={viewOnly} value={currentMenu.chatBarText} onChange={e => setCurrentMenu({ ...currentMenu, chatBarText: e.target.value })} /></div>
                                <div><label className="label">選單高度</label><select disabled={viewOnly} value={currentMenu.size.height} onChange={e => setCurrentMenu({ ...currentMenu, size: { ...currentMenu.size, height: parseInt(e.target.value) } })}><option value={1686}>大型 (1686px)</option><option value={843}>小型 (843px)</option></select></div>
                            </div>
                        </div>

                        <div className="card" style={{ flex: 1, minHeight: 'fit-content' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3>區塊設定 ({currentMenu.areas.length})</h3>
                                {!viewOnly && <button onClick={addArea} className="secondary" style={{ padding: '5px 10px' }}><Plus size={16} /></button>}
                            </div>

                            {selectedAreaIndex !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '8px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>區塊 {selectedAreaIndex + 1}</span>
                                            {!viewOnly && <Trash2 size={14} className="text-red" style={{ cursor: 'pointer' }} onClick={() => removeArea(selectedAreaIndex)} />}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">動作類型</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {ACTION_TYPES.map(type => (
                                                <button key={type.value} disabled={viewOnly} onClick={() => updateAreaAction(selectedAreaIndex, { type: type.value })}
                                                    style={{
                                                        padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', color: 'white',
                                                        backgroundColor: currentMenu.areas[selectedAreaIndex]?.action?.type === type.value ? 'rgba(255, 215, 0, 0.2)' : '#222',
                                                        border: currentMenu.areas[selectedAreaIndex]?.action?.type === type.value ? '1px solid #FFD700' : '1px solid #444'
                                                    }}>{type.label}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {currentMenu.areas[selectedAreaIndex]?.action?.type === 'message' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label className="label">傳送訊息文字</label>
                                                {(() => {
                                                    const { cleanValue, tags } = extractTagsFromValue('message', currentMenu.areas[selectedAreaIndex].action.text);
                                                    return (
                                                        <>
                                                            <input type="text" disabled={viewOnly} value={cleanValue || ''} onChange={e => {
                                                                const currentTags = currentMenu.areas[selectedAreaIndex].action.tags || tags;
                                                                updateAreaAction(selectedAreaIndex, { text: e.target.value, tags: currentTags });
                                                            }} />
                                                            <div style={{ marginTop: '8px' }}>
                                                                <label className="label" style={{ fontSize: '11px', color: '#888' }}>點擊時標註標籤</label>
                                                                <TagInput
                                                                    tags={currentMenu.areas[selectedAreaIndex].action.tags || tags}
                                                                    onChange={newTags => updateAreaAction(selectedAreaIndex, { tags: newTags })}
                                                                    readOnly={viewOnly}
                                                                />
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                    {currentMenu.areas[selectedAreaIndex]?.action?.type === 'uri' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label className="label">網址 (URL)</label>
                                                {(() => {
                                                    const { cleanValue, tags } = extractTagsFromValue('uri', currentMenu.areas[selectedAreaIndex].action.uri);
                                                    return (
                                                        <>
                                                            <input type="text" disabled={viewOnly} value={cleanValue || ''} onChange={e => {
                                                                const currentTags = currentMenu.areas[selectedAreaIndex].action.tags || tags;
                                                                updateAreaAction(selectedAreaIndex, { uri: e.target.value, tags: currentTags });
                                                            }} />
                                                            <div style={{ marginTop: '8px' }}>
                                                                <label className="label" style={{ fontSize: '11px', color: '#888' }}>點擊時標註標籤</label>
                                                                <TagInput
                                                                    tags={currentMenu.areas[selectedAreaIndex].action.tags || tags}
                                                                    onChange={newTags => updateAreaAction(selectedAreaIndex, { tags: newTags })}
                                                                    readOnly={viewOnly}
                                                                />
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                    {currentMenu.areas[selectedAreaIndex]?.action?.type === 'postback' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label className="label">Postback Data</label>
                                                {(() => {
                                                    const { cleanValue, tags } = extractTagsFromValue('postback', currentMenu.areas[selectedAreaIndex].action.data);
                                                    return (
                                                        <>
                                                            <input type="text" disabled={viewOnly} value={cleanValue || ''} onChange={e => {
                                                                const currentTags = currentMenu.areas[selectedAreaIndex].action.tags || tags;
                                                                updateAreaAction(selectedAreaIndex, { data: e.target.value, tags: currentTags });
                                                            }} />
                                                            <div style={{ marginTop: '8px' }}>
                                                                <label className="label" style={{ fontSize: '11px', color: '#888' }}>點擊時標註標籤</label>
                                                                <TagInput
                                                                    tags={currentMenu.areas[selectedAreaIndex].action.tags || tags}
                                                                    onChange={newTags => updateAreaAction(selectedAreaIndex, { tags: newTags })}
                                                                    readOnly={viewOnly}
                                                                />
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <div><label className="label">顯示文字 (displayText)</label><input type="text" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].action.displayText || ''} onChange={e => updateAreaAction(selectedAreaIndex, { displayText: e.target.value })} /></div>
                                        </div>
                                    )}
                                    {currentMenu.areas[selectedAreaIndex]?.action?.type === 'richmenuswitch' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label className="label">切換目標別名 (Target Alias)</label>
                                                <input
                                                    type="text"
                                                    list="available-aliases"
                                                    disabled={viewOnly}
                                                    value={currentMenu.areas[selectedAreaIndex].action.richMenuAliasId || ''}
                                                    onChange={e => updateAreaAction(selectedAreaIndex, { richMenuAliasId: e.target.value })}
                                                />
                                                <datalist id="available-aliases">
                                                    {allAliases.map(a => <option key={a} value={a} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '10px' }}>
                                        <div><label className="label">X (px)</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex]?.bounds?.x || 0} onChange={e => updateAreaBounds(selectedAreaIndex, { x: parseInt(e.target.value) || 0 })} /></div>
                                        <div><label className="label">Y (px)</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex]?.bounds?.y || 0} onChange={e => updateAreaBounds(selectedAreaIndex, { y: parseInt(e.target.value) || 0 })} /></div>
                                        <div><label className="label">寬 (px)</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex]?.bounds?.width || 0} onChange={e => updateAreaBounds(selectedAreaIndex, { width: parseInt(e.target.value) || 0 })} /></div>
                                        <div><label className="label">高 (px)</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex]?.bounds?.height || 0} onChange={e => updateAreaBounds(selectedAreaIndex, { height: parseInt(e.target.value) || 0 })} /></div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', textAlign: 'center' }}>請點選左側區塊進行查看</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div><h1 style={{ fontSize: '32px', marginBottom: '10px' }}>圖文選單</h1><p style={{ color: '#B0B0B0' }}>管理並設計 OA 的圖文選單按鈕與功能</p></div>
                <div style={{ padding: '10px 15px', backgroundColor: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px', fontSize: '13px', color: '#FFD700', maxWidth: '500px' }}>
                    <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                    系統僅能顯示與管理透過此介面或 API 建立的選單。原先於 LINE 官方後台 GUI 建立的選單無法讀取。
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <Tooltip title="重置預設：若設定預設後手機沒更新，可先嘗試解除目前的預設再重新設定。">
                        <button onClick={handleUnsetDefault} className="secondary" style={{ color: '#ff4d4d', borderColor: '#444' }}><RotateCcw size={18} /> 重置預設</button>
                    </Tooltip>
                    <button onClick={handleCreateNew} className="primary"><Plus size={20} /> 新增選單</button>
                </div>
            </div>
            {loading ? <div style={{ padding: '50px', textAlign: 'center' }}>載入中...</div> : menus.length === 0 ? (
                <div className="card" style={{ padding: '50px', textAlign: 'center' }}><AlertCircle size={48} style={{ color: '#666', marginBottom: '15px' }} /><p style={{ color: '#888' }}>目前還沒有任何圖文選單</p><button onClick={handleCreateNew} className="secondary" style={{ marginTop: '20px' }}>立即建立第一個選單</button></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {getSortedMenus().map((menu) => (
                        <div key={menu.richMenuId} className="card" style={{ position: 'relative', border: menu.status === 'default' ? '1px solid #FFD700' : '1px solid #333' }}>
                            {menu.status === 'default' && <div style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: '#FFD700', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>預設中</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ height: '150px', backgroundColor: '#222', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#666', overflow: 'hidden' }}>
                                    <RichMenuPreview menuId={menu.richMenuId} />
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{menu.name}</h4>
                                    <p style={{ fontSize: '13px', color: '#888' }}>選單別名: {menu.aliases?.join(', ') || '無'}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button onClick={() => handleEditMenu(menu)} className="secondary" style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Eye size={14} /> 查看</button>
                                    {menu.status !== 'default' ? (
                                        <button onClick={() => setDefault(menu.richMenuId)} className="secondary" style={{ flex: 1, padding: '8px' }}>設為預設</button>
                                    ) : (
                                        <button className="secondary" disabled style={{ flex: 1, padding: '8px', opacity: 0.5 }}>已設預設</button>
                                    )}
                                    <button onClick={() => deleteMenu(menu.richMenuId)} style={{ padding: '8px', border: '1px solid #444', background: 'none', color: '#ff4d4d' }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default RichMenu;
