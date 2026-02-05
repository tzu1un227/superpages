import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Edit2, Trash2, Plus, Check, X, Filter, Clock, LayoutDashboard, Users, MessageSquare, Save, FileJson, Image as ImageIcon, Video, Mic, Type, BarChart2, Download, Upload, Play, ExternalLink, TrendingUp, CheckCircle2, Circle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import FlexMessageEditor from '../components/FlexMessageEditor';
import JourneyPreview from '../components/JourneyPreview';
import { downloadCSV } from '../utils/csvUtils';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const ProjectsManagement = () => {
    const location = useLocation();

    // Project Preview State & Handlers
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewSteps, setPreviewSteps] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    const handlePreviewProject = async () => {
        if (!selectedProjectId) {
            alert('請先選擇一個專案');
            return;
        }
        setPreviewLoading(true);
        setIsPreviewModalOpen(true);
        setPreviewSteps([]);

        try {
            // Determine sort order
            const currentProjectSchedules = schedules.filter(s => s.project_id == selectedProjectId);
            const sorted = [...currentProjectSchedules].sort((a, b) => (parseInt(a.step_id) || 0) - (parseInt(b.step_id) || 0));

            const steps = [];
            for (const s of sorted) {
                // If this is the schedule currently being edited, use the form data instead of the fixed schedule state
                let content = s.message_content;
                if (editingScheduleId === s.schedule_id && editScheduleFormData.message_content) {
                    content = editScheduleFormData.message_content;
                }

                if (content && content.startsWith('QA|')) {
                    const tag = content.substring(3);
                    try {
                        const res = await api.get(`/qa-bank/${tag}`);
                        const msgs = res.data.msg_rpy || [];

                        // Process each message in the QA bank entry
                        for (let i = 0; i < msgs.length; i++) {
                            let m = msgs[i];
                            if (typeof m === 'string') {
                                try { m = JSON.parse(m); } catch (e) { }
                            }
                            if (m.Line) m = m.Line;

                            // Format delay info only for the first message of a step
                            const stepLabel = `Step ${s.step_id} (間隔 ${s.interval_hours} hr)`;
                            const delay = i === 0 ? stepLabel : '';
                            steps.push({ ...m, delay });
                        }
                    } catch (e) {
                        console.error("Failed to fetch QA content", e);
                        steps.push({ OTYPE: 'TextSendMessage', text: `[無法讀取訊息內容: ${tag}]`, delay: `Step ${s.step_id}` });
                    }
                } else if (content) {
                    steps.push({ OTYPE: 'TextSendMessage', text: content, delay: `Step ${s.step_id} (間隔 ${s.interval_hours} hr)` });
                }
            }
            setPreviewSteps(steps);
        } catch (err) {
            alert('預覽生成失敗: ' + err.message);
        } finally {
            setPreviewLoading(false);
        }
    };
    // Helper to format hours to Day/Hour/Minute
    const formatInterval = (totalHours) => {
        const h = parseFloat(totalHours) || 0;
        const days = Math.floor(h / 24);
        const remainingHours = h % 24;
        const hours = Math.floor(remainingHours);
        // Deal with floating point precision for minutes (e.g. 0.5 hours = 30 mins)
        const minutes = Math.round((remainingHours - hours) * 60);
        return { days, hours, minutes };
    };

    const [projects, setProjects] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [projectUsers, setProjectUsers] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [editProjectFormData, setEditProjectFormData] = useState({});
    const [newProject, setNewProject] = useState({
        project_name: '',
        start_date: '',
        end_date: '',
        is_enabled: true,
        anchor_config: { type: 'immediate', day: 1, time: '09:00' },
        dormancy_config: { enabled: false, start: '23:00', end: '08:00' }
    });
    const [showAddProjectForm, setShowAddProjectForm] = useState(false);

    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [editScheduleFormData, setEditScheduleFormData] = useState({});
    const [newSchedule, setNewSchedule] = useState({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
    const [showAddScheduleForm, setShowAddScheduleForm] = useState(false);

    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('projects'); // projects, schedules, users

    const [projectStats, setProjectStats] = useState({ tc: 0, cc: 0, ms: 0, mss: 0, msf: 0, completion_rate: 0 });

    const colors = [
        '#2196F3', '#4CAF50', '#FFD700', '#F44336', '#9C27B0',
        '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63'
    ];
    const [statsDateRange, setStatsDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Rich Message Modal State
    const [isRichModalOpen, setIsRichModalOpen] = useState(false);
    const [richModalConfig, setRichModalConfig] = useState({ initialTag: '', projectId: '', stepId: '', onSave: null });

    const openRichEditor = (currentValue, projectId, stepId, onSave) => {
        let initialTag = '';
        let initialText = '';
        if (currentValue && currentValue.startsWith('QA|')) {
            initialTag = currentValue.substring(3);
        } else {
            initialText = currentValue || '';
        }
        setRichModalConfig({
            initialTag,
            initialText,
            projectId,
            stepId,
            onSave: (tag, preview) => {
                onSave('QA|' + tag, preview);
            }
        });
        setIsRichModalOpen(true);
    };

    useEffect(() => {
        setProjects([]);
        setSchedules([]);
        setSelectedProjectId('');
        fetchProjects();
    }, [location.pathname]);

    useEffect(() => {
        if (activeTab === 'schedules') {
            fetchSchedules();
            if (selectedProjectId) {
                fetchProjectStats(selectedProjectId);
            }
        }
        if (activeTab === 'users' && selectedProjectId) {
            fetchProjectUsers(selectedProjectId);
        }
    }, [selectedProjectId, activeTab, statsDateRange]);

    // Auto-fill Step ID
    useEffect(() => {
        if (!showAddScheduleForm) return;

        const effectiveProjectId = newSchedule.project_id || selectedProjectId;
        if (effectiveProjectId) {
            // Filter schedules for the selected project
            const projectSchedules = schedules.filter(s => s.project_id == effectiveProjectId);

            if (projectSchedules.length > 0) {
                const maxStep = Math.max(...projectSchedules.map(s => parseInt(s.step_id) || 0));
                setNewSchedule(prev => {
                    // Start from max + 1
                    const nextStep = maxStep + 1;
                    // Only update if it's different to avoid loops (though dependency array handles most)
                    // and strictly if we haven't manually typed something else? 
                    // Actually user wants auto-fill. If they manually typed, this effect *might* overwrite if logic triggers again.
                    // But logic triggers on projectId change or form open. 
                    // If they type step_id, efficientProjectId doesn't change, form doesn't close. Effect doesn't run. Safe.
                    if (prev.step_id !== nextStep) {
                        return { ...prev, step_id: nextStep };
                    }
                    return prev;
                });
            } else {
                setNewSchedule(prev => {
                    if (prev.step_id !== 1) return { ...prev, step_id: 1 };
                    return prev;
                });
            }
        }
    }, [newSchedule.project_id, selectedProjectId, showAddScheduleForm, schedules]);

    // Auto-refresh Projects every 30 seconds
    useEffect(() => {
        let interval;
        if (activeTab === 'projects') {
            // Initial fetch is handled by other effects or immediate need
            // But we ensure we Poll
            interval = setInterval(() => {
                fetchProjects();
            }, 30000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

    const fetchProjects = async () => {
        try {
            // Add timestamp to prevent caching
            const res = await api.get('/projects', { params: { _t: new Date().getTime() } });
            setProjects(res.data);
        } catch (err) {
            setError('無法取得專案列表');
        }
    };

    const fetchSchedules = async () => {
        if (activeTab !== 'schedules') return;
        try {
            const url = selectedProjectId
                ? `/schedules?project_id=${selectedProjectId}`
                : `/schedules`;
            const res = await api.get(url);
            setSchedules(res.data);
        } catch (err) {
            setError('無法取得排程資料');
        }
    };

    const fetchProjectUsers = async (projectId) => {
        try {
            const res = await api.get(`/projects/${projectId}/users`);
            setProjectUsers(res.data);
        } catch (err) {
            setError('無法取得專案用戶列表');
        }
    };

    const fetchProjectStats = async (projectId) => {
        if (!projectId) return;
        try {
            const resp = await api.get(`/projects/${projectId}/stats`, {
                params: {
                    start_time: statsDateRange.start,
                    end_time: statsDateRange.end
                }
            });
            setProjectStats(resp.data);
        } catch (err) {
            console.error('Error fetching project stats:', err);
        }
    };

    const handleExportSchedules = async () => {
        if (!selectedProjectId) {
            alert('請先選擇一個專案');
            return;
        }
        try {
            const res = await api.get(`/projects/${selectedProjectId}/schedules/export`);
            const dataStr = JSON.stringify(res.data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

            const exportFileDefaultName = `project_${selectedProjectId}_schedules.json`;

            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } catch (err) {
            alert('匯出失敗: ' + err.message);
        }
    };

    const handleImportSchedules = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!selectedProjectId) {
            alert('請先選擇一個專案');
            return;
        }

        if (!window.confirm('警告：匯入將會覆蓋此專案現有的所有步驟。確定要繼續嗎？')) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);
                await api.post(`/projects/${selectedProjectId}/schedules/import`, jsonData);
                alert('匯入成功');
                fetchSchedules();
            } catch (err) {
                alert('匯入失敗: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // User Selection Modal State
    const [isUserSelectModalOpen, setIsUserSelectModalOpen] = useState(false);

    const handleAddUserToProject = () => {
        if (!selectedProjectId) {
            alert('請先選擇一個專案');
            return;
        }
        setIsUserSelectModalOpen(true);
    };

    const onUserSelected = async (userId) => {
        try {
            await api.post('/trigger', {
                user: userId,
                message: `iup|${selectedProjectId}`,
                type: 'Sensor',
                api_index: 0
            });
            alert(`已送出加入專案指令 (User: ${userId}, Project: ${selectedProjectId})`);
            setIsUserSelectModalOpen(false);
            setTimeout(() => fetchProjectUsers(selectedProjectId), 1000);
        } catch (err) {
            alert('指令發送失敗: ' + err.message);
        }
    };

    const handleRemoveUser = async (userId) => {
        if (!window.confirm(`確定要將用戶 ${userId} 從此專案移除嗎？`)) return;
        try {
            await api.delete(`/projects/${selectedProjectId}/users/${userId}`);
            fetchProjectUsers(selectedProjectId);
        } catch (err) {
            alert('移除失敗: ' + (err.response?.data?.message || err.message));
        }
    };

    // Project Preview State





    // try {
    // Fetch schedules again or use state? Use state `schedules` but ensure it's up to date?
    // `schedules` state might be filtered or not? 
    // `fetchSchedules` fetches by `selectedProjectId` if set.
    // Let's rely on `schedules` but sort it.


    /* const steps = [];
    // for (const s of sorted) {
    let msg = null;
    const content = s.message_content;
    if (content && content.startsWith('QA|')) {
        const tag = content.substring(3);
        try {
            const res = await api.get(`/qa-bank/${tag}`);
            const msgs = res.data.msg_rpy || [];
            // Take the first message for preview sim
            if (msgs.length > 0) {
                let first = msgs[0];
                if (typeof first === 'string') first = JSON.parse(first);
                if (first.Line) first = first.Line;
                msg = first;
            }
        } catch (e) {
            console.error("Failed to fetch QA content", e);
            msg = { OTYPE: 'TextSendMessage', text: '[無法讀取訊息內容]' };
        }
    } else if (content) {
        msg = { OTYPE: 'TextSendMessage', text: content };
    }

    if (msg) {
        // Format delay
        const delay = `Step ${s.step_id} (間隔 ${s.interval_hours} hr)`;
        steps.push({ ...msg, delay });
    }
}
setPreviewSteps(steps);
// } catch (err) { */
    // alert('預覽生成失敗: ' + err.message);


    // Project Actions
    const handleEditProjectClick = (project) => {
        setEditingProjectId(project.project_id);
        // Ensure configs exist
        setEditProjectFormData({
            ...project,
            anchor_config: project.anchor_config || { type: 'immediate', day: 1, time: '09:00' },
            dormancy_config: project.dormancy_config || { enabled: false, start: '23:00', end: '08:00' }
        });
    };



    // Helper to auto-save plain text as Rich Message (QA entry)
    const saveAsRichMessage = async (content, projectId, stepId) => {
        if (!content) return content;
        if (content.startsWith('QA|')) return content;

        // Generate standardized tag
        const tag = `cron_${projectId}_${stepId}`;
        const payload = [{
            OTYPE: 'TextSendMessage',
            text: content
        }];

        try {
            await api.post('/qa-bank', {
                tag: tag,
                msg_rpy: payload,
                type: 'Sensor'
            });
            return `QA|${tag}`;
        } catch (err) {
            console.error(err);
            throw new Error(`訊息自動轉存 QA 失敗: ${err.message}`);
        }
    };

    const handleUpdateProject = async () => {
        if (!editProjectFormData.project_name || !editProjectFormData.project_name.trim()) {
            setError('專案名稱不能為空');
            return;
        }
        try {
            await api.put(`/projects/${editingProjectId}`, editProjectFormData);
            setEditingProjectId(null);
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '專案更新失敗');
        }
    };

    const handleDeleteProject = async (id) => {
        if (window.confirm('確定要刪除此專案嗎？相關排程也可能受到影響。')) {
            await api.delete(`/projects/${id}`);
            fetchProjects();
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.project_name.trim()) {
            setError('專案名稱不能為空');
            return;
        }
        try {
            await api.post('/projects', newProject);
            setShowAddProjectForm(false);
            setNewProject({
                project_name: '',
                start_date: '',
                end_date: '',
                is_enabled: true,
                anchor_config: { type: 'immediate', day: 1, time: '09:00' },
                dormancy_config: { enabled: false, start: '23:00', end: '08:00' }
            });
            fetchProjects();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || '新增專案失敗');
        }
    };

    // Schedule Actions
    const handleEditScheduleClick = (schedule) => {
        setEditingScheduleId(schedule.schedule_id);

        let initialContent = schedule.message_content;

        setEditScheduleFormData({
            ...schedule,
            message_content: initialContent
        });
    };

    const handleUpdateSchedule = async () => {
        try {
            let finalMessageContent = editScheduleFormData.message_content;

            // Auto convert plain text to QA tag if needed
            if (finalMessageContent && !finalMessageContent.startsWith('QA|')) {
                finalMessageContent = await saveAsRichMessage(
                    finalMessageContent,
                    editScheduleFormData.project_id,
                    editScheduleFormData.step_id
                );
            }

            // Ensure interval_hours is valid
            const safeInterval = (editScheduleFormData.interval_hours === '' || editScheduleFormData.interval_hours === null)
                ? '0'
                : editScheduleFormData.interval_hours;

            // Update with processed message content
            await api.put(`/schedules/${editingScheduleId}`, {
                ...editScheduleFormData,
                interval_hours: safeInterval,
                message_content: finalMessageContent
            });

            setEditingScheduleId(null);
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || err.message || '排程更新失敗');
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (window.confirm('確定要刪除此排程嗎？')) {
            await api.delete(`/schedules/${id}`);
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

            // Auto convert plain text to QA tag if needed
            if (scheduleToCreate.message_content && !scheduleToCreate.message_content.startsWith('QA|')) {
                scheduleToCreate.message_content = await saveAsRichMessage(
                    scheduleToCreate.message_content,
                    scheduleToCreate.project_id,
                    scheduleToCreate.step_id
                );
            }

            // Ensure interval_hours is valid
            if (scheduleToCreate.interval_hours === '' || scheduleToCreate.interval_hours === null) {
                scheduleToCreate.interval_hours = '0';
            }

            await api.post('/schedules', scheduleToCreate);
            setShowAddScheduleForm(false);
            setNewSchedule({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
            fetchSchedules();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || err.message || '新增排程失敗');
        }
    };

    // Helper for Status Badge
    const getStatusBadge = (status) => {
        const colors = {
            '編輯中': '#B0B0B0', // Gray
            '已排程': '#FFC107', // Amber/Yellow
            '進行中': '#4CAF50', // Green
            '已暫停': '#FF9800', // Orange
            '已完成': '#2196F3', // Blue
            '已終止': '#F44336', // Red
            '未知': '#666'
        };
        const color = colors[status] || '#666';
        return (
            <span style={{
                backgroundColor: `${color}20`,
                color: color,
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                border: `1px solid ${color}40`,
                display: 'inline-block',
                minWidth: '60px',
                textAlign: 'center'
            }}>
                {status}
            </span>
        );
    };

    // Reusable Config Inputs
    const renderConfigInputs = (data, setData, isEditing) => (
        <>
            <div style={{ marginTop: '10px', padding: '10px', background: '#333', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '8px' }}>錨點設定 (Anchor)</label>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                        <input
                            type="radio"
                            name={`anchor_type_${isEditing ? 'edit' : 'new'}`}
                            checked={data.anchor_config.type === 'immediate'}
                            onChange={() => setData({ ...data, anchor_config: { ...data.anchor_config, type: 'immediate' } })}
                        />
                        立即觸發
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                        <input
                            type="radio"
                            name={`anchor_type_${isEditing ? 'edit' : 'new'}`}
                            checked={data.anchor_config.type === 'weekly'}
                            onChange={() => setData({ ...data, anchor_config: { ...data.anchor_config, type: 'weekly' } })}
                        />
                        每週特定時間
                    </label>
                </div>
                {data.anchor_config.type === 'weekly' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select
                            value={data.anchor_config.day}
                            onChange={(e) => setData({ ...data, anchor_config: { ...data.anchor_config, day: parseInt(e.target.value) } })}
                            style={{ flex: 1 }}
                        >
                            <option value={1}>週一</option>
                            <option value={2}>週二</option>
                            <option value={3}>週三</option>
                            <option value={4}>週四</option>
                            <option value={5}>週五</option>
                            <option value={6}>週六</option>
                            <option value={0}>週日</option>
                        </select>
                        <input
                            type="time"
                            value={data.anchor_config.time}
                            onChange={(e) => setData({ ...data, anchor_config: { ...data.anchor_config, time: e.target.value } })}
                            style={{ flex: 1 }}
                        />
                    </div>
                )}
            </div>

            <div style={{ marginTop: '10px', padding: '10px', background: '#333', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '8px' }}>休眠時間 (Dormancy)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0', marginBottom: '10px' }}>
                    <input
                        type="checkbox"
                        checked={data.dormancy_config.enabled}
                        onChange={(e) => setData({ ...data, dormancy_config: { ...data.dormancy_config, enabled: e.target.checked } })}
                    />
                    啟用休眠
                </label>
                {data.dormancy_config.enabled && (
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <input
                            type="time"
                            value={data.dormancy_config.start}
                            onChange={(e) => setData({ ...data, dormancy_config: { ...data.dormancy_config, start: e.target.value } })}
                            style={{ flex: 1 }}
                        />
                        <span>~</span>
                        <input
                            type="time"
                            value={data.dormancy_config.end}
                            onChange={(e) => setData({ ...data, dormancy_config: { ...data.dormancy_config, end: e.target.value } })}
                            style={{ flex: 1 }}
                        />
                    </div>
                )}
            </div>
        </>
    );

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
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        padding: '12px 25px',
                        backgroundColor: activeTab === 'users' ? 'var(--secondary-black)' : 'transparent',
                        color: activeTab === 'users' ? 'var(--primary-yellow)' : '#B0B0B0',
                        borderBottom: activeTab === 'users' ? '2px solid var(--primary-yellow)' : 'none',
                        display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px 8px 0 0'
                    }}
                >
                    <Users size={18} /> 參與用戶
                </button>
            </div>

            {
                activeTab === 'projects' ? (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '20px' }}>專案列表</h3>
                            <button className="primary" onClick={() => setShowAddProjectForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                <Plus size={18} /> 新增專案
                            </button>
                        </div>

                        {showAddProjectForm && (
                            <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: '1 1 480px', minWidth: '300px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>專案名稱</label>
                                            <input type="text" value={newProject.project_name} onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })} style={{ width: '100%' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ flex: '1 1 180px' }}>
                                                <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>開始時間</label>
                                                <input type="datetime-local" value={newProject.start_date} onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })} style={{ width: '100%' }} />
                                            </div>
                                            <div style={{ flex: '1 1 180px' }}>
                                                <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>結束時間</label>
                                                <input type="datetime-local" value={newProject.end_date} onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })} style={{ width: '100%' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0' }}>
                                                <input type="checkbox" checked={newProject.is_enabled} onChange={(e) => setNewProject({ ...newProject, is_enabled: e.target.checked })} /> 啟用專案
                                            </label>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 480px', minWidth: '300px' }}>
                                        {renderConfigInputs(newProject, setNewProject, false)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', flex: '0 0 auto', marginLeft: 'auto' }}>
                                        <button className="primary" onClick={handleCreateProject} style={{ minWidth: '80px' }}>儲存</button>
                                        <button onClick={() => setShowAddProjectForm(false)} style={{ background: '#444', minWidth: '80px' }}>取消</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>專案名稱</th>
                                        <th>有效期間</th>
                                        <th>狀態</th>
                                        <th>詳細設定</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map((p) => (
                                        <tr key={p.project_id}>
                                            <td
                                                onClick={() => {
                                                    if (editingProjectId !== p.project_id) {
                                                        setActiveTab('schedules');
                                                        setSelectedProjectId(p.project_id);
                                                    }
                                                }}
                                                style={{ cursor: editingProjectId !== p.project_id ? 'pointer' : 'default', textDecoration: editingProjectId !== p.project_id ? 'underline' : 'none', color: '#fff' }}
                                            >
                                                {editingProjectId === p.project_id ? (
                                                    <input type="text" value={editProjectFormData.project_name} onChange={e => setEditProjectFormData({ ...editProjectFormData, project_name: e.target.value })} style={{ width: '100%' }} />
                                                ) : (
                                                    <span>{p.project_name} <span style={{ fontSize: '10px', color: '#666' }}>({p.project_id})</span></span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '14px' }}>
                                                {editingProjectId === p.project_id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <input type="datetime-local" value={editProjectFormData.start_date.replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, start_date: e.target.value })} style={{ padding: '5px' }} />
                                                        <input type="datetime-local" value={editProjectFormData.end_date.replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, end_date: e.target.value })} style={{ padding: '5px' }} />
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#B0B0B0' }}>
                                                        {p.start_date.slice(0, 16).replace('T', ' ')} <br />
                                                        ~ {p.end_date.slice(0, 16).replace('T', ' ')}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {editingProjectId === p.project_id ? (
                                                    <label>
                                                        <input type="checkbox" checked={editProjectFormData.is_enabled} onChange={e => setEditProjectFormData({ ...editProjectFormData, is_enabled: e.target.checked })} /> 啟用
                                                    </label>
                                                ) : (
                                                    getStatusBadge(p.status)
                                                )}
                                            </td>
                                            <td style={{ fontSize: '12px', color: '#aaa', maxWidth: '200px' }}>
                                                {editingProjectId === p.project_id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <div style={{ fontSize: '11px', color: '#888' }}>設定詳細編輯中...</div>
                                                        {renderConfigInputs(editProjectFormData, setEditProjectFormData, true)}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div>⚓ {p.anchor_config?.type === 'weekly' ? `週${['日', '一', '二', '三', '四', '五', '六'][p.anchor_config.day]} ${p.anchor_config.time}` : '立即'}</div>
                                                        {p.dormancy_config?.enabled && (
                                                            <div>💤 {p.dormancy_config.start}~{p.dormancy_config.end}</div>
                                                        )}
                                                    </div>
                                                )}
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
                ) : activeTab === 'schedules' ? (
                    <div className="card">
                        {/* ... Schedules content remains same, just adjusted the nesting ... */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <h3 style={{ fontSize: '20px' }}>排程步驟設定</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '8px' }}>
                                    <Filter size={16} className="text-yellow" />
                                    <span style={{ fontSize: '14px' }}>選擇專案:</span>
                                    <select
                                        value={selectedProjectId}
                                        onChange={e => setSelectedProjectId(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', padding: '5px' }}
                                    >
                                        <option value="">請選擇專案...</option>
                                        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '14px', color: '#B0B0B0' }}>統計範圍:</span>
                                    <input
                                        type="date"
                                        value={statsDateRange.start}
                                        onChange={e => setStatsDateRange({ ...statsDateRange, start: e.target.value })}
                                        style={{ padding: '4px 8px', background: '#333', border: '1px solid #444', color: '#fff' }}
                                    />
                                    <span>~</span>
                                    <input
                                        type="date"
                                        value={statsDateRange.end}
                                        onChange={e => setStatsDateRange({ ...statsDateRange, end: e.target.value })}
                                        style={{ padding: '4px 8px', background: '#333', border: '1px solid #444', color: '#fff' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={handlePreviewProject}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#444', color: '#fff' }}
                                    title="預覽專案完整流程"
                                >
                                    <Play size={18} /> 預覽專案
                                </button>
                                <button
                                    onClick={handleExportSchedules}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#333', color: '#fff' }}
                                    title="匯出步驟為 JSON"
                                >
                                    <Download size={18} /> 匯出
                                </button>
                                <label className="primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', cursor: 'pointer' }}>
                                    <Upload size={18} /> 匯入
                                    <input type="file" accept=".json" onChange={handleImportSchedules} style={{ display: 'none' }} />
                                </label>
                                <button className="primary" onClick={() => setShowAddScheduleForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                    <Plus size={18} /> 新增排程
                                </button>
                            </div>
                        </div>

                        {selectedProjectId && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                                <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <div style={{ color: '#888', fontSize: '12px' }}>觸發客戶數</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-yellow)' }}>{projectStats.tc || 0}</div>
                                </div>
                                <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <div style={{ color: '#888', fontSize: '12px' }}>完成率</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{projectStats.completion_rate || 0}%</div>
                                    <div style={{ fontSize: '10px', color: '#555' }}>共 {projectStats.cc || 0} 人完成</div>
                                </div>
                                <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <div style={{ color: '#888', fontSize: '12px' }}>總發送數</div>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{projectStats.ms || 0}</div>
                                </div>
                                <div style={{ background: '#1a1a1a', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                    <div style={{ color: '#888', fontSize: '12px' }}>成功 / 失敗</div>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>{projectStats.mss || 0}</span>
                                        <span style={{ color: '#444' }}>/</span>
                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#FF4D4D' }}>{projectStats.msf || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showAddScheduleForm && (
                            <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 80px 340px 2fr auto', gap: '15px', alignItems: 'end' }}>
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
                                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>間隔 (天/時)</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="天"
                                                value={(() => {
                                                    const { days } = formatInterval(newSchedule.interval_hours);
                                                    return days;
                                                })()}
                                                onChange={e => {
                                                    const d = parseInt(e.target.value) || 0;
                                                    const { hours, minutes } = formatInterval(newSchedule.interval_hours);
                                                    const total = d * 24 + hours + minutes / 60;
                                                    setNewSchedule({ ...newSchedule, interval_hours: total.toString() });
                                                }}
                                                style={{ width: '100%', minWidth: '60px' }}
                                            />
                                            <span style={{ alignSelf: 'center', color: '#B0B0B0' }}>天</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="23"
                                                step="1"
                                                placeholder="時"
                                                value={(() => {
                                                    const { hours } = formatInterval(newSchedule.interval_hours);
                                                    return hours;
                                                })()}
                                                onChange={e => {
                                                    const h = parseInt(e.target.value) || 0;
                                                    const { days, minutes } = formatInterval(newSchedule.interval_hours);
                                                    const total = days * 24 + h + minutes / 60;
                                                    setNewSchedule({ ...newSchedule, interval_hours: total.toString() });
                                                }}
                                                style={{ width: '100%', minWidth: '60px' }}
                                            />
                                            <span style={{ alignSelf: 'center', color: '#B0B0B0' }}>時</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                step="1"
                                                placeholder="分"
                                                value={(() => {
                                                    const { minutes } = formatInterval(newSchedule.interval_hours);
                                                    return minutes;
                                                })()}
                                                onChange={e => {
                                                    const m = parseInt(e.target.value) || 0;
                                                    const { days, hours } = formatInterval(newSchedule.interval_hours);
                                                    const total = days * 24 + hours + m / 60;
                                                    setNewSchedule({ ...newSchedule, interval_hours: total.toString() });
                                                }}
                                                style={{ width: '100%', minWidth: '60px' }}
                                            />
                                            <span style={{ alignSelf: 'center', color: '#B0B0B0' }}>分</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>訊息內容</label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <input
                                                type="text"
                                                value={(newSchedule.message_content && newSchedule.message_content.startsWith('QA|') && newSchedule.message_preview)
                                                    ? newSchedule.message_preview
                                                    : newSchedule.message_content
                                                }
                                                onChange={e => setNewSchedule({ ...newSchedule, message_content: e.target.value })}
                                                style={{ width: '100%' }}
                                            />
                                            <button
                                                onClick={() => openRichEditor(
                                                    newSchedule.message_content,
                                                    selectedProjectId,
                                                    newSchedule.step_id,
                                                    (val, preview) => setNewSchedule(prev => ({ ...prev, message_content: val, message_preview: preview }))
                                                )}
                                                title="編輯多媒體/Flex訊息"
                                                style={{ padding: '8px', background: '#333', border: '1px solid #444', color: 'var(--primary-yellow)' }}
                                            >
                                                <MessageSquare size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button className="primary" onClick={handleCreateSchedule} style={{ minWidth: '80px' }}>儲存</button>
                                        <button onClick={() => setShowAddScheduleForm(false)} style={{ background: '#444', minWidth: '80px' }}>取消</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
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
                                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={(() => {
                                                                const { days } = formatInterval(editScheduleFormData.interval_hours);
                                                                return days;
                                                            })()}
                                                            onChange={e => {
                                                                const d = parseInt(e.target.value) || 0;
                                                                const { hours, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                const total = d * 24 + hours + minutes / 60;
                                                                setEditScheduleFormData({ ...editScheduleFormData, interval_hours: total.toString() });
                                                            }}
                                                            style={{ width: '40px', minWidth: '60px' }}
                                                        /> <span style={{ fontSize: '12px' }}>天</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="23"
                                                            step="1"
                                                            value={(() => {
                                                                const { hours } = formatInterval(editScheduleFormData.interval_hours);
                                                                return hours;
                                                            })()}
                                                            onChange={e => {
                                                                const h = parseInt(e.target.value) || 0;
                                                                const { days, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                const total = days * 24 + h + minutes / 60;
                                                                setEditScheduleFormData({ ...editScheduleFormData, interval_hours: total.toString() });
                                                            }}
                                                            style={{ width: '40px', minWidth: '60px' }}
                                                        /> <span style={{ fontSize: '12px' }}>時</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="59"
                                                            step="1"
                                                            value={(() => {
                                                                const { minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                return minutes;
                                                            })()}
                                                            onChange={e => {
                                                                const m = parseInt(e.target.value) || 0;
                                                                const { days, hours } = formatInterval(editScheduleFormData.interval_hours);
                                                                const total = days * 24 + hours + m / 60;
                                                                setEditScheduleFormData({ ...editScheduleFormData, interval_hours: total.toString() });
                                                            }}
                                                            style={{ width: '40px', minWidth: '60px' }}
                                                        /> <span style={{ fontSize: '12px' }}>分</span>
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        const { days, hours, minutes } = formatInterval(s.interval_hours);
                                                        let text = '';
                                                        if (days > 0) text += `${days} 天 `;
                                                        if (hours > 0) text += `${hours} 小時 `;
                                                        if (minutes > 0) text += `${minutes} 分`;
                                                        if (!text) text = '0 分';
                                                        return <span>{text}</span>
                                                    })()
                                                )}
                                            </td>
                                            <td style={{ maxWidth: '300px' }}>
                                                {editingScheduleId === s.schedule_id ? (
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <input
                                                            type="text"
                                                            value={(editScheduleFormData.message_content && editScheduleFormData.message_content.startsWith('QA|') && editScheduleFormData.message_preview)
                                                                ? editScheduleFormData.message_preview
                                                                : editScheduleFormData.message_content
                                                            }
                                                            onChange={e => setEditScheduleFormData({ ...editScheduleFormData, message_content: e.target.value })}
                                                            style={{ width: '100%' }}
                                                        />
                                                        <button
                                                            onClick={() => openRichEditor(
                                                                editScheduleFormData.message_content,
                                                                editScheduleFormData.project_id,
                                                                editScheduleFormData.step_id,
                                                                (val, preview) => setEditScheduleFormData(prev => ({ ...prev, message_content: val, message_preview: preview }))
                                                            )}
                                                            style={{ padding: '5px', background: '#333', border: '1px solid #444', color: 'var(--primary-yellow)' }}
                                                        >
                                                            <MessageSquare size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {s.message_preview ? (
                                                            <>
                                                                {/* <MessageSquare size={14} color="#4CAF50" title="Rich Message" /> */}
                                                                <span>{s.message_preview}</span>
                                                                <span style={{ fontSize: '10px', color: '#666' }}>({s.message_content.split('|')[1]?.split('_').pop()})</span>
                                                            </>
                                                        ) : s.message_content && s.message_content.startsWith('QA|') ? (
                                                            <>
                                                                <MessageSquare size={14} color="#4CAF50" title="Rich Message" />
                                                                <span style={{ color: '#aaa', fontStyle: 'italic' }}>Rich Message</span>
                                                            </>
                                                        ) : s.message_content}
                                                    </div>
                                                )}
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
                ) : (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <h3 style={{ fontSize: '20px' }}>參與用戶列表</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '8px' }}>
                                    <Filter size={16} className="text-yellow" />
                                    <span style={{ fontSize: '14px' }}>選擇專案:</span>
                                    <select
                                        value={selectedProjectId}
                                        onChange={e => setSelectedProjectId(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', padding: '5px' }}
                                    >
                                        <option value="">請選擇專案...</option>
                                        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button className="primary" onClick={handleAddUserToProject} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                <Plus size={18} /> 手動加入用戶
                            </button>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>姓名</th>
                                        <th>所屬專案</th>
                                        <th>加入狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectUsers.length > 0 ? projectUsers.map((u, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: '600' }}>{u.user_name || u.user_id}</td>
                                            <td>
                                                {projects.find(p => p.project_id == selectedProjectId)?.project_name || `ID: ${selectedProjectId}`}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#4CAF50' }}>● 已在排程中</span>
                                                    <button
                                                        onClick={() => handleRemoveUser(u.user_id)}
                                                        style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#FF4D4D' }}
                                                        title="移除用戶"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                                {selectedProjectId ? '此專案目前無參與用戶。' : '請先選擇一個專案以查看參與用戶。'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
            {/* Rich Message Modal */}
            <RichMessageModal
                isOpen={isRichModalOpen}
                onClose={() => setIsRichModalOpen(false)}
                onSave={richModalConfig.onSave}
                initialTag={richModalConfig.initialTag}
                initialText={richModalConfig.initialText}
                projectId={richModalConfig.projectId}
                stepId={richModalConfig.stepId}
            />
            {/* User Select Modal */}
            <UserSelectModal
                isOpen={isUserSelectModalOpen}
                onClose={() => setIsUserSelectModalOpen(false)}
                onSelect={onUserSelected}
                existingUsers={projectUsers.map(u => u.user_id)}
            />
            {/* Preview Modal */}
            {
                isPreviewModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <div style={{ width: '400px', height: '80%', backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>專案預覽</h3>
                                <X style={{ cursor: 'pointer', color: '#666' }} onClick={() => setIsPreviewModalOpen(false)} />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                                {previewLoading && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
                                        載入中...
                                    </div>
                                )}
                                <JourneyPreview steps={previewSteps} />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Rich Message Editor Modal
const RichMessageModal = ({ isOpen, onClose, onSave, initialTag, initialText, projectId, stepId }) => {
    const [tag, setTag] = useState(initialTag || '');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeMsgIndex, setActiveMsgIndex] = useState(0);

    // Default Tag Generation if empty
    useEffect(() => {
        if (isOpen) {
            if (!initialTag) {
                // Try to generate default tag
                const pId = projectId || 'new';
                const sId = stepId || 'new';
                setTag(`cron_${pId}_${sId}`);

                // If there is initialText (passed from input), stick it in first message
                if (initialText) {
                    setMessages([{ OTYPE: 'TextSendMessage', text: initialText }]);
                } else {
                    setMessages([createEmptyMsg()]); // Init with 1 empty message
                }
            } else {
                setTag(initialTag);
                fetchExistingMessages(initialTag);
            }
        }
    }, [isOpen, initialTag, initialText, projectId, stepId]);

    const createEmptyMsg = () => ({ OTYPE: 'TextSendMessage', text: '' });

    const fetchExistingMessages = async (tagName) => {
        setLoading(true);
        try {
            const res = await api.get(`/qa-bank/${tagName}`);
            let msgs = res.data.msg_rpy || [];
            // Parse strings if they are JSON strings (backend might return list of strings or list of dicts depending on implementation)
            // Our backend returns list of strings (json dumped).
            msgs = msgs.map(m => {
                let parsed = typeof m === 'string' ? JSON.parse(m) : m;
                // Backend wraps content in {"Line": ...}, we need to unwrap it for the editor
                if (parsed.Line) return parsed.Line;
                return parsed;
            });
            if (msgs.length === 0) msgs = [createEmptyMsg()];
            setMessages(msgs);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setMessages([createEmptyMsg()]);
            } else {
                alert('讀取失敗: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation
        // Filter out empty messages? Or allow them? usage limited to 5.
        // Let's validate required fields.
        for (let i = 0; i < messages.length; i++) {
            const m = messages[i];
            if (m.OTYPE === 'TextSendMessage' && !m.text) { alert(`第 ${i + 1} 則訊息內容不能為空`); return; }
            if (m.OTYPE === 'FlexSendMessage') {
                if (!m.contents) { alert(`第 ${i + 1} 則 Flex 內容不能為空`); return; }
                if (typeof m.contents === 'string') {
                    try { JSON.parse(m.contents); } catch (e) { alert(`第 ${i + 1} 則 JSON 格式錯誤`); return; }
                }
            }
        }

        setLoading(true);
        try {
            // Converts contents string to object if needed for Flex
            const payloadMessages = messages.map(m => {
                if (m.OTYPE === 'FlexSendMessage' && typeof m.contents === 'string') {
                    return { ...m, contents: JSON.parse(m.contents) };
                }
                return m;
            });

            await api.post('/qa-bank', {
                tag: tag,
                msg_rpy: payloadMessages,
                type: 'Sensor'
            });
            const firstMsg = payloadMessages[0];
            let previewText = '';
            if (firstMsg) {
                if (firstMsg.OTYPE === 'TextSendMessage') previewText = firstMsg.text;
                else if (firstMsg.OTYPE === 'FlexSendMessage') previewText = firstMsg.alt_text || 'Flex Message';
                else previewText = `[${firstMsg.OTYPE.replace('SendMessage', '')}]`;
            }
            onSave(tag, previewText);
            onClose();
        } catch (err) {
            alert('儲存失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateMessage = (index, field, value) => {
        const newMsgs = [...messages];
        newMsgs[index] = { ...newMsgs[index], [field]: value };
        setMessages(newMsgs);
    };

    const changeType = (index, newType) => {
        const newMsgs = [...messages];
        let newMsg = { OTYPE: newType };
        if (newType === 'TextSendMessage') newMsg.text = '';
        if (newType === 'ImageSendMessage' || newType === 'VideoSendMessage') {
            newMsg.original_content_url = '';
            newMsg.preview_image_url = '';
        }
        if (newType === 'AudioSendMessage') {
            newMsg.original_content_url = '';
            newMsg.duration = 1000;
        }
        if (newType === 'FlexSendMessage') {
            newMsg.alt_text = 'Flex Message';
            newMsg.contents = '{}';
        }
        newMsgs[index] = newMsg;
        setMessages(newMsgs);
    };

    const addMessageSlot = () => {
        if (messages.length >= 5) return;
        setMessages([...messages, createEmptyMsg()]);
        setActiveMsgIndex(messages.length);
    };

    const removeMessageSlot = (index) => {
        const newMsgs = messages.filter((_, i) => i !== index);
        setMessages(newMsgs);
        if (activeMsgIndex >= newMsgs.length) setActiveMsgIndex(newMsgs.length - 1);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{ width: '800px', height: '80%', backgroundColor: '#222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px' }}>進階訊息編輯器</h2>
                    <X style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                {/* <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', color: '#888', marginBottom: '5px' }}>Tag (識別標籤)</label>
                    <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: '100%', padding: '8px', background: '#333', border: '1px solid #444', color: '#fff' }} />
                </div> */}

                <div style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
                    {/* Left: Message List */}
                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                        {messages.map((m, i) => (
                            <div key={i}
                                onClick={() => setActiveMsgIndex(i)}
                                style={{
                                    padding: '10px', backgroundColor: activeMsgIndex === i ? '#444' : '#333',
                                    borderRadius: '8px', cursor: 'pointer', border: activeMsgIndex === i ? '1px solid var(--primary-yellow)' : '1px solid transparent',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}
                            >
                                <span style={{ fontSize: '14px' }}>#{i + 1} {m.OTYPE.replace('SendMessage', '')}</span>
                                <Trash2 size={14} color="#FF4D4D" onClick={(e) => { e.stopPropagation(); removeMessageSlot(i); }} />
                            </div>
                        ))}
                        {messages.length < 5 && (
                            <button onClick={addMessageSlot} style={{ border: '1px dashed #666', background: 'transparent', padding: '10px', color: '#888' }}>
                                + 新增訊息
                            </button>
                        )}
                    </div>

                    {/* Right: Content Editor */}
                    <div style={{ flex: 1, backgroundColor: '#333', borderRadius: '8px', padding: '20px', overflowY: 'auto' }}>
                        {messages[activeMsgIndex] ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>類型</label>
                                    <select
                                        value={messages[activeMsgIndex].OTYPE}
                                        onChange={(e) => changeType(activeMsgIndex, e.target.value)}
                                        style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }}
                                    >
                                        <option value="TextSendMessage">文字 (Text)</option>
                                        <option value="ImageSendMessage">圖片 (Image)</option>
                                        <option value="VideoSendMessage">影片 (Video)</option>
                                        <option value="AudioSendMessage">聲音 (Audio)</option>
                                        <option value="FlexSendMessage">Flex 訊息</option>
                                    </select>
                                </div>

                                {messages[activeMsgIndex].OTYPE === 'TextSendMessage' && (
                                    <div>
                                        <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>內容</label>
                                        <textarea
                                            value={messages[activeMsgIndex].text}
                                            onChange={(e) => updateMessage(activeMsgIndex, 'text', e.target.value)}
                                            rows={8}
                                            style={{ width: '100%', padding: '10px', background: '#222', border: 'none', color: '#fff' }}
                                        />
                                    </div>
                                )}

                                {messages[activeMsgIndex].OTYPE === 'ImageSendMessage' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>圖片網址 (Original)</label>
                                            <input type="text" value={messages[activeMsgIndex].original_content_url || ''} onChange={(e) => {
                                                const newMsgs = [...messages];
                                                newMsgs[activeMsgIndex] = {
                                                    ...newMsgs[activeMsgIndex],
                                                    original_content_url: e.target.value,
                                                    preview_image_url: e.target.value
                                                };
                                                setMessages(newMsgs);
                                            }} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                            <p style={{ fontSize: '12px', color: '#666' }}>*Preview URL 自動同步</p>
                                        </div>
                                    </>
                                )}

                                {messages[activeMsgIndex].OTYPE === 'VideoSendMessage' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>影片網址</label>
                                            <input type="text" value={messages[activeMsgIndex].original_content_url || ''} onChange={(e) => updateMessage(activeMsgIndex, 'original_content_url', e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>預覽圖網址</label>
                                            <input type="text" value={messages[activeMsgIndex].preview_image_url || ''} onChange={(e) => updateMessage(activeMsgIndex, 'preview_image_url', e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                        </div>
                                    </>
                                )}

                                {messages[activeMsgIndex].OTYPE === 'AudioSendMessage' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>音檔網址</label>
                                            <input type="text" value={messages[activeMsgIndex].original_content_url || ''} onChange={(e) => updateMessage(activeMsgIndex, 'original_content_url', e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>長度 (毫秒)</label>
                                            <input type="number" value={messages[activeMsgIndex].duration || 1000} onChange={(e) => updateMessage(activeMsgIndex, 'duration', parseInt(e.target.value))} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                        </div>
                                    </>
                                )}

                                {messages[activeMsgIndex].OTYPE === 'FlexSendMessage' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>替代文字 (Alt Text)</label>
                                            <input type="text" value={messages[activeMsgIndex].alt_text || ''} onChange={(e) => updateMessage(activeMsgIndex, 'alt_text', e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }} />
                                        </div>
                                        <>
                                            <div style={{ height: '600px', border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                                                <FlexMessageEditor
                                                    initialContent={messages[activeMsgIndex].contents}
                                                    onSave={(jsonString) => {
                                                        updateMessage(activeMsgIndex, 'contents', jsonString);
                                                    }}
                                                    onCancel={() => { }}
                                                />
                                            </div>
                                        </>
                                    </>
                                )}

                            </div>
                        ) : (
                            <div style={{ color: '#666', textAlign: 'center', marginTop: '50px' }}>請選擇或新增訊息</div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                    <button onClick={onClose} style={{ background: '#444', padding: '10px 20px', borderRadius: '4px', border: 'none', color: '#fff' }}>取消</button>
                    <button onClick={handleSave} disabled={loading} style={{ background: 'var(--primary-yellow)', padding: '10px 20px', borderRadius: '4px', border: 'none', color: '#000', fontWeight: 'bold' }}>
                        {loading ? '儲存中...' : '儲存'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UserSelectModal = ({ isOpen, onClose, onSelect, existingUsers = [] }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setSearchTerm('');
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/registered-users?source=private_var');
            setUsers(res.data);
        } catch (err) {
            alert('無法取得用戶列表: ' + err.message);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        !existingUsers.includes(u.user_id) &&
        ((u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (u.user_id && u.user_id.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{ width: '500px', height: '600px', backgroundColor: '#222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px' }}>選擇用戶加入專案</h2>
                    <X style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <input
                        type="text"
                        placeholder="搜尋姓名或是 User ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#333', borderRadius: '8px' }}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>載入中...</div>
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                            <div
                                key={u.user_id}
                                onClick={() => onSelect(u.user_id)}
                                style={{
                                    padding: '12px',
                                    borderBottom: '1px solid #444',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {u.pic ? (
                                        <img
                                            src={u.pic}
                                            alt={u.name}
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #444' }}
                                        />
                                    ) : (
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                                            <Users size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{u.name || '未命名'}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>{u.user_id}</div>
                                    </div>
                                </div>
                                <Plus size={16} color="var(--primary-yellow)" />
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>找不到符合的用戶</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectsManagement;
