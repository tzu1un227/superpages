import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Trash2, Plus, Check, X } from 'lucide-react';

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [newProject, setNewProject] = useState({ project_name: '', start_date: '', end_date: '', is_enabled: true });
    const [showAddForm, setShowAddForm] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        const res = await axios.get('http://localhost:5000/api/projects');
        setProjects(res.data);
    };

    const handleEditClick = (project) => {
        setEditingId(project.project_id);
        setEditFormData(project);
    };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditFormData({ ...editFormData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleUpdate = async () => {
        try {
            await axios.put(`http://localhost:5000/api/projects/${editingId}`, editFormData);
            setEditingId(null);
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '更新失敗');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('確定要刪除此專案嗎？')) {
            await axios.delete(`http://localhost:5000/api/projects/${id}`);
            fetchProjects();
        }
    };

    const handleCreate = async () => {
        try {
            await axios.post('http://localhost:5000/api/projects', newProject);
            setShowAddForm(false);
            setNewProject({ project_name: '', start_date: '', end_date: '', is_enabled: true });
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '新增失敗');
        }
    };

    return (
        <div style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 className="text-yellow">專案管理 (Projects)</h1>
                <button className="primary" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                    <Plus size={18} /> 新增專案
                </button>
            </div>

            {error && <p style={{ color: '#FF4D4D', marginBottom: '20px' }}>{error}</p>}

            {showAddForm && (
                <div className="card" style={{ marginBottom: '30px' }}>
                    <h3>新增專案</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', alignItems: 'end', marginTop: '15px' }}>
                        <div>
                            <label>名稱</label>
                            <input type="text" name="project_name" value={newProject.project_name} onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>開始時間</label>
                            <input type="datetime-local" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>結束時間</label>
                            <input type="datetime-local" value={newProject.end_date} onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })} style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label>啟用</label>
                            <input type="checkbox" checked={newProject.is_enabled} onChange={(e) => setNewProject({ ...newProject, is_enabled: e.target.checked })} />
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
                            <th>專案名稱</th>
                            <th>開始時間</th>
                            <th>結束時間</th>
                            <th>狀態</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((p) => (
                            <tr key={p.project_id}>
                                <td>{p.project_id}</td>
                                <td>
                                    {editingId === p.project_id ? (
                                        <input type="text" name="project_name" value={editFormData.project_name} onChange={handleEditChange} />
                                    ) : p.project_name}
                                </td>
                                <td>
                                    {editingId === p.project_id ? (
                                        <input type="datetime-local" name="start_date" value={editFormData.start_date.replace(' ', 'T')} onChange={handleEditChange} />
                                    ) : p.start_date}
                                </td>
                                <td>
                                    {editingId === p.project_id ? (
                                        <input type="datetime-local" name="end_date" value={editFormData.end_date.replace(' ', 'T')} onChange={handleEditChange} />
                                    ) : p.end_date}
                                </td>
                                <td>
                                    {editingId === p.project_id ? (
                                        <input type="checkbox" name="is_enabled" checked={editFormData.is_enabled} onChange={handleEditChange} />
                                    ) : (p.is_enabled ? '✅ 啟用' : '❌ 停用')}
                                </td>
                                <td>
                                    {editingId === p.project_id ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Check className="text-yellow" style={{ cursor: 'pointer' }} onClick={handleUpdate} />
                                            <X style={{ cursor: 'pointer' }} onClick={() => setEditingId(null)} />
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <Edit2 size={18} style={{ cursor: 'pointer' }} onClick={() => handleEditClick(p)} />
                                            <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDelete(p.project_id)} />
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Projects;
