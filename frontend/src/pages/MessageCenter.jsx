import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Send, User, Info, Search, Tag, X, Image as ImageIcon, Mic, Video, Smile, ArrowDown, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

function MessageCenter() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(false);

    // --- 搜尋與篩選狀態 ---
    const [searchQuery, setSearchQuery] = useState('');          // 用戶清單搜尋（user_id / 名稱）
    const [selectedTagFilters, setSelectedTagFilters] = useState([]); // 標籤篩選
    const [messageSearch, setMessageSearch] = useState('');       // 對話內容搜尋

    // 用來對 searchQuery 做 debounce，避免每一個字都打 API
    const searchTimer = useRef(null);

    useEffect(() => {
        setUsers([]);
        setSelectedUser(null);
        setMessages([]);
        setSearchQuery('');
        setSelectedTagFilters([]);
        setMessageSearch('');
        fetchUsers();
    }, [location.pathname]);

    useEffect(() => {
        if (selectedUser) {
            setMessages([]); // 切換用戶時立即清空舊訊息，避免畫面殘留與捲軸誤判
            fetchHistory(selectedUser);
            setMessageSearch(''); // 切換用戶時清除對話搜尋
        }
    }, [selectedUser]);

    // 當搜尋條件改變，debounce 後重新抓取用戶
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            fetchUsers(searchQuery, selectedTagFilters);
        }, 300);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [searchQuery, selectedTagFilters]);

    const fetchUsers = async (q = '', tags = []) => {
        try {
            const params = {};
            if (q) params.q = q;
            if (tags.length > 0) params.tag = tags.join(',');
            const resp = await api.get('/users', { params });
            setUsers(resp.data);
            if (resp.data.length > 0 && !selectedUser) {
                setSelectedUser(resp.data[0].user_id);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (userId, isPolling = false) => {
        try {
            const resp = await api.get(`/history/${userId}`);
            setMessages(resp.data);
            if (!isPolling) {
                api.post(`/users/${userId}/read`).then(() => {
                    // Update local unread count immediately
                    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, unread_count: 0 } : u));
                }).catch(e => console.error("Failed to mark as read", e));
            }
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    };

    // 自動更新：歷史訊息 7 秒一次，用戶清單 15 秒一次
    useEffect(() => {
        const historyInterval = setInterval(() => {
            if (selectedUser) {
                fetchHistory(selectedUser, true);
            }
        }, 7000);

        const usersInterval = setInterval(() => {
            // 只有在沒有特定搜尋時才自動更新清單內容，避免干擾使用者輸入
            if (!searchQuery) {
                fetchUsers(searchQuery, selectedTagFilters);
            }
        }, 15000);

        return () => {
            clearInterval(historyInterval);
            clearInterval(usersInterval);
        };
    }, [selectedUser, searchQuery, selectedTagFilters]);

    // 捲軸功能與新訊息偵測
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);
    const prevMessagesLengthRef = useRef(0);
    const userScrollPositionsRef = useRef({});

    const scrollToBottom = (smooth = true) => {
        if (chatContainerRef.current) {
            const { scrollHeight } = chatContainerRef.current;
            chatContainerRef.current.scrollTo({
                top: scrollHeight,
                behavior: smooth ? "smooth" : "auto"
            });
        }
        setIsAtBottom(true);
        setShowNewMsgBtn(false);
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const bottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsAtBottom(bottom);
        if (bottom) setShowNewMsgBtn(false);

        if (selectedUser && e.target && messages.length > 0) {
            // 記錄距離底部的距離，這樣圖片載入撐開高度時才不會讓畫面跳掉
            userScrollPositionsRef.current[selectedUser] = scrollHeight - scrollTop;
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            const isInitialLoad = prevMessagesLengthRef.current === 0;
            const hasNewMessages = messages.length > prevMessagesLengthRef.current;

            if (isInitialLoad) {
                const savedPos = userScrollPositionsRef.current[selectedUser];
                if (savedPos !== undefined && chatContainerRef.current) {
                    setTimeout(() => {
                        if (chatContainerRef.current) {
                            const { scrollHeight, clientHeight } = chatContainerRef.current;
                            chatContainerRef.current.scrollTop = scrollHeight - savedPos;
                            const newScrollTop = chatContainerRef.current.scrollTop;
                            setIsAtBottom(scrollHeight - newScrollTop - clientHeight < 150);
                        }
                    }, 50);
                } else {
                    setTimeout(() => scrollToBottom(false), 50);
                }
            } else if (isAtBottom && hasNewMessages) {
                setTimeout(() => scrollToBottom(true), 50);
            } else if (hasNewMessages) {
                setShowNewMsgBtn(true);
            }
            prevMessagesLengthRef.current = messages.length;
        } else {
            prevMessagesLengthRef.current = 0;
        }
    }, [messages]);

    useEffect(() => {
        prevMessagesLengthRef.current = 0;
        setIsAtBottom(true);
        setShowNewMsgBtn(false);
    }, [selectedUser]);

    const [availableTags, setAvailableTags] = useState([]);

    const fetchAvailableTags = async () => {
        try {
            const resp = await api.get('/tags');
            // 後端已經處理過一部分，但保險起見前端再做一次清理
            const tags = resp.data || [];
            setAvailableTags(tags);
        } catch (err) {
            console.error('Error fetching tags:', err);
        }
    };

    useEffect(() => {
        fetchAvailableTags();
    }, []);

    const sendMessage = async () => {
        if (!input.trim() || !selectedUser) return;
        try {
            setLoading(true);
            await api.post('/trigger', {
                user: selectedUser,
                message: `MSG|${input}`,
                type: 'Sensor',
                api_index: 0
            });
            setMessages([...messages, { content: input, timestamp: new Date(), category: 'Message', user_id: 'yzuadmin' }]);
            setInput('');
        } catch (err) {
            showToast('發送失敗: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = async () => {
        if (!tagInput.trim() || !selectedUser) return;
        try {
            await api.post('/trigger', {
                user: selectedUser,
                message: `set_tag|${tagInput}`,
                type: 'Sensor',
                api_index: 0
            });
            showToast(`已新增標籤: ${tagInput}`, 'success');
            setTagInput('');
            // Update local state immediately for better UX
            setUsers(prev => prev.map(u => u.user_id === selectedUser ? {
                ...u,
                tags: u.tags ? (typeof u.tags === 'string' ? (u.tags.includes('|') ? `${u.tags}|${tagInput}` : `${u.tags},${tagInput}`) : [...u.tags, tagInput]) : tagInput
            } : u));
            setTimeout(() => {
                fetchUsers(searchQuery, selectedTagFilters);
                fetchAvailableTags();
            }, 1000);
        } catch (err) {
            showToast('新增標籤失敗', 'error');
        }
    };

    const handleDeleteTag = async (tagName) => {
        if (!selectedUser) return;
        if (!window.confirm(`確定要刪除標籤 [${tagName}] 嗎？`)) return;
        try {
            await api.post('/trigger', {
                user: selectedUser,
                message: `del_tag|${tagName}`,
                type: 'Sensor',
                api_index: 0
            });
            showToast(`已刪除標籤: ${tagName}`, 'success');
            // Update local state immediately
            setUsers(prev => prev.map(u => {
                if (u.user_id === selectedUser) {
                    const currentTags = getCurrentUserTags(u);
                    const newTags = currentTags.filter(t => t !== tagName).join('|');
                    return { ...u, tags: newTags };
                }
                return u;
            }));
            setTimeout(() => fetchUsers(searchQuery, selectedTagFilters), 1000);
        } catch (err) {
            alert('刪除標籤失敗');
        }
    };

    const getCurrentUserTags = (userObj) => {
        const user = userObj || users.find(u => u.user_id === selectedUser);
        if (!user || !user.tags) return [];

        let tagsInput = user.tags;
        let tagList = [];

        // 處理分割符 |
        const rawParts = typeof tagsInput === 'string' ? tagsInput.split('|') : [tagsInput];

        rawParts.forEach(part => {
            if (!part) return;
            let trimmed = String(part).trim();

            // 處理 ['A', 'B'] 這種字串
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                // 移除前後方括號，然後依照逗號分割
                const inner = trimmed.substring(1, trimmed.length - 1);
                // 處理逗號分割並移除引號
                inner.split(',').forEach(s => {
                    const s_clean = s.trim().replace(/^['"]|['"]$/g, '');
                    if (s_clean) tagList.push(s_clean);
                });
            } else if (trimmed.includes(',')) {
                trimmed.split(',').forEach(s => {
                    const s_clean = s.trim().replace(/^['"]|['"]$/g, '');
                    if (s_clean) tagList.push(s_clean);
                });
            } else {
                tagList.push(trimmed.replace(/^['"]|['"]$/g, ''));
            }
        });

        // 最終清理與去重
        const uniqueTags = [...new Set(tagList.map(t => String(t).trim()).filter(t => t && t !== 'null' && t !== 'undefined' && t !== '[]' && t !== '{}'))];
        return uniqueTags;
    };

    // 輔助函式：提取訊息的可搜尋文本（解決 JSON Unicode 編碼問題）
    const getSearchableText = (m) => {
        let content = m.content || '';
        if (typeof content !== 'string') return '';

        // 如果是 sys_reply 類別，通常是 JSON
        if (m.category === 'sys_reply') {
            try {
                const parsed = JSON.parse(content);
                if (parsed.type === 'text') return parsed.text || '';
                if (parsed.altText) return parsed.altText;
                // 如果是 Flex 訊息，嘗試抓取 body 內容
                if (parsed.type === 'flex' && parsed.contents) {
                    const bubble = parsed.contents.type === 'carousel' ? parsed.contents.contents[0] : parsed.contents;
                    const body = bubble?.body?.contents || [];
                    return body.map(c => c.text || '').join(' ') || (parsed.altText || '');
                }
            } catch (e) {
                // 解析失敗則回傳原文
            }
        }

        // 移除 MSG| 前綴
        if (content.startsWith('MSG|')) return content.substring(4);

        return content;
    };

    // 聊天室中實際顯示的訊息（過濾掉系統指令與 follow 事件，但不因搜尋而隱藏）
    const displayedMessages = messages.filter(m => {
        if (m.category === 'Sensor' || m.category === 'Postback' || m.category === 'Follow' || m.category === 'follow') return false;
        return true;
    });

    // 搜尋結果列表
    const searchResults = messageSearch.trim() ? displayedMessages.filter(m => {
        const text = getSearchableText(m);
        const search = messageSearch.toLowerCase();
        return text.toLowerCase().includes(search) || (m.content || '').toLowerCase().includes(search);
    }) : [];

    // 跳轉到訊息
    const jumpToMessage = (index) => {
        const element = document.getElementById(`msg-${index}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 閃爍效果
            element.style.transition = 'background-color 0.3s';
            const originalBg = element.style.backgroundColor;
            element.style.backgroundColor = 'rgba(255, 215, 0, 0.5)';
            setTimeout(() => {
                element.style.backgroundColor = originalBg;
            }, 1000);
        }
    };

    // 輔助函式：高亮搜尋文本
    const highlightText = (text) => {
        if (!messageSearch.trim() || !text) return text;
        const parts = String(text).split(new RegExp(`(${messageSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => (
                    part.toLowerCase() === messageSearch.toLowerCase() ?
                        <mark key={i} style={{ backgroundColor: 'rgba(255, 215, 0, 0.6)', color: 'black', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> :
                        part
                ))}
            </span>
        );
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '20px' }}>
            {/* User Sidebar */}
            <div className="card" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '15px' }}>
                {/* 搜尋框 */}
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="搜尋用戶 ID 或名稱..."
                        style={{ width: '100%', paddingLeft: '35px', paddingRight: searchQuery ? '32px' : '12px', boxSizing: 'border-box' }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* 標籤篩選區 */}
                {availableTags.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Tag size={11} /> 標籤篩選
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            <span
                                onClick={() => setSelectedTagFilters([])}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedTagFilters.length === 0 ? 'var(--primary-yellow)' : 'transparent',
                                    color: selectedTagFilters.length === 0 ? 'black' : '#aaa',
                                    border: `1px solid ${selectedTagFilters.length === 0 ? 'var(--primary-yellow)' : '#555'}`,
                                    transition: 'all 0.15s'
                                }}
                            >全部</span>
                            {availableTags.map((tag, idx) => (
                                <span
                                    key={idx}
                                    onClick={() => {
                                        if (selectedTagFilters.includes(tag)) {
                                            setSelectedTagFilters(selectedTagFilters.filter(t => t !== tag));
                                        } else {
                                            setSelectedTagFilters([...selectedTagFilters, tag]);
                                        }
                                    }}
                                    style={{
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        backgroundColor: selectedTagFilters.includes(tag) ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                                        color: selectedTagFilters.includes(tag) ? 'var(--primary-yellow)' : '#aaa',
                                        border: `1px solid ${selectedTagFilters.includes(tag) ? 'var(--primary-yellow)' : '#555'}`,
                                        transition: 'all 0.15s'
                                    }}
                                >{tag}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* 用戶清單 */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading && users.length === 0 ? (
                        <LoadingSpinner message="載入用戶中..." />
                    ) : users.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                            {searchQuery || selectedTagFilters.length > 0 ? '找不到符合的用戶' : '尚無用戶'}
                        </div>
                    ) : (
                        users.map(u => {
                            const userTags = getCurrentUserTags(u);
                            const unreadCount = parseInt(u.unread_count || '0');
                            return (
                                <div
                                    key={u.user_id}
                                    onClick={() => setSelectedUser(u.user_id)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        backgroundColor: selectedUser === u.user_id ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                                        border: selectedUser === u.user_id ? '1px solid var(--primary-yellow)' : '1px solid transparent',
                                        position: 'relative'
                                    }}
                                >
                                    {unreadCount > 0 && selectedUser !== u.user_id && (
                                        <div style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '12px',
                                            backgroundColor: '#ff4d4f',
                                            color: 'white',
                                            borderRadius: '10px',
                                            padding: '1px 6px',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            minWidth: '18px',
                                            textAlign: 'center',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ backgroundColor: '#333', padding: '8px', borderRadius: '50%', flexShrink: 0 }}>
                                            <User size={18} />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <p style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || u.user_id}</p>
                                            {u.name && (
                                                <p style={{ fontSize: '11px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.user_id}</p>
                                            )}
                                            <p style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.last_message || '尚無訊息'}</p>
                                            {userTags.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                                                    {userTags.slice(0, 3).map((t, i) => (
                                                        <span key={i} style={{ fontSize: '10px', color: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)', padding: '1px 6px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.2)' }}>
                                                            {t}
                                                        </span>
                                                    ))}
                                                    {userTags.length > 3 && (
                                                        <span style={{ fontSize: '10px', color: '#666' }}>+{userTags.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', position: 'relative' }}>
                {selectedUser ? (
                    <>
                        {/* 延遲提醒 */}
                        <div style={{
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                            borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                            padding: '8px 20px',
                            color: 'var(--primary-yellow)',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Info size={14} /> 新訊息將於 5-10 秒鐘延遲收到
                        </div>

                        {/* 聊天室 Header：用戶名 + 標籤 + 新增標籤 */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', marginBottom: '5px' }}>{users.find(u => u.user_id === selectedUser)?.name || selectedUser}</h3>
                                {users.find(u => u.user_id === selectedUser)?.name && (
                                    <p style={{ fontSize: '12px', color: '#555', marginBottom: '5px' }}>{selectedUser}</p>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                    {getCurrentUserTags().map((t, i) => (
                                        <span key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            backgroundColor: '#333',
                                            color: '#FFD700',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            border: '1px solid rgba(255, 215, 0, 0.3)'
                                        }}>
                                            {t}
                                            <button
                                                onClick={() => handleDeleteTag(t)}
                                                style={{ background: 'none', border: 'none', color: '#ff4d4f', padding: '0', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                                            >×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <input
                                    list="available-tags"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    placeholder="選擇或輸入標籤..."
                                    style={{ width: '200px', padding: '6px 12px', fontSize: '12px' }}
                                />
                                <datalist id="available-tags">
                                    {availableTags.map((tag, idx) => (
                                        <option key={idx} value={tag} />
                                    ))}
                                </datalist>
                                <button
                                    onClick={handleAddTag}
                                    style={{ padding: '6px 15px', fontSize: '12px', backgroundColor: 'var(--primary-yellow)', color: 'black' }}
                                >
                                    新增
                                </button>
                            </div>
                        </div>

                        {/* 對話內容搜尋框 */}
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #222', backgroundColor: '#1a1a1a', position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                                <input
                                    value={messageSearch}
                                    onChange={e => setMessageSearch(e.target.value)}
                                    placeholder="搜尋對話內容..."
                                    style={{ width: '100%', paddingLeft: '30px', paddingRight: messageSearch ? '30px' : '10px', fontSize: '13px', padding: '6px 10px 6px 30px', boxSizing: 'border-box', backgroundColor: '#252525', border: '1px solid #333', borderRadius: '6px', color: 'inherit' }}
                                />
                                {messageSearch && (
                                    <button
                                        onClick={() => setMessageSearch('')}
                                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {messageSearch && (
                                <>
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                        找到 {searchResults.length} 筆符合的訊息
                                    </div>
                                    {searchResults.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: '20px',
                                            right: '20px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            backgroundColor: '#222',
                                            border: '1px solid #333',
                                            borderRadius: '0 0 8px 8px',
                                            zIndex: 50,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                        }}>
                                            {searchResults.map((m, idx) => {
                                                const globalIndex = messages.indexOf(m);
                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => jumpToMessage(globalIndex)}
                                                        style={{
                                                            padding: '8px 12px',
                                                            borderBottom: '1px solid #333',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            transition: 'background-color 0.1s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#333'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                            <span style={{ color: m.user_id === 'yzuadmin' ? 'var(--primary-yellow)' : '#aaa' }}>
                                                                {m.user_id === 'yzuadmin' ? '管理者' : '用戶'}
                                                            </span>
                                                            <span style={{ color: '#555', fontSize: '10px' }}>{new Date(m.timestamp).toLocaleString()}</span>
                                                        </div>
                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#eee' }}>
                                                            {getSearchableText(m)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 訊息列表 */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}
                        >
                            {(() => {
                                let lastDate = null;
                                return displayedMessages.map((m, i) => {
                                    const mDate = new Date(m.timestamp).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
                                    const showDateHeader = mDate !== lastDate;
                                    lastDate = mDate;

                                    const isAdmin = m.user_id === 'yzuadmin' || m.category === 'Response' || m.category === 'sys_reply';
                                    let displayContent = m.content;
                                    if (isAdmin && typeof displayContent === 'string' && displayContent.startsWith('MSG|')) {
                                        displayContent = displayContent.substring(4);
                                    }

                                    const globalIndex = messages.indexOf(m);
                                    // ...

                                    // 內部元件：處理帶有 Token 的圖片載入
                                    const AuthenticatedImage = ({ src, alt, style, onClick }) => {
                                        const [imgUrl, setImgUrl] = useState(null);
                                        const [error, setError] = useState(false);
                                        const [retryCount, setRetryCount] = useState(0);

                                        useEffect(() => {
                                            let isMounted = true;
                                            setError(false);

                                            api.get(src, { responseType: 'blob', timeout: 10000 })
                                                .then(response => {
                                                    if (isMounted) {
                                                        const url = URL.createObjectURL(response.data);
                                                        setImgUrl(url);
                                                    }
                                                })
                                                .catch(err => {
                                                    console.error("Failed to load authenticated image:", err);
                                                    if (isMounted) {
                                                        setError(true);
                                                        // 自動重試一次
                                                        if (retryCount < 1) {
                                                            setTimeout(() => setRetryCount(c => c + 1), 2000);
                                                        }
                                                    }
                                                });
                                            return () => {
                                                isMounted = false;
                                                // 這裡不立即 revoke，交給下一次 effect 或元件卸載處理，避免閃爍或載入中斷
                                            };
                                        }, [src, retryCount]);

                                        // 卸載時清理
                                        useEffect(() => {
                                            return () => {
                                                if (imgUrl) URL.revokeObjectURL(imgUrl);
                                            };
                                        }, [imgUrl]);

                                        if (error && retryCount >= 1) return (
                                            <div style={{ ...style, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', color: '#888', padding: '10px' }}>
                                                <ImageIcon size={20} />
                                                <div style={{ fontSize: '10px', marginTop: '5px' }}>圖片載入失敗</div>
                                                <button onClick={() => setRetryCount(0)} style={{ fontSize: '10px', marginTop: '5px', padding: '2px 8px' }}>重試</button>
                                            </div>
                                        );

                                        if (!imgUrl) return <div style={{ ...style, width: '150px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', color: '#666', fontSize: '10px' }}>載入中...</div>;
                                        return <img src={imgUrl} alt={alt} style={style} onClick={onClick} />;
                                    };

                                    const renderMessageContent = () => {
                                        if (m.category === 'Image') {
                                            const imageUrl = `/line/content/${m.content}`;
                                            return (
                                                <AuthenticatedImage
                                                    src={imageUrl}
                                                    style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                                                    onClick={() => {
                                                        api.get(imageUrl, { responseType: 'blob' }).then(res => {
                                                            const url = URL.createObjectURL(res.data);
                                                            window.open(url, '_blank');
                                                        });
                                                    }}
                                                    alt="Line Image"
                                                />
                                            );
                                        }
                                        if (m.category === 'Audio') return <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'inherit' }}><Mic size={16} /> [語音訊息]</div>;
                                        if (m.category === 'Video') return <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'inherit' }}><Video size={16} /> [影片訊息]</div>;
                                        if (m.category === 'Sticker') {
                                            try {
                                                // Handle content like '{"packageId": "1", "stickerId": "1"}' or just ID
                                                const match = m.content.match(/"stickerId":\s*"(\d+)"/);
                                                const stickerId = match ? match[1] : (m.content.match(/^\d+$/) ? m.content : null);
                                                if (stickerId) return <img src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`} style={{ width: '120px' }} alt="Sticker" />;
                                            } catch (e) { }
                                            return <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'inherit' }}><Smile size={16} /> [貼圖訊息]</div>;
                                        }

                                        if (m.category === 'sys_reply') {
                                            try {
                                                const parsed = JSON.parse(m.content);
                                                if (parsed.type === 'text' && parsed.text) return highlightText(parsed.text);
                                                if (parsed.type === 'image') return (
                                                    <img src={parsed.previewImageUrl || parsed.originalContentUrl} style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(parsed.originalContentUrl, '_blank')} />
                                                );
                                                if (parsed.type === 'video') return (
                                                    <div style={{ maxWidth: '200px' }}>
                                                        <video src={parsed.originalContentUrl} controls poster={parsed.previewImageUrl} style={{ width: '100%', borderRadius: '8px' }} />
                                                    </div>
                                                );
                                                if (parsed.type === 'audio') return (
                                                    <audio controls src={parsed.originalContentUrl} style={{ maxWidth: '200px' }} />
                                                );
                                                if (parsed.type === 'flex' && parsed.contents) {
                                                    const renderFlexBubble = (bubble) => {
                                                        const hero = bubble.hero || {};
                                                        const body = bubble.body || {};
                                                        const title = body.contents?.find(c => c.size === 'xl' || c.weight === 'bold')?.text || bubble.altText || 'Flex Message';
                                                        const imageUrl = hero.url;
                                                        return (
                                                            <div style={{ backgroundColor: '#fff', color: '#000', borderRadius: '8px', overflow: 'hidden', width: '200px', fontSize: '12px' }}>
                                                                {imageUrl && <img src={imageUrl} style={{ width: '100%', height: '100px', objectFit: 'cover' }} />}
                                                                <div style={{ padding: '8px' }}>
                                                                    {title && <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>}
                                                                    <div style={{ color: '#666' }}>[Flex 訊息]</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    };

                                                    if (parsed.contents.type === 'carousel') {
                                                        return (
                                                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', maxWidth: '300px' }}>
                                                                {parsed.contents.contents.map((b, idx) => (
                                                                    <div key={idx} style={{ flexShrink: 0 }}>{renderFlexBubble(b)}</div>
                                                                ))}
                                                            </div>
                                                        );
                                                    } else {
                                                        return renderFlexBubble(parsed.contents);
                                                    }
                                                }
                                                return `[${parsed.type}]`;
                                            } catch (e) { return highlightText(m.content); }
                                        }
                                        return highlightText(displayContent);
                                    };

                                    return (
                                        <React.Fragment key={i}>
                                            {showDateHeader && (
                                                <div style={{ textAlign: 'center', margin: '20px 0', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: '#333', zIndex: 0 }}></div>
                                                    <span style={{ backgroundColor: '#1a1a1a', padding: '4px 15px', color: '#888', fontSize: '12px', position: 'relative', zIndex: 1, borderRadius: '12px' }}>{mDate}</span>
                                                </div>
                                            )}
                                            <div id={`msg-${globalIndex}`} style={{
                                                alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                                                maxWidth: '70%',
                                                padding: '12px 16px',
                                                borderRadius: '16px',
                                                backgroundColor: isAdmin ? 'var(--primary-yellow)' : '#333',
                                                color: isAdmin ? 'black' : 'white',
                                            }}>
                                                <div style={{ fontSize: '14px' }}>
                                                    {renderMessageContent()}
                                                </div>
                                                <p style={{ fontSize: '10px', marginTop: '5px', opacity: 0.6 }}>{new Date(m.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()}
                            <div ref={messagesEndRef} />
                        </div>

                        {showNewMsgBtn && (
                            <button
                                onClick={scrollToBottom}
                                style={{
                                    position: 'absolute',
                                    bottom: '90px',
                                    right: '30px',
                                    backgroundColor: 'var(--primary-yellow)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '20px',
                                    padding: '8px 15px',
                                    fontSize: '12px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <ArrowDown size={14} /> 有新訊息
                            </button>
                        )}

                        {/* 訊息輸入框 */}
                        <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', gap: '15px' }}>
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                                placeholder="輸入訊息..."
                                style={{ flex: 1 }}
                            />
                            <button
                                onClick={sendMessage}
                                className="primary"
                                style={{ padding: '0 25px' }}
                                disabled={loading}
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                        請選擇一個用戶開始對話
                    </div>
                )}
            </div>
        </div>
    );
}

export default MessageCenter;
