import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, Download, UserPlus, Users, Tag, Clock, Phone, Mail, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, X, MessageSquare, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
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
  
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ tags: [], joinTime: '全部時間', lastInteractionTime: '全部時間', phone: '全部', email: '全部' });
  const [advancedFilters, setAdvancedFilters] = useState({ tags: [], joinTime: '全部時間', lastInteractionTime: '全部時間', phone: '全部', email: '全部' });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ mode: 'existing', groupName: '', newGroupName: '', description: '' });
  
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [selectedCustomerForSidebar, setSelectedCustomerForSidebar] = useState(null);
  const [sidebarDetails, setSidebarDetails] = useState({ projects: [], rich_menu: null, loading: false });
  const [sidebarTagInput, setSidebarTagInput] = useState('');

  const navigate = useNavigate();
  const { oaId } = useParams();
  const { showToast } = useToast();

  const fetchCustomers = async (silent = false) => {
    if (!silent && customers.length === 0) setIsLoading(true);
    try {
      const response = await api.get('/customers?limit=100&offset=0');
      setCustomers(response.data);
      
      // 若數量滿 100 筆，表示可能還有更多資料，在背景繼續載入剩餘的
      if (response.data.length === 100) {
        api.get('/customers?offset=100').then(res => {
          if (res.data && res.data.length > 0) {
            setCustomers(prev => [...prev, ...res.data]);
          }
        }).catch(e => console.error('Background fetch failed:', e));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      showToast('無法取得客戶名單', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchGroups = async (silent = false) => {
    if (!silent && groups.length === 0) setIsLoading(true);
    try {
      const response = await api.get('/customers/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      showToast('無法取得客群列表', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchTags = async (silent = false) => {
    if (!silent && tags.length === 0) setIsLoading(true);
    try {
      const response = await api.get('/customers/tags');
      setTags(response.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
      showToast('無法取得標籤列表', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };


  const refreshAllData = useCallback(async (isInitial = false) => {
    console.log('refreshAllData triggered');
    // Only show global loading spinner on initial load if we have no data
    if (isInitial && customers.length === 0) setIsLoading(true);
    try {
      console.log('Start fetching all data...');
      await Promise.all([
        fetchCustomers(true).catch(e => console.error('Customers refresh fail:', e)),
        fetchGroups(true).catch(e => console.error('Groups refresh fail:', e)),
        fetchTags(true).catch(e => console.error('Tags refresh fail:', e))
      ]);
      console.log('Data refresh finished');
    } catch (err) {
      console.error('Refresh logic error:', err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [oaId, customers.length]); // eslint-disable-line

  // Initial load and when OA changes
  useEffect(() => {
    setCustomers([]);
    setGroups([]);
    setTags([]);
    setSelectedUserIds([]);
    setFilterContext({ type: null, value: null });
    setSearchQuery('');
    refreshAllData(true);
  }, [oaId]);

  // Fetch Sidebar Details
  useEffect(() => {
    if (selectedCustomerForSidebar) {
      const fetchDetails = async () => {
        setSidebarDetails(prev => ({ ...prev, loading: true }));
        try {
          const resp = await api.get(`/customers/${selectedCustomerForSidebar.user_id}/details`);
          setSidebarDetails({
            projects: resp.data.projects || [],
            rich_menu: resp.data.rich_menu || null,
            loading: false
          });
        } catch (err) {
          console.error('Failed to fetch sidebar details:', err);
          setSidebarDetails({ projects: [], rich_menu: null, loading: false });
        }
      };
      fetchDetails();
    } else {
      setSidebarDetails({ projects: [], rich_menu: null, loading: false });
      setSidebarTagInput('');
    }
  }, [selectedCustomerForSidebar]);

  // When tab changes, just clear selection
  useEffect(() => {
    setSelectedUserIds([]); // clear selection when tab changes
  }, [activeTab]);


  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleView = (type, value, description = '') => {
    setFilterContext({ type, value, description });
    setActiveTab('customers');
    setSelectedUserIds([]);
  };

  const filteredCustomers = useMemo(() => {
    let filtered = customers;
    if (filterContext.type === 'group') {
      filtered = filtered.filter(c => Array.isArray(c.group_name) ? c.group_name.includes(filterContext.value) : c.group_name === filterContext.value);
    } else if (filterContext.type === 'tag') {
      filtered = filtered.filter(c => Array.isArray(c.tag) ? c.tag.includes(filterContext.value) : c.tag === filterContext.value);
    }
    
    // Advanced Filters
    if (advancedFilters.tags.length > 0) {
      filtered = filtered.filter(c => {
        const cTags = Array.isArray(c.tag) ? c.tag : (c.tag ? [c.tag] : []);
        return advancedFilters.tags.some(t => cTags.includes(t));
      });
    }
    
    const now = new Date();
    
    if (advancedFilters.joinTime !== '全部時間') {
      filtered = filtered.filter(c => {
        if (!c.join_time) return false;
        const joinDate = new Date(c.join_time);
        const diffDays = (now - joinDate) / (1000 * 60 * 60 * 24);
        if (advancedFilters.joinTime === '最近7天') return diffDays <= 7;
        if (advancedFilters.joinTime === '最近30天') return diffDays <= 30;
        if (advancedFilters.joinTime === '最近90天') return diffDays <= 90;
        if (advancedFilters.joinTime === '最近一年') return diffDays <= 365;
        return true;
      });
    }

    if (advancedFilters.lastInteractionTime !== '全部時間') {
      filtered = filtered.filter(c => {
        if (!c.last_interaction) return advancedFilters.lastInteractionTime === '超過90天';
        const intDate = new Date(c.last_interaction);
        const diffDays = (now - intDate) / (1000 * 60 * 60 * 24);
        if (advancedFilters.lastInteractionTime === '24小時內') return diffDays <= 1;
        if (advancedFilters.lastInteractionTime === '最近7天') return diffDays <= 7;
        if (advancedFilters.lastInteractionTime === '最近30天') return diffDays <= 30;
        if (advancedFilters.lastInteractionTime === '最近90天') return diffDays <= 90;
        if (advancedFilters.lastInteractionTime === '超過90天') return diffDays > 90;
        return true;
      });
    }
    
    if (advancedFilters.phone !== '全部') {
      filtered = filtered.filter(c => advancedFilters.phone === '是' ? (c.phone && c.phone !== '未設定') : (!c.phone || c.phone === '未設定'));
    }
    
    if (advancedFilters.email !== '全部') {
      filtered = filtered.filter(c => advancedFilters.email === '是' ? (c.email && c.email !== '未設定') : (!c.email || c.email === '未設定'));
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const matchesName = c.name && c.name.toLowerCase().includes(lowerQuery);
        const matchesEmail = c.email && c.email.toLowerCase().includes(lowerQuery);
        const matchesPhone = c.phone && c.phone.toLowerCase().includes(lowerQuery);
        const matchesTag = Array.isArray(c.tag) ? c.tag.some(t => t.toLowerCase().includes(lowerQuery)) : (c.tag && c.tag.toLowerCase().includes(lowerQuery));
        
        return matchesName || matchesEmail || matchesPhone || matchesTag;
      });
    }
    return filtered;
  }, [customers, filterContext, searchQuery, advancedFilters]);

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

  const handleActionClick = async (action, item) => {
    if (action === '刪除客群') {
      if (window.confirm(`確定要刪除客群「${item}」嗎？\n此操作將移除該客群的所有資訊，並解除所有使用者的客群綁定。`)) {
        setIsProcessing(true);
        try {
          await api.delete(`/customers/groups/${encodeURIComponent(item)}`);
          showToast(`已成功刪除客群: ${item}`, 'success');
          if (filterContext.type === 'group' && filterContext.value === item) {
            setFilterContext({ type: 'all', value: '', description: '' });
          }
          setIsProcessing(false);
          console.log('Group deletion successful, refreshing...');
          await refreshAllData();
        } catch (error) {

          console.error(error);
          showToast('刪除客群失敗', 'error');
          setIsProcessing(false);
        }

      }
      return;
    }
    if (action === '刪除標籤') {
      if (window.confirm(`確定要刪除標籤「${item}」嗎？\n此操作將解除所有使用者的該標籤綁定。`)) {
        setIsProcessing(true);
        try {
          await api.delete(`/customers/tags/${encodeURIComponent(item)}`);
          showToast(`已成功刪除標籤: ${item}`, 'success');
          if (filterContext.type === 'tag' && filterContext.value === item) {
            setFilterContext({ type: 'all', value: '', description: '' });
          }
          setIsProcessing(false);
          console.log('Tag deletion successful, refreshing...');
          await refreshAllData();
        } catch (error) {

          console.error(error);
          showToast('刪除標籤失敗', 'error');
          setIsProcessing(false);
        }

      }
      return;
    }
    showToast(`${action}功能開發中: ${item}`, 'info');
  };

  const handleEditClick = (e, customer) => {
    e.stopPropagation();
    setEditingCustomer({
      user_id: customer.user_id,
      name: customer.name || '',
      phone: customer.phone === '未設定' ? '' : (customer.phone || ''),
      email: customer.email === '未設定' ? '' : (customer.email || '')
    });
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    setIsProcessing(true);
    try {
      await api.put(`/customers/${editingCustomer.user_id}`, {
        name: editingCustomer.name,
        phone: editingCustomer.phone,
        email: editingCustomer.email
      });
      setIsEditModalOpen(false);
      showToast('客戶資料更新成功', 'success');
      setEditingCustomer(null);
      await refreshAllData();
    } catch (err) {
      showToast('更新客戶資料失敗', 'error');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenFilter = () => {
    if (tags.length === 0) fetchTags();
    setFilterDraft(advancedFilters);
    setIsFilterModalOpen(true);
  };
  
  const hasAdvancedFilter = advancedFilters.tags.length > 0 || advancedFilters.joinTime !== '全部時間' || advancedFilters.lastInteractionTime !== '全部時間' || advancedFilters.phone !== '全部' || advancedFilters.email !== '全部';

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    return groups.filter(g => g.group_name && g.group_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [groups, searchQuery]);

  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;
    return tags.filter(t => t.tag_name && t.tag_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tags, searchQuery]);

  const handleExport = () => {
    if (sortedCustomers.length === 0) {
      showToast('目前沒有資料可以匯出', 'info');
      return;
    }

    const headers = ['客戶名稱', '最近互動時間', '聯絡電話', '電子信箱', '標籤', '目標客群'];
    
    const csvContent = [
      headers.join(','),
      ...sortedCustomers.map(c => {
        const name = `"${c.name || ''}"`;
        const lastInteraction = `"${c.last_interaction || ''}"`;
        const phone = `"${c.phone || ''}"`;
        const email = `"${c.email || ''}"`;
        const tag = `"${Array.isArray(c.tag) ? c.tag.join(';') : (c.tag || '')}"`;
        const group = `"${c.group_name || ''}"`;
        return [name, lastInteraction, phone, email, tag, group].join(',');
      })
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customer_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('資料匯出成功！', 'success');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUserIds(sortedCustomers.map(c => c.user_id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveToGroup = async () => {
    if (selectedUserIds.length === 0) return;
    const finalGroupName = groupForm.mode === 'existing' ? groupForm.groupName : groupForm.newGroupName;
    if (!finalGroupName.trim()) {
      showToast('請輸入或選擇客群名稱', 'error');
      return;
    }
    
    setIsProcessing(true);
    try {
      await api.post('/customers/groups', {
        group_name: finalGroupName,
        description: groupForm.mode === 'existing' ? (groups.find(g => g.group_name === finalGroupName)?.description || '') : groupForm.description,
        user_ids: selectedUserIds
      });
      setIsGroupModalOpen(false);
      showToast(`成功將 ${selectedUserIds.length} 名用戶加入客群: ${finalGroupName}`, 'success');
      setSelectedUserIds([]);
      await refreshAllData();
    } catch (err) {
      showToast('加入客群失敗', 'error');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTagToGroup = async () => {
    if (!tagInput.trim() || filteredCustomers.length === 0) return;
    const userIds = filteredCustomers.map(u => u.user_id).filter(Boolean);
    
    setIsProcessing(true);
    try {
      await api.post('/customers/tags/batch', {
        tag_name: tagInput.trim(),
        user_ids: userIds
      });
      setIsTagModalOpen(false);
      showToast(`成功為 ${userIds.length} 名用戶加入標籤: ${tagInput.trim()}`, 'success');
      setTagInput('');
      await refreshAllData();
    } catch (err) {
      showToast('加入標籤失敗', 'error');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSidebarAddTag = async () => {
    if (!sidebarTagInput.trim() || !selectedCustomerForSidebar) return;
    const tag = sidebarTagInput.trim();
    setSidebarTagInput('');
    try {
      await api.post('/trigger', {
        user: selectedCustomerForSidebar.user_id,
        message: `set_tag|${tag}`,
        type: 'Sensor',
        api_index: 0
      });
      showToast(`已新增標籤: ${tag}`, 'success');
      // Update local state to reflect UI change immediately
      setSelectedCustomerForSidebar(prev => {
        const currentTags = Array.isArray(prev.tag) ? prev.tag : (prev.tag ? [prev.tag] : []);
        if (!currentTags.includes(tag)) {
          return { ...prev, tag: [...currentTags, tag] };
        }
        return prev;
      });
    } catch (err) {
      showToast('新增標籤失敗', 'error');
      console.error(err);
    }
  };

  const handleSidebarDeleteTag = async (tagName) => {
    if (!selectedCustomerForSidebar) return;
    if (!window.confirm(`確定要刪除標籤 [${tagName}] 嗎？`)) return;
    try {
      await api.post('/trigger', {
        user: selectedCustomerForSidebar.user_id,
        message: `del_tag|${tagName}`,
        type: 'Sensor',
        api_index: 0
      });
      showToast(`標籤 [${tagName}] 正在刪除中...`, 'success');
      // Update local state to reflect UI change immediately
      setSelectedCustomerForSidebar(prev => {
        const currentTags = Array.isArray(prev.tag) ? prev.tag : (prev.tag ? [prev.tag] : []);
        return { ...prev, tag: currentTags.filter(t => t !== tagName) };
      });
    } catch (err) {
      showToast('刪除標籤失敗', 'error');
      console.error(err);
    }
  };

  const handleSidebarDeleteProject = async (projectId, projectName) => {
    if (!selectedCustomerForSidebar) return;
    if (!window.confirm(`確定要將此用戶退出自動旅程 [${projectName}] 嗎？`)) return;
    try {
      await api.delete(`/projects/${projectId}/users/${selectedCustomerForSidebar.user_id}`);
      showToast('已將用戶退出自動旅程', 'success');
      // Fetch details again to refresh
      const resp = await api.get(`/customers/${selectedCustomerForSidebar.user_id}/details`);
      setSidebarDetails(prev => ({ ...prev, projects: resp.data.projects || [] }));
    } catch (err) {
      showToast('退出自動旅程失敗', 'error');
      console.error(err);
    }
  };

  const handleSidebarDeleteRichMenu = async () => {
    if (!selectedCustomerForSidebar) return;
    if (!window.confirm(`確定要解除用戶的專屬圖文選單嗎？（將恢復為預設圖文選單）`)) return;
    try {
      await api.delete(`/customers/${selectedCustomerForSidebar.user_id}/richmenu`);
      showToast('已解除綁定圖文選單', 'success');
      // Update local state to reflect UI change
      setSidebarDetails(prev => ({ ...prev, rich_menu: null }));
    } catch (err) {
      showToast('解除圖文選單失敗', 'error');
      console.error(err);
    }
  };



  const handleSendGroupMessage = () => {
    const userIds = filteredCustomers.map(c => c.user_id).filter(Boolean).join(',');
    if (!userIds) {
      showToast('該群組目前沒有用戶可發送訊息', 'error');
      return;
    }
    navigate(`/oa/${oaId}/broadcast`, { 
      state: { 
        presetTarget: { 
          type: 'ids', 
          value: userIds, 
          name: filterContext.type === 'group' ? `發送給客群：${filterContext.value}` : `發送給選定目標`,
          autoStep2: true 
        } 
      } 
    });
  };

  const renderCustomersTable = () => (
    <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#2A2A2A', borderBottom: '1px solid #444' }}>
              <th style={{ padding: '16px', width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={selectedUserIds.length > 0 && selectedUserIds.length === sortedCustomers.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                />
              </th>
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
              <th onClick={() => handleSort('group_name')} style={{ padding: '16px', fontWeight: '500', color: '#888', cursor: 'pointer', userSelect: 'none' }}>
                客群 <SortIcon columnKey="group_name" />
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>
                自動旅程
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888' }}>
                圖文選單
              </th>
              <th style={{ padding: '16px', fontWeight: '500', color: '#888', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>載入中...</td>
              </tr>
            ) : sortedCustomers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#888' }}>無客戶資料</td>
              </tr>
            ) : (
              sortedCustomers.map((c, idx) => (
                <tr 
                  key={idx} 
                  onClick={() => setSelectedCustomerForSidebar(c)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #333', transition: 'background-color 0.2s', backgroundColor: selectedUserIds.includes(c.user_id) ? 'rgba(255, 215, 0, 0.05)' : 'transparent' }} 
                  onMouseEnter={e => {if(!selectedUserIds.includes(c.user_id)) e.currentTarget.style.backgroundColor = '#2A2A2A'}} 
                  onMouseLeave={e => {if(!selectedUserIds.includes(c.user_id)) e.currentTarget.style.backgroundColor = 'transparent'}}
                >
                  <td style={{ padding: '16px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedUserIds.includes(c.user_id)}
                      onChange={(e) => { e.stopPropagation(); handleSelectUser(c.user_id); }}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </td>
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
                        <div style={{ fontWeight: '500', fontSize: '15px', whiteSpace: 'nowrap' }}>{c.name || '未命名用戶'}</div>
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
                    {Array.isArray(c.group_name) && c.group_name.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {c.group_name.map((g, i) => (
                          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '16px', backgroundColor: '#FFD700', color: '#000', fontSize: '12px', fontWeight: 'bold' }}>
                            <Users size={12} style={{ marginRight: '4px' }} />
                            {g}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#666', fontSize: '13px' }}>未規劃</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {Array.isArray(c.projects) && c.projects.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.projects.map((p, i) => {
                          const isCompleted = p.status === 'completed';
                          return (
                            <span key={i} style={{ 
                              backgroundColor: isCompleted ? 'rgba(156, 163, 175, 0.2)' : 'rgba(59, 130, 246, 0.2)', 
                              color: isCompleted ? '#9CA3AF' : '#60A5FA', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '12px', 
                              border: isCompleted ? '1px solid rgba(156, 163, 175, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)' 
                            }}>
                              {p.project_name}{isCompleted ? ' (已完成)' : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: '#666', fontSize: '13px' }}>無</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {c.rich_menu ? (
                      <span style={{ color: '#FFD700', fontSize: '13px' }}>{c.rich_menu.name}</span>
                    ) : (
                      <span style={{ color: '#666', fontSize: '13px' }}>預設選單</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button onClick={(e) => handleEditClick(e, c)} style={{ padding: '6px 12px', backgroundColor: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }} title="編輯客戶">
                      編輯
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
      <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                <td style={{ padding: '16px', fontWeight: '500', cursor: 'pointer' }} onClick={() => handleView('group', g.group_name, g.description)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} className="text-yellow" />
                    <span style={{ transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#FFD700'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                      {g.group_name}
                    </span>
                  </div>
                  {g.description && <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginLeft: '24px' }}>{g.description}</div>}
                </td>
                <td style={{ padding: '16px', color: '#ccc' }}>{g.member_count} 人</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleView('group', g.group_name, g.description)} style={{ padding: '6px 12px', backgroundColor: '#333', border: '1px solid #555', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginRight: '8px' }}>
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
    </div>
  );

  const renderTagsTable = () => (
    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', backgroundColor: '#222', borderRadius: '12px', border: '1px solid #333' }}>
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
          {activeTab === 'customers' && (
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#333', color: 'white', border: '1px solid #444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <Download size={16} /> 匯出資料
            </button>
          )}
          {activeTab === 'groups' && (
            <button onClick={() => { 
                setActiveTab('customers'); 
                showToast('請先在列表左側勾選您要加入客群的用戶', 'info'); 
              }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
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
            placeholder={activeTab === 'customers' ? "搜尋客戶名稱、電話、信箱或標籤..." : activeTab === 'groups' ? "搜尋客群名稱..." : "搜尋標籤名稱..."}
            style={{ width: '100%', padding: '12px 16px 12px 48px', backgroundColor: '#222', border: '1px solid #333', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <button onClick={handleOpenFilter} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: hasAdvancedFilter ? 'rgba(255, 215, 0, 0.1)' : '#222', color: hasAdvancedFilter ? '#FFD700' : 'white', border: hasAdvancedFilter ? '1px solid #FFD700' : '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}>
          <Filter size={16} /> 篩選條件 {hasAdvancedFilter && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FFD700' }}></div>}
        </button>
      </div>

      {filterContext.type && activeTab === 'customers' && (
        filterContext.type === 'group' ? (
          <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <h2 style={{ margin: 0, color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}><Users size={20} /> {filterContext.value}</h2>
                {filterContext.description && <p style={{ margin: '8px 0 0 0', color: '#ccc', fontSize: '14px' }}>{filterContext.description}</p>}
                <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>共 {filteredCustomers.length} 名用戶</p>
             </div>
             <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <button onClick={() => setIsTagModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#333', color: 'white', border: '1px solid #555', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='#444'} onMouseLeave={e => e.currentTarget.style.backgroundColor='#333'}><Tag size={16} /> 上標籤</button>
                 <button onClick={handleSendGroupMessage} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}><MessageSquare size={16} /> 發訊息</button>
                 <div style={{ width: '1px', height: '24px', backgroundColor: '#555', margin: '0 4px' }}></div>
                 <button onClick={() => setFilterContext({ type: null, value: null })} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='#888'}>
                   <X size={16} /> 返回
                 </button>
             </div>
          </div>
        ) : (
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px' }}>
            <span style={{ color: '#FFD700', fontWeight: 'bold' }}>
              過濾中：標籤 = {filterContext.value}
            </span>
            <button onClick={() => setFilterContext({ type: null, value: null })} style={{ background: 'transparent', border: 'none', color: '#FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={16} /> 取消過濾
            </button>
          </div>
        )
      )}

      {activeTab === 'customers' && renderCustomersTable()}
      {activeTab === 'groups' && renderGroupsTable()}
      {activeTab === 'tags' && renderTagsTable()}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#fff', color: '#333', width: '500px', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>篩選客戶</h2>
                <div style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>設定篩選條件以找到目標客戶</div>
              </div>
              <X size={20} color="#666" style={{ cursor: 'pointer' }} onClick={() => setIsFilterModalOpen(false)} />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>標籤篩選</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '4px 0' }}>
                {tags.map(t => (
                  <div 
                    key={t.tag_name}
                    onClick={() => {
                      const newTags = filterDraft.tags.includes(t.tag_name) 
                        ? filterDraft.tags.filter(tg => tg !== t.tag_name) 
                        : [...filterDraft.tags, t.tag_name];
                      setFilterDraft({...filterDraft, tags: newTags});
                    }}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '20px', 
                      border: filterDraft.tags.includes(t.tag_name) ? '1px solid #111' : '1px solid #eee',
                      backgroundColor: filterDraft.tags.includes(t.tag_name) ? '#111' : '#fff',
                      color: filterDraft.tags.includes(t.tag_name) ? '#fff' : '#333',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {t.tag_name}
                  </div>
                ))}
                {tags.length === 0 && <span style={{ color: '#999', fontSize: '13px' }}>尚無標籤資料</span>}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>加入時間</div>
              <select 
                value={filterDraft.joinTime} 
                onChange={(e) => setFilterDraft({...filterDraft, joinTime: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', outline: 'none' }}
              >
                <option value="全部時間">全部時間</option>
                <option value="最近7天">最近7天</option>
                <option value="最近30天">最近30天</option>
                <option value="最近90天">最近90天</option>
                <option value="最近一年">最近一年</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>最近互動時間</div>
              <select 
                value={filterDraft.lastInteractionTime} 
                onChange={(e) => setFilterDraft({...filterDraft, lastInteractionTime: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', outline: 'none' }}
              >
                <option value="全部時間">全部時間</option>
                <option value="24小時內">24小時內</option>
                <option value="最近7天">最近7天</option>
                <option value="最近30天">最近30天</option>
                <option value="最近90天">最近90天</option>
                <option value="超過90天">超過90天</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>是否有手機</div>
                <select 
                  value={filterDraft.phone} 
                  onChange={(e) => setFilterDraft({...filterDraft, phone: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', outline: 'none' }}
                >
                  <option value="全部">全部</option>
                  <option value="是">是</option>
                  <option value="否">否</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>是否有 Email</div>
                <select 
                  value={filterDraft.email} 
                  onChange={(e) => setFilterDraft({...filterDraft, email: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', outline: 'none' }}
                >
                  <option value="全部">全部</option>
                  <option value="是">是</option>
                  <option value="否">否</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setFilterDraft({ tags: [], joinTime: '全部時間', lastInteractionTime: '全部時間', phone: '全部', email: '全部' })}
                style={{ padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
              >
                清除條件
              </button>
              <button 
                onClick={() => {
                  setAdvancedFilters(filterDraft);
                  setIsFilterModalOpen(false);
                }}
                style={{ padding: '10px 20px', backgroundColor: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
              >
                套用條件
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#222', color: '#fff', width: '400px', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} className="text-yellow" /> 加入客戶群</h2>
              <X size={20} color="#888" style={{ cursor: 'pointer' }} onClick={() => setIsGroupModalOpen(false)} />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setGroupForm({...groupForm, mode: 'existing'})} 
                style={{ flex: 1, padding: '8px', backgroundColor: groupForm.mode === 'existing' ? '#FFD700' : '#333', color: groupForm.mode === 'existing' ? '#000' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >現有客群</button>
              <button 
                onClick={() => setGroupForm({...groupForm, mode: 'new'})} 
                style={{ flex: 1, padding: '8px', backgroundColor: groupForm.mode === 'new' ? '#FFD700' : '#333', color: groupForm.mode === 'new' ? '#000' : '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >建立新客群</button>
            </div>

            {groupForm.mode === 'existing' ? (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>選擇客群</label>
                <select 
                  value={groupForm.groupName} 
                  onChange={(e) => setGroupForm({...groupForm, groupName: e.target.value})}
                  style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="">請選擇客群...</option>
                  {groups.map(g => <option key={g.group_name} value={g.group_name}>{g.group_name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>新客群名稱</label>
                  <input 
                    type="text" 
                    value={groupForm.newGroupName} 
                    onChange={(e) => setGroupForm({...groupForm, newGroupName: e.target.value})}
                    placeholder="輸入客群名稱..."
                    style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>客群描述 (選填)</label>
                  <textarea 
                    value={groupForm.description} 
                    onChange={(e) => setGroupForm({...groupForm, description: e.target.value})}
                    placeholder="輸入客群描述..."
                    rows={3}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setIsGroupModalOpen(false)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveToGroup} disabled={isProcessing} style={{ padding: '8px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isProcessing ? '儲存中...' : '儲存並加入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {isTagModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#222', color: '#fff', width: '400px', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><Tag size={20} className="text-yellow" /> 批次上標籤</h2>
              <X size={20} color="#888" style={{ cursor: 'pointer' }} onClick={() => setIsTagModalOpen(false)} />
            </div>
            
            <p style={{ color: '#ccc', fontSize: '14px', marginBottom: '16px' }}>將為客群「{filterContext.value}」中的 {filteredCustomers.length} 名用戶統一加上標籤：</p>

            <div style={{ marginBottom: '24px' }}>
              <input 
                type="text" 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="輸入要新增的標籤名稱..."
                list="tag-options"
                style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
              />
              <datalist id="tag-options">
                {tags.map(t => <option key={t.tag_name} value={t.tag_name} />)}
              </datalist>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setIsTagModalOpen(false)} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleAddTagToGroup} disabled={isProcessing || !tagInput.trim()} style={{ padding: '8px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '6px', cursor: (isProcessing || !tagInput.trim()) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isProcessing ? '處理中...' : '確定新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#222', color: '#fff', width: '400px', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>編輯客戶資訊</h2>
              <X size={20} color="#888" style={{ cursor: 'pointer' }} onClick={() => { setIsEditModalOpen(false); setEditingCustomer(null); }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>名稱</label>
              <input 
                type="text" 
                value={editingCustomer.name} 
                onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                placeholder="輸入名稱..."
                style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>手機</label>
              <input 
                type="text" 
                value={editingCustomer.phone} 
                onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                placeholder="輸入手機號碼..."
                style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px' }}>電子信箱</label>
              <input 
                type="email" 
                value={editingCustomer.email} 
                onChange={(e) => setEditingCustomer({...editingCustomer, email: e.target.value})}
                placeholder="輸入電子信箱..."
                style={{ width: '100%', padding: '10px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => { setIsEditModalOpen(false); setEditingCustomer(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
              <button onClick={handleSaveCustomer} disabled={isProcessing} style={{ padding: '8px 16px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isProcessing ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedUserIds.length > 0 && activeTab === 'customers' && (
        <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#FFD700', color: '#000', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 100 }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>已選擇 {selectedUserIds.length} 名用戶</div>
          <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(0,0,0,0.2)' }}></div>
          <button onClick={() => setIsGroupModalOpen(true)} style={{ background: 'transparent', border: 'none', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
            <Plus size={16} /> 加入客群
          </button>
          <button onClick={() => setSelectedUserIds([])} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px' }}>
            取消
          </button>
        </div>
      )}

      {/* Customer Detail Sidebar */}
      <div style={{
        position: 'fixed', top: 0, right: selectedCustomerForSidebar ? 0 : '-400px', width: '400px', height: '100vh',
        backgroundColor: '#1a1a1a', borderLeft: '1px solid #333', boxShadow: '-5px 0 25px rgba(0,0,0,0.5)',
        transition: 'right 0.3s ease-in-out', zIndex: 1050, display: 'flex', flexDirection: 'column'
      }}>
        {selectedCustomerForSidebar && (
          <>
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedCustomerForSidebar.pic ? (
                    <img src={selectedCustomerForSidebar.pic} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Users size={20} color="#888" />
                  )}
                </div>
                {selectedCustomerForSidebar.name || '未命名用戶'}
              </h2>
              <X size={24} color="#888" style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomerForSidebar(null)} />
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>聯絡資訊</div>
                <div style={{ backgroundColor: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <Phone size={16} color="#FFD700" /> 
                    <span>{selectedCustomerForSidebar.phone || '未設定'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Mail size={16} color="#FFD700" /> 
                    <span>{selectedCustomerForSidebar.email || '未設定'}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>標籤</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={sidebarTagInput}
                    onChange={(e) => setSidebarTagInput(e.target.value)}
                    placeholder="輸入新標籤..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSidebarAddTag()}
                    style={{ flex: 1, padding: '8px 12px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', borderRadius: '6px', outline: 'none' }}
                  />
                  <button 
                    onClick={handleSidebarAddTag}
                    style={{ padding: '8px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}
                  >新增</button>
                </div>
                <div style={{ backgroundColor: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Array.isArray(selectedCustomerForSidebar.tag) && selectedCustomerForSidebar.tag.length > 0 ? (
                    selectedCustomerForSidebar.tag.map((t, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#333', fontSize: '13px', border: '1px solid #444', color: '#FFD700' }}>
                        <Tag size={12} style={{ marginRight: '6px' }} /> {t}
                        <X size={12} style={{ marginLeft: '6px', cursor: 'pointer', color: '#888' }} onClick={() => handleSidebarDeleteTag(t)} />
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#666', fontSize: '14px' }}>無標籤</span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>所屬客群</div>
                <div style={{ backgroundColor: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Array.isArray(selectedCustomerForSidebar.group_name) && selectedCustomerForSidebar.group_name.length > 0 ? (
                    selectedCustomerForSidebar.group_name.map((g, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#FFD700', fontSize: '13px', color: '#000', fontWeight: 'bold' }}>
                        <Users size={12} style={{ marginRight: '6px' }} /> {g}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#666', fontSize: '14px' }}>未加入任何客群</span>
                  )}
                </div>
              </div>

              {/* 自動旅程 (Projects) */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>自動旅程</div>
                <div style={{ backgroundColor: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sidebarDetails.loading ? (
                    <span style={{ color: '#666', fontSize: '14px' }}>載入中...</span>
                  ) : sidebarDetails.projects.length > 0 ? (
                    sidebarDetails.projects.map((p, i) => (
                      <span key={i} style={{ 
                        display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', 
                        backgroundColor: p.status === 'active' ? 'rgba(0,200,0,0.1)' : p.status === 'completed' ? 'rgba(33,150,243,0.1)' : 'rgba(255,255,255,0.1)', 
                        border: `1px solid ${p.status === 'active' ? '#00c800' : p.status === 'completed' ? '#2196F3' : '#444'}`, 
                        color: p.status === 'active' ? '#00c800' : p.status === 'completed' ? '#2196F3' : '#ccc' 
                      }}>
                        {p.name} ({p.status === 'active' ? '進行中' : p.status === 'completed' ? '已完成' : p.status === 'paused' ? '已中斷' : p.status})
                        <X size={12} style={{ marginLeft: '6px', cursor: 'pointer', color: p.status === 'active' ? '#00c800' : p.status === 'completed' ? '#2196F3' : '#888' }} onClick={() => handleSidebarDeleteProject(p.id, p.name)} />
                      </span>
                    ))
                  ) : (
                    <span style={{ color: '#666', fontSize: '14px' }}>未加入任何旅程</span>
                  )}
                </div>
              </div>

              {/* 圖文選單 (Rich Menu) */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#888', fontSize: '14px', marginBottom: '8px' }}>圖文選單</div>
                <div style={{ backgroundColor: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sidebarDetails.loading ? (
                    <span style={{ color: '#666', fontSize: '14px' }}>載入中...</span>
                  ) : sidebarDetails.rich_menu ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,215,0,0.1)', fontSize: '13px', border: '1px solid #FFD700', color: '#FFD700' }}>
                      {sidebarDetails.rich_menu.name}
                      <X size={12} style={{ marginLeft: '6px', cursor: 'pointer', color: '#FFD700' }} onClick={handleSidebarDeleteRichMenu} />
                    </span>
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '14px' }}>預設圖文選單</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid #333' }}>
              <button 
                onClick={() => navigate(`/oa/${oaId}/messages?userId=${selectedCustomerForSidebar.user_id}`)}
                style={{ width: '100%', padding: '12px', backgroundColor: '#FFD700', color: '#000', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                <MessageSquare size={18} /> 跳轉至訊息中心
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default CustomerCenter;
