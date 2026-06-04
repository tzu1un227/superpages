import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { 
    Play, Save, Plus, Trash2, RefreshCw, 
    CheckCircle, XCircle, Database, FileText, AlertCircle, Zap
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';

function TestRunner() {
    const { oaId } = useParams();
    const { showToast } = useToast();
    
    // State
    const [testCases, setTestCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState([]);
    const [testUserId, setTestUserId] = useState('');

    useEffect(() => {
        fetchTestCases();
    }, [oaId]);

    const fetchTestCases = async () => {
        setLoading(true);
        try {
            const res = await api.get('/test-runner/test_cases');
            if (res.data.cases) {
                setTestCases(res.data.cases);
            }
        } catch (err) {
            showToast('無法取得測試案例', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/test-runner/test_cases', { cases: testCases });
            showToast('測試案例已儲存', 'success');
        } catch (err) {
            showToast('儲存失敗', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRunTests = async () => {
        if (testCases.length === 0) {
            showToast('請先新增至少一筆測試案例', 'error');
            return;
        }
        
        setRunning(true);
        setResults([]); // Clear previous results
        
        try {
            showToast('開始逐筆執行測試，請稍候...', 'info');
            let currentResults = [];
            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                try {
                    const res = await api.post('/test-runner/execute', { cases: [tc] }, { timeout: 90000 });
                    if (res.data.results && res.data.results.length > 0) {
                        const r = res.data.results[0];
                        currentResults.push(r);
                        setResults([...currentResults]);
                        setTestUserId(res.data.test_user_id);
                    }
                } catch (err) {
                    currentResults.push({
                        id: tc.id, keyword: tc.trigger_keyword, status: 'Fail',
                        reason: 'API錯誤或斷線: ' + err.message, actual_content: '', actual_state: ''
                    });
                    setResults([...currentResults]);
                }
            }
            
            const fails = currentResults.filter(r => r.status === 'Fail').length;
            if (fails > 0) {
                showToast(`測試完成，共有 ${fails} 項失敗`, 'error');
            } else {
                showToast('恭喜！所有測試皆通過 ✅', 'success');
            }
        } finally {
            setRunning(false);
        }
    };



    const addTestCase = () => {
        const newId = testCases.length > 0 ? Math.max(...testCases.map(t => t.id || 0)) + 1 : 1;
        setTestCases([...testCases, { id: newId, trigger_type: 'Message', trigger_keyword: '', expected_state: '00000', expected_reply_type: '', expected_content: '' }]);
    };

    const removeTestCase = (index) => {
        const newCases = [...testCases];
        newCases.splice(index, 1);
        setTestCases(newCases);
    };

    const updateTestCase = (index, field, value) => {
        const newCases = [...testCases];
        newCases[index][field] = value;
        setTestCases(newCases);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '25px', overflowY: 'auto', paddingBottom: '30px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Play size={32} className="text-yellow" />
                        系統測試儀表板 (REST API Test Runner)
                    </h1>
                    <p style={{ color: '#B0B0B0' }}>透過底層 Websocket 自動驅動機器人，並直接從資料庫檢驗測試結果。完全無副作用。</p>
                </div>
            </div>

            {/* Main Action Bar */}
            <div className="card" style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={handleRunTests} className="primary" disabled={running || loading} style={{ backgroundColor: '#28a745', border: 'none', padding: '10px 25px', fontSize: '16px' }}>
                        {running ? <LoadingSpinner size={20} /> : <Play size={20} />} 
                        {running ? '正在自動執行測試...' : '執行全部測試 ▶'}
                    </button>

                    
                    {testUserId && !running && (
                        <span style={{ fontSize: '13px', color: '#888' }}>測試執行綁定之 UserID: <code style={{color:'#ddd'}}>{testUserId}</code></span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={addTestCase} className="secondary">
                        <Plus size={18} /> 新增情境
                    </button>
                    <button onClick={handleSave} className="primary" disabled={saving || loading}>
                        {saving ? <LoadingSpinner size={18} /> : <Save size={18} />} 儲存案例
                    </button>
                </div>
            </div>

            {/* Two Column Layout: Cases & Results */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                
                {/* Test Cases Editor (Left) */}
                <div className="card" style={{ flex: '1', padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} className="text-yellow" />
                        <h3 style={{ margin: 0, fontSize: '16px' }}>測試案例清單 (編輯區)</h3>
                    </div>
                    
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}><LoadingSpinner size={30} /></div>
                    ) : testCases.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>尚無測試案例，請點擊右上方新增</div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e1e1e', zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333', width: '30px' }}>#</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333', width: '110px' }}>事件類型</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>觸發內容/關鍵字</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333', width: '120px' }}>預期回覆格式</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>預期文字內容</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333', width: '80px' }}>預期狀態</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #333', width: '40px' }}>刪除</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testCases.map((tc, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                            <td style={{ padding: '10px', color: '#888' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px' }}>
                                                <select value={tc.trigger_type || 'Message'} onChange={e => updateTestCase(idx, 'trigger_type', e.target.value)}
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }}>
                                                    <option value="Message">Message</option>
                                                    <option value="Image">Image</option>
                                                    <option value="Location">Location</option>
                                                    <option value="Beacon">Beacon</option>
                                                    <option value="Postback">Postback</option>
                                                    <option value="Follow">Follow</option>
                                                    <option value="Unfollow">Unfollow</option>
                                                    <option value="Sensor">Sensor</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <input type="text" value={tc.trigger_keyword || ''} onChange={e => updateTestCase(idx, 'trigger_keyword', e.target.value)} 
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }} placeholder="觸發內容" />
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <select value={tc.expected_reply_type || 'text'} onChange={e => updateTestCase(idx, 'expected_reply_type', e.target.value)}
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }}>
                                                    <option value="">(無)</option>
                                                    <option value="text">文字 (text)</option>
                                                    <option value="image">圖片 (image)</option>
                                                    <option value="flex">Flex 卡片</option>
                                                    <option value="video">影片 (video)</option>
                                                    <option value="audio">語音 (audio)</option>
                                                    <option value="location">位置 (location)</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <input type="text" value={tc.expected_content || ''} onChange={e => updateTestCase(idx, 'expected_content', e.target.value)} 
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }} placeholder="包含此字串" />
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <input type="text" value={tc.expected_state || ''} onChange={e => updateTestCase(idx, 'expected_state', e.target.value)} 
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }} placeholder="00000" />
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <button onClick={() => removeTestCase(idx)} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '5px' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Test Results Viewer (Right) */}
                <div className="card" style={{ flex: '1', padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertCircle size={20} className={results.length > 0 && results.some(r => r.status === 'Fail') ? "text-red-400" : "text-green-400"} />
                        <h3 style={{ margin: 0, fontSize: '16px' }}>測試執行結果</h3>
                        {results.length > 0 && (
                            <span style={{ marginLeft: 'auto', fontSize: '13px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#333' }}>
                                完成: {results.length} 筆
                            </span>
                        )}
                    </div>
                    
                    {results.length === 0 && running ? (
                        <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            <LoadingSpinner size={40} />
                            <p style={{ color: '#888' }}>正在準備執行自動化測試階段...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>尚未執行測試。請點擊上方按鈕開始。</div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            {running && (
                                <div style={{ padding: '10px', backgroundColor: '#333', textAlign: 'center', fontSize: '13px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <LoadingSpinner size={16} /> 正在逐筆寫入測試記錄...
                                </div>
                            )}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e1e1e', zIndex: 10 }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333', width: '50px' }}>狀態</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>觸發來源</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>實際回覆預覽</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>實際狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((res, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: res.status === 'Fail' ? 'rgba(255, 77, 77, 0.1)' : 'transparent' }}>
                                            <td style={{ padding: '10px', verticalAlign: 'top' }}>
                                                {res.status === 'Pass' ? 
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#28a745', fontWeight: 'bold' }}>
                                                        <CheckCircle size={16} /> PASS
                                                    </div> 
                                                    : 
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ff4d4d', fontWeight: 'bold' }}>
                                                        <XCircle size={16} /> FAIL
                                                    </div>
                                                }
                                            </td>
                                            <td style={{ padding: '10px', color: '#ccc', verticalAlign: 'top', fontWeight: 'bold' }}>
                                                <div style={{ color: '#888', fontSize: '11px', marginBottom: '2px' }}>{res.type}</div>
                                                {res.keyword}
                                            </td>
                                            <td style={{ padding: '10px', color: res.status === 'Fail' ? '#ff9999' : '#aaa' }}>
                                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                    {res.actual_types && res.actual_types.map((t, i) => (
                                                        <span key={i} style={{ backgroundColor: '#217b7b', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div style={{ wordBreak: 'break-all', maxHeight: '60px', overflowY: 'hidden' }}>{String(res.actual_content).substring(0, 100)}{String(res.actual_content).length > 100 ? '...' : ''}</div>
                                                {res.status === 'Fail' && <div style={{ color: '#ff4d4d', marginTop: '5px', fontSize: '12px' }}>原因: {res.reason}</div>}
                                            </td>
                                            <td style={{ padding: '10px', color: '#ccc', verticalAlign: 'top' }}><code>{res.actual_state}</code></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}

export default TestRunner;
