import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Download, UserPlus, Users, Tag, Clock, Phone, Mail, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../contexts/ToastContext';

const CustomerCenter = () => {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterContext, setFilterContext] = useState({ type: null, value: null });
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers();
    } else if (activeTab === 'groups') {
      fetchGroups();
    } else if (activeTab === 'tags') {
      fetchTags();
    }
  }, [activeTab]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      addToast('無法取得客戶名單', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/customers/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      addToast('無法取得客群列表', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/customers/tags');
      setTags(response.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
      addToast('無法取得標籤列表', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleView = (type, value) => {
    setFilterContext({ type, value });
    setActiveTab('customers');
  };

  const filteredCustomers = useMemo(() => {
    let filtered = customers;
    if (filterContext.type === 'group') {
      filtered = filtered.filter(c => c.group_name === filterContext.value);
    } else if (filterContext.type === 'tag') {
      filtered = filtered.filter(c => Array.isArray(c.tag) ? c.tag.includes(filterContext.value) : c.tag === filterContext.value);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
        (c.user_id && c.user_id.toLowerCase().includes(lowerQuery)) ||
        (c.email && c.email.toLowerCase().includes(lowerQuery))
      );
    }
    return filtered;
  }, [customers, filterContext, searchQuery]);

  const sortedCustomers = useMemo(() => {
    let sortableItems = [...filteredCustomers];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'tag') {
          const aTags = Array.isArray(a.tag) ? a.tag.join(', ') : '';
          const bTags = Array.isArray(b.tag) ? b.tag.join(', ') : '';
          if (aTags < bTags) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aTags > bTags) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle nulls
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredCustomers, sortConfig]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.5, display: 'inline-block', verticalAlign: 'middle' }} />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp size={14} style={{ marginLeft: '4px', color: '#FFD700', display: 'inline-block', verticalAlign: 'middle' }} /> : 
      <ArrowDown size={14} style={{ marginLeft: '4px', color: '#FFD700', display: 'inline-block', verticalAlign: 'middle' }} />;
  };

  const handleActionClick = (action, item) => {
    addToast(`${action}功能開發中: ${item}`, 'info');
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    return groups.filter(g => g.group_name && g.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [groups, searchQuery]);

  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;
    return tags.filter(t => t.tag_name && t.tag_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tags, searchQuery]);

  const renderCustomersTable = () => (
    <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#2A2A2A', borderBottom: '1px solid #444' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '16px', fontWeight: '500', color: '#888', cursor: 'pointer', userSelect: 'none' }}>
                客戶名稱 <SortIcon columnKey="name" />
              </th>
              <th onClick={() => handleSort('last_interaction')} style={{ padding: '16px', fontWeight: '500', color: '#888', cursor: 'pointer', userSelect: 'none' }}>
                最近互動時間 <SortIcon columnKey="last_interaction" />
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>
                聯絡資訊
              </th>
              <th onClick={() => handleSort('tag')} style={{ padding: '16px', fontWeight: '500', color: '#888', cursor: 'pointer', userSelect: 'none' }}>
                標籤 <SortIcon columnKey="tag" />
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>
                狀態
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>載入中...</td>
              </tr>
            ) : sortedCustomers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>無客戶資料</td>
              </tr>
            ) : (
              sortedCustomers.map((c, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #333', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2A2A2A'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#444', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.pic ? (
                          <img src={c.pic} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Users size={20} color="#888" />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ fontWeight: '500', fontSize: '15px' }}>{c.name || '未命名用戶'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: '#ccc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="#888" />
                      {c.last_interaction || '無互動紀錄'}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#ccc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} color="#888" />{c.phone || '未設定'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} color="#888" />{c.email || '未設定'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {Array.isArray(c.tag) && c.tag.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {c.tag.map((t, i) => (
                          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '16px', backgroundColor: '#333', fontSize: '12px', border: '1px solid #444', color: '#FFD700' }}>
                            <Tag size={12} style={{ marginRight: '4px' }} />
                            {t}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#666', fontSize: '13px' }}>無標籤</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(136, 136, 136, 0.2)', color: '#888', fontSize: '12px' }}>
                      未規劃
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button onClick={() => handleActionClick('編輯客戶', c.name)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }} title="更多選項">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGroupsTable = () => (
    <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
        <thead>
          <tr style={{ backgroundColor: '#2A2A2A', borderBottom: '1px solid #444' }}>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>客群名稱</th>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>人數</th>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888', textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>載入中...</td>
            </tr>
          ) : filteredGroups.length === 0 ? (
            <tr>
              <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>無客群資料</td>
            </tr>
          ) : (
            filteredGroups.map((g, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '16px', fontWeight: '500', cursor: 'pointer' }} onClick={() => handleView('group', g.group_name)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} className="text-yellow" />
                    <span style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#FFD700'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                      {g.group_name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '16px', color: '#ccc' }}>{g.member_count} 人</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleView('group', g.group_name)} style={{ padding: '6px 12px', backgroundColor: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginRight: '8px' }}>
                    查看
                  </button>
                  <button onClick={() => handleActionClick('刪除客群', g.group_name)} style={{ padding: '6px 12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                    刪除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTagsTable = () => (
    <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
        <thead>
          <tr style={{ backgroundColor: '#2A2A2A', borderBottom: '1px solid #444' }}>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>標籤名稱</th>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>標記人數</th>
            <th style={{ padding: '16px', fontWeight: '500', color: '#888', textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>載入中...</td>
            </tr>
          ) : filteredTags.length === 0 ? (
            <tr>
              <td colSpan="3" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>無標籤資料</td>
            </tr>
          ) : (
            filteredTags.map((t, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '16px', fontWeight: '500', cursor: 'pointer' }} onClick={() => handleView('tag', t.tag_name)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={16} style={{ color: '#FFD700' }} />
                    <span style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#FFD700'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                      {t.tag_name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '16px', color: '#ccc' }}>{t.member_count} 人</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleView('tag', t.tag_name)} style={{ padding: '6px 12px', backgroundColor: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginRight: '8px' }}>
                    查看
                  </button>
                  <button onClick={() => handleActionClick('刪除標籤', t.tag_name)} style={{ padding: '6px 12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                    刪除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={28} className="text-yellow" />
          客戶中心
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#333', color: 'white', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <Download size={16} /> 匯出資料
          </button>
          {activeTab === 'groups' && (
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              <UserPlus size={16} /> 新增客群
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid #333' }}>
        {['customers', 'groups', 'tags'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #FFD700' : '2px solid transparent',
              color: activeTab === tab ? '#FFD700' : '#888',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            {tab === 'customers' ? '客戶資訊' : tab === 'groups' ? '目標客群' : '標籤管理'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} color="#888" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'customers' ? "搜尋客戶名稱、ID 或信箱..." : activeTab === 'groups' ? "搜尋客群名稱..." : "搜尋標籤名稱..."}
            style={{ width: '100%', padding: '12px 16px 12px 48px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#222', color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
          <Filter size={16} /> 篩選條件
        </button>
      </div>

      {filterContext.type && activeTab === 'customers' && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px' }}>
          <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
            過濾中：{filterContext.type === 'group' ? '目標客群' : '標籤'} = {filterContext.value}
          </span>
          <button onClick={() => setFilterContext({ type: null, value: null })} style={{ background: 'transparent', border: 'none', color: '#FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <X size={16} /> 取消過濾
          </button>
        </div>
      )}

      {activeTab === 'customers' && renderCustomersTable()}
      {activeTab === 'groups' && renderGroupsTable()}
      {activeTab === 'tags' && renderTagsTable()}
    </div>
  );
};

export default CustomerCenter;
