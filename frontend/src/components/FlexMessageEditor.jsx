import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Image as ImageIcon, Link as LinkIcon, MessageSquare, Upload } from 'lucide-react';
import api, { API_BASE_URL } from '../api';
import JourneyPreview from './JourneyPreview';
import TagInput from './TagInput';

// 統一的 JSON 標準化輔助函式，排除內部暫存變數（如 _template），並以穩定的字串形式比較
const normalize = (obj) => {
    if (!obj) return null;
    try {
        const clone = typeof obj === 'string' ? JSON.parse(obj) : JSON.parse(JSON.stringify(obj));
        const sweep = (o) => {
            if (Array.isArray(o)) o.forEach(sweep);
            else if (o && typeof o === 'object') {
                delete o._template;
                Object.values(o).forEach(sweep);
            }
        };
        sweep(clone);
        return JSON.stringify(clone);
    } catch (e) {
        return null;
    }
};

const FlexMessageEditor = ({ initialContent, onSave, onCancel, readOnly }) => {
    // Modes
    const [mode, setMode] = useState('single'); // 'single' | 'carousel'
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [appName, setAppName] = useState('');
    const [menus, setMenus] = useState([]);
    const [projects, setProjects] = useState([]);

    const match = window.location.pathname.match(/\/oa\/(\d+)/);
    const oaId = match ? match[1] : null;

    const getMenuSelectValue = (menuVal) => {
        if (!menuVal) return '';
        const matched = menus.find(m => m.ui_uuid === menuVal || (m.richMenuId || m.rich_menu_id) === menuVal);
        return matched ? (matched.ui_uuid || '') : menuVal;
    };

    useEffect(() => {
        const fetchMenusAndProjects = async () => {
            try {
                const menusRes = await api.get(oaId && oaId !== 'all' ? '/richmenu/' : '/richmenu/all');
                setMenus(menusRes.data.richmenus || menusRes.data || []);
            } catch (e) {
                console.error('Failed to fetch menus:', e);
            }
            try {
                const projRes = await api.get('/projects', { params: { _t: new Date().getTime() } });
                setProjects(Array.isArray(projRes.data) ? projRes.data : []);
            } catch (e) {
                console.error('Failed to fetch projects:', e);
            }
        };
        fetchMenusAndProjects();
    }, [oaId]);

    useEffect(() => {
        const fetchOAName = async () => {
            try {
                const res = await api.get('/my_oas');
                const configs = res.data.configs || (Array.isArray(res.data) ? res.data : []);
                const currentConfig = configs.find(c => c.id.toString() === oaId);
                if (currentConfig?.other_settings?.app_name) {
                    setAppName(currentConfig.other_settings.app_name);
                }
            } catch (err) {
                console.error('Failed to fetch OA config:', err);
            }
        };
        if (oaId) fetchOAName();
    }, [oaId]);

    // Cards State
    // Card Schema:
    // {
    //   template: 'option' | 'image',
    //   imageUrl: '',
    //   imageAction: { type: 'none', label: '', value: '' }, // type: 'none' | 'uri' | 'message'
    //   title: '',
    //   description: '',
    //   buttons: [ { text: '', action: 'uri' | 'message', value: '' } ]
    // }
    const defaultCard = {
        template: 'option',
        imageUrl: '',
        imageAction: { type: 'none', value: '', tags: [], journey: '', menu: '' },
        title: '',
        description: '',
        buttons: [],
        tags: [] // For legacy or top-level if needed, but per-button is better
    };

    const [cards, setCards] = useState([{ ...defaultCard }]);
    const [hasInitialized, setHasInitialized] = useState(false);
    
    // 用於追蹤本編輯器最後一次主動儲存的 JSON 狀態，避免父元件狀態回流導致的競態回溯問題
    const lastSavedJsonRef = useRef(null);
    // 用於管理圖片上傳狀態，提供豐富的視覺載入特效與阻擋重複操作
    const [isUploading, setIsUploading] = useState(false);

    // 初始與外部變更載入邏輯
    useEffect(() => {
        if (!initialContent) {
            setHasInitialized(true);
            return;
        }

        try {
            const incoming = typeof initialContent === 'string' ? JSON.parse(initialContent) : initialContent;
            const normalizedIncoming = normalize(incoming);

            // 若傳入內容與最後一次本機儲存的內容完全相同，則視為「自身儲存回流」，忽略以防競態回溯
            if (hasInitialized && lastSavedJsonRef.current === normalizedIncoming) {
                return;
            }

            const current = generateJson();
            if (normalize(incoming) === normalize(current)) {
                // 若內容語意上相同，僅標記已初始化即可
                if (!hasInitialized) setHasInitialized(true);
                return;
            }

            // 初始化邏輯：首次掛載時載入
            // 或當外部傳入內容與當前本機狀態有根本性的顯著差異（例如在父元件切換了編輯的訊息）
            const isExternalChange = !hasInitialized;
            const isSignificantDiff = normalize(incoming) !== normalize(current);

            if (isExternalChange || (hasInitialized && isSignificantDiff)) {
                if (incoming.type === 'carousel') {
                    setMode('carousel');
                    const parsedCards = incoming.contents.map(b => parseBubbleToCard(b));
                    if (parsedCards.length > 0) {
                        const firstTemplate = parsedCards[0].template;
                        parsedCards.forEach(c => c.template = firstTemplate);
                    }
                    setCards(parsedCards);
                } else if (incoming.type === 'bubble') {
                    setMode('single');
                    setCards([parseBubbleToCard(incoming)]);
                }
                if (!hasInitialized) setHasInitialized(true);
            }
        } catch (e) {
            console.error("FlexEditor Load Error:", e);
            setHasInitialized(true);
        }
    }, [initialContent]);

    // 自動儲存邏輯
    useEffect(() => {
        if (!hasInitialized) return;

        const currentJson = generateJson();
        const incomingJson = typeof initialContent === 'string' ? JSON.parse(initialContent || '{}') : initialContent;

        const normalizedCurrent = normalize(currentJson);
        const normalizedIncoming = normalize(incomingJson);

        if (normalizedCurrent !== normalizedIncoming) {
            const size = JSON.stringify(currentJson).length;
            if (size > 9000) {
                console.warn(`Flex payload size warning: ${size} characters. LINE limit is ~10KB.`);
            }
            // 儲存時同步更新 lastSavedJsonRef
            lastSavedJsonRef.current = normalizedCurrent;
            onSave(JSON.stringify(currentJson));
        }
    }, [cards, mode, hasInitialized]);

    // Validation helper
    const validateCards = () => {
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cardNum = i + 1;
            const cardPrefix = mode === 'carousel' ? `卡片 #${cardNum}: ` : '';

            if (card.template === 'option') {
                if (!card.imageUrl?.trim()) return `${cardPrefix}圖片網址不可為空白`;
                if (!card.title?.trim()) return `${cardPrefix}標題不可為空白`;
                if (!card.description?.trim()) return `${cardPrefix}說明文字不可為空白`;

                for (let j = 0; j < card.buttons.length; j++) {
                    const btn = card.buttons[j];
                    const btnNum = j + 1;
                    if (!btn.text?.trim()) return `${cardPrefix}按鈕 #${btnNum} 文字不可為空白`;
                    if (btn.action === 'uri' && !btn.value?.trim()) {
                        return `${cardPrefix}按鈕 #${btnNum} 的連結連結 (URL) 不可為空白`;
                    }
                    if (btn.action === 'message' && !btn.value?.trim()) {
                        return `${cardPrefix}按鈕 #${btnNum} 的回傳文字不可為空白`;
                    }
                }
            } else {
                // Image template
                if (!card.imageUrl?.trim()) return `${cardPrefix}圖片網址不可為空白`;
                if (card.imageAction.type !== 'none') {
                    if (card.imageAction.type === 'uri' && !card.imageAction.value?.trim()) {
                        return `${cardPrefix}圖片點擊的連結連結 (URL) 不可為空白`;
                    }
                    if (card.imageAction.type === 'message' && !card.imageAction.value?.trim()) {
                        return `${cardPrefix}圖片點擊的回傳文字不可為空白`;
                    }
                }
            }
        }
        return null;
    };

    // Helper: Parse Bubble back to internal Card state
    const parseBubbleToCard = (bubble) => {
        const hero = bubble.hero || {};
        const body = bubble.body || {};
        const footer = bubble.footer || {};

        const extractBindData = (payload) => {
            let bindData = { tag: [], journey: '', menu: '' };
            if (!payload || typeof payload !== 'string') return bindData;
            
            if (payload.startsWith('sys_bind|')) {
                const parts = payload.split('|');
                if (parts[1]) bindData.tag = parts[1].split(',').filter(t => t);
                if (parts[2]) bindData.journey = parts[2];
                if (parts[3]) bindData.menu = parts[3];
                return bindData;
            } else if (payload.includes('|sys_bind|')) {
                const parts = payload.split('|sys_bind|');
                if (parts.length > 1) {
                    const params = parts[1].split('|');
                    if (params[0]) bindData.tag = params[0].split(',').filter(t => t);
                    if (params[1]) bindData.journey = params[1];
                    if (params[2]) bindData.menu = params[2];
                }
                return bindData;
            }
            if (payload.includes('set_tag|')) {
                const parts = payload.split('|');
                const tagIdx = parts.indexOf('set_tag');
                if (tagIdx !== -1) bindData.tag = parts.slice(tagIdx + 1).filter(t => t);
                return bindData;
            }
            
            let urlParams = null;
            if (payload.includes('liff.line.me')) {
                if (payload.match(/[?&](tag|journey|menu)=/)) {
                    urlParams = new URLSearchParams(payload.substring(payload.indexOf('?')));
                }
            } else if (payload.includes('/redirect?') || payload.includes('%2Fredirect%3F')) {
                const search = payload.includes('?') ? payload.substring(payload.indexOf('?')) : decodeURIComponent(payload).substring(decodeURIComponent(payload).indexOf('?'));
                urlParams = new URLSearchParams(search);
            }
            
            if (urlParams) {
                const tagStr = urlParams.get('tag') || urlParams.get('tags');
                if (tagStr) bindData.tag = tagStr.split(/[,|]/).map(t => t.trim()).filter(t => t);
                const journeyStr = urlParams.get('journey');
                if (journeyStr) bindData.journey = journeyStr;
                const menuStr = urlParams.get('menu');
                if (menuStr) bindData.menu = menuStr;
            }
            
            const match = payload.match(/#tags=([^#?&]*)/);
            if (match && match[1]) {
                bindData.tag = match[1].split(/[,|]/).map(t => t.trim()).filter(t => t);
            }
            return bindData;
        };

        const cleanPayload = (payload) => {
            if (!payload || typeof payload !== 'string') return payload;
            if (payload.startsWith('sys_bind|')) {
                return payload.split('|').slice(4).join('|');
            }
            if (payload.includes('|sys_bind|')) {
                return payload.split('|sys_bind|')[0];
            }
            if (payload.includes('set_tag|')) {
                return payload.split('set_tag|')[0].replace(/\|$/, '');
            }
            // Clean LIFF format
            if (payload.includes('liff.line.me')) {
                const redirectMatch = payload.match(/[?&]redirect=([^&]*)/);
                if (redirectMatch && redirectMatch[1]) {
                    const redirectUrl = decodeURIComponent(redirectMatch[1]);
                    const urlMatch = redirectUrl.match(/[?&]url=([^&]*)/);
                    if (urlMatch && urlMatch[1]) {
                        return decodeURIComponent(urlMatch[1]);
                    }
                    return redirectUrl;
                }
            }
            // Clean redirect format
            if (payload.includes('/redirect?') || payload.includes('%2Fredirect%3F')) {
                const urlMatch = payload.match(/[?&]url=([^&]*)/) || decodeURIComponent(payload).match(/[?&]url=([^&]*)/);
                if (urlMatch && urlMatch[1]) {
                    return decodeURIComponent(urlMatch[1]);
                }
            }
            // Clean URI fragment format
            return payload.split('#tags=')[0];
        };

        const card = {
            template: (hero.type === 'image' && (!body.contents || body.contents.length === 0)) ? 'image' : 'option',
            imageUrl: hero.url || '',
            imageAction: {
                type: 'none',
                value: '',
                tags: []
            },
            title: body.contents?.find(c => c.size === 'xl' || c.weight === 'bold')?.text || '',
            description: body.contents?.find(c => c.wrap && c.size === 'sm')?.text || '',
            buttons: (footer.contents || []).filter(c => c.type === 'button').map(b => {
                const rawVal = b.action.uri || b.action.data || b.action.text || '';
                const cleanVal = cleanPayload(rawVal);
                const bindData = extractBindData(rawVal);

                // Determine if it was a URI or Message
                // If it's a URI scheme or was originally a URI type
                const isUri = b.action.type === 'uri' || (cleanVal && (cleanVal.startsWith('http') || cleanVal.startsWith('line://')));

                return {
                    text: b.action.label || b.action.text || '',
                    action: isUri ? 'uri' : 'message',
                    value: cleanVal,
                    tags: bindData.tag,
                    journey: bindData.journey,
                    menu: bindData.menu
                };
            })
        };

        // Parse Hero Action
        if (hero.action) {
            const rawVal = hero.action.uri || hero.action.data || hero.action.text || '';
            const cleanVal = cleanPayload(rawVal);
            const bindData = extractBindData(rawVal);
            const isUri = hero.action.type === 'uri' || (cleanVal && (cleanVal.startsWith('http') || cleanVal.startsWith('line://')));

            card.imageAction = {
                type: isUri ? 'uri' : 'message',
                value: cleanVal,
                tags: bindData.tag,
                journey: bindData.journey,
                menu: bindData.menu
            };
        }
        return card;
    };

    // Helper: Generate Flex JSON from State
    const generateJson = () => {
        const buildAction = (type, val, bindData = { tag: [], journey: '', menu: '' }) => {
            if (type === 'none') return null;

            const tagsStr = (bindData.tag && bindData.tag.length > 0) ? bindData.tag.join(',') : '';
            const journeyStr = bindData.journey || '';
            const menuStr = bindData.menu || '';
            const hasBind = tagsStr || journeyStr || menuStr;

            if (type === 'uri') {
                if (!val || !val.trim()) return { type: 'uri', label: 'action', uri: '' };

                const hasValidScheme = val.startsWith('http://') || val.startsWith('https://') || val.startsWith('line://');
                let finalVal = val;
                if (!hasValidScheme && val.trim().length > 0) {
                    finalVal = 'https://' + val;
                }

                if (hasBind) {
                    const redirectBase = API_BASE_URL ? `${API_BASE_URL}/redirect` : '/api/redirect';
                    const absoluteRedirectBase = redirectBase.startsWith('/') ? window.location.origin + redirectBase : redirectBase;
                    
                    let finalTargetUrl = `${absoluteRedirectBase}?url=${encodeURIComponent(finalVal)}&oaId=${oaId}`;
                    if (tagsStr) finalTargetUrl += `&tags=${encodeURIComponent(tagsStr)}`;
                    if (journeyStr) finalTargetUrl += `&journey=${encodeURIComponent(journeyStr)}`;
                    if (menuStr) finalTargetUrl += `&menu=${encodeURIComponent(menuStr)}`;

                    if (appName) {
                        const liffId = "2009851813-AgTeSa4r";
                        let liffUrl = `https://liff.line.me/${liffId}?bot=${appName}&redirect=${encodeURIComponent(finalVal)}`;
                        if (tagsStr) liffUrl += `&tag=${encodeURIComponent(tagsStr)}`;
                        if (journeyStr) liffUrl += `&journey=${encodeURIComponent(journeyStr)}`;
                        if (menuStr) liffUrl += `&menu=${encodeURIComponent(menuStr)}`;
                        return { type: 'uri', label: 'action', uri: liffUrl };
                    }
                    
                    return { type: 'uri', label: 'action', uri: finalTargetUrl };
                }
                
                const redirectBase = API_BASE_URL ? `${API_BASE_URL}/redirect` : '/api/redirect';
                const absoluteRedirectBase = redirectBase.startsWith('/') ? window.location.origin + redirectBase : redirectBase;
                const finalTargetUrl = `${absoluteRedirectBase}?url=${encodeURIComponent(finalVal)}&oaId=${oaId}`;
                return { type: 'uri', label: 'action', uri: finalTargetUrl };
            }

            if (!val || !val.trim()) {
                return { type: 'postback', label: 'action', data: '', displayText: '' };
            }

            if (hasBind) {
                return {
                    type: 'postback',
                    label: 'action',
                    data: `sys_bind|${tagsStr}|${journeyStr}|${menuStr}|${val}`,
                    displayText: val
                };
            }
            return {
                type: 'postback',
                label: 'action',
                data: val,
                displayText: val
            };
        };

        const generateBubble = (card) => {
            const bubble = {
                type: 'bubble',
                size: mode === 'carousel' ? 'kilo' : 'micro',
                hero: {
                    type: 'image',
                    url: card.imageUrl || 'https://dummyimage.com/800x400/cccccc/666666.png&text=Image',
                    size: 'full',
                    aspectRatio: '20:13',
                    aspectMode: 'cover'
                }
            };

            const heroAction = buildAction(card.imageAction.type, card.imageAction.value, {
                tag: card.imageAction.tags,
                journey: card.imageAction.journey,
                menu: card.imageAction.menu
            });
            if (heroAction) {
                bubble.hero.action = heroAction;
            }

            if (card.template === 'option') {
                // In carousel mode, force all to kilo. In single mode, mega is set later.
                bubble.size = 'kilo';
                bubble.body = {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        { type: 'text', text: card.title || '標題', weight: 'bold', size: 'xl' },
                        { type: 'text', text: card.description || '內容描述...', size: 'sm', color: '#666666', wrap: true }
                    ]
                };
                if (card.buttons && card.buttons.length > 0) {
                    bubble.footer = {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        contents: card.buttons.map(btn => {
                            const btnAction = buildAction(btn.action === 'uri' ? 'uri' : 'message', btn.value, {
                                tag: btn.tags,
                                journey: btn.journey,
                                menu: btn.menu
                            });
                            if (!btnAction) return null;
                            return {
                                type: 'button',
                                style: 'link',
                                height: 'sm',
                                action: btnAction
                            };
                        }).filter(b => b !== null)
                    };

                    if (bubble.footer.contents.length > 0) {
                        bubble.footer.contents.forEach((b, i) => {
                            // Map back labels - search in non-null buttons
                            const originalButtons = card.buttons.filter(ob => {
                                const act = buildAction(ob.action === 'uri' ? 'uri' : 'message', ob.value, {
                                    tag: ob.tags,
                                    journey: ob.journey,
                                    menu: ob.menu
                                });
                                return !!act;
                            });
                            b.action.label = originalButtons[i]?.text || '按鈕';
                        });
                    } else {
                        delete bubble.footer;
                    }
                }
            } else {
                // Image Card: Optimize for "Full Bleed" look in carousels
                if (mode === 'carousel') {
                    bubble.size = 'kilo';
                }
                
                // Use a taller aspect ratio for image-only cards to cover more vertical space in mixed carousels
                bubble.hero.aspectRatio = '1:1';
                bubble.hero.aspectMode = 'cover';
                bubble.hero.backgroundColor = '#000000';
                
                // Add explicit empty body and footer to ensure styles are applied when stretched in a carousel
                bubble.body = {
                    type: 'box',
                    layout: 'vertical',
                    contents: []
                };
                bubble.footer = {
                    type: 'box',
                    layout: 'vertical',
                    contents: []
                };

                // Add styles to ensure any remaining space (due to other tall cards) is black, not white
                bubble.styles = {
                    body: { backgroundColor: '#000000' },
                    footer: { backgroundColor: '#000000' }
                };
            }

            return bubble;
        };

        const bubbles = cards.map(c => generateBubble(c));

        if (mode === 'carousel') {
            return {
                type: 'carousel',
                contents: bubbles
            };
        } else {
            const bubble = bubbles[0];
            if (bubble) bubble.size = 'mega';
            return bubble;
        }
    };

    // Handlers
    const handleAddCard = () => {
        if (cards.length >= 10) return;
        // Copy first card format
        const first = cards[0];
        const newCard = {
            ...first,
            imageUrl: '', // Blank content
            imageAction: { ...first.imageAction, value: '', tags: [], journey: '', menu: '' },
            title: '',
            description: '',
            buttons: first.buttons.map(b => ({ ...b, value: '', tags: [], journey: '', menu: '' }))
        };
        setCards([...cards, newCard]);
        setCurrentCardIndex(cards.length); // Switch to new card
    };

    const handleDeleteCard = (index) => {
        if (cards.length <= 1) return;
        const newCards = cards.filter((_, i) => i !== index);
        setCards(newCards);
        if (currentCardIndex >= newCards.length) setCurrentCardIndex(newCards.length - 1);
    };

    const updateCurrentCard = (field, value) => {
        setCards(prevCards => {
            const newCards = [...prevCards];
            // 若為切換模板，強制套用至所有卡片，確保輪播中只有一種模板
            if (field === 'template') {
                return newCards.map(c => ({ ...c, template: value }));
            }
            newCards[currentCardIndex] = { ...newCards[currentCardIndex], [field]: value };
            return newCards;
        });
    };

    const updateCardButton = (btnIndex, field, value) => {
        setCards(prevCards => {
            const newCards = [...prevCards];
            const buttons = [...newCards[currentCardIndex].buttons];
            buttons[btnIndex] = { ...buttons[btnIndex], [field]: value };
            newCards[currentCardIndex].buttons = buttons;
            return newCards;
        });
    };

    const addCardButton = () => {
        const newCards = [...cards];
        if (newCards[currentCardIndex].buttons.length >= 3) return;
        newCards[currentCardIndex].buttons.push({ text: '新按鈕', action: 'message', value: '', tags: [], journey: '', menu: '' });
        setCards(newCards);
    };

    const removeCardButton = (btnIndex) => {
        const newCards = [...cards];
        newCards[currentCardIndex].buttons = newCards[currentCardIndex].buttons.filter((_, i) => i !== btnIndex);
        setCards(newCards);
    };

    // Computed json for preview
    const previewJson = generateJson();
    const previewWrapper = [{ OTYPE: 'FlexSendMessage', contents: previewJson }];
    const payloadSize = JSON.stringify(previewJson).length;

    const currentCard = cards[currentCardIndex];

    return (
        <div style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden' }}>
            <style>{`
                @keyframes flex-editor-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
            {/* Header / Mode Switcher */}
            <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>圖文訊息編輯器</h3>
                    <div style={{ display: 'flex', backgroundColor: '#333', borderRadius: '20px', padding: '3px' }}>
                        <button
                            onClick={() => { setMode('single'); setCards([cards[0]]); setCurrentCardIndex(0); }}
                            style={{
                                padding: '5px 15px', borderRadius: '15px', border: 'none',
                                backgroundColor: mode === 'single' ? 'var(--primary-yellow)' : 'transparent',
                                color: mode === 'single' ? '#000' : '#888',
                                cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            單張
                        </button>
                        <button
                            onClick={() => { setMode('carousel'); }}
                            style={{
                                padding: '5px 15px', borderRadius: '15px', border: 'none',
                                backgroundColor: mode === 'carousel' ? 'var(--primary-yellow)' : 'transparent',
                                color: mode === 'carousel' ? '#000' : '#888',
                                cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            輪播
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center' }}>
                        {payloadSize > 9000 ? (
                            <span style={{ color: '#FF4D4D' }}>⚠️ Payload 接近上限</span>
                        ) : <span>自動儲存中...</span>}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                {/* Editor Panel - Top */}
                <div style={{ borderBottom: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
                    <fieldset disabled={readOnly} style={{ border: 'none', padding: '20px', margin: 0, opacity: readOnly ? 0.7 : 1, minWidth: 0 }}>

                    {/* Template Selector (Global) */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px', fontSize: '13px', color: '#aaa' }}>
                            {mode === 'carousel' ? '輪播排版模板 (套用至所有卡片)' : '卡片排版模板'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div
                                onClick={() => updateCurrentCard('template', 'option')}
                                style={{
                                    padding: '10px', border: currentCard.template === 'option' ? '2px solid var(--primary-yellow)' : '1px solid #444',
                                    borderRadius: '8px', cursor: 'pointer', backgroundColor: '#333', textAlign: 'center'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>選項型</div>
                                <div style={{ fontSize: '11px', color: '#888' }}>圖 + 文 + 按鈕</div>
                            </div>
                            <div
                                onClick={() => updateCurrentCard('template', 'image')}
                                style={{
                                    padding: '10px', border: currentCard.template === 'image' ? '2px solid var(--primary-yellow)' : '1px solid #444',
                                    borderRadius: '8px', cursor: 'pointer', backgroundColor: '#333', textAlign: 'center'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>圖片型</div>
                                <div style={{ fontSize: '11px', color: '#888' }}>純圖片 + 點擊與否</div>
                            </div>
                        </div>
                    </div>

                    {/* Carousel Nav */}
                    {mode === 'carousel' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: '#333', padding: '10px', borderRadius: '8px' }}>
                            <button
                                disabled={currentCardIndex === 0}
                                onClick={() => setCurrentCardIndex(i => Math.max(0, i - 1))}
                                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentCardIndex === 0 ? 0.3 : 1 }}
                            >
                                <ChevronLeft />
                            </button>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: '12px', color: '#888' }}>卡片編輯</span>
                                <div style={{ fontWeight: 'bold' }}>{currentCardIndex + 1} / {cards.length}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                {currentCardIndex > 0 && (
                                    <button onClick={() => handleDeleteCard(currentCardIndex)} title="刪除此卡片" style={{ background: '#FF4D4D', border: 'none', borderRadius: '4px', padding: '5px', color: '#fff', cursor: 'pointer' }}>
                                        <X size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={handleAddCard}
                                    disabled={cards.length >= 10}
                                    title="新增卡片"
                                    style={{ background: '#4CAF50', border: 'none', borderRadius: '4px', padding: '5px', color: '#fff', cursor: cards.length >= 10 ? 'not-allowed' : 'pointer', opacity: cards.length >= 10 ? 0.5 : 1 }}
                                >
                                    <Plus size={16} />
                                </button>
                                <button
                                    disabled={currentCardIndex === cards.length - 1}
                                    onClick={() => setCurrentCardIndex(i => Math.min(cards.length - 1, i + 1))}
                                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: currentCardIndex === cards.length - 1 ? 0.3 : 1 }}
                                >
                                    <ChevronRight />
                                </button>
                            </div>
                        </div>
                    )}

                    <div key={currentCardIndex} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* Image Field */}
                        <div>
                            <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '5px' }}>圖片網址 (800x400px)</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                    type="text" value={currentCard.imageUrl}
                                    onChange={e => updateCurrentCard('imageUrl', e.target.value)}
                                    disabled={isUploading}
                                    placeholder={isUploading ? '圖片上傳中...' : ''}
                                    style={{ flex: 1, padding: '8px', background: isUploading ? '#222' : '#333', border: '1px solid #444', borderRadius: '4px', color: isUploading ? '#888' : '#fff' }}
                                />
                                <label style={{
                                    padding: '8px 12px',
                                    background: isUploading ? '#555' : 'var(--primary-yellow)',
                                    color: isUploading ? '#888' : '#000',
                                    borderRadius: '4px',
                                    cursor: isUploading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    opacity: isUploading ? 0.7 : 1,
                                    pointerEvents: isUploading ? 'none' : 'auto'
                                }}>
                                    {isUploading ? (
                                        <>
                                            <span style={{
                                                width: '14px',
                                                height: '14px',
                                                border: '2px solid #888',
                                                borderTop: '2px solid #fff',
                                                borderRadius: '50%',
                                                animation: 'flex-editor-spin 1s linear infinite',
                                                display: 'inline-block'
                                            }} />
                                            上傳中...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            上傳 (Max 1MB)
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            if (file.size > 5 * 1024 * 1024) {
                                                alert('圖片大小不可超過 5 MB');
                                                e.target.value = '';
                                                return;
                                            }

                                            const formData = new FormData();
                                            formData.append('file', file);

                                            try {
                                                setIsUploading(true);
                                                const res = await api.post('/upload/github', formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' }
                                                });
                                                updateCurrentCard('imageUrl', res.data.url);
                                            } catch (err) {
                                                const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                alert('哎呀，上傳失敗了：' + errorMsg);
                                            } finally {
                                                setIsUploading(false);
                                                e.target.value = ''; // Reset to allow same file upload
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Image Action */}
                        <div>
                            <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '5px' }}>圖片點擊行為</label>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                <select
                                    value={currentCard.imageAction.type}
                                    onChange={e => updateCurrentCard('imageAction', { ...currentCard.imageAction, type: e.target.value })}
                                    style={{ flex: 1, padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                                >
                                    <option value="none">無動作</option>
                                    <option value="uri">開啟連結</option>
                                    <option value="message">傳送訊息</option>
                                </select>
                            </div>
                            {currentCard.imageAction.type !== 'none' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder={currentCard.imageAction.type === 'uri' ? 'https://...' : '回傳文字'}
                                        value={currentCard.imageAction.value}
                                        onChange={e => updateCurrentCard('imageAction', { ...currentCard.imageAction, value: e.target.value })}
                                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                                    />
                                    <div style={{ marginTop: '5px' }}>
                                        <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '4px' }}>點擊時標註標籤</label>
                                        <TagInput
                                            tags={currentCard.imageAction.tags || []}
                                            onChange={newTags => updateCurrentCard('imageAction', { ...currentCard.imageAction, tags: newTags })}
                                            singleSelect={true}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '4px' }}>加入自動旅程</label>
                                            <select
                                                value={currentCard.imageAction.journey || ''}
                                                onChange={e => updateCurrentCard('imageAction', { ...currentCard.imageAction, journey: e.target.value })}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                            >
                                                <option value="">不設定</option>
                                                {projects.map(p => (
                                                    <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', color: '#888', fontSize: '12px', marginBottom: '4px' }}>切換圖文選單</label>
                                            <select
                                                value={getMenuSelectValue(currentCard.imageAction.menu)}
                                                onChange={e => updateCurrentCard('imageAction', { ...currentCard.imageAction, menu: e.target.value })}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                            >
                                                <option value="">不設定</option>
                                                {menus.map(m => (
                                                    <option key={m.richMenuId || m.rich_menu_id || m.id} value={m.ui_uuid || ''}>{m.name || m.richMenuId || m.rich_menu_id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Option Only Fields */}
                        {currentCard.template === 'option' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '5px' }}>標題</label>
                                    <input
                                        type="text" value={currentCard.title}
                                        onChange={e => updateCurrentCard('title', e.target.value)}
                                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '5px' }}>說明文字</label>
                                    <textarea
                                        value={currentCard.description}
                                        onChange={e => updateCurrentCard('description', e.target.value)}
                                        style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                                        rows={3}
                                    />
                                </div>

                                {/* Buttons */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ display: 'block', color: '#aaa', fontSize: '13px' }}>按鈕 (0-3個)</label>
                                        {currentCard.buttons.length < 3 && (
                                            <button onClick={addCardButton} style={{ fontSize: '12px', color: 'var(--primary-yellow)', background: 'transparent', border: '1px dashed #666', padding: '2px 8px', cursor: 'pointer' }}>+ 新增按鈕</button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {currentCard.buttons.map((btn, idx) => (
                                            <div key={idx} style={{ padding: '10px', background: '#333', borderRadius: '8px', border: '1px solid #444' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                    <span style={{ fontSize: '12px', color: '#888' }}>按鈕 {idx + 1}</span>
                                                    <X size={14} color="#FF4D4D" onClick={() => removeCardButton(idx)} style={{ cursor: 'pointer' }} />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px', marginBottom: '5px' }}>
                                                    <input
                                                        type="text" placeholder="按鈕文字"
                                                        value={btn.text}
                                                        onChange={e => updateCardButton(idx, 'text', e.target.value)}
                                                        style={{ padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', width: '100%' }}
                                                    />
                                                    <select
                                                        value={btn.action}
                                                        onChange={e => updateCardButton(idx, 'action', e.target.value)}
                                                        style={{ padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', width: '100%' }}
                                                    >
                                                        <option value="message">傳送訊息</option>
                                                        <option value="uri">開啟連結</option>
                                                    </select>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder={btn.action === 'uri' ? 'http://...' : '回傳文字'}
                                                    value={btn.value}
                                                    onChange={e => updateCardButton(idx, 'value', e.target.value)}
                                                    style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', marginBottom: '8px' }}
                                                />
                                                <div style={{ marginTop: '5px' }}>
                                                    <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '4px' }}>點擊時標註標籤</label>
                                                    <TagInput
                                                        tags={btn.tags || []}
                                                        onChange={newTags => updateCardButton(idx, 'tags', newTags)}
                                                        singleSelect={true}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '4px' }}>加入自動旅程</label>
                                                        <select
                                                            value={btn.journey || ''}
                                                            onChange={e => updateCardButton(idx, 'journey', e.target.value)}
                                                            style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                                        >
                                                            <option value="">不設定</option>
                                                            {projects.map(p => (
                                                                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '4px' }}>切換圖文選單</label>
                                                        <select
                                                            value={getMenuSelectValue(btn.menu)}
                                                            onChange={e => updateCardButton(idx, 'menu', e.target.value)}
                                                            style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                                        >
                                                            <option value="">不設定</option>
                                                            {menus.map(m => (
                                                                <option key={m.richMenuId} value={m.ui_uuid || ''}>{m.name || m.richMenuId}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    </fieldset>
                </div>

                {/* Preview Panel - Bottom */}
                <div style={{ backgroundColor: '#1a1a1a', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <div style={{ marginBottom: '15px', color: '#aaa', fontSize: '14px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>即時預覽 (寬版)</span>
                        <span style={{ color: payloadSize > 9000 ? '#FF4D4D' : '#888', fontWeight: payloadSize > 9000 ? 'bold' : 'normal' }}>
                            Payload Size: {payloadSize} / 10000 {payloadSize > 9000 && '(接近上限，建議縮減內容)'}
                        </span>
                    </div>
                    <div style={{
                        width: '100%',
                        border: '1px solid #333',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#8CAEC5',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ backgroundColor: '#2b2b2b', padding: '10px 15px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                            LINE Preview
                        </div>
                        <div style={{ padding: '20px', overflowX: 'auto' }}>
                            <JourneyPreview steps={previewWrapper} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlexMessageEditor;
