import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import {
    Plus, Trash2, Save, Image as ImageIcon, Settings,
    MousePointer2, Move, Maximize, Check, X, AlertCircle,
    ChevronDown, ChevronUp, ExternalLink, MessageSquare,
    CreditCard, Repeat
} from 'lucide-react';

const ACTION_TYPES = [
    { value: 'message', label: '傳送文字', icon: MessageSquare },
    { value: 'uri', label: '跳轉網頁', icon: ExternalLink },
    { value: 'postback', label: 'Postback', icon: CreditCard },
    { value: 'richmenuswitch', label: '切換選單', icon: Repeat },
];

function RichMenu() {
    const { oaId } = useParams();
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('list'); // 'list' or 'edit'
    const [currentMenu, setCurrentMenu] = useState(null);
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Initial menu state
    const emptyMenu = {
        size: { width: 2500, height: 1686 },
        selected: false,
        name: '未命名選單',
        chatBarText: '開啟選單',
        areas: []
    };

    useEffect(() => {
        if (view === 'list') {
            fetchMenus();
        }
    }, [view, oaId]);

    const fetchMenus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/richmenu/');
            setMenus(res.data.richmenus || []);
        } catch (err) {
            console.error('Failed to fetch menus:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setCurrentMenu({ ...emptyMenu });
        setBackgroundImage(null);
        setView('edit');
    };

    const handleEditMenu = (menu) => {
        // Line API returns areas with bounds, we use them directly
        setCurrentMenu({ ...menu });
        // In a real app, we'd fetch the image from Line, but here we expect user to re-upload or manage
        setBackgroundImage(null);
        setView('edit');
    };

    const addArea = () => {
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
        const newAreas = currentMenu.areas.filter((_, i) => i !== index);
        setCurrentMenu({ ...currentMenu, areas: newAreas });
        if (selectedAreaIndex === index) setSelectedAreaIndex(null);
    };

    const updateAreaBounds = (index, bounds) => {
        const newAreas = [...currentMenu.areas];
        newAreas[index].bounds = { ...newAreas[index].bounds, ...bounds };
        setCurrentMenu({ ...currentMenu, areas: newAreas });
    };

    const updateAreaAction = (index, action) => {
        const newAreas = [...currentMenu.areas];
        newAreas[index].action = { ...newAreas[index].action, ...action };
        setCurrentMenu({ ...currentMenu, areas: newAreas });
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setBackgroundImage(event.target.result);
                // Try to auto-detect size if needed, but Line prefers 2500x1686 or 2500x843
            };
            reader.readAsDataURL(file);
            setCurrentMenu({ ...currentMenu, imageFile: file });
        }
    };

    const saveMenu = async () => {
        if (!currentMenu.name || !currentMenu.chatBarText) {
            alert('請填寫選單名稱和標題');
            return;
        }

        if (currentMenu.chatBarText.length > 14) {
            alert('聊天欄標題長度不能超過 14 個字');
            return;
        }

        if (currentMenu.areas.length === 0) {
            alert('請至少新增一個點擊區塊');
            return;
        }

        // Validate Actions
        for (let i = 0; i < currentMenu.areas.length; i++) {
            const area = currentMenu.areas[i];
            if (area.action.type === 'message' && !area.action.text) {
                alert(`區塊 ${i + 1} 的文字訊息不能為空`);
                return;
            }
            if (area.action.type === 'uri' && !area.action.uri) {
                alert(`區塊 ${i + 1} 的網址不能為空`);
                return;
            }
            if (area.action.type === 'postback' && !area.action.data) {
                alert(`區塊 ${i + 1} 的 Postback Data 不能為空`);
                return;
            }
            if (area.action.type === 'richmenuswitch') {
                if (!area.action.richMenuAliasId) {
                    alert(`區塊 ${i + 1} 的切換目標別名不能為空`);
                    return;
                }
                if (!area.action.data) {
                    alert(`區塊 ${i + 1} 的 Data 不能為空（Line 規範切換選單必須帶入 Data）`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            // 1. Create Metadata
            const metaData = {
                size: {
                    width: Math.round(currentMenu.size.width),
                    height: Math.round(currentMenu.size.height)
                },
                selected: currentMenu.selected || false,
                name: currentMenu.name.substring(0, 300),
                chatBarText: currentMenu.chatBarText.substring(0, 14),
                areas: currentMenu.areas.map(a => ({
                    bounds: {
                        x: Math.round(a.bounds.x),
                        y: Math.round(a.bounds.y),
                        width: Math.round(a.bounds.width),
                        height: Math.round(a.bounds.height)
                    },
                    action: { ...a.action }
                }))
            };

            let richMenuId = currentMenu.richMenuId;
            if (!richMenuId) {
                console.log('Creating new rich menu metadata:', metaData);
                const createRes = await api.post('/richmenu/', metaData);
                richMenuId = createRes.data.richMenuId;
            }

            // 2. Upload Image if provided
            if (currentMenu.imageFile) {
                console.log('Uploading image for:', richMenuId);
                const formData = new FormData();
                formData.append('image', currentMenu.imageFile);
                await api.post(`/richmenu/${richMenuId}/image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else if (!currentMenu.richMenuId) {
                alert('建立新選單時必須上傳底圖！');
                setLoading(false);
                return;
            }

            // 3. Create Alias (Sanitize: only a-z0-9_-)
            const safeAlias = currentMenu.name.toLowerCase()
                .replace(/[^a-z0-9_-]/g, '_')
                .substring(0, 32);

            if (safeAlias) {
                try {
                    console.log('Creating alias:', safeAlias, 'for', richMenuId);
                    await api.post('/richmenu/alias', {
                        richMenuAliasId: safeAlias,
                        richMenuId: richMenuId
                    });
                } catch (aliasErr) {
                    console.warn('Alias creation failed (it might already exist):', aliasErr);
                }
            }

            alert('圖文選單已成功同步至 Line！');
            setView('list');
        } catch (err) {
            console.error('Save failed details:', err.response?.data);
            const errorInfo = err.response?.data;
            let msg = '儲存失敗';

            if (errorInfo?.message) {
                msg += `: ${errorInfo.message}`;
            }

            if (errorInfo?.line_error) {
                msg += `\nLine API 錯誤: ${typeof errorInfo.line_error === 'object' ? JSON.stringify(errorInfo.line_error) : errorInfo.line_error}`;
            } else if (errorInfo?.error) {
                msg += `\n詳情: ${errorInfo.error}`;
            }

            if (errorInfo?.details) {
                msg += `\n欄位詳情: ${JSON.stringify(errorInfo.details)}`;
            }

            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    const deleteMenu = async (id) => {
        if (!window.confirm('確定要刪除此圖文選單嗎？')) return;
        try {
            await api.delete(`/richmenu/${id}`);
            fetchMenus();
        } catch (err) {
            alert('刪除失敗');
        }
    };

    const setDefault = async (id) => {
        try {
            await api.post(`/richmenu/set-default/${id}`);
            fetchMenus();
            alert('已設為預設選單');
        } catch (err) {
            alert('設定失敗');
        }
    };

    const [dragInfo, setDragInfo] = useState(null); // { index, type: 'move'|'resize', startX, startY, initialBounds }

    const scale = 0.2; // Preview scale constant

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (!dragInfo) return;

            const dx = (e.clientX - dragInfo.startX) / scale;
            const dy = (e.clientY - dragInfo.startY) / scale;

            const newBounds = { ...dragInfo.initialBounds };

            if (dragInfo.type === 'move') {
                newBounds.x = Math.max(0, Math.min(emptyMenu.size.width - newBounds.width, Math.round(dragInfo.initialBounds.x + dx)));
                newBounds.y = Math.max(0, Math.min(currentMenu.size.height - newBounds.height, Math.round(dragInfo.initialBounds.y + dy)));
            } else if (dragInfo.type === 'resize') {
                newBounds.width = Math.max(10, Math.min(emptyMenu.size.width - newBounds.x, Math.round(dragInfo.initialBounds.width + dx)));
                newBounds.height = Math.max(10, Math.min(currentMenu.size.height - newBounds.y, Math.round(dragInfo.initialBounds.height + dy)));
            }

            updateAreaBounds(dragInfo.index, newBounds);
        };

        const handleGlobalMouseUp = () => {
            setDragInfo(null);
        };

        if (dragInfo) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [dragInfo, currentMenu?.size.height]);

    // Canvas Logic for resizing/dragging boxes
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
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            zIndex: isSelected ? 10 : 1,
            userSelect: 'none',
            boxSizing: 'border-box'
        };

        const onMouseDown = (e, type) => {
            e.stopPropagation();
            onSelect(index);
            setDragInfo({
                index,
                type,
                startX: e.clientX,
                startY: e.clientY,
                initialBounds: { ...bounds }
            });
        };

        return (
            <div
                style={style}
                onMouseDown={(e) => onMouseDown(e, 'move')}
            >
                {index + 1}
                {isSelected && (
                    <div
                        onMouseDown={(e) => onMouseDown(e, 'resize')}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 15,
                            height: 15,
                            backgroundColor: '#FFD700',
                            cursor: 'nwse-resize',
                            zIndex: 11
                        }}
                    />
                )}
            </div>
        );
    };

    if (view === 'edit') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0 }}>← 返回列表</button>
                        <h1 style={{ fontSize: '28px' }}>編輯圖文選單</h1>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={saveMenu} className="primary" disabled={loading}>
                            <Save size={18} /> {loading ? '儲存中...' : '儲存並同步'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px', flex: 1, minHeight: 0 }}>
                    {/* Visual Editor */}
                    <div className="card" style={{ overflow: 'auto', padding: '40px', backgroundColor: '#000', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        <div
                            style={{
                                position: 'relative',
                                width: `${currentMenu.size.width * scale}px`,
                                height: `${currentMenu.size.height * scale}px`,
                                backgroundColor: '#222',
                                border: '1px solid #444',
                                backgroundSize: 'cover',
                                backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                                flexShrink: 0
                            }}
                            onClick={() => setSelectedAreaIndex(null)}
                        >
                            {!backgroundImage && (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
                                    <ImageIcon size={48} />
                                    <p>請先上傳底圖 (2500x1686 或 2500x843)</p>
                                    <input type="file" onChange={handleImageUpload} style={{ marginTop: '10px' }} accept="image/*" />
                                </div>
                            )}
                            {currentMenu.areas.map((area, idx) => (
                                <AreaBox
                                    key={idx}
                                    index={idx}
                                    area={area}
                                    isSelected={selectedAreaIndex === idx}
                                    onSelect={setSelectedAreaIndex}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Properties Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '5px' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '15px' }}>選單設定</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label className="label">選單別名/名稱</label>
                                    <input
                                        type="text"
                                        value={currentMenu.name}
                                        onChange={e => setCurrentMenu({ ...currentMenu, name: e.target.value })}
                                        placeholder="例如: main_menu"
                                    />
                                </div>
                                <div>
                                    <label className="label">聊天欄標題</label>
                                    <input
                                        type="text"
                                        value={currentMenu.chatBarText}
                                        onChange={e => setCurrentMenu({ ...currentMenu, chatBarText: e.target.value })}
                                        placeholder="例如: 點我看優惠"
                                    />
                                </div>
                                <div>
                                    <label className="label">選單高度</label>
                                    <select
                                        value={currentMenu.size.height}
                                        onChange={e => setCurrentMenu({ ...currentMenu, size: { ...currentMenu.size, height: parseInt(e.target.value) } })}
                                    >
                                        <option value={1686}>大型 (1686px)</option>
                                        <option value={843}>小型 (843px)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ flex: 1, minHeight: 'fit-content' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3>區塊設定 ({currentMenu.areas.length})</h3>
                                <button onClick={addArea} className="secondary" style={{ padding: '5px 10px' }}><Plus size={16} /></button>
                            </div>

                            {selectedAreaIndex !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '8px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>區塊 {selectedAreaIndex + 1}</span>
                                            <Trash2 size={14} className="text-red" style={{ cursor: 'pointer' }} onClick={() => removeArea(selectedAreaIndex)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label">動作類型</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {ACTION_TYPES.map(type => (
                                                <button
                                                    key={type.value}
                                                    onClick={() => updateAreaAction(selectedAreaIndex, { type: type.value })}
                                                    style={{
                                                        padding: '8px',
                                                        fontSize: '12px',
                                                        backgroundColor: currentMenu.areas[selectedAreaIndex].action.type === type.value ? 'rgba(255, 215, 0, 0.2)' : '#222',
                                                        border: currentMenu.areas[selectedAreaIndex].action.type === type.value ? '1px solid #FFD700' : '1px solid #444',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {currentMenu.areas[selectedAreaIndex].action.type === 'message' && (
                                        <div>
                                            <label className="label">傳送訊息文字</label>
                                            <input
                                                type="text"
                                                value={currentMenu.areas[selectedAreaIndex].action.text || ''}
                                                onChange={e => updateAreaAction(selectedAreaIndex, { text: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {currentMenu.areas[selectedAreaIndex].action.type === 'uri' && (
                                        <div>
                                            <label className="label">網址 (URL)</label>
                                            <input
                                                type="text"
                                                value={currentMenu.areas[selectedAreaIndex].action.uri || ''}
                                                onChange={e => updateAreaAction(selectedAreaIndex, { uri: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {currentMenu.areas[selectedAreaIndex].action.type === 'postback' && (
                                        <div>
                                            <label className="label">Postback Data</label>
                                            <input
                                                type="text"
                                                value={currentMenu.areas[selectedAreaIndex].action.data || ''}
                                                onChange={e => updateAreaAction(selectedAreaIndex, { data: e.target.value })}
                                            />
                                        </div>
                                    )}

                                    {currentMenu.areas[selectedAreaIndex].action.type === 'richmenuswitch' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div>
                                                <label className="label">切換目標別名 (Alias)</label>
                                                <input
                                                    type="text"
                                                    value={currentMenu.areas[selectedAreaIndex].action.richMenuAliasId || ''}
                                                    onChange={e => updateAreaAction(selectedAreaIndex, { richMenuAliasId: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">傳送 Data (可選)</label>
                                                <input
                                                    type="text"
                                                    value={currentMenu.areas[selectedAreaIndex].action.data || ''}
                                                    onChange={e => updateAreaAction(selectedAreaIndex, { data: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px' }}>
                                        <div>
                                            <label className="label">X (px)</label>
                                            <input type="number" style={{ width: '100%' }} value={currentMenu.areas[selectedAreaIndex].bounds.x} onChange={e => updateAreaBounds(selectedAreaIndex, { x: parseInt(e.target.value) || 0 })} />
                                        </div>
                                        <div>
                                            <label className="label">Y (px)</label>
                                            <input type="number" style={{ width: '100%' }} value={currentMenu.areas[selectedAreaIndex].bounds.y} onChange={e => updateAreaBounds(selectedAreaIndex, { y: parseInt(e.target.value) || 0 })} />
                                        </div>
                                        <div>
                                            <label className="label">寬 (px)</label>
                                            <input type="number" style={{ width: '100%' }} value={currentMenu.areas[selectedAreaIndex].bounds.width} onChange={e => updateAreaBounds(selectedAreaIndex, { width: parseInt(e.target.value) || 0 })} />
                                        </div>
                                        <div>
                                            <label className="label">高 (px)</label>
                                            <input type="number" style={{ width: '100%' }} value={currentMenu.areas[selectedAreaIndex].bounds.height} onChange={e => updateAreaBounds(selectedAreaIndex, { height: parseInt(e.target.value) || 0 })} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', textAlign: 'center' }}>
                                    請點選左側區塊<br />進行設定
                                </div>
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
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>圖文選單</h1>
                    <p style={{ color: '#B0B0B0' }}>管理並設計 OA 的圖文選單按鈕與功能</p>
                </div>
                <button onClick={handleCreateNew} className="primary">
                    <Plus size={20} /> 新增選單
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '50px', textAlign: 'center' }}>載入中...</div>
            ) : menus.length === 0 ? (
                <div className="card" style={{ padding: '50px', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#666', marginBottom: '15px' }} />
                    <p style={{ color: '#888' }}>目前還沒有任何圖文選單</p>
                    <button onClick={handleCreateNew} className="secondary" style={{ marginTop: '20px' }}>立即建立第一個選單</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {menus.map((menu) => (
                        <div key={menu.richMenuId} className="card" style={{ position: 'relative' }}>
                            {menu.status === 'default' && (
                                <div style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: '#FFD700', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                    預設中
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ height: '120px', backgroundColor: '#222', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#666' }}>
                                    {/* Ideally show a thumbnail here */}
                                    {menu.richMenuId}
                                </div>
                                <div>
                                    <h4 style={{ marginBottom: '5px' }}>{menu.name}</h4>
                                    <p style={{ fontSize: '13px', color: '#888' }}>別名: {menu.aliases?.join(', ') || '無'}</p>
                                    <p style={{ fontSize: '13px', color: '#888' }}>尺寸: {menu.size.width}x{menu.size.height}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button onClick={() => handleEditMenu(menu)} className="secondary" style={{ flex: 1, padding: '8px' }}>編輯</button>
                                    {menu.status !== 'default' && (
                                        <button onClick={() => setDefault(menu.richMenuId)} className="secondary" style={{ flex: 1, padding: '8px' }}>設為預設</button>
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
