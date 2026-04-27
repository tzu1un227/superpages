import React from 'react';
import { User } from 'lucide-react';

// Mock styles for LINE simulation
const styles = {
    container: {
        backgroundColor: '#8FAADC', // LINE chat bg color
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px',
        overflowY: 'auto',
        fontFamily: 'sans-serif',
        fontSize: '14px',
    },
    bubbleRow: {
        display: 'flex',
        marginBottom: '10px',
        alignItems: 'flex-start',
    },
    avatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        marginRight: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    bubbleContainer: {
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
    },
    textBubble: {
        backgroundColor: '#fff',
        padding: '10px 15px',
        borderRadius: '15px',
        position: 'relative',
        color: '#000',
        wordBreak: 'break-word',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    imageBubble: {
        maxWidth: '200px',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
    },
    flexContainer: {
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '5px',
    },
    flexBubble: {
        backgroundColor: '#fff',
        borderRadius: '10px',
        overflow: 'hidden',
        width: '240px', // standard flex width approximation
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
    },
    flexImage: {
        width: '100%',
        height: '120px',
        objectFit: 'cover',
        backgroundColor: '#eee',
    },
    flexContent: {
        padding: '12px',
    },
    flexTitle: {
        fontWeight: 'bold',
        fontSize: '16px',
        marginBottom: '5px',
        color: '#333',
    },
    flexDesc: {
        fontSize: '13px',
        color: '#666',
        marginBottom: '10px',
        whiteSpace: 'pre-wrap',
    },
    flexButton: {
        display: 'block',
        width: '100%',
        padding: '10px 0',
        textAlign: 'center',
        color: '#42659a', // LINE link color
        textDecoration: 'none',
        borderTop: '1px solid #eee',
        fontWeight: 'bold',
        fontSize: '14px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
    },
    stepBadge: {
        backgroundColor: '#000',
        color: '#fff',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        marginBottom: '5px',
        alignSelf: 'flex-start',
    },
    delayLabel: {
        fontSize: '10px',
        color: '#1E40AF', // Blue-800
        backgroundColor: '#DBEAFE', // Blue-100
        padding: '2px 6px',
        borderRadius: '4px',
        marginBottom: '5px',
        alignSelf: 'flex-start',
        whiteSpace: 'pre-wrap'
    }
};

const JourneyPreview = ({ steps = [] }) => {

    const renderFlexCard = (card, index) => {
        // Handle both "Option" (Template A) and "Image" (Template B)
        // Image Card (Template B) is a pure image bubble.
        const isImageCard = !card.title && !card.description && (!card.buttons || card.buttons.length === 0);

        if (isImageCard) {
            return (
                <div key={index} style={{ 
                    ...styles.flexBubble, 
                    backgroundColor: '#000', 
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ 
                        ...styles.flexImage, 
                        height: 'auto', 
                        flex: 1,
                        position: 'relative', 
                        borderRadius: '0', 
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000'
                    }}>
                        {card.imageUrl ? (
                            <img src={card.imageUrl} alt="Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                                No Image
                            </div>
                        )}
                        {/* Overlay to hint action */}
                        {card.imageAction && card.imageAction.type !== 'none' && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.5)', color: '#fff',
                                fontSize: '10px', padding: '5px', textAlign: 'center'
                            }}>
                                {card.imageAction.type === 'message' ? '點擊傳送訊息' : '點擊開啟連結'}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Option Card (Template A)
        return (
            <div key={index} style={styles.flexBubble}>
                <div style={styles.flexImage}>
                    {card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.title || "Card"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ccc', color: '#666' }}>
                            No Image
                        </div>
                    )}
                </div>
                <div style={styles.flexContent}>
                    {card.title && <div style={styles.flexTitle}>{card.title}</div>}
                    {card.description && <div style={styles.flexDesc}>{card.description}</div>}
                </div>
                {/* Buttons */}
                {card.buttons && card.buttons.map((btn, btnIdx) => (
                    <button key={btnIdx} style={{
                        ...styles.flexButton,
                        color: btn.action === 'uri' ? '#3b82f6' : '#000', // Blue for link, Black for message
                    }}>
                        {btn.action === 'uri' && '🔗 '}{btn.text || '按鈕'}
                    </button>
                ))}
            </div>
        );
    };

    const renderMessage = (msg, idx) => {
        // Handle Text
        if (msg.OTYPE === 'TextSendMessage') {
            return <div key={idx} style={styles.textBubble}>{msg.text}</div>;
        }

        // Handle Image
        if (msg.OTYPE === 'ImageSendMessage') {
            return (
                <div key={idx} style={styles.imageBubble}>
                    <img src={msg.preview_image_url || msg.original_content_url} alt="Image" style={{ width: '100%' }} />
                </div>
            );
        }

        // Handle Video
        if (msg.OTYPE === 'VideoSendMessage') {
            return (
                <div key={idx} style={{ ...styles.imageBubble, position: 'relative' }}>
                    <video
                        src={msg.original_content_url}
                        poster={msg.preview_image_url}
                        controls
                        style={{ width: '100%', borderRadius: '10px' }}
                    />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                        {/* Play icon overlay if needed, but native controls are fine */}
                    </div>
                </div>
            );
        }

        // Handle Audio
        if (msg.OTYPE === 'AudioSendMessage') {
            return (
                <div key={idx} style={{ ...styles.textBubble, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🔊 語音訊息</span>
                    <audio controls src={msg.original_content_url} style={{ height: '30px', maxWidth: '150px' }} />
                </div>
            );
        }

        // Handle Flex
        if (msg.OTYPE === 'FlexSendMessage') {
            try {
                let content = msg.contents;
                if (typeof content === 'string') {
                    try {
                        content = JSON.parse(content);
                    } catch (e) {
                        return <div key={idx} style={{ ...styles.textBubble, color: 'red' }}>Invalid JSON</div>;
                    }
                }

                if (!content) {
                    return <div key={idx} style={styles.textBubble}>Flex 內容為空</div>;
                }

                if (content.type === 'carousel') {
                    if (!Array.isArray(content.contents)) {
                        return <div key={idx} style={styles.textBubble}>Invalid Carousel Format</div>;
                    }
                    return (
                        <div key={idx} style={styles.flexContainer}>
                            {content.contents.map((bubble, bIdx) => {
                                if (!bubble || typeof bubble !== 'object') return null;
                                const hero = bubble.hero || {};
                                const body = bubble.body || {};
                                const footer = bubble.footer || {};

                                const bodyContents = Array.isArray(body.contents) ? body.contents : [];
                                const footerContents = Array.isArray(footer.contents) ? footer.contents : [];

                                const titleObj = bodyContents.find(c => c && c.size === 'xl');
                                const title = titleObj?.text || '';
                                const desc = bodyContents.find(c => c && c.wrap === true && c !== titleObj)?.text || '';
                                const imageUrl = hero.url;

                                const buttons = footerContents.map(b => ({
                                    text: b?.action?.label || 'Button',
                                    action: b?.action?.type || 'message'
                                }));

                                return renderFlexCard({ imageUrl, title, description: desc, buttons }, bIdx);
                            })}
                        </div>
                    );
                } else if (content.type === 'bubble') {
                    const hero = content.hero || {};
                    const body = content.body || {};
                    const footer = content.footer || {};

                    const bodyContents = Array.isArray(body.contents) ? body.contents : [];
                    const footerContents = Array.isArray(footer.contents) ? footer.contents : [];

                    const titleObj = bodyContents.find(c => c && c.size === 'xl');
                    const title = titleObj?.text || '';
                    const desc = bodyContents.find(c => c && c.wrap === true && c !== titleObj)?.text || '';
                    const imageUrl = hero.url;
                    const buttons = footerContents.map(b => ({
                        text: b?.action?.label || 'Button',
                        action: b?.action?.type || 'message'
                    }));

                    return <div key={idx} style={styles.bubbleContainer}>{renderFlexCard({ imageUrl, title, description: desc, buttons }, 0)}</div>;
                } else {
                    return <div key={idx} style={styles.textBubble}>Unsupported Flex Type</div>;
                }
            } catch (err) {
                console.error("Flex preview rendering error:", err);
                return <div key={idx} style={{ ...styles.textBubble, color: 'red' }}>[渲染錯誤] 訊息結構損毀</div>;
            }
        }

        return <div key={idx} style={styles.textBubble}>[{msg.OTYPE}]</div>;
    };

    return (
        <div style={styles.container}>
            {steps.map((step, index) => (
                <div key={index} style={styles.bubbleRow}>
                    <div style={styles.avatar}><User size={24} color="#ccc" /></div>
                    <div style={styles.bubbleContainer}>
                        {step.delay && <div style={styles.delayLabel}>{step.delay}</div>}
                        <div style={styles.stepBadge}>{index + 1}</div>
                        {/* Step can be a wrapper of messages or a single message? 
                             The prompt implies steps in a journey. 
                             If `steps` is just a list of messages from the editor: */}
                        {renderMessage(step, 0)}
                    </div>
                </div>
            ))}
            {steps.length === 0 && <div style={{ textAlign: 'center', color: '#fff', marginTop: '20px' }}>預覽區域</div>}
        </div>
    );
};

export default JourneyPreview;
