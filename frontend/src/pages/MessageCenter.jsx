import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Send, User, Info, Search, Tag, X, Image as ImageIcon, Mic, Video, Smile, ArrowDown, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { CircularProgress } from '@mui/material';

// 內部元件：處理帶有 Token 的圖片載入
const AuthenticatedImage = ({ src, alt, style, onClick, onLoad }) => {
    const [imgUrl, setImgUrl] = useState(null);
    const [error, setError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setError(false);
        setIsLoaded(false);

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
                    if (retryCount < 1) {
                        setTimeout(() => setRetryCount(c => c + 1), 2000);
                    }
                }
            });
        return () => {
            isMounted = false;
        };
    }, [src, retryCount]);

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

    const handleImgLoad = () => {
        setIsLoaded(true);
        if (onLoad) onLoad();
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {(!imgUrl || !isLoaded) && (
                <div style={{ ...style, width: '150px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', color: '#666', fontSize: '10px' }}>
                    載入中...
                </div>
            )}
            {imgUrl && (
                <img
                    src={imgUrl}
                    alt={alt}
                    style={{ ...style, display: isLoaded ? 'block' : 'none' }}
                    onLoad={handleImgLoad}
                    onClick={onClick}
                />
            )}
        </div>
    );
};

const LazyImage = ({ src, alt, style, onLoad, onClick }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {!isLoaded && (
                <div style={{ ...style, width: style.width || '120px', height: style.height || '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', color: '#666', fontSize: '10px', borderRadius: style.borderRadius || '0' }}>
                    載入中...
                </div>
            )}
            <img
                src={src}
                alt={alt}
                style={{ ...style, display: isLoaded ? 'block' : 'none' }}
                onLoad={() => {
                    setIsLoaded(true);
                    if (onLoad) onLoad();
                }}
                onClick={onClick}
            />
        </div>
    );
};

class MessageCenterErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("MessageCenter Error caught by Boundary:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', backgroundColor: '#222', color: 'red', height: '100%', overflow: 'auto' }}>
                    <h2>⚠️ 訊息中心畫面崩潰 (React Crash)</h2>
                    <p>請將以下紅色錯誤文字完整截圖或複製給工程師：</p>
                    <pre style={{ backgroundColor: '#111', padding: '15px', color: '#ff4d4d', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br/><br/>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        重新載入畫面
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function MessageCenter() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const selectedUserRef = useRef(null);
    const messagesCacheRef = useRef({});
    const [messages, _setMessages] = useState([]);
    
    const setMessages = React.useCallback((action) => {
        _setMessages(prev => {
            const nextMsg = typeof action === 'function' ? action(prev) : action;
            if (selectedUserRef.current && Array.isArray(nextMsg) && nextMsg.length > 0) {
                messagesCacheRef.current[selectedUserRef.current] = nextMsg;
            }
            return nextMsg;
        });
    }, []);

    const [input, setInput] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingChat, setLoadingChat] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const fullHistoryLoadedRef = useRef(false);
    const { showToast } = useToast();
    const lastSendTimeRef = useRef(0);
    const [isSending, setIsSending] = useState(false);
    const isSendingRef = useRef(false);

    // --- 搜尋與篩選狀態 ---
    const [searchQuery, setSearchQuery] = useState('');          // 用戶清單搜尋（user_id / 名稱）
    const [selectedTagFilters, setSelectedTagFilters] = useState([]); // 標籤篩選
    const [messageSearch, setMessageSearch] = useState('');       // 對話內容搜尋
    const [fetchUsersInterval, setFetchUsersInterval] = useState(15000); // 用戶列表抓取間隔
    const [sidebarDisplayCount, setSidebarDisplayCount] = useState(15); // 側邊欄視覺分頁：一次顯示的用戶數
    const [localUnreadCounts, setLocalUnreadCounts] = useState(() => {
        const saved = localStorage.getItem('localUnreadCounts');
        return saved ? JSON.parse(saved) : {};
    });

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
        selectedUserRef.current = selectedUser;
        if (selectedUser) {
            setLoadingChat(true);

            // 預置捲軸狀態，防止舊用戶的「置底」狀態干擾新用戶的記憶位置恢復
            const savedScroll = userScrollPositionsRef.current[selectedUser];
            const wasAtBottom = !savedScroll || savedScroll.distanceFromBottom < 200;
            setIsAtBottom(wasAtBottom);
            isAtBottomRef.current = wasAtBottom;

            const cachedMessages = messagesCacheRef.current[selectedUser];

            if (cachedMessages && cachedMessages.length > 0) {
                // 如果快取命中，瞬間載入畫面
                setMessages(cachedMessages);
                setLoadingChat(false);
                fullHistoryLoadedRef.current = false;
                
                // 標記已讀
                api.post(`/users/${selectedUser}/read`).then(() => {
                    setUsers(prev => prev.map(u => u.user_id === selectedUser ? { ...u, unread_count: 0 } : u));
                }).catch(e => console.error("Failed to mark as read", e));
                
                // 註：這時候不用呼叫 fetchHistory(selectedUser)，因為背景每秒輪詢機制
                // 會立刻利用這個 cachedMessages 裡最新的 timestamp，自動透過 `after=...` 補齊這段期間的新訊息
            } else {
                setMessages([]); // 切換用戶時立即清空舊訊息，避免畫面殘留與捲軸誤判
                fetchHistory(selectedUser);
                fullHistoryLoadedRef.current = false; // 重置全量載入狀態
            }

            setMessageSearch(''); // 切換用戶時清除對話搜尋
        }
    }, [selectedUser]);

    // 當搜尋條件改變，debounce 後重新抓取用戶，並重置側邊欄顯示數量
    useEffect(() => {
        setSidebarDisplayCount(15); // 搜尋條件變動時重置
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
            const newUsers = resp.data;
            
            // 預先寫入最新 10 筆歷史訊息的快取，確保點擊時瞬間載入
            newUsers.forEach(u => {
                if (u.recent_messages && Array.isArray(u.recent_messages) && !messagesCacheRef.current[u.user_id]) {
                    messagesCacheRef.current[u.user_id] = [...u.recent_messages].reverse();
                }
            });

            setLocalUnreadCounts(prev => {
                const newCounts = { ...prev };
                const cachedTimes = JSON.parse(localStorage.getItem('user_last_times') || '{}');
                let countsChanged = false;

                newUsers.forEach(u => {
                    if (u.user_id === selectedUser) {
                        if (newCounts[u.user_id] !== 0) {
                            newCounts[u.user_id] = 0;
                            countsChanged = true;
                        }
                        cachedTimes[u.user_id] = u.last_time;
                    } else if (u.last_time && cachedTimes[u.user_id] !== u.last_time) {
                        if (new Date(u.last_time) > new Date(cachedTimes[u.user_id] || 0)) {
                            newCounts[u.user_id] = (newCounts[u.user_id] || 0) + 1;
                        }
                        cachedTimes[u.user_id] = u.last_time;
                        countsChanged = true;
                    }
                });

                if (countsChanged) {
                    localStorage.setItem('localUnreadCounts', JSON.stringify(newCounts));
                    localStorage.setItem('user_last_times', JSON.stringify(cachedTimes));
                    return newCounts;
                }
                return prev;
            });
            setUsers(newUsers);
            if (newUsers.length > 0 && !selectedUserRef.current) {
                setSelectedUser(newUsers[0].user_id);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
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

    // --- 輔助：格式化側邊欄的最後一則訊息 ---
    const formatSidebarMessage = (userObj) => {
        const msgString = userObj.last_message;
        const category = userObj.last_message_category;

        if (category === 'Image') return '[圖片訊息]';
        if (category === 'Video') return '[影片訊息]';
        if (category === 'Audio') return '[語音訊息]';

        if (!msgString) return '';
        try {
            const parsed = JSON.parse(msgString);
            if (parsed && typeof parsed === 'object' && parsed.type) {
                switch (parsed.type) {
                    case 'text': return parsed.text || '[文字訊息]';
                    case 'image': return '[圖片訊息]';
                    case 'video': return '[影片訊息]';
                    case 'audio': return '[語音訊息]';
                    case 'location': return '[位置訊息]';
                    case 'sticker': return '[貼圖訊息]';
                    case 'flex': return '[Flex 訊息]';
                    case 'template': return '[樣板訊息]';
                    case 'carousel': return '[輪播訊息]';
                    case 'imagemap': return '[圖片選單]';
                    default: return `[${parsed.type}]`;
                }
            }
        } catch (e) {
            // 解析失敗，非 JSON 格式
        }
        if (typeof msgString === 'string') {
            if (msgString.startsWith('MSG|')) return msgString.substring(4);
            // 舊版 `formatSidebarMessage` 已經整合移至頂部，因為它跟 fetchHistory 在相近的範疇，以下原本重複的即被移除
        }
        return msgString;
    };

    const abortControllerRef = useRef(null);
    const layoutRef = useRef({ scrollHeight: 0, scrollTop: 0, isUpdatingHistory: false });

    // 處理向上加載歷史訊息後的捲軸位置回復
    React.useLayoutEffect(() => {
        if (layoutRef.current.isUpdatingHistory && chatContainerRef.current) {
            const { scrollHeight: prevScrollHeight, scrollTop: prevScrollTop } = layoutRef.current;
            const currentScrollHeight = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = prevScrollTop + (currentScrollHeight - prevScrollHeight);
            layoutRef.current.isUpdatingHistory = false;
        }
    }, [messages]);

    const fetchHistory = async (userId, isPolling = false) => {
        try {
            if (!isPolling) {
                if (abortControllerRef.current) abortControllerRef.current.abort();
                abortControllerRef.current = new AbortController();
            }

            const signal = isPolling ? undefined : abortControllerRef.current.signal;

            if (isPolling) {
                // 增量式輪詢：只抓最新一筆之後的新訊息
                const latestTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : null;
                if (!latestTimestamp) return;

                const resp = await api.get(`/history/${userId}`, {
                    params: { after: latestTimestamp }
                });

                if (selectedUserRef.current === userId && Array.isArray(resp.data) && resp.data.length > 0) {
                    setMessages(prev => {
                        const existingKeys = new Set(prev.map(m => m.timestamp + m.content));
                        const uniqueNew = resp.data.filter(m => m && m.timestamp && !existingKeys.has(m.timestamp + m.content));
                        if (uniqueNew.length > 0) {
                            return [...prev, ...uniqueNew];
                        }
                        return prev;
                    });
                }
                return;
            }

            // 初次載入：只抓最新 50 筆（不再發第二次全撈）
            const resp = await api.get(`/history/${userId}?limit=50`, { signal });
            if (selectedUserRef.current === userId) {
                const loadedMessages = Array.isArray(resp.data) ? resp.data : [];
                setMessages(loadedMessages);
                setHasMoreHistory(loadedMessages.length >= 50); // 如果不足 50 筆代表已無更舊的訊息
                setLoadingChat(false);
            }

            // 標記已讀
            api.post(`/users/${userId}/read`).then(() => {
                setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, unread_count: 0 } : u));
            }).catch(e => console.error("Failed to mark as read", e));
        } catch (error) {
            if (error.name !== 'CanceledError') {
                console.error('Error fetching history:', error);
                setLoadingChat(false); // 確保出錯時也會關閉載入中狀態
            }
        }
    };

    // 向上滾動時載入更舊的訊息
    const loadOlderMessages = async () => {
        if (loadingOlder || !hasMoreHistory || !selectedUser || messages.length === 0) return;
        setLoadingOlder(true);
        try {
            const oldestTimestamp = messages[0]?.timestamp;
            if (!oldestTimestamp) {
                setHasMoreHistory(false);
                return;
            }

            const resp = await api.get(`/history/${selectedUser}`, {
                params: { limit: 50, before: oldestTimestamp }
            });

            const newMessages = Array.isArray(resp.data) ? resp.data : [];

            if (selectedUserRef.current === selectedUser && newMessages.length > 0) {
                setMessages(prev => {
                    // 過濾掉可能重複的訊息，確保穩定陣列與避免型別錯誤
                    const existingKeys = new Set(prev.map(m => m.timestamp + m.content));
                    const uniqueNew = newMessages.filter(m => m && m.timestamp && !existingKeys.has(m.timestamp + m.content));
                    
                    if (uniqueNew.length > 0) {
                        // 記錄當前捲軸位置，以便插入舊訊息後保持瀏覽位置
                        if (chatContainerRef.current) {
                            layoutRef.current.scrollHeight = chatContainerRef.current.scrollHeight;
                            layoutRef.current.scrollTop = chatContainerRef.current.scrollTop;
                            layoutRef.current.isUpdatingHistory = true;
                        }
                        return [...uniqueNew, ...prev];
                    }
                    return prev;
                });
            }
            if (!Array.isArray(resp.data) || resp.data.length < 50) {
                setHasMoreHistory(false);
            }
        } catch (error) {
            console.error('Error loading older messages:', error);
            setHasMoreHistory(false);
        } finally {
            setLoadingOlder(false);
        }
    };

    // --- 全部已讀 ---
    const handleMarkAllRead = () => {
        const now = new Date().toISOString();
        users.forEach(u => {
            localStorage.setItem(`lastRead_${u.user_id}`, now);
        });
        setLocalUnreadCounts({});
        localStorage.setItem('localUnreadCounts', '{}');
        // 強制重新渲染排序
        setFetchUsersInterval(100); // 縮短下次抓取時間來觸發更新
        setTimeout(() => setFetchUsersInterval(15000), 1000);
    };

    // --- 輔助：未讀判斷 (基於本地快取的最後讀取時間) ---
    const isUserUnread = (user) => {
        if (!user.last_time) return false;
        if (selectedUser === user.user_id) return false;

        const lastReadTime = localStorage.getItem(`lastRead_${user.user_id}`);
        if (!lastReadTime) return true; // 從未讀取過，視為未讀

        return new Date(user.last_time) > new Date(lastReadTime);
    };

    // 搜尋時全撈完整歷史紀錄（確保搜尋能覆蓋所有訊息）
    const loadFullHistory = async () => {
        if (fullHistoryLoadedRef.current || !selectedUserRef.current) return;
        fullHistoryLoadedRef.current = true;
        try {
            const currentUserId = selectedUserRef.current;
            const resp = await api.get(`/history/${currentUserId}`);
            if (selectedUserRef.current === currentUserId) {
                const fullMessages = Array.isArray(resp.data) ? resp.data : [];
                setMessages(fullMessages);
                setHasMoreHistory(false);
            }
        } catch (error) {
            console.error('Error loading full history:', error);
            fullHistoryLoadedRef.current = false; // 失敗時允許重試
        }
    };

    // --- 輔助：排序後的用戶清單 (未讀優先) ---
    const sortedUsers = React.useMemo(() => {
        return [...users].sort((a, b) => {
            const aUnread = isUserUnread(a);
            const bUnread = isUserUnread(b);
            if (aUnread && !bUnread) return -1;
            if (!aUnread && bUnread) return 1;

            // 否則維持原本的時間排序
            const aTime = new Date(a.last_time || 0);
            const bTime = new Date(b.last_time || 0);
            return bTime - aTime;
        });
    }, [users, selectedUser]);

    // 更新讀取時間
    useEffect(() => {
        if (selectedUser) {
            localStorage.setItem(`lastRead_${selectedUser}`, new Date().toISOString());
            setLocalUnreadCounts(prev => {
                if (prev[selectedUser] === 0) return prev;
                const updated = { ...prev, [selectedUser]: 0 };
                localStorage.setItem('localUnreadCounts', JSON.stringify(updated));
                return updated;
            });
        }
    }, [selectedUser, messages]);

    // 自動更新：歷史訊息 1 秒一次，用戶清單 15 秒一次
    useEffect(() => {
        const historyInterval = setInterval(() => {
            if (selectedUser && (Date.now() - lastSendTimeRef.current > 2000)) {
                fetchHistory(selectedUser, true);
            }
        }, 1000);

        const usersInterval = setInterval(() => {
            // 只有在沒有特定搜尋時才自動更新清單內容，避免干擾使用者輸入
            if (!searchQuery) {
                fetchUsers(searchQuery, selectedTagFilters);
            }
        }, fetchUsersInterval);

        return () => {
            clearInterval(historyInterval);
            clearInterval(usersInterval);
        };
    }, [selectedUser, searchQuery, selectedTagFilters, fetchUsersInterval]);

    // 捲軸功能與新訊息偵測
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const isAtBottomRef = useRef(true);
    const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);
    const prevMessagesLengthRef = useRef(0);
    const userScrollPositionsRef = useRef({});
    const isRestoringRef = useRef(false);

    const scrollToBottom = (smooth = true) => {
        if (chatContainerRef.current) {
            const { scrollHeight } = chatContainerRef.current;
            chatContainerRef.current.scrollTo({
                top: scrollHeight,
                behavior: smooth ? "smooth" : "auto"
            });
        }
        setIsAtBottom(true);
        isAtBottomRef.current = true;
        setShowNewMsgBtn(false);
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const bottom = distanceFromBottom < 200;
        if (!isRestoringRef.current) {
            setIsAtBottom(bottom);
            isAtBottomRef.current = bottom;
            if (bottom) setShowNewMsgBtn(false);
        }

        // 向上滑到頂部時自動載入更舊的訊息
        if (scrollTop < 80 && hasMoreHistory && !loadingOlder && !isRestoringRef.current) {
            loadOlderMessages();
        }

        if (selectedUser && e.target && messages.length > 0) {
            userScrollPositionsRef.current[selectedUser] = {
                distanceFromBottom,
                scrollTop
            };
        }
    };

    React.useLayoutEffect(() => {
        if (layoutRef.current.isUpdatingHistory && chatContainerRef.current) {
            const container = chatContainerRef.current;
            const heightDiff = container.scrollHeight - layoutRef.current.scrollHeight;
            container.scrollTop = layoutRef.current.scrollTop + heightDiff;
        }
    }, [messages]);

    useEffect(() => {
        if (messages.length > 0) {
            const isInitialLoad = prevMessagesLengthRef.current === 0;
            const hasNewMessages = messages.length > prevMessagesLengthRef.current;
            const isHistoryLoad = layoutRef.current.isUpdatingHistory;

            if (isInitialLoad) {
                isRestoringRef.current = true;
                // 檢查是否有前次停留的捲動紀錄
                const savedScroll = userScrollPositionsRef.current[selectedUser];
                if (savedScroll !== undefined && chatContainerRef.current) {
                    if (savedScroll.distanceFromBottom >= 200) {
                        chatContainerRef.current.scrollTop = savedScroll.scrollTop;
                        setTimeout(() => {
                            if (chatContainerRef.current) {
                                chatContainerRef.current.scrollTop = savedScroll.scrollTop;
                            }
                            isRestoringRef.current = false;
                        }, 150);
                    } else {
                        setTimeout(() => scrollToBottom(false), 50);
                        setTimeout(() => {
                            scrollToBottom(false);
                            isRestoringRef.current = false;
                        }, 250);
                    }
                } else {
                    setTimeout(() => scrollToBottom(false), 50);
                    setTimeout(() => {
                        scrollToBottom(false);
                        isRestoringRef.current = false;
                    }, 350);
                }
            } else if (isHistoryLoad) {
                // Do nothing, scroll handled by useLayoutEffect
            } else if (isAtBottom && hasNewMessages) {
                setTimeout(() => scrollToBottom(true), 50);
            } else if (hasNewMessages) {
                setShowNewMsgBtn(true);
            }
            prevMessagesLengthRef.current = messages.length;
            layoutRef.current.isUpdatingHistory = false;
        } else {
            prevMessagesLengthRef.current = 0;
            layoutRef.current.isUpdatingHistory = false;
        }
    }, [messages]);

    useEffect(() => {
        prevMessagesLengthRef.current = 0;

        // 切換用戶時，檢查是否有舊紀錄來決定 isAtBottom 的初始狀態
        const savedScroll = userScrollPositionsRef.current[selectedUser];
        if (savedScroll !== undefined) {
            const bottom = savedScroll.distanceFromBottom < 100;
            setIsAtBottom(bottom);
            isAtBottomRef.current = bottom;
        } else {
            setIsAtBottom(true);
            isAtBottomRef.current = true;
        }

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
        if (isSendingRef.current || !selectedUser || !input.trim()) return;
        
        isSendingRef.current = true;
        const messageToSend = input;
        try {
            setIsSending(true);
            // Optimistic clear to prevent immediate double-press issues
            setInput('');
            
            await api.post('/trigger', {
                user: selectedUser,
                message: `MSG|${messageToSend}`,
                type: 'Sensor',
                api_index: 0
            });
            setMessages([...messages, { content: messageToSend, timestamp: new Date().toISOString(), category: 'Message', user_id: 'yzuadmin' }]);
            lastSendTimeRef.current = Date.now();
        } catch (err) {
            showToast('發送失敗: ' + err.message, 'error');
            // Restore input if failed and it has not been replaced
            setInput(prev => prev === '' ? messageToSend : prev);
        } finally {
            setIsSending(false);
            isSendingRef.current = false;
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
            setUsers(prev => prev.map(u => {
                if (u.user_id === selectedUser) {
                    const currentTags = getCurrentUserTags(u);
                    if (!currentTags.includes(tagInput)) {
                        const newTags = [...currentTags, tagInput].join('|');
                        return { ...u, tags: newTags };
                    }
                }
                return u;
            }));
            setTimeout(() => {
                fetchUsers(searchQuery, selectedTagFilters);
                fetchAvailableTags();
            }, 1500);
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
            setTimeout(() => fetchUsers(searchQuery, selectedTagFilters), 1500);
        } catch (err) {
            showToast('刪除標籤失敗', 'error');
        }
    };

    // 舊版 `formatSidebarMessage` 已經整合移至頂部，以下原本重複的即被移除

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
        if (!text) return '';
        if (typeof text === 'object') {
            try { text = JSON.stringify(text); } catch(e) { text = '[物件]'; }
        }
        text = String(text);
        
        if (!messageSearch.trim()) return text;
        
        const parts = text.split(new RegExp(`(${messageSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
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

    const filteredUsers = React.useMemo(() => {
        // This is just to get the count for the "用戶列表 (X)" display
        // The actual filtering for display is handled by `sortedUsers` which uses `fetchUsers` results.
        // This `filteredUsers` is not used for rendering the list itself, only for the count.
        return users.filter(u => {
            const matchesSearch = searchQuery ? (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.user_id?.toLowerCase().includes(searchQuery.toLowerCase())) : true;
            const userTags = getCurrentUserTags(u);
            const matchesTags = selectedTagFilters.length > 0 ? selectedTagFilters.every(tag => userTags.includes(tag)) : true;
            return matchesSearch && matchesTags;
        });
    }, [users, searchQuery, selectedTagFilters]);

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
                        <X
                            size={14}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#999' }}
                            onClick={() => setSearchQuery('')}
                        />
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>用戶列表 ({filteredUsers.length})</div>
                    <button
                        onClick={handleMarkAllRead}
                        className="btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
                    >
                        全部已讀
                    </button>
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

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }} onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } = e.target;
                    if (scrollHeight - scrollTop - clientHeight < 50) {
                        setSidebarDisplayCount(prev => Math.min(prev + 15, sortedUsers.length));
                    }
                }}>
                    {loading && users.length === 0 ? (
                        <LoadingSpinner message="載入用戶中..." />
                    ) : users.length === 0 ? (
                        <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                            {searchQuery || selectedTagFilters.length > 0 ? '找不到符合的用戶' : '尚無用戶'}
                        </div>
                    ) : (
                        <>
                        {sortedUsers.slice(0, sidebarDisplayCount).map(u => {
                            const userTags = getCurrentUserTags(u);
                            const isUnread = isUserUnread(u);
                            return (
                                <div
                                    key={u.user_id}
                                    onClick={() => setSelectedUser(u.user_id)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        backgroundColor: selectedUser === u.user_id
                                            ? 'rgba(255, 215, 0, 0.12)'
                                            : (isUnread ? 'rgba(255, 215, 0, 0.04)' : 'transparent'),
                                        border: selectedUser === u.user_id
                                            ? '1px solid var(--primary-yellow)'
                                            : (isUnread ? '1px solid rgba(255, 215, 0, 0.2)' : '1px solid transparent'),
                                        borderLeft: isUnread && selectedUser !== u.user_id
                                            ? '4px solid var(--primary-yellow)'
                                            : (selectedUser === u.user_id ? '4px solid var(--primary-yellow)' : '1px solid transparent'),
                                        position: 'relative',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {isUnread && (
                                        <div style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '12px',
                                            backgroundColor: '#ff4d4f',
                                            color: 'white',
                                            borderRadius: '12px',
                                            minWidth: '16px',
                                            height: '16px',
                                            fontSize: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 4px',
                                            boxShadow: '0 0 5px rgba(255,77,79,0.5)'
                                        }}>
                                            {localUnreadCounts[u.user_id] || 1}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ backgroundColor: '#333', padding: '8px', borderRadius: '50%', flexShrink: 0 }}>
                                            <User size={18} />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <p style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || u.user_id}</p>
                                            <p style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatSidebarMessage(u) || '尚無訊息'}</p>
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
                        })}
                        {sidebarDisplayCount < sortedUsers.length && (
                            <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '12px' }}>
                                向下滑動載入更多... ({sidebarDisplayCount}/{sortedUsers.length})
                            </div>
                        )}
                        </>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                {selectedUser ? (
                    <>
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
                                    onChange={e => {
                                        const val = e.target.value;
                                        setMessageSearch(val);
                                        // 開始搜尋時自動全撈完整歷史紀錄
                                        if (val.trim() && !fullHistoryLoadedRef.current) {
                                            loadFullHistory();
                                        }
                                    }}
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
                                                            <span style={{ color: '#555', fontSize: '10px' }}>
                                                                {m.timestamp && !isNaN(new Date(m.timestamp).getTime()) ? new Date(m.timestamp).toLocaleString() : ''}
                                                            </span>
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
                            style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowAnchor: 'auto', minHeight: 0 }}
                        >
                            {loadingChat ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <LoadingSpinner message="載入對話中..." />
                                </div>
                            ) : (
                                <>
                                    {loadingOlder && (
                                        <div style={{ padding: '10px', textAlign: 'center', color: '#888', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                            <CircularProgress size={16} sx={{ color: 'var(--primary-yellow)' }} />
                                            載入更舊的紀錄...
                                        </div>
                                    )}
                                    {(() => {
                                        let lastDate = null;
                                        return displayedMessages.map((m, i) => {
                                    const validDate = m.timestamp && !isNaN(new Date(m.timestamp).getTime());
                                    const mDate = validDate ? new Date(m.timestamp).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                                    const showDateHeader = mDate && mDate !== lastDate;
                                    if (mDate) lastDate = mDate;

                                    const isAdmin = m.user_id === 'yzuadmin' || m.category === 'Response' || m.category === 'sys_reply';
                                    let displayContent = m.content;
                                    if (isAdmin && typeof displayContent === 'string' && displayContent.startsWith('MSG|')) {
                                        displayContent = displayContent.substring(4);
                                    }
                                    
                                    // 防呆：如果 content 是物件，強制轉為字串避免 React "Objects are not valid" 崩潰
                                    if (typeof displayContent === 'object' && displayContent !== null) {
                                        try {
                                            displayContent = JSON.stringify(displayContent, null, 2);
                                        } catch(e) {
                                            displayContent = '[無法解析的複雜物件]';
                                        }
                                    }

                                    const globalIndex = messages.indexOf(m);
                                    const stableKey = m.timestamp ? `${m.timestamp}-${messages.length - globalIndex}` : i;

                                    const handleMediaLoad = () => {
                                        // 使用 Ref 避免 React closure 造成的狀態過期問題
                                        if (isAtBottomRef.current && !isRestoringRef.current) {
                                            // 給延遲確保 DOM 已渲染完畢
                                            setTimeout(() => scrollToBottom(true), 100);
                                        }
                                    };

                                    const renderMessageContent = () => {
                                      try {
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
                                                    onLoad={handleMediaLoad}
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
                                                if (stickerId) return (
                                                    <LazyImage
                                                        src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`}
                                                        style={{ width: '120px' }}
                                                        alt="Sticker"
                                                        onLoad={handleMediaLoad}
                                                    />
                                                );
                                            } catch (e) { }
                                            return <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'inherit' }}><Smile size={16} /> [貼圖訊息]</div>;
                                        }

                                        if (m.category === 'sys_reply') {
                                            try {
                                                const parsed = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                                                if (parsed.type === 'text' && parsed.text) return highlightText(parsed.text);
                                                if (parsed.type === 'image') return (
                                                    <LazyImage
                                                        src={parsed.previewImageUrl || parsed.originalContentUrl}
                                                        style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                                                        onClick={() => window.open(parsed.originalContentUrl, '_blank')}
                                                        onLoad={handleMediaLoad}
                                                    />
                                                );
                                                if (parsed.type === 'video') return (
                                                    <div style={{ maxWidth: '200px' }}>
                                                        <video src={parsed.originalContentUrl} controls poster={parsed.previewImageUrl} style={{ width: '100%', borderRadius: '8px' }} onLoadedData={handleMediaLoad} />
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
                                                                {imageUrl && (
                                                                    <LazyImage
                                                                        src={imageUrl}
                                                                        style={{ width: '100%', height: '100px', objectFit: 'cover' }}
                                                                        onLoad={handleMediaLoad}
                                                                    />
                                                                )}
                                                                <div style={{ padding: '8px' }}>
                                                                    {title && <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{typeof title === 'object' ? JSON.stringify(title) : String(title)}</div>}
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
                                                return `[${typeof parsed.type === 'object' ? JSON.stringify(parsed.type) : String(parsed.type)}]`;
                                            } catch (e) { return highlightText(displayContent); }
                                        }
                                        return highlightText(displayContent);
                                      } catch (err) {
                                        console.error("Render message error:", err, m);
                                        return <span style={{color: '#ff4d4f', fontSize: '12px'}}>[訊息格式無法解析]</span>;
                                      }
                                    };

                                    return (
                                        <React.Fragment key={stableKey}>
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
                                                <p style={{ fontSize: '10px', marginTop: '5px', opacity: 0.6 }}>
                                                    {m.timestamp && !isNaN(new Date(m.timestamp).getTime()) ? new Date(m.timestamp).toLocaleTimeString() : ''}
                                                </p>
                                            </div>
                                        </React.Fragment>
                                    );
                                });
                            })()}
                                </>
                            )}
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
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (!e.repeat) sendMessage();
                                    }
                                }}
                                placeholder={isSending ? "正在發送..." : "輸入訊息..."}
                                style={{ flex: 1, cursor: isSending ? 'not-allowed' : 'text', opacity: isSending ? 0.7 : 1 }}
                                disabled={isSending}
                            />
                            <button
                                onClick={sendMessage}
                                className="primary"
                                style={{ padding: '0 25px' }}
                                disabled={isSending || !input.trim()}
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

export default function MessageCenterBoundary() {
    return (
        <MessageCenterErrorBoundary>
            <MessageCenter />
        </MessageCenterErrorBoundary>
    );
}
