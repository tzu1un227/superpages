import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Search, Database, Table, Eye, RefreshCw, 
    ChevronLeft, ChevronRight, Download, Filter,
    Database as DbIcon, LayoutList, SearchX
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

const CHUNK_SIZE = 300;

function DatabaseViewer() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    
    // State
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    
    // Data State
    const [tableData, setTableData] = useState([]);
    const [totalRows, setTotalRows] = useState(0);
    const [offset, setOffset] = useState(0);
    
    // Cache State: { [tableName]: { data, total, offset, searchTerm } }
    const [cache, setCache] = useState({});

    // Fetch Tables on Mount
    useEffect(() => {
        fetchTables();
    }, [oaId]);

    const fetchTables = async () => {
        setLoading(true);
        try {
            const res = await api.get('/db/tables');
            setTables(res.data.tables || []);
            if (res.data.tables && res.data.tables.length > 0) {
                // Don't auto-select to avoid massive load immediately
            }
        } catch (err) {
            showToast('無法取得資料表清單', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async (tableName, newOffset = 0, isMore = false, forceSearch = '') => {
        if (!tableName) return;
        
        // If not loading more and we have cache for same search, use it
        if (!isMore && !forceSearch && cache[tableName] && cache[tableName].searchTerm === '') {
            const cached = cache[tableName];
            setTableData(cached.data);
            setTotalRows(cached.total);
            setOffset(cached.offset);
            setSelectedTable(tableName);
            setActiveSearch('');
            setSearchTerm('');
            return;
        }

        if (isMore) setLoading(false); // don't block UI for "load more"
        else setLoading(true);

        try {
            const res = await api.get('/db/data', {
                params: {
                    table: tableName,
                    limit: CHUNK_SIZE,
                    offset: newOffset,
                    search: forceSearch
                }
            });

            const newData = res.data.data || [];
            const total = res.data.total || 0;

            if (isMore) {
                setTableData(prev => [...prev, ...newData]);
            } else {
                setTableData(newData);
            }
            
            setTotalRows(total);
            setOffset(newOffset);
            setSelectedTable(tableName);
            setActiveSearch(forceSearch);

            // Update Cache if it's a full load/standard load (not search results or we can cache search too)
            if (!forceSearch) {
                setCache(prev => ({
                    ...prev,
                    [tableName]: {
                        data: isMore ? [...(prev[tableName]?.data || []), ...newData] : newData,
                        total: total,
                        offset: newOffset,
                        searchTerm: ''
                    }
                }));
            }

        } catch (err) {
            showToast('載入資料失敗', 'error');
        } finally {
            setLoading(false);
            setSearching(false);
        }
    };

    const handleTableChange = (e) => {
        const val = e.target.value;
        if (!val) {
            setSelectedTable('');
            setTableData([]);
            return;
        }
        loadData(val, 0);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!selectedTable) return;
        setSearching(true);
        loadData(selectedTable, 0, false, searchTerm);
    };

    const handleLoadMore = () => {
        if (tableData.length >= totalRows) return;
        loadData(selectedTable, offset + CHUNK_SIZE, true, activeSearch);
    };

    // Columns Derived from first row
    const columns = useMemo(() => {
        if (tableData.length === 0) return [];
        return Object.keys(tableData[0]);
    }, [tableData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '25px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <DbIcon size={32} className="text-yellow" />
                        資料庫檢視
                    </h1>
                    <p style={{ color: '#B0B0B0' }}>瀏覽資料庫中的 Table 與 View，支援分段載入與搜尋</p>
                </div>
                
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div className="search-box" style={{ width: '300px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                        <form onSubmit={handleSearch}>
                            <input 
                                type="text" 
                                placeholder="搜尋文字內容..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '40px', width: '100%' }}
                                disabled={!selectedTable}
                            />
                        </form>
                    </div>
                    <button 
                        onClick={() => fetchTables()} 
                        className="secondary" 
                        style={{ padding: '8px 15px' }}
                        title="重新刷新清單"
                    >
                        <RefreshCw size={20} className={loading && !selectedTable ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Selector Card */}
            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <LayoutList size={20} className="text-gray-400" />
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>選擇資料表：</span>
                    <select 
                        value={selectedTable} 
                        onChange={handleTableChange}
                        style={{ flex: 1, maxWidth: '400px', padding: '10px' }}
                    >
                        <option value="">-- 請選擇資料表 --</option>
                        {tables.map(t => (
                            <option key={t.table_name} value={t.table_name}>
                                [{t.table_type === 'VIEW' ? 'View' : 'Table'}] {t.table_name}
                            </option>
                        ))}
                    </select>
                    
                    {selectedTable && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', color: '#888' }}>
                            <span>總筆數: <b className="text-white">{totalRows}</b></span>
                            <span>目前載入: <b className="text-white">{tableData.length}</b></span>
                            {activeSearch && <span>搜尋關鍵字: <b className="text-yellow">"{activeSearch}"</b></span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
                {loading && tableData.length === 0 ? (
                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '15px' }}>
                        <LoadingSpinner size={40} />
                        <p style={{ color: '#666' }}>正從資料庫檢索數據...</p>
                    </div>
                ) : !selectedTable ? (
                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '20px', color: '#444' }}>
                        <Table size={64} opacity={0.3} />
                        <p style={{ fontSize: '18px' }}>請先選擇一個資料表以開始瀏覽</p>
                    </div>
                ) : tableData.length === 0 ? (
                    <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '20px', color: '#444' }}>
                        <SearchX size={64} opacity={0.3} />
                        <p style={{ fontSize: '18px' }}>找不到任何符合條件的資料</p>
                        {activeSearch && <button onClick={() => loadData(selectedTable, 0)} className="secondary">清除搜尋</button>}
                    </div>
                ) : (
                    <>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        {columns.map(col => (
                                            <th key={col} style={{ padding: '12px 15px', textAlign: 'left', backgroundColor: '#2a2a2a', color: '#aaa', borderBottom: '1px solid #333' }}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #222', transition: 'background 0.2s' }} className="hover:bg-zinc-800">
                                            {columns.map(col => (
                                                <td key={col} style={{ padding: '10px 15px', color: '#ddd', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {row[col] === null ? <em style={{ color: '#555' }}>null</em> : 
                                                     typeof row[col] === 'object' ? JSON.stringify(row[col]) : 
                                                     String(row[col])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Footer / Load More */}
                        <div style={{ padding: '15px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
                            {tableData.length < totalRows ? (
                                <button 
                                    onClick={handleLoadMore} 
                                    className="secondary" 
                                    style={{ padding: '8px 40px', borderRadius: '20px' }}
                                    disabled={loading}
                                >
                                    {loading ? '載入中...' : `載入更多 (剩餘 ${totalRows - tableData.length} 筆)`}
                                </button>
                            ) : (
                                <div style={{ color: '#555', fontSize: '14px' }}>
                                    已載入全部內容 ({totalRows} 筆)
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default DatabaseViewer;
