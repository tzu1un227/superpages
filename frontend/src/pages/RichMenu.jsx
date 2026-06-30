import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { hasCachedApiResponse } from '../api';
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

// 全域記憶體圖片快取，避免重複對相同的圖文選單 ID 請求慢速的二進位資料
const frontendImageCache = {};

const MenuPreviewImage = ({ target }) => {
    const getBase64Url = (base64) => base64 ? (base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`) : null;
    let initialBase64 = target.imageBase64;
    if (!initialBase64 && target.data) {
        try {
            const dataObj = typeof target.data === 'string' ? JSON.parse(target.data) : target.data;
            if (Array.isArray(dataObj) && dataObj.length > 0) initialBase64 = dataObj[0].imageBase64;
            else if (dataObj) initialBase64 = dataObj.imageBase64;
        } catch(e) {}
    }
    const [imgUrl, setImgUrl] = React.useState(getBase64Url(initialBase64));
    
    React.useEffect(() => {
        let b64 = target.imageBase64;
        if (!b64 && target.data) {
            try {
                const dataObj = typeof target.data === 'string' ? JSON.parse(target.data) : target.data;
                if (Array.isArray(dataObj) && dataObj.length > 0) b64 = dataObj[0].imageBase64;
                else if (dataObj) b64 = dataObj.imageBase64;
            } catch(e) {}
        }
        
        if (b64) {
            setImgUrl(getBase64Url(b64));
        } else if (target.rich_menu_id || target.richMenuId) {
            const rid = target.rich_menu_id || target.richMenuId;
            if (frontendImageCache[rid]) {
                setImgUrl(frontendImageCache[rid]);
            } else {
                api.get(`/richmenu/${rid}/image`, { responseType: 'blob' }).then(res => {
                    const url = URL.createObjectURL(res.data);
                    frontendImageCache[rid] = url;
                    setImgUrl(url);
                }).catch(() => {});
            }
        }
    }, [target]);

    return imgUrl ? <img src={imgUrl} alt={target.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '10px', color: '#666' }}>無圖片</span>;
};


function RichMenu() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    const [menus, setMenus] = useState([]);
    const [metadata, setMetadata] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('list'); // 'list', 'edit', 'permissions'
    const [currentGroup, setCurrentGroup] = useState([]);
    const [currentMenuIndex, setCurrentMenuIndex] = useState(0);
    const currentMenu = currentGroup[currentMenuIndex] || null;

    const setCurrentMenu = (updater) => {
        setCurrentGroup(prevGroup => {
            if (!prevGroup || prevGroup.length === 0) return prevGroup;
            const newGroup = [...prevGroup];
            const prevMenu = newGroup[currentMenuIndex];
            const updatedMenu = typeof updater === 'function' ? updater(prevMenu) : updater;
            newGroup[currentMenuIndex] = updatedMenu;
            return newGroup;
        });
    };
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [linkModalState, setLinkModalState] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [allAliases, setAllAliases] = useState([]);
    const [viewOnly, setViewOnly] = useState(false);
    const [menuSearch, setMenuSearch] = useState('');
    const { myOAs, currentAccount } = useAuth();
    const navigate = useNavigate();
    const [selectedOAId, setSelectedOAId] = useState(oaId || 'all');
    const [dragState, setDragState] = useState(null);
    const imageContainerRef = useRef(null);

    // Auto-fetch and set background image for currentMenu
    useEffect(() => {
        if (!currentMenu) return;
        if (currentMenu.imageBase64) {
            setBackgroundImage(currentMenu.imageBase64.startsWith('data:') ? currentMenu.imageBase64 : `data:image/jpeg;base64,${currentMenu.imageBase64}`);
        } else if (currentMenu.richMenuId || currentMenu.rich_menu_id) {
            const rid = currentMenu.richMenuId || currentMenu.rich_menu_id;
            fetchImageWithAuth(rid).then(imageUrl => {
                if (imageUrl) setBackgroundImage(imageUrl);
                else setBackgroundImage(null);
            });
        } else {
            setBackgroundImage(null);
        }
    }, [currentMenu?.ui_uuid, currentMenu?.richMenuId, currentMenu?.rich_menu_id, currentMenu?.imageBase64]);

    // Initial menu state
    const emptyMenu = {
        size: { width: 2500, height: 1686 },
        name: '未命名選單',
        chatBarText: '開啟選單',
        areas: [],
        status: 'draft',
        start_time: '',
        end_time: '',
        visibility: 'public',
        publishStrategy: 'hidden',
        targetTags: [],
        targetAll: false,
        targetUserCount: 0,
        permissionTags: [],
        fallbackMessage: '',
        alias_id: ''
    };

    const [allTags, setAllTags] = useState([]);

    const scale = 0.2;

    const getMenusEndpoint = () => selectedOAId === 'all' ? '/richmenu/all' : '/richmenu/';

    useEffect(() => {
        setSelectedOAId(oaId || 'all');
    }, [oaId]);

    useEffect(() => {
        if (view === 'list') {
            fetchData();
        }
    }, [view, oaId, selectedOAId]);

    const fetchData = async () => {
        const menusEndpoint = getMenusEndpoint();
        const hasWarmCache = hasCachedApiResponse(menusEndpoint) && hasCachedApiResponse('/richmenu/metadata');

        if (!hasWarmCache) {
            setLoading(true);
        }

        try {
            await Promise.all([fetchMenus(), fetchMetadata()]);
            // 取得標籤清單供下拉選單使用
            try {
                const tagsRes = await api.get('/customers/tags');
                setAllTags(tagsRes.data || []);
            } catch (err) {
                console.error('Failed to fetch tags:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMenus = async () => {
        try {
            const res = await api.get(getMenusEndpoint());
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

    const handleCreateNew = () => {
        const newUuid = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newMenu = { ...emptyMenu, ui_uuid: newUuid, group_id: newUuid };
        setCurrentGroup([newMenu]);
        setCurrentMenuIndex(0);
        setBackgroundImage(null);
        setViewOnly(false);
        setSelectedAreaIndex(null);
        setView('edit');
    };

    const handleMouseDown = (e, index, type) => {
        if (viewOnly) return;
        e.stopPropagation();
        setSelectedAreaIndex(index);
        setDragState({ type, index, startX: e.clientX, startY: e.clientY, startBounds: { ...currentMenu.areas[index].bounds } });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragState) return;
            const dx = Math.round((e.clientX - dragState.startX) / scale);
            const dy = Math.round((e.clientY - dragState.startY) / scale);
            
            const newBounds = { ...dragState.startBounds };
            
            if (dragState.type === 'move') {
                newBounds.x = Math.max(0, Math.min(currentMenu.size.width - newBounds.width, newBounds.x + dx));
                newBounds.y = Math.max(0, Math.min(currentMenu.size.height - newBounds.height, newBounds.y + dy));
            } else if (dragState.type === 'resize') {
                newBounds.width = Math.max(50, Math.min(currentMenu.size.width - newBounds.x, newBounds.width + dx));
                newBounds.height = Math.max(50, Math.min(currentMenu.size.height - newBounds.y, newBounds.height + dy));
            }
            
            setCurrentMenu(prev => {
                const newAreas = [...prev.areas];
                if (newAreas[dragState.index]) {
                    newAreas[dragState.index].bounds = { ...newBounds };
                }
                return { ...prev, areas: newAreas };
            });
        };
        
        const handleMouseUp = () => {
            setDragState(null);
        };
        
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, currentMenu, scale]);

    useEffect(() => {
        if (!currentMenu || view !== 'edit' || viewOnly) return;
        const fetchCount = async (tags = []) => {
            try {
                const res = await api.post('/customers/count-by-tags', { tags });
                setCurrentMenu(prev => ({ ...prev, targetUserCount: res.data.count, totalUserCount: res.data.totalCount || 0 }));
            } catch (e) {
                console.error('Failed to fetch target user count', e);
            }
        };

        if (currentMenu.publishStrategy === 'restricted' && (!currentMenu.targetAll && currentMenu.targetTags?.length > 0)) {
            fetchCount(currentMenu.targetTags);
        } else if (currentMenu.publishStrategy === 'default' || (currentMenu.publishStrategy === 'restricted' && currentMenu.targetAll)) {
            fetchCount([]);
        } else {
            setCurrentMenu(prev => prev.targetUserCount !== 0 || prev.totalUserCount !== 0 ? { ...prev, targetUserCount: 0, totalUserCount: 0 } : prev);
        }
    }, [currentMenu?.targetTags, currentMenu?.targetAll, currentMenu?.publishStrategy, view, viewOnly]);

    
    useEffect(() => {
        if (!linkModalState) return;
        const fetchCount = async (tags = []) => {
            try {
                const res = await api.post('/customers/count-by-tags', { tags });
                setLinkModalState(prev => ({ ...prev, targetUserCount: res.data.count, totalUserCount: res.data.totalCount || 0 }));
            } catch (e) {
                console.error('Failed to fetch target user count', e);
            }
        };

        if (linkModalState.publishStrategy === 'restricted' && linkModalState.targetTags?.length > 0) {
            fetchCount(linkModalState.targetTags);
        } else if (linkModalState.publishStrategy === 'default') {
            fetchCount([]);
        } else {
            setLinkModalState(prev => prev.targetUserCount !== 0 || prev.totalUserCount !== 0 ? { ...prev, targetUserCount: 0, totalUserCount: 0 } : prev);
        }
    }, [linkModalState?.targetTags, linkModalState?.publishStrategy]);

    const fetchImageWithAuth = async (richMenuId) => {
        if (!richMenuId) return null;
        if (frontendImageCache[richMenuId]) {
            return frontendImageCache[richMenuId];
        }
        try {
            const response = await api.get(`/richmenu/${richMenuId}/image`, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(response.data);
            frontendImageCache[richMenuId] = blobUrl;
            return blobUrl;
        } catch (err) {
            return null;
        }
    };

    const handleEditMenu = (item, isMetadata = false) => {
        setLoading(true);
        try {
            const dataURLtoFile = (dataurl, filename) => {
                const arr = dataurl.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while(n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new File([u8arr], filename, {type:mime});
            };

            if (isMetadata) {
                // If it has group_id, find all members in the metadata
                let itemsToLoad = [item];
                if (item.group_id) {
                    itemsToLoad = metadata.filter(m => m.group_id === item.group_id);
                    // Ensure the clicked item is first
                    itemsToLoad = [item, ...itemsToLoad.filter(m => m.id !== item.id)];
                }

                const loadedGroup = itemsToLoad.map(m => {
                    const data = typeof m.data === 'string' ? JSON.parse(m.data) : m.data;
                    let file = null;
                    if (data.imageBase64) {
                        file = dataURLtoFile(data.imageBase64, 'draft.png');
                    }
                    return {
                        ...data,
                        id: m.id,
                        status: m.status,
                        richMenuId: m.rich_menu_id,
                        start_time: m.start_time || '',
                        end_time: m.end_time || '',
                        name: m.name,
                        chatBarText: m.chat_bar_text,
                        imageFile: file,
                        publishStrategy: data.publishStrategy || (m.status === 'restricted' ? 'restricted' : (m.status === 'public' ? 'default' : 'hidden')),
                        targetTags: data.targetTags || [],
                        targetUserCount: data.targetUserCount || 0,
                        permissionTags: m.permission_tags || [],
                        fallbackMessage: m.fallback_message || '',
                        alias_id: m.alias_id || '',
                        ui_uuid: m.ui_uuid || data.ui_uuid,
                        group_id: m.group_id || data.group_id
                    };
                });

                setCurrentGroup(loadedGroup);
                setCurrentMenuIndex(0);
                setViewOnly(loadedGroup[0].status !== 'draft');
                setBackgroundImage(loadedGroup[0].imageBase64 || null);
            } else {
                setCurrentGroup([{
                    ...emptyMenu,
                    richMenuId: item.richMenuId,
                    name: item.name,
                    chatBarText: item.chatBarText,
                    size: item.size,
                    areas: item.areas,
                    status: 'published',
                    permissionTags: item.permission_tags || [],
                    fallbackMessage: item.fallback_message || '',
                    alias_id: item.alias_id || ''
                }]);
                setCurrentMenuIndex(0);
                setViewOnly(true);
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
            showToast('圖文選單圖片大小不可超過 1 MB', 'error');
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
                    size: { width, height },
                    imageBase64: event.target.result
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const validateMenu = () => {
        if (!currentMenu.name || !currentMenu.name.trim()) {
            showToast('錯誤：請填寫選單名稱', 'error');
            return false;
        }
        if (!currentMenu.chatBarText || !currentMenu.chatBarText.trim()) {
            showToast('錯誤：請填寫聊天欄標題', 'error');
            return false;
        }
        if (!currentMenu.areas || currentMenu.areas.length === 0) {
            showToast('錯誤：請至少設定一個點擊區域', 'error');
            return false;
        }
        for (let i = 0; i < currentMenu.areas.length; i++) {
            const area = currentMenu.areas[i];
            if (area.action.type === 'uri' && (!area.action.uri || !area.action.uri.trim())) {
                showToast(`錯誤：區域 ${i + 1} 尚未填寫連結網址`, 'error');
                return false;
            }
            if (area.action.type === 'message' && (!area.action.text || !area.action.text.trim())) {
                showToast(`錯誤：區域 ${i + 1} 尚未填寫文字內容`, 'error');
                return false;
            }
        }
        
        const trimmedName = currentMenu.name.trim();
        const duplicateInMetadata = metadata.some(m => m.name === trimmedName && m.id !== currentMenu.id);
        const duplicateInMenus = menus.some(m => m.name === trimmedName && m.richMenuId !== currentMenu.richMenuId);
        if (duplicateInMetadata || duplicateInMenus) {
            showToast('錯誤：選單名稱不能重複', 'error');
            return false;
        }

        return true;
    };

    const saveAsDraft = async () => {
        if (viewOnly) return;
        
        // validate all
        for (let i = 0; i < currentGroup.length; i++) {
            const menu = currentGroup[i];
            if (!menu.name || !menu.name.trim()) { showToast(`草稿 ${i+1}: 請填寫選單名稱`, 'error'); return; }
            if (!menu.chatBarText || !menu.chatBarText.trim()) { showToast(`草稿 ${i+1}: 請填寫聊天欄標題`, 'error'); return; }
            if (!menu.areas || menu.areas.length === 0) { showToast(`草稿 ${i+1}: 請至少設定一個點擊區域`, 'error'); return; }
        }

        setLoading(true);
        try {
            for (let i = 0; i < currentGroup.length; i++) {
                const menu = currentGroup[i];
                const payload = {
                    id: menu.id,
                    name: menu.name,
                    chat_bar_text: menu.chatBarText,
                    status: 'draft',
                    start_time: menu.start_time || null,
                    end_time: menu.end_time || null,
                    permission_tags: menu.permissionTags,
                    fallback_message: menu.fallbackMessage,
                    ui_uuid: menu.ui_uuid,
                    group_id: menu.group_id,
                    data: {
                        size: menu.size,
                        areas: menu.areas,
                        name: menu.name,
                        chatBarText: menu.chatBarText,
                        imageBase64: menu.imageBase64,
                        visibility: menu.visibility,
                        publishStrategy: menu.publishStrategy,
                        targetTags: menu.targetTags,
                        targetUserCount: menu.targetUserCount,
                        ui_uuid: menu.ui_uuid,
                        group_id: menu.group_id
                    }
                };
                await api.post('/richmenu/metadata', payload);
            }
            showToast('草稿群組已儲存', 'success');
            setView('list');
        } catch (err) {
            showToast('儲存草稿失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPublishModal = () => {
        if (viewOnly) return;
        // validate all
        for (let i = 0; i < currentGroup.length; i++) {
            const menu = currentGroup[i];
            if (!menu.name || !menu.name.trim()) { showToast(`草稿 ${i+1}: 請填寫選單名稱`, 'error'); return; }
            if (!menu.chatBarText || !menu.chatBarText.trim()) { showToast(`草稿 ${i+1}: 請填寫聊天欄標題`, 'error'); return; }
            if (!menu.areas || menu.areas.length === 0) { showToast(`草稿 ${i+1}: 請至少設定一個點擊區域`, 'error'); return; }
            if (!menu.imageBase64 && !menu.richMenuId) {
                showToast(`草稿 ${i+1}: 錯誤：同步至 LINE 必須上傳底圖`, 'error');
                return;
            }
        }
        
        if (window.confirm('確定要發佈至 LINE 嗎？發佈後內容將鎖定無法再次編輯。')) {
            publishGroupToLine();
        }
    };

    const publishGroupToLine = async () => {
        setLoading(true);
        try {
            const currentOA = myOAs.find(oa => oa.id.toString() === selectedOAId.toString()) || myOAs[0];
            const appName = currentOA?.other_settings?.app_name || '';
            const liffId = "2009851813-AgTeSa4r";

            for (let i = 0; i < currentGroup.length; i++) {
                const menu = currentGroup[i];
                const metaDataForLine = {
                    size: { width: Math.round(menu.size.width), height: Math.round(menu.size.height) },
                    selected: false,
                    name: menu.name.substring(0, 300),
                    chatBarText: menu.chatBarText.substring(0, 14),
                    areas: menu.areas.map(a => {
                        const action = { ...a.action };
                        if (action.type === 'uri' && action.tags && action.tags.length > 0) {
                            const targetUrl = action.uri;
                            const tagName = action.tags.join(',');
                            if (appName) {
                                action.uri = `https://liff.line.me/${liffId}?bot=${appName}&tag=${encodeURIComponent(tagName)}&redirect=${encodeURIComponent(targetUrl)}`;
                            } else {
                                action.uri = `${API_BASE_URL}/redirect?tags=${encodeURIComponent(tagName)}&redirect=${encodeURIComponent(targetUrl)}`;
                            }
                            delete action.tags;
                        }
                        if (action.type === 'richmenuswitch') {
                            // Find target uuid
                            const targetUuid = (action.data || '').replace('switch_rm|', '');
                            if (!targetUuid) {
                                throw new Error('有切換選單區塊未選擇目標圖文選單，請選擇後再發佈。');
                            }
                            const postbackData = `switch_rm|${targetUuid}`.substring(0, 300);
                            action.type = 'postback';
                            action.data = postbackData;
                            delete action.text;
                        }
                        return {
                            bounds: { x: Math.round(a.bounds.x), y: Math.round(a.bounds.y), width: Math.round(a.bounds.width), height: Math.round(a.bounds.height) },
                            action: action
                        };
                    })
                };

                const createRes = await api.post('/richmenu/', metaDataForLine);
                const richMenuId = createRes.data.richMenuId;

                if (menu.imageFile) {
                    const formData = new FormData();
                    formData.append('image', menu.imageFile);
                    await api.post(`/richmenu/${richMenuId}/image`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }

                // If this is the one chosen to be default, status becomes public, else published
                let targetStatus = 'published';
                if (menu.publishStrategy === 'default') {
                    targetStatus = 'public';
                } else if (menu.publishStrategy === 'restricted') {
                    targetStatus = 'restricted';
                }

                const payload = {
                    id: menu.id,
                    name: menu.name,
                    chat_bar_text: menu.chatBarText,
                    status: targetStatus,
                    rich_menu_id: richMenuId,
                    start_time: menu.start_time || null,
                    end_time: menu.end_time || null,
                    permission_tags: menu.permissionTags,
                    fallback_message: menu.fallbackMessage,
                    ui_uuid: menu.ui_uuid,
                    group_id: menu.group_id,
                    data: {
                        size: menu.size,
                        areas: menu.areas,
                        name: menu.name,
                        chatBarText: menu.chatBarText,
                        visibility: menu.visibility,
                        publishStrategy: menu.publishStrategy,
                        targetTags: menu.targetTags,
                        targetUserCount: menu.targetUserCount,
                        ui_uuid: menu.ui_uuid,
                        group_id: menu.group_id
                    }
                };
                await api.post('/richmenu/metadata', payload);

                // Set default via LINE API if strategy is default
                if (menu.publishStrategy === 'default') {
                    try {
                        await api.post(`/richmenu/set-default/${richMenuId}`);
                    } catch (err) {
                        console.error('Failed to set default', err);
                    }
                }
            }
            
            showToast('群組選單已成功同步至 LINE！', 'success');
            setCurrentGroup([]);
            setView('list');
        } catch (err) {
            console.error(err);
            const detail = err.response?.data?.line_error?.message || err.response?.data?.message || err.message || '未知錯誤';
            showToast(`發佈失敗: ${detail}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const dummyPublish = async (shouldLink = false) => {
        // old function removal placeholder
    };
    
    const deleteMenu = async (id, name, isMetadata = false, force = false, skipConfirm = false) => {
        const msg = force ? '確定要解除所有綁定並強制刪除嗎？' : `確定要刪除「${name}」嗎？`;
        if (!skipConfirm && !window.confirm(msg)) return;
        setLoading(true);
        try {
            const endpoint = isMetadata 
                ? `/richmenu/metadata/${id}${force ? '?force=true' : ''}`
                : `/richmenu/${id}${force ? '?force=true' : ''}`;
            await api.delete(endpoint);
            fetchData();
            showToast(`「${name}」已刪除`, 'success');
        } catch (err) {
            if (err.response && err.response.status === 409 && err.response.data.needs_force) {
                const deps = err.response.data.dependencies || [];
                const depText = deps.length > 0 ? `\n${deps.map(d => `• ${d}`).join('\n')}` : '';
                const alertMsg = `⚠️ 無法刪除圖文選單「${name}」\n\n目前仍有以下項目與此選單綁定：${depText}\n\n為防止誤刪正在運作中的功能，請先至對應功能解除綁定後，再執行刪除操作。`;
                window.alert(alertMsg);
                return;
            }
            showToast('刪除失敗: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setLoading(false);
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
            const res = await api.post(`/richmenu/link/${id}`);
            if (res.data && res.data.message === 'restricted_sync') {
                showToast('已觸發限定標籤用戶同步', 'success');
            } else {
                showToast('已連結至全體用戶', 'success');
            }
        } catch (err) {
            showToast('連結失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    
    
    const submitLinkModal = async () => {
        if (!linkModalState) return;
        setLoading(true);
        try {
            // First update metadata to match selected strategy and tags
            const item = linkModalState.item;
            let newStatus = 'published';
            if (linkModalState.publishStrategy === 'restricted') newStatus = 'restricted';
            else if (linkModalState.publishStrategy === 'default') newStatus = 'public';
            else newStatus = 'hidden';

            const payload = {
                id: item.id,
                name: item.name,
                chat_bar_text: item.chat_bar_text || item.chatBarText,
                status: newStatus,
                rich_menu_id: linkModalState.richMenuId,
                start_time: item.start_time || null,
                end_time: item.end_time || null,
                permission_tags: item.permission_tags || item.permissionTags || [],
                fallback_message: item.fallback_message || item.fallbackMessage || '',
                ui_uuid: item.ui_uuid,
                group_id: item.group_id,
                data: {
                    ...(item.data || {}),
                    size: item.size || (item.data && item.data.size),
                    areas: item.areas || (item.data && item.data.areas),
                    name: item.name,
                    chatBarText: item.chat_bar_text || item.chatBarText,
                    imageBase64: item.imageBase64 || (item.data && item.data.imageBase64),
                    visibility: item.visibility || (item.data && item.data.visibility),
                    publishStrategy: linkModalState.publishStrategy,
                    targetTags: linkModalState.targetTags,
                    targetUserCount: linkModalState.targetUserCount || 0,
                    ui_uuid: item.ui_uuid,
                    group_id: item.group_id
                }
            };
            await api.post('/richmenu/metadata', payload);
            
            // Then perform link
            const res = await api.post(`/richmenu/link/${linkModalState.richMenuId}`);
            if (res.data && res.data.message === 'restricted_sync') {
                showToast('已觸發限定標籤用戶同步', 'success');
            } else {
                showToast('已完成連結作業', 'success');
            }
            setLinkModalState(null);
            fetchMetadata();
        } catch (err) {
            console.error(err);
            showToast('連結失敗', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('確定要清除所有的圖文選單嗎？這將會移除全域預設選單，並解除所有用戶的個別綁定。')) return;
        setLoading(true);
        try {
            await api.post('/richmenu/clear-all');
            showToast('已清除所有圖文選單', 'success');
            await fetchData();
        } catch (err) {
            showToast('清除失敗', 'error');
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

    const deleteArea = (index) => {
        if (viewOnly) return;
        const newAreas = currentMenu.areas.filter((_, i) => i !== index);
        setCurrentMenu({ ...currentMenu, areas: newAreas });
        setSelectedAreaIndex(null);
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


    
    const handleDeleteDraftFromGroup = (e, idx) => {
        e.stopPropagation();
        if (currentGroup.length <= 1) {
            showToast('群組中至少需保留一個選單', 'error');
            return;
        }
        const group = [...currentGroup];
        group.splice(idx, 1);
        setCurrentGroup(group);
        if (currentMenuIndex >= group.length) {
            setCurrentMenuIndex(group.length - 1);
        } else if (currentMenuIndex === idx) {
            setCurrentMenuIndex(0);
        } else if (currentMenuIndex > idx) {
            setCurrentMenuIndex(currentMenuIndex - 1);
        }
    };

    const handleAddDraftToGroup = () => {
        const groupId = currentGroup[0]?.group_id;
        const newUuid = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newMenu = { ...emptyMenu, ui_uuid: newUuid, group_id: groupId };
        setCurrentGroup([...currentGroup, newMenu]);
        setCurrentMenuIndex(currentGroup.length);
        setBackgroundImage(null);
        setSelectedAreaIndex(null);
    };

    // Rendering Helpers

    // Combined and Grouped logic
    const combinedList = React.useMemo(() => {
        const metadataItems = metadata.map(m => ({ ...m, isMetadata: true }));
        const lineItems = menus
            .filter(rm => !metadataItems.some(m => m.rich_menu_id === rm.richMenuId))
            .map(rm => ({ ...rm, isMetadata: false }));
            
        // 額外過濾機制：如果在 metadata 中有相同 name 但不同狀態的異常重複（例如同時有草稿和發佈的），只保留最新的。
        // 這可以解決過去因為發生錯誤導致建立重複草稿的畫面殘影問題。
        const deduplicatedMetadata = [];
        const seenNames = new Set();
        
        // 排序讓最新的在前面
        metadataItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        for (const item of metadataItems) {
            if (!seenNames.has(item.name)) {
                deduplicatedMetadata.push(item);
                seenNames.add(item.name);
            }
        }

        const list = [
            ...deduplicatedMetadata,
            ...lineItems
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
                {loading && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <LoadingSpinner />
                        <div style={{ marginLeft: '15px', color: 'white', fontSize: '18px' }}>處理中，請稍候...</div>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <button onClick={() => setView('list')} style={{ background: 'none', color: '#888', marginBottom: '10px', padding: 0 }}>← 返回列表</button>
                        <h1 style={{ fontSize: '28px' }}>
                            {viewOnly ? '查看選單' : currentMenu.id ? '編輯草稿' : '新增選單'}
                            {currentMenu.status === 'published' && <span style={{ marginLeft: '10px', fontSize: '14px', backgroundColor: '#4CAF50', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>已發佈</span>}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        {!viewOnly && (
                            <>
                                <button onClick={saveAsDraft} className="secondary" disabled={loading} style={{ whiteSpace: 'nowrap' }}><Save size={18} /> 儲存草稿群組</button>
                                <button onClick={handleOpenPublishModal} className="primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}><Send size={18} /> 發佈至 LINE</button>
                            </>
                        )}
                        {!viewOnly && currentMenu.richMenuId && (
                            <button onClick={() => setLinkModalState({ richMenuId: currentMenu.richMenuId, item: currentMenu, publishStrategy: currentMenu.publishStrategy !== "hidden" ? currentMenu.publishStrategy : "default", targetTags: currentMenu.targetTags || [], targetUserCount: currentMenu.targetUserCount || 0, totalUserCount: currentMenu.totalUserCount || 0 })} className="primary" style={{ backgroundColor: '#4CAF50', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}><LinkIcon size={18} /> 立即連結全體</button>
                        )}
                        
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {currentGroup.map((g, idx) => (
                        <button key={idx} onClick={() => {
                            setCurrentMenuIndex(idx);
                            setSelectedAreaIndex(null);
                            setBackgroundImage(g.imageBase64 || null);
                        }} style={{
                            padding: '8px 16px', borderRadius: '8px', 
                            backgroundColor: idx === currentMenuIndex ? 'var(--primary-yellow)' : '#333',
                            color: idx === currentMenuIndex ? '#000' : '#fff',
                            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}>
                            {g.name || `草稿 ${idx + 1}`}
                            {!viewOnly && currentGroup.length > 1 && (
                                <button 
                                    onClick={(e) => handleDeleteDraftFromGroup(e, idx)} 
                                    style={{ marginLeft: '8px', background: 'none', border: 'none', color: idx === currentMenuIndex ? '#000' : '#888', cursor: 'pointer', padding: 0 }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </button>
                    ))}
                    {!viewOnly && (
                        <button onClick={handleAddDraftToGroup} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#444', color: '#fff', border: '1px dashed #888', cursor: 'pointer' }}>
                            + 新增選單
                        </button>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px', flex: 1, minHeight: 0 }}>
                    <div className="card" style={{ overflow: 'auto', padding: '40px', backgroundColor: '#000', borderRadius: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: '40px' }}>
                        <div ref={imageContainerRef} style={{
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
                            {backgroundImage && !viewOnly && (
                                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20 }}>
                                    <label style={{ cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', color: 'white', fontSize: '12px' }}>
                                        <ImageIcon size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />重新上傳
                                        <input type="file" onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />
                                    </label>
                                </div>
                            )}
                            {currentMenu.areas.map((area, idx) => {
                                const { bounds } = area;
                                return (
                                    <div key={idx} onMouseDown={(e) => handleMouseDown(e, idx, 'move')} style={{
                                        position: 'absolute', left: `${bounds.x * scale}px`, top: `${bounds.y * scale}px`, width: `${bounds.width * scale}px`, height: `${bounds.height * scale}px`,
                                        border: selectedAreaIndex === idx ? '3px solid #FFD700' : '2px solid rgba(255, 215, 0, 0.5)',
                                        backgroundColor: selectedAreaIndex === idx ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.1)',
                                        cursor: viewOnly ? 'pointer' : 'move', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', zIndex: selectedAreaIndex === idx ? 10 : 1
                                    }} onClick={(e) => { e.stopPropagation(); setSelectedAreaIndex(idx); }}>
                                        {idx + 1}
                                        {!viewOnly && selectedAreaIndex === idx && (
                                            <div onMouseDown={(e) => handleMouseDown(e, idx, 'resize')} style={{
                                                position: 'absolute', right: '-6px', bottom: '-6px', width: '12px', height: '12px',
                                                backgroundColor: '#FFD700', borderRadius: '50%', cursor: 'nwse-resize', zIndex: 11
                                            }} />
                                        )}
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
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> 切換權限設定</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                <div>
                                    <label className="label">誰可切換於此圖文 (可複選)</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                        {allTags.map(t => (
                                            <label key={`perm-${t.tag_name}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: currentMenu.permissionTags.includes(t.tag_name) ? 'var(--primary-yellow)' : '#333', color: currentMenu.permissionTags.includes(t.tag_name) ? '#000' : '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', cursor: viewOnly ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                                                <input 
                                                    type="checkbox" 
                                                    style={{ display: 'none' }}
                                                    checked={currentMenu.permissionTags.includes(t.tag_name)}
                                                    disabled={viewOnly}
                                                    onChange={(e) => {
                                                        const newTags = e.target.checked 
                                                            ? [...currentMenu.permissionTags, t.tag_name]
                                                            : currentMenu.permissionTags.filter(tag => tag !== t.tag_name);
                                                        setCurrentMenu({ ...currentMenu, permissionTags: newTags });
                                                    }}
                                                />
                                                {t.tag_name}
                                            </label>
                                        ))}
                                        {allTags.length === 0 && <span style={{ color: '#666', fontSize: '13px' }}>目前沒有任何標籤</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>必須擁有上述任一標籤，才能透過其他圖文選單的按鈕切換至此選單。若未選擇任何標籤，則代表不限制。</div>
                                </div>
                                <div>
                                    <label className="label">無權限提示訊息 (Fallback)</label>
                                    <textarea 
                                        disabled={viewOnly} 
                                        value={currentMenu.fallbackMessage || ''} 
                                        onChange={e => setCurrentMenu({ ...currentMenu, fallbackMessage: e.target.value })} 
                                        placeholder="例如: 您沒有權限查看此選單" 
                                        maxLength={150}
                                        style={{ width: '100%', height: '80px', backgroundColor: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', padding: '10px', marginTop: '5px', resize: 'vertical' }}
                                    />
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '5px', textAlign: 'right' }}>{currentMenu.fallbackMessage?.length || 0}/150 字</div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> 發布策略</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                <div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '5px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: viewOnly ? 'default' : 'pointer', opacity: viewOnly ? 0.8 : 1 }}>
                                            <input type="radio" name="publishStrategy" value="hidden" checked={currentMenu.publishStrategy === 'hidden'} readOnly={viewOnly} onClick={e => viewOnly && e.preventDefault()} onChange={() => !viewOnly && setCurrentMenu({ ...currentMenu, publishStrategy: 'hidden' })} style={{ accentColor: '#FFD700', transform: 'scale(1.2)', margin: '0 5px', pointerEvents: viewOnly ? 'none' : 'auto' }} />
                                            只建立至 LINE，不顯示給使用者
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: viewOnly ? 'default' : 'pointer', opacity: viewOnly ? 0.8 : 1 }}>
                                            <input type="radio" name="publishStrategy" value="default" checked={currentMenu.publishStrategy === 'default'} readOnly={viewOnly} onClick={e => viewOnly && e.preventDefault()} onChange={() => !viewOnly && setCurrentMenu({ ...currentMenu, publishStrategy: 'default' })} style={{ accentColor: '#FFD700', transform: 'scale(1.2)', margin: '0 5px', pointerEvents: viewOnly ? 'none' : 'auto' }} />
                                            立即設為全體預設圖文選單
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: viewOnly ? 'default' : 'pointer', opacity: viewOnly ? 0.8 : 1 }}>
                                            <input type="radio" name="publishStrategy" value="restricted" checked={currentMenu.publishStrategy === 'restricted'} readOnly={viewOnly} onClick={e => viewOnly && e.preventDefault()} onChange={() => !viewOnly && setCurrentMenu({ ...currentMenu, publishStrategy: 'restricted' })} style={{ accentColor: '#FFD700', transform: 'scale(1.2)', margin: '0 5px', pointerEvents: viewOnly ? 'none' : 'auto' }} />
                                            指定綁定對象後套用(非預設)
                                        </label>
                                    </div>
                                </div>
                                
                                {currentMenu.publishStrategy === 'restricted' && (
                                    <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333', marginLeft: '25px' }}>
                                        <div style={{ marginBottom: '15px', display: 'flex', gap: '20px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: viewOnly ? 'default' : 'pointer' }}>
                                                <input type="radio" checked={currentMenu.targetAll} disabled={viewOnly} onChange={() => setCurrentMenu({...currentMenu, targetAll: true, targetTags: ['ALL_USERS']})} style={{ accentColor: '#FFD700' }} />
                                                所有好友
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: viewOnly ? 'default' : 'pointer' }}>
                                                <input type="radio" checked={!currentMenu.targetAll} disabled={viewOnly} onChange={() => setCurrentMenu({...currentMenu, targetAll: false, targetTags: []})} style={{ accentColor: '#FFD700' }} />
                                                指定標籤
                                            </label>
                                        </div>
                                        
                                        {!currentMenu.targetAll && (
                                            <>
                                                <label className="label">適用標籤 (可複選)</label>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                                    {allTags.map(t => (
                                                        <label key={t.tag_name} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: (currentMenu.targetTags || []).includes(t.tag_name) ? 'var(--primary-yellow)' : '#333', color: (currentMenu.targetTags || []).includes(t.tag_name) ? '#000' : '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', cursor: viewOnly ? 'default' : 'pointer', transition: 'all 0.2s' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                style={{ display: 'none' }}
                                                                checked={(currentMenu.targetTags || []).includes(t.tag_name)}
                                                                disabled={viewOnly}
                                                                onChange={(e) => {
                                                                    const newTags = e.target.checked 
                                                                        ? [...(currentMenu.targetTags || []).filter(t => t !== 'ALL_USERS'), t.tag_name]
                                                                        : (currentMenu.targetTags || []).filter(tag => tag !== t.tag_name);
                                                                    setCurrentMenu({ ...currentMenu, targetTags: newTags });
                                                                }}
                                                            />
                                                            {t.tag_name}
                                                        </label>
                                                    ))}
                                                    {allTags.length === 0 && <span style={{ color: '#666', fontSize: '13px' }}>目前沒有任何標籤</span>}
                                                </div>
                                            </>
                                        )}
                                        <div style={{ marginTop: '15px', fontSize: '13px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Shield size={14} /> 預計套用人數：
                                            <span style={{ color: 'var(--primary-yellow)', fontWeight: 'bold', fontSize: '16px' }}>{currentMenu.targetUserCount}</span> 人
                                            <span style={{ fontSize: '11px', color: '#666' }}>(佔好友人數 {currentMenu.totalUserCount ? ((currentMenu.targetUserCount / currentMenu.totalUserCount) * 100).toFixed(1) : 0}%)</span>
                                        </div>
                                    </div>
                                )}
                                {currentMenu.publishStrategy === 'default' && (
                                    <div style={{ backgroundColor: '#111', padding: '10px 15px', borderRadius: '8px', border: '1px solid #333', marginLeft: '25px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Shield size={14} style={{ color: '#aaa' }} /> <span style={{ color: '#aaa', fontSize: '13px' }}>預計套用人數：</span>
                                        <span style={{ color: 'var(--primary-yellow)', fontWeight: 'bold', fontSize: '16px' }}>{currentMenu.totalUserCount || 0}</span> <span style={{ color: '#aaa', fontSize: '13px' }}>人</span>
                                        <span style={{ fontSize: '11px', color: '#666' }}>(佔好友人數 100%)</span>
                                    </div>
                                )}

                            </div>
                        </div>

                        {currentMenu.publishStrategy !== 'hidden' && (
                            <div className="card">
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> 排程設定</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div><label className="label">開始時間</label><input type="datetime-local" value={currentMenu.start_time} onChange={e => setCurrentMenu({ ...currentMenu, start_time: e.target.value })} style={{ width: '100%' }} disabled={viewOnly} /></div>
                                        <div><label className="label">結束時間</label><input type="datetime-local" value={currentMenu.end_time} onChange={e => setCurrentMenu({ ...currentMenu, end_time: e.target.value })} style={{ width: '100%' }} disabled={viewOnly} /></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3>區塊設定 ({currentMenu.areas.length})</h3>
                                {!viewOnly && <button onClick={addArea} className="secondary" style={{ padding: '5px 10px' }}><Plus size={16} /></button>}
                            </div>
                            {selectedAreaIndex !== null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, color: 'var(--primary-yellow)' }}>區塊 {selectedAreaIndex + 1}</h4>
                                        {!viewOnly && (
                                            <button onClick={() => deleteArea(selectedAreaIndex)} className="secondary" style={{ color: '#ff4d4d', padding: '4px 8px', fontSize: '12px' }}>
                                                <Trash2 size={14} style={{ marginRight: '4px' }} /> 刪除
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div><label className="label">X 座標</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].bounds.x} onChange={e => updateAreaBounds(selectedAreaIndex, { x: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                                        <div><label className="label">Y 座標</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].bounds.y} onChange={e => updateAreaBounds(selectedAreaIndex, { y: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                                        <div><label className="label">寬度</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].bounds.width} onChange={e => updateAreaBounds(selectedAreaIndex, { width: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                                        <div><label className="label">高度</label><input type="number" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].bounds.height} onChange={e => updateAreaBounds(selectedAreaIndex, { height: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                                    </div>
                                    <label className="label" style={{ marginTop: '5px' }}>點擊動作</label>
                                    <select value={currentMenu.areas[selectedAreaIndex].action.type} disabled={viewOnly} onChange={e => updateAreaAction(selectedAreaIndex, { type: e.target.value })}>
                                        {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    {currentMenu.areas[selectedAreaIndex].action.type === 'message' && (
                                        <input type="text" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].action.text || ''} onChange={e => updateAreaAction(selectedAreaIndex, { text: e.target.value })} placeholder="訊息內容" />
                                    )}
                                    {currentMenu.areas[selectedAreaIndex].action.type === 'uri' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <input type="text" disabled={viewOnly} value={currentMenu.areas[selectedAreaIndex].action.uri || ''} onChange={e => updateAreaAction(selectedAreaIndex, { uri: e.target.value })} placeholder="https://..." />
                                            <div>
                                                <label className="label">附加標籤 (將轉換為追蹤連結)</label>
                                                <TagInput
                                                    tags={currentMenu.areas[selectedAreaIndex].action.tags || []}
                                                    onChange={tags => updateAreaAction(selectedAreaIndex, { tags })}
                                                    disabled={viewOnly}
                                                    placeholder="輸入標籤後按 Enter"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {currentMenu.areas[selectedAreaIndex].action.type === 'richmenuswitch' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <select 
                                                disabled={viewOnly} 
                                                value={currentMenu.areas[selectedAreaIndex].action.data || ''} 
                                                onChange={e => {
                                                    if (e.target.value === 'create_and_switch') {
                                                        const newUuid = Date.now().toString(36) + Math.random().toString(36).substring(2);
                                                        const newDraft = {
                                                            ui_uuid: newUuid,
                                                            name: `草稿 ${currentGroup.length + 1}`,
                                                            size: { width: 2500, height: 1686 },
                                                            selected: false,
                                                            chatBarText: '選單',
                                                            areas: [],
                                                            status: 'draft',
                                                            publishStrategy: 'default',
                                                            targetTags: [],
                                                            visibility: 'default',
                                                            permissionTags: [],
                                                            fallbackMessage: '',
                                                            start_time: '',
                                                            end_time: ''
                                                        };
                                                        setCurrentGroup([...currentGroup, newDraft]);
                                                        updateAreaAction(selectedAreaIndex, { data: `switch_rm|${newUuid}` });
                                                    } else {
                                                        updateAreaAction(selectedAreaIndex, { data: e.target.value });
                                                    }
                                                }}
                                            >
                                                <option value="">請選擇要切換的圖文選單</option>
                                                <optgroup label="本次編輯群組">
                                                    <option value="create_and_switch" style={{ color: '#4CAF50', fontWeight: 'bold' }}>+ 建立新選單並設定切換</option>
                                                    {currentGroup.filter(g => g.ui_uuid !== currentMenu.ui_uuid).map(g => (
                                                        <option key={g.ui_uuid} value={`switch_rm|${g.ui_uuid}`}>{g.name || `草稿 ${currentGroup.indexOf(g)+1}`}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="其他圖文選單">
                                                    {metadata.filter(m => m.ui_uuid && m.group_id !== currentGroup[0]?.group_id).map(m => (
                                                        <option key={m.ui_uuid} value={`switch_rm|${m.ui_uuid}`}>{m.name}</option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                            {(() => {
                                                const data = currentMenu.areas[selectedAreaIndex].action.data;
                                                if (!data || !data.startsWith('switch_rm|')) return null;
                                                const targetUuid = data.split('|')[1];
                                                let target = currentGroup.find(g => g.ui_uuid === targetUuid);
                                                if (!target) {
                                                    target = metadata.find(m => m.ui_uuid === targetUuid);
                                                }
                                                if (target) {
                                                    return (
                                                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#222', borderRadius: '8px', border: '1px solid #444', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                            <div style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <MenuPreviewImage target={target} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{target.name || '未命名草稿'}</div>
                                                                <div style={{ fontSize: '11px', color: '#aaa' }}>{target.status === 'published' ? '已發佈' : '草稿'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

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
        <div style={{ position: 'relative', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                            圖文選單
                            <Tooltip title={HELP_CONTENT.list.content}>
                                <HelpCircle size={20} style={{ color: '#888', cursor: 'pointer' }} />
                            </Tooltip>
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                            <div style={{ position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                                <input
                                    type="text"
                                    placeholder="搜尋選單名稱或 ID..."
                                    value={menuSearch}
                                    onChange={(e) => setMenuSearch(e.target.value)}
                                    style={{ padding: '8px 12px 8px 34px', backgroundColor: '#222', border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '13px', width: '240px', outline: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={handleClearAll} className="secondary" style={{ color: '#ff4d4d' }}><Trash2 size={18} /> 清除所有圖文選單</button>
                    <button onClick={handleCreateNew} className="primary"><Plus size={20} /> 新增選單</button>
                </div>
            </div>

            <div style={{ position: 'relative', minHeight: '300px' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '100px' }}>
                        <LoadingSpinner />
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                    {Object.entries(groupedMenus).map(([oaName, oaMenus]) => (
                    <div key={oaName}>
                        <h2 style={{ fontSize: '20px', color: 'var(--primary-yellow)', marginBottom: '20px', borderLeft: '4px solid var(--primary-yellow)', paddingLeft: '15px' }}>
                            {oaName} ({oaMenus.length})
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                            {oaMenus.map((item, idx) => {
                                const isDraft = item.isMetadata && item.status === 'draft';
                                const isPublished = (item.isMetadata && ['published', 'public', 'restricted'].includes(item.status)) || !item.isMetadata;
                                const isPublic = item.status === 'public' || item.status === 'published'; // Fallback to 'published' for legacy
                                const isRestricted = item.status === 'restricted';
                                const rid = item.rich_menu_id || item.richMenuId;
                                const isDefault = item.status === 'default' || item.status === 'public';
                                
                                let tagsPreview = [];
                                try {
                                    if (item.data && typeof item.data === 'string') {
                                        const parsed = JSON.parse(item.data);
                                        if (parsed.targetTags) tagsPreview = parsed.targetTags;
                                    } else if (item.data && item.data.targetTags) {
                                        tagsPreview = item.data.targetTags;
                                    }
                                } catch (e) { }

                                return (
                                    <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: isDefault ? '2px solid #FFD700' : '1px solid #333' }}>
                                        <div style={{ height: '150px', backgroundColor: '#111', borderRadius: '8px', marginBottom: '15px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                            <MenuPreviewImage target={item} />
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: isDraft ? '#FF9800' : isRestricted ? '#9C27B0' : '#4CAF50', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', zIndex: 2 }}>
                                                {isDraft ? '草稿' : isRestricted ? '限定發佈' : '公開發佈'}
                                            </div>
                                            {isDefault && <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#FFD700', color: 'black', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', zIndex: 2 }}>預設</div>}
                                        </div>
                                        <h4 style={{ marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h4>
                                        {isRestricted && tagsPreview.length > 0 && (
                                            <div style={{ marginBottom: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                {tagsPreview.map(tag => (
                                                    <span key={`target-${tag}`} style={{ backgroundColor: '#333', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        {(() => {
                                            let permissionTagsPreview = item.permission_tags || [];
                                            let fallbackMessagePreview = item.fallback_message || '';
                                            try {
                                                if (item.data && typeof item.data === 'string') {
                                                    const parsed = JSON.parse(item.data);
                                                    if (parsed.permissionTags) permissionTagsPreview = parsed.permissionTags;
                                                    if (parsed.fallbackMessage) fallbackMessagePreview = parsed.fallbackMessage;
                                                } else if (item.data) {
                                                    if (item.data.permissionTags) permissionTagsPreview = item.data.permissionTags;
                                                    if (item.data.fallbackMessage) fallbackMessagePreview = item.data.fallbackMessage;
                                                }
                                            } catch (e) { }

                                            return (
                                                <>
                                                    {permissionTagsPreview.length > 0 && (
                                                        <div style={{ marginBottom: '10px' }}>
                                                            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>切換權限標籤:</div>
                                                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                                {permissionTagsPreview.map(tag => (
                                                                    <span key={`perm-${tag}`} style={{ backgroundColor: '#FFD700', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{tag}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {fallbackMessagePreview && (
                                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            Fallback: {fallbackMessagePreview}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                        <div style={{ marginTop: 'auto' }}>
                                            <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                                                {item.isMetadata ? `更新於 ${new Date(item.created_at).toLocaleString()}` : `ID: ${rid?.slice(-8)}`}
                                            </p>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleEditMenu(item, item.isMetadata)} className="secondary" style={{ flex: 1, padding: '8px' }}>
                                                    {isDraft ? <Edit2 size={14} /> : <Eye size={14} />} {isDraft ? '編輯' : '查看'}
                                                </button>
                                                {isPublished && rid && (
                                                    <>
                                                        <Tooltip title={isRestricted ? "立即將此限定圖文選單同步至標籤用戶 (Link)" : "立即將此圖文選單連結至全體用戶 (Link)"}>
                                                            <button onClick={() => setLinkModalState({ richMenuId: rid, item: item, publishStrategy: item.status === "restricted" ? "restricted" : "default", targetTags: item.target_tags || [], targetUserCount: 0, totalUserCount: 0 })} className="secondary" style={{ padding: '8px', color: '#fff', borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
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
                                                <button onClick={() => deleteMenu(item.isMetadata ? item.id : item.richMenuId, item.name, item.isMetadata)} style={{ padding: '8px', color: '#ff4d4d', border: '1px solid #444', background: 'none' }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            </div>
        
            {linkModalState && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="modal-content" style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>連結圖文選單</h3>
                            <button onClick={() => setLinkModalState(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input type="radio" name="linkPublishStrategy" value="default" checked={linkModalState.publishStrategy === 'default'} onChange={() => setLinkModalState({ ...linkModalState, publishStrategy: 'default' })} style={{ accentColor: '#FFD700', transform: 'scale(1.2)', margin: '0 5px' }} />
                                全體對象
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input type="radio" name="linkPublishStrategy" value="restricted" checked={linkModalState.publishStrategy === 'restricted'} onChange={() => setLinkModalState({ ...linkModalState, publishStrategy: 'restricted' })} style={{ accentColor: '#FFD700', transform: 'scale(1.2)', margin: '0 5px' }} />
                                選定標籤
                            </label>

                            {linkModalState.publishStrategy === 'restricted' && (
                                <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <label className="label">適用標籤 (可複選)</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                        {allTags.map(t => (
                                            <label key={t.tag_name} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: (linkModalState.targetTags || []).includes(t.tag_name) ? 'var(--primary-yellow)' : '#333', color: (linkModalState.targetTags || []).includes(t.tag_name) ? '#000' : '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                                <input 
                                                    type="checkbox" 
                                                    style={{ display: 'none' }}
                                                    checked={(linkModalState.targetTags || []).includes(t.tag_name)}
                                                    onChange={(e) => {
                                                        const newTags = e.target.checked 
                                                            ? [...(linkModalState.targetTags || []), t.tag_name]
                                                            : (linkModalState.targetTags || []).filter(tag => tag !== t.tag_name);
                                                        setLinkModalState({ ...linkModalState, targetTags: newTags });
                                                    }}
                                                />
                                                {t.tag_name}
                                            </label>
                                        ))}
                                        {allTags.length === 0 && <span style={{ color: '#666', fontSize: '13px' }}>目前沒有任何標籤</span>}
                                    </div>
                                    <div style={{ marginTop: '15px', fontSize: '13px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Shield size={14} /> 預計套用人數：
                                        <span style={{ color: 'var(--primary-yellow)', fontWeight: 'bold', fontSize: '16px' }}>{linkModalState.targetUserCount}</span> 人
                                        <span style={{ fontSize: '11px', color: '#666' }}>(佔好友人數 {linkModalState.totalUserCount ? ((linkModalState.targetUserCount / linkModalState.totalUserCount) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                </div>
                            )}

                            {linkModalState.publishStrategy === 'default' && (
                                <div style={{ backgroundColor: '#111', padding: '10px 15px', borderRadius: '8px', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Shield size={14} style={{ color: '#aaa' }} /> <span style={{ color: '#aaa', fontSize: '13px' }}>預計套用人數：</span>
                                    <span style={{ color: 'var(--primary-yellow)', fontWeight: 'bold', fontSize: '16px' }}>{linkModalState.totalUserCount || 0}</span> <span style={{ color: '#aaa', fontSize: '13px' }}>人</span>
                                    <span style={{ fontSize: '11px', color: '#666' }}>(佔好友人數 100%)</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                                <button onClick={submitLinkModal} className="primary" disabled={loading}>
                                    確定連結
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
</div>
    );
}

export default RichMenu;
