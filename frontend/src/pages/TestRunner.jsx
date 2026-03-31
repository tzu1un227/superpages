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
                    const res = await api.post('/test-runner/execute', { cases: [tc] }, { timeout: 30000 });
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

    const runSheetSyncCommand = async (commandName) => {
        setRunning(true);
        try {
            showToast(`正在發送指令：${commandName}，請稍候...`, 'info');
            const res = await api.post('/test-runner/execute', { 
                cases: [{ trigger_keyword: commandName, expected_reply_type: '' }] 
            }, { timeout: 60000 });
            const result = res.data.results[0];
            if (result && result.actual_content) {
                showToast(`機器人回應：${result.actual_content.substring(0, 50)}...`, 'success');
            } else {
                showToast('指令發送成功，但機器人未回應或重新啟動中', 'info');
            }
        } catch (err) {
            showToast('發送指令失敗: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setRunning(false);
        }
    };

    const handleOneClickTest = async () => {
        if (testCases.length === 0) {
            showToast('請先新增至少一筆測試案例', 'error');
            return;
        }
        
        setRunning(true);
        setResults([]);
        
        try {
            // 階段 1: 載入測試法則
            showToast('【階段 1/3】向機器人發送切換指令，請稍候 10 秒等待同步...', 'info');
            await api.post('/test-runner/execute', { 
                cases: [{ trigger_keyword: '!更新法則 一般法則_測試版', expected_reply_type: '' }] 
            }, { timeout: 60000 });
            await new Promise(r => setTimeout(r, 10000));
            
            // 階段 2: 執行全部測試
            showToast('【階段 2/3】正在自動化逐筆執行測試，畫面會即時更新結果...', 'info');
            let hasFails = false;
            let currentResults = [];
            
            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                try {
                    const res = await api.post('/test-runner/execute', { cases: [tc] }, { timeout: 30000 });
                    if (res.data.results && res.data.results.length > 0) {
                        const r = res.data.results[0];
                        if (r.status === 'Fail') hasFails = true;
                        currentResults.push(r);
                        setResults([...currentResults]);
                        setTestUserId(res.data.test_user_id);
                    }
                } catch (err) {
                    hasFails = true;
                    currentResults.push({
                        id: tc.id, keyword: tc.trigger_keyword, status: 'Fail',
                        reason: 'API連接逾時或發送失敗', actual_content: '', actual_state: ''
                    });
                    setResults([...currentResults]);
                }
            }
            
            // 階段 3: 還原正式法則
            showToast('【階段 3/3】測試完畢，發送「上傳」指令以還原正式法則庫 (等待10秒)...', 'info');
            await api.post('/test-runner/execute', { 
                cases: [{ trigger_keyword: '上傳', expected_reply_type: '' }] 
            }, { timeout: 60000 });
            await new Promise(r => setTimeout(r, 10000));
            
            if (hasFails) {
                showToast('一鍵測試流程完成，但有部分測試失敗 ❌', 'error');
            } else {
                showToast('🎉 一鍵自動測試全流程完成，且全數通過 ✅', 'success');
            }
        } catch (err) {
            showToast('一鍵自動化流程中斷: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setRunning(false);
        }
    };

    const addTestCase = () => {
        const newId = testCases.length > 0 ? Math.max(...testCases.map(t => t.id || 0)) + 1 : 1;
        setTestCases([...testCases, { id: newId, trigger_keyword: '', expected_state: '00000' }]);
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
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => runSheetSyncCommand('!更新法則 一般法則_測試版')} className="secondary" disabled={running} title="模擬發送切換法則表指令">
                        <Database size={18} /> 載入測試法則庫
                    </button>
                    <button onClick={() => runSheetSyncCommand('上傳')} className="secondary" disabled={running}>
                        <RefreshCw size={18} /> 還原正式法則庫
                    </button>
                </div>
            </div>

            {/* Main Action Bar */}
            <div className="card" style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={handleRunTests} className="primary" disabled={running || loading} style={{ backgroundColor: '#28a745', border: 'none', padding: '10px 25px', fontSize: '16px' }}>
                        {running ? <LoadingSpinner size={20} /> : <Play size={20} />} 
                        {running ? '正在自動執行測試...' : '執行全部測試 ▶'}
                    </button>
                    <button onClick={handleOneClickTest} className="primary" disabled={running || loading} style={{ backgroundColor: '#ff9900', border: 'none', padding: '10px 25px', fontSize: '16px', color: '#111', fontWeight: 'bold' }}>
                        {running ? <LoadingSpinner size={20} /> : <Zap size={20} />} 
                        一鍵自動完成 (載入➜測試➜還原) 🚀
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
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>觸發關鍵字</th>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>預期狀態(選填)</th>
                                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #333', width: '40px' }}>刪除</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testCases.map((tc, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                            <td style={{ padding: '10px', color: '#888' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px' }}>
                                                <input type="text" value={tc.trigger_keyword || ''} onChange={e => updateTestCase(idx, 'trigger_keyword', e.target.value)} 
                                                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #444', color: '#fff' }} placeholder="#test" />
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
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #333' }}>觸發指令</th>
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
                                            <td style={{ padding: '10px', color: '#ccc', verticalAlign: 'top', fontWeight: 'bold' }}>{res.keyword}</td>
                                            <td style={{ padding: '10px', color: res.status === 'Fail' ? '#ff9999' : '#aaa' }}>
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
