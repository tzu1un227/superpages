import api from '../api';
import { Edit2, Trash2, Plus, Check, X, Filter, Clock, LayoutDashboard } from 'lucide-react';

const ProjectsManagement = () => {
    const [projects, setProjects] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [editProjectFormData, setEditProjectFormData] = useState({});
    const [newProject, setNewProject] = useState({ project_name: '', start_date: '', end_date: '', is_enabled: true });
    const [showAddProjectForm, setShowAddProjectForm] = useState(false);

    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [editScheduleFormData, setEditScheduleFormData] = useState({});
    const [newSchedule, setNewSchedule] = useState({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
    const [showAddScheduleForm, setShowAddScheduleForm] = useState(false);

    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('projects'); // projects or schedules

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        fetchSchedules();
    }, [selectedProjectId, activeTab]);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/api/projects');
            setProjects(res.data);
        } catch (err) {
            setError('無法取得專案列表');
        }
    };

    const fetchSchedules = async () => {
        if (activeTab !== 'schedules') return;
        try {
            const url = selectedProjectId
                ? `/api/schedules?project_id=${selectedProjectId}`
                : `/api/schedules`;
            const res = await api.get(url);
            setSchedules(res.data);
        } catch (err) {
            setError('無法取得排程資料');
        }
    };

    // Project Actions
    const handleEditProjectClick = (project) => {
        setEditingProjectId(project.project_id);
        setEditProjectFormData(project);
    };

    const handleUpdateProject = async () => {
        try {
            await api.put(`/api/projects/${editingProjectId}`, editProjectFormData);
            setEditingProjectId(null);
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '專案更新失敗');
        }
    };

    const handleDeleteProject = async (id) => {
        if (window.confirm('確定要刪除此專案嗎？相關排程也可能受到影響。')) {
            await api.delete(`/api/projects/${id}`);
            fetchProjects();
        }
    };

    const handleCreateProject = async () => {
        try {
            await api.post('/api/projects', newProject);
            setShowAddProjectForm(false);
            setNewProject({ project_name: '', start_date: '', end_date: '', is_enabled: true });
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '新增專案失敗');
        }
    };

    // Schedule Actions
    const handleEditScheduleClick = (schedule) => {
        setEditingScheduleId(schedule.schedule_id);
        setEditScheduleFormData(schedule);
    };

    const handleUpdateSchedule = async () => {
        try {
            await api.put(`/api/schedules/${editingScheduleId}`, editScheduleFormData);
            setEditingScheduleId(null);
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '排程更新失敗');
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (window.confirm('確定要刪除此排程嗎？')) {
            await api.delete(`/api/schedules/${id}`);
            fetchSchedules();
        }
    };

    const handleCreateSchedule = async () => {
        try {
            const scheduleToCreate = { ...newSchedule, project_id: selectedProjectId || newSchedule.project_id };
            if (!scheduleToCreate.project_id) {
                setError('請先選擇或輸入專案 ID');
                return;
            }
            await api.post('/api/schedules', scheduleToCreate);
            setShowAddScheduleForm(false);
            setNewSchedule({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '新增排程失敗');
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>專案與排程管理</h1>
                <p style={{ color: '#B0B0B0' }}>管理自動化推播專案及其對應的執行排程</p>
            </div>

            {error && (
                <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', color: '#FF4D4D', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '25px' }}>
                <button
                    onClick={() => setActiveTab('projects')}
                    style={{
                        padding: '12px 25px',
                        backgroundColor: activeTab === 'projects' ? 'var(--secondary-black)' : 'transparent',
                        color: activeTab === 'projects' ? 'var(--primary-yellow)' : '#B0B0B0',
                        borderBottom: activeTab === 'projects' ? '2px solid var(--primary-yellow)' : 'none',
                        display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px 8px 0 0'
                    }}
                >
                    <LayoutDashboard size={18} /> 專案管理
                </button>
                <button
                    onClick={() => setActiveTab('schedules')}
                    style={{
                        padding: '12px 25px',
                        backgroundColor: activeTab === 'schedules' ? 'var(--secondary-black)' : 'transparent',
                        color: activeTab === 'schedules' ? 'var(--primary-yellow)' : '#B0B0B0',
                        borderBottom: activeTab === 'schedules' ? '2px solid var(--primary-yellow)' : 'none',
                        display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px 8px 0 0'
                    }}
                >
                    <Clock size={18} /> 排程設定
                </button>
            </div>

            {activeTab === 'projects' ? (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '20px' }}>專案列表</h3>
                        <button className="primary" onClick={() => setShowAddProjectForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                            <Plus size={18} /> 新增專案
                        </button>
                    </div>

                    {showAddProjectForm && (
                        <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '15px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>專案名稱</label>
                                    <input type="text" value={newProject.project_name} onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>開始時間</label>
                                    <input type="datetime-local" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>結束時間</label>
                                    <input type="datetime-local" value={newProject.end_date} onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0' }}>
                                        <input type="checkbox" checked={newProject.is_enabled} onChange={(e) => setNewProject({ ...newProject, is_enabled: e.target.checked })} /> 啟用
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="primary" onClick={handleCreateProject}>儲存</button>
                                    <button onClick={() => setShowAddProjectForm(false)} style={{ background: '#444' }}>取消</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>專案名稱</th>
                                    <th>有效期間</th>
                                    <th>狀態</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p) => (
                                    <tr key={p.project_id}>
                                        <td>{p.project_id}</td>
                                        <td>
                                            {editingProjectId === p.project_id ? (
                                                <input type="text" value={editProjectFormData.project_name} onChange={e => setEditProjectFormData({ ...editProjectFormData, project_name: e.target.value })} />
                                            ) : p.project_name}
                                        </td>
                                        <td style={{ fontSize: '14px' }}>
                                            {editingProjectId === p.project_id ? (
                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                    <input type="datetime-local" value={editProjectFormData.start_date.replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, start_date: e.target.value })} style={{ padding: '5px' }} />
                                                    <span>~</span>
                                                    <input type="datetime-local" value={editProjectFormData.end_date.replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, end_date: e.target.value })} style={{ padding: '5px' }} />
                                                </div>
                                            ) : (
                                                <span style={{ color: '#B0B0B0' }}>{p.start_date} ~ {p.end_date}</span>
                                            )}
                                        </td>
                                        <td>
                                            {editingProjectId === p.project_id ? (
                                                <input type="checkbox" checked={editProjectFormData.is_enabled} onChange={e => setEditProjectFormData({ ...editProjectFormData, is_enabled: e.target.checked })} />
                                            ) : (p.is_enabled ? <span style={{ color: '#4CAF50' }}>● 已啟用</span> : <span style={{ color: '#666' }}>○ 已停用</span>)}
                                        </td>
                                        <td>
                                            {editingProjectId === p.project_id ? (
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <Check className="text-yellow" style={{ cursor: 'pointer' }} onClick={handleUpdateProject} />
                                                    <X style={{ cursor: 'pointer' }} onClick={() => setEditingProjectId(null)} />
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '15px' }}>
                                                    <Edit2 size={18} style={{ cursor: 'pointer', color: '#B0B0B0' }} onClick={() => handleEditProjectClick(p)} />
                                                    <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDeleteProject(p.project_id)} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <h3 style={{ fontSize: '20px' }}>排程清單</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '8px' }}>
                                <Filter size={16} className="text-yellow" />
                                <span style={{ fontSize: '14px' }}>過濾專案:</span>
                                <select
                                    value={selectedProjectId}
                                    onChange={e => setSelectedProjectId(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', padding: '5px' }}
                                >
                                    <option value="">全部顯示</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <button className="primary" onClick={() => setShowAddScheduleForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                            <Plus size={18} /> 新增排程
                        </button>
                    </div>

                    {showAddScheduleForm && (
                        <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 100px 100px 2fr auto', gap: '15px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>所屬專案</label>
                                    <select
                                        value={newSchedule.project_id || selectedProjectId}
                                        onChange={e => setNewSchedule({ ...newSchedule, project_id: e.target.value })}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">選擇專案...</option>
                                        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>步驟 ID</label>
                                    <input type="number" value={newSchedule.step_id} onChange={e => setNewSchedule({ ...newSchedule, step_id: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>間隔 (時)</label>
                                    <input type="number" step="0.1" value={newSchedule.interval_hours} onChange={e => setNewSchedule({ ...newSchedule, interval_hours: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>訊息內容</label>
                                    <input type="text" value={newSchedule.message_content} onChange={e => setNewSchedule({ ...newSchedule, message_content: e.target.value })} style={{ width: '100%' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="primary" onClick={handleCreateSchedule}>儲存</button>
                                    <button onClick={() => setShowAddScheduleForm(false)} style={{ background: '#444' }}>取消</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>專案</th>
                                    <th>步驟</th>
                                    <th>間隔時間</th>
                                    <th>預設訊息內容</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules.length > 0 ? schedules.map((s) => (
                                    <tr key={s.schedule_id}>
                                        <td>{s.schedule_id}</td>
                                        <td style={{ fontSize: '13px', color: '#B0B0B0' }}>
                                            {projects.find(p => p.project_id === s.project_id)?.project_name || `ID: ${s.project_id}`}
                                        </td>
                                        <td>
                                            {editingScheduleId === s.schedule_id ? (
                                                <input type="number" value={editScheduleFormData.step_id} onChange={e => setEditScheduleFormData({ ...editScheduleFormData, step_id: e.target.value })} style={{ width: '60px' }} />
                                            ) : s.step_id}
                                        </td>
                                        <td>
                                            {editingScheduleId === s.schedule_id ? (
                                                <input type="number" step="0.1" value={editScheduleFormData.interval_hours} onChange={e => setEditScheduleFormData({ ...editScheduleFormData, interval_hours: e.target.value })} style={{ width: '80px' }} />
                                            ) : `${s.interval_hours} 小時`}
                                        </td>
                                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {editingScheduleId === s.schedule_id ? (
                                                <input type="text" value={editScheduleFormData.message_content} onChange={e => setEditScheduleFormData({ ...editScheduleFormData, message_content: e.target.value })} style={{ width: '100%' }} />
                                            ) : s.message_content}
                                        </td>
                                        <td>
                                            {editingScheduleId === s.schedule_id ? (
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <Check className="text-yellow" style={{ cursor: 'pointer' }} onClick={handleUpdateSchedule} />
                                                    <X style={{ cursor: 'pointer' }} onClick={() => setEditingScheduleId(null)} />
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '15px' }}>
                                                    <Edit2 size={18} style={{ cursor: 'pointer', color: '#B0B0B0' }} onClick={() => handleEditScheduleClick(s)} />
                                                    <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDeleteSchedule(s.schedule_id)} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>無排程資料，請切換專案或建立新排程。</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectsManagement;
