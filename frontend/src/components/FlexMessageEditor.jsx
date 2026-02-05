import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Image as ImageIcon, Link as LinkIcon, MessageSquare } from 'lucide-react';

const FlexMessageEditor = ({ initialContent, onSave, onCancel }) => {
    // Modes
    const [mode, setMode] = useState('single'); // 'single' | 'carousel'
    const [currentCardIndex, setCurrentCardIndex] = useState(0);

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
        imageAction: { type: 'none', value: '' },
        title: '',
        description: '',
        buttons: []
    };

    const [cards, setCards] = useState([{ ...defaultCard }]);

    // Initialize from props
    useEffect(() => {
        if (initialContent) {
            try {
                const parsed = typeof initialContent === 'string' ? JSON.parse(initialContent) : initialContent;

                // Prevent infinite loop: if incoming content matches current state, do nothing
                // relying on JSON.stringify for deep comparison of simple objects
                const currentJson = generateJson();
                if (JSON.stringify(parsed) === JSON.stringify(currentJson)) {
                    return;
                }

                if (parsed.type === 'carousel') {
                    setMode('carousel');
                    const loadedCards = parsed.contents.map(bubble => parseBubbleToCard(bubble));
                    setCards(loadedCards);
                } else if (parsed.type === 'bubble') {
                    setMode('single');
                    setCards([parseBubbleToCard(parsed)]);
                }
            } catch (e) {
                console.error("Failed to parse initial content", e);
                // Fallback to default
            }
        }
    }, [initialContent]);

    // Auto-save when cards or mode changes
    useEffect(() => {
        const json = generateJson();
        onSave(JSON.stringify(json));
    }, [cards, mode]);

    // Helper: Parse Bubble back to internal Card state
    const parseBubbleToCard = (bubble) => {
        const hero = bubble.hero || {};
        const body = bubble.body || {};
        const footer = bubble.footer || {};

        // Detect Template Type
        // If we strictly follow our generation logic:
        // Image Card has NO footer and NO Title/Desc in Body (or minimal body).
        // Option Card has Footer.

        let template = 'option';
        const hasButtons = footer.contents && footer.contents.length > 0;
        const hasTitle = body.contents?.some(c => c.size === 'xl');

        if (!hasButtons && !hasTitle) {
            template = 'image';
        }

        const card = {
            template,
            imageUrl: hero.url || '',
            imageAction: { type: 'none', value: '' },
            title: '',
            description: '',
            buttons: []
        };

        // Image Action
        if (hero.action) {
            card.imageAction.type = hero.action.type;
            card.imageAction.value = hero.action.uri || hero.action.text || '';
        }

        // Text
        if (body.contents) {
            const titleObj = body.contents.find(c => c.size === 'xl');
            if (titleObj) card.title = titleObj.text;

            if (titleObj) card.title = titleObj.text;

            const descObj = body.contents.find(c => (c.color === '#666666' || c.wrap === true) && c !== titleObj);
            if (descObj) card.description = descObj.text;
        }

        // Buttons
        if (footer.contents) {
            card.buttons = footer.contents.map(b => ({
                text: b.style === 'link' ? (b.action.label || 'LINK') : (b.action.label || 'BTN'), // Heuristic
                action: b.action.type,
                value: b.action.uri || b.action.text
            }));
            // Fix text label if needed
            card.buttons.forEach((btn, i) => {
                const originalBtn = footer.contents[i];
                if (originalBtn.action && originalBtn.action.label) btn.text = originalBtn.action.label;
            });
        }

        return card;
    };

    // Helper: Generate Flex JSON from State
    const generateJson = () => {
        const bubbles = cards.map(card => {
            const bubble = {
                type: 'bubble',
                size: 'giga', // Better for full width
                hero: {
                    type: 'image',
                    url: card.imageUrl || 'https://via.placeholder.com/800x400?text=No+Image',
                    size: 'full',
                    aspectRatio: '2:1',
                    aspectMode: 'cover',
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: []
                }
            };

            // Image Action
            if (card.imageAction.type !== 'none') {
                bubble.hero.action = {
                    type: card.imageAction.type,
                    label: 'action'
                };
                if (card.imageAction.type === 'uri') bubble.hero.action.uri = card.imageAction.value;
                if (card.imageAction.type === 'message') bubble.hero.action.text = card.imageAction.value;
            }

            // Template Specifics
            if (card.template === 'option') {
                // Title
                if (card.title) {
                    bubble.body.contents.push({
                        type: 'text',
                        text: card.title,
                        weight: 'bold',
                        size: 'xl',
                        wrap: true
                    });
                }
                // Description
                if (card.description) {
                    bubble.body.contents.push({
                        type: 'text',
                        text: card.description,
                        size: 'sm',
                        color: '#666666',
                        wrap: true,
                        margin: 'md'
                    });
                }

                // Buttons (Footer)
                if (card.buttons.length > 0) {
                    bubble.footer = {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        contents: card.buttons.map(btn => {
                            const btnObj = {
                                type: 'button',
                                style: btn.action === 'uri' ? 'link' : 'primary', // Use link style for URI as requested (Blue text implied) or primary
                                height: 'sm',
                                action: {
                                    type: btn.action,
                                    label: btn.text
                                }
                            };

                            // Visual Customization per request
                            // "Open Link": Blue bg + Icon (Not standard Flex, but we can approximate with colors)
                            // "Send Message": White bg + Icon
                            // Actually Flex Button `style` is limited (link, primary, secondary).
                            // Primary is usually Green/AppColor. Secondary is Grey/White. Link is text only.
                            // The user requested specific visuals: "Blue background" vs "White background".
                            // We can use `color` property for background if style is primary/secondary.

                            if (btn.action === 'uri') {
                                btnObj.style = 'primary';
                                btnObj.color = '#1E88E5'; // Blue
                                btnObj.action.uri = btn.value;
                            } else {
                                btnObj.style = 'secondary'; // White-ish/Light Grey
                                btnObj.action.text = btn.value;
                            }
                            return btnObj;
                        })
                    };
                }
            } else {
                // Image Card
                // Body is just a placeholder to keep valid structure or empty?
                // Minimal body
                bubble.body.paddingAll = "0px";
            }

            return bubble;
        });

        if (mode === 'single') {
            return bubbles[0];
        } else {
            return {
                type: 'carousel',
                contents: bubbles
            };
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
            imageAction: { ...first.imageAction, value: '' },
            title: '',
            description: '',
            buttons: first.buttons.map(b => ({ ...b, value: '' }))
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
        const newCards = [...cards];
        newCards[currentCardIndex] = { ...newCards[currentCardIndex], [field]: value };
        setCards(newCards);
    };

    const updateCardButton = (btnIndex, field, value) => {
        const newCards = [...cards];
        const buttons = [...newCards[currentCardIndex].buttons];
        buttons[btnIndex] = { ...buttons[btnIndex], [field]: value };
        newCards[currentCardIndex].buttons = buttons;
        setCards(newCards);
    };

    const addCardButton = () => {
        const newCards = [...cards];
        if (newCards[currentCardIndex].buttons.length >= 3) return;
        newCards[currentCardIndex].buttons.push({ text: '新按鈕', action: 'message', value: '' });
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

    const currentCard = cards[currentCardIndex];

    return (
        <div style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header / Mode Switcher */}
            <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Flex 編輯器</h3>
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
                    {/* <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid #666', color: '#fff', padding: '6px 15px', borderRadius: '4px' }}>取消</button> */}
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Form - Full Width */}
                <div style={{ width: '100%', padding: '20px', overflowY: 'auto' }}>

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

                    {/* Template Selector */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ marginBottom: '10px', fontSize: '13px', color: '#aaa' }}>卡片模板</div>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {/* Image Field */}
                        <div>
                            <label style={{ display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '5px' }}>圖片網址 (800x400px)</label>
                            <input
                                type="text" value={currentCard.imageUrl}
                                onChange={e => updateCurrentCard('imageUrl', e.target.value)}
                                style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                            />
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
                                <input
                                    type="text"
                                    placeholder={currentCard.imageAction.type === 'uri' ? 'https://...' : '回傳文字'}
                                    value={currentCard.imageAction.value}
                                    onChange={e => updateCurrentCard('imageAction', { ...currentCard.imageAction, value: e.target.value })}
                                    style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', borderRadius: '4px', color: '#fff' }}
                                />
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
                                        <label style={{ display: 'block', color: '#aaa', fontSize: '13px' }}>按鈕 (1-3個)</label>
                                        {currentCard.buttons.length < 3 && (
                                            <button onClick={addCardButton} style={{ fontSize: '12px', color: 'var(--primary-yellow)', background: 'transparent', border: '1px dashed #666', padding: '2px 8px', cursor: 'pointer' }}>+ 新增按鈕</button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {currentCard.buttons.map((btn, idx) => (
                                            <div key={idx} style={{ padding: '10px', background: '#333', borderRadius: '8px', border: '1px solid #444' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                    <span style={{ fontSize: '12px', color: '#888' }}>按鈕 {idx + 1}</span>
                                                    {currentCard.buttons.length > 1 && <X size={14} color="#FF4D4D" onClick={() => removeCardButton(idx)} style={{ cursor: 'pointer' }} />}
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
                                                    style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlexMessageEditor;
