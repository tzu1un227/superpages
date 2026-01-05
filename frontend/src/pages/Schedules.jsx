import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Trash2, Plus, Check, X, Filter } from 'lucide-react';

const Schedules = () => {
    const [schedules, setSchedules] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [newSchedule, setNewSchedule] = useState({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchSchedules();
    }, [selectedProjectId]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/projects');
            setProjects(res.data);
            // Default to 'All' or first project
        } catch (err) {
            setError('無法取得專案列表');
        }
    };

    const fetchSchedules = async () => {
        try {
            const url = selectedProjectId
                ? `http://localhost:5000/api/schedules?project_id=${selectedProjectId}`
                : `http://localhost:5000/api/schedules`;
            const res = await axios.get(url);
            setSchedules(res.data);
        } catch (err) {
            setError('無法取得排程資料');
        }
    };

    const handleEditClick = (schedule) => {
        setEditingId(schedule.schedule_id);
        setEditFormData(schedule);
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({ ...editFormData, [name]: value });
    };

    const handleUpdate = async () => {
        try {
            await axios.put(`http://localhost:5000/api/schedules/${editingId}`, editFormData);
            setEditingId(null);
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '更新失敗');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('確定要刪除此排程嗎？')) {
            await axios.delete(`http://localhost:5000/api/schedules/${id}`);
            fetchSchedules();
        }
    };

    const handleCreate = async () => {
        try {
            const scheduleToCreate = { ...newSchedule, project_id: selectedProjectId };
            await axios.post('http://localhost:5000/api/schedules', scheduleToCreate);
            setShowAddForm(false);
            setNewSchedule({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '新增失敗');
        }
    };

    return (
        <div style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="text-yellow">排程管理 (Schedules)</h1>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Filter size={18} className="text-yellow" />
                        <label>選擇專案：</label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#222', color: 'white' }}
                        >
                            <option value="">全部顯示</option>
                            {projects.map(p => (
                                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                            ))}
                        </select>
                    </div>
                    <button className="primary" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                        <Plus size={18} /> 新增排程
                    </button>
                </div>
            </div>

            {error && <p style={{ color: '#FF4D4D', marginBottom: '20px' }}>{error}</p>}

            {showAddForm && (
                <div className="card" style={{ marginBottom: '30px' }}>
                    <h3>新增排程 {selectedProjectId ? `(專案ID: ${selectedProjectId})` : ''}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '15px', alignItems: 'end', marginTop: '15px' }}>
                        {!selectedProjectId && (
                            <div>
                                <label>專案 ID</label>
                                <input type="number" value={newSchedule.project_id} onChange={(e) => setNewSchedule({ ...newSchedule, project_id: e.target.value })} style={{ width: '100%' }} />
                            </div>
                        )}
                        <div>
                            <label>步驟 ID</label>
                            <input type="number" value={newSchedule.step_id} onChange={(e) => setNewSchedule({ ...newSchedule, step_id: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>間隔小時</label>
                            <input type="number" step="0.1" value={newSchedule.interval_hours} onChange={(e) => setNewSchedule({ ...newSchedule, interval_hours: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>訊息內容</label>
                            <input type="text" value={newSchedule.message_content} onChange={(e) => setNewSchedule({ ...newSchedule, message_content: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="primary" onClick={handleCreate}>儲存</button>
                            <button onClick={() => setShowAddForm(false)} style={{ background: '#444' }}>取消</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: '0' }}>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>步驟 ID</th>
                            <th>間隔小時</th>
                            <th>訊息內容</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedules.length > 0 ? schedules.map((s) => (
                            <tr key={s.schedule_id}>
                                <td>{s.schedule_id}</td>
                                <td>
                                    {editingId === s.schedule_id ? (
                                        <input type="number" name="step_id" value={editFormData.step_id} onChange={handleEditChange} />
                                    ) : s.step_id}
                                </td>
                                <td>
                                    {editingId === s.schedule_id ? (
                                        <input type="number" step="0.1" name="interval_hours" value={editFormData.interval_hours} onChange={handleEditChange} />
                                    ) : s.interval_hours}
                                </td>
                                <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {editingId === s.schedule_id ? (
                                        <input type="text" name="message_content" value={editFormData.message_content} onChange={handleEditChange} style={{ width: '100%' }} />
                                    ) : s.message_content}
                                </td>
                                <td>
                                    {editingId === s.schedule_id ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Check className="text-yellow" style={{ cursor: 'pointer' }} onClick={handleUpdate} />
                                            <X style={{ cursor: 'pointer' }} onClick={() => setEditingId(null)} />
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <Edit2 size={18} style={{ cursor: 'pointer' }} onClick={() => handleEditClick(s)} />
                                            <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDelete(s.schedule_id)} />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>該專案目前無排程資料</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Schedules;
