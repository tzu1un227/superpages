import React, { useState, useEffect } from 'react';
import { useTask } from '../contexts/TaskContext';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Edit2, Trash2, Plus, Check, X, Filter, Clock, LayoutDashboard, Users, User, MessageSquare, Save, FileJson, Image as ImageIcon, Video, Mic, Type, BarChart2, Download, Upload, Play, ExternalLink, TrendingUp, CheckCircle2, Circle, ChevronLeft, ChevronRight, BarChart3, RotateCcw, GripVertical, HelpCircle } from 'lucide-react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress, Tooltip as MuiTooltip } from '@mui/material';
import FlexMessageEditor from '../components/FlexMessageEditor';
import JourneyPreview from '../components/JourneyPreview';
import { downloadCSV } from '../utils/csvUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
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
    const { showToast } = useToast();
    const { taskState, updateTask, resetTask } = useTask();


    const handlePreviewProject = async () => {
        setPreviewLoading(true);
        setIsPreviewModalOpen(true);
        setPreviewSteps([]);
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setPreviewBaseTime(now.toISOString().slice(0, 16));

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
                            const { label: intervalLabel } = formatInterval(s.interval_hours);
                            const stepLabel = `Step ${s.step_id} (間隔 ${intervalLabel})`;
                            const delay = i === 0 ? stepLabel : '';
                            steps.push({ ...m, delay, raw_interval_hours: s.interval_hours, is_first: i === 0 });
                        }
                    } catch (e) {
                        console.error("Failed to fetch QA content", e);
                        steps.push({ OTYPE: 'TextSendMessage', text: `[無法讀取訊息內容: ${tag}]`, delay: `Step ${s.step_id}`, raw_interval_hours: s.interval_hours, is_first: true });
                    }
                } else if (content) {
                    const { label: intervalLabel } = formatInterval(s.interval_hours);
                    steps.push({ OTYPE: 'TextSendMessage', text: content, delay: `Step ${s.step_id} (間隔 ${intervalLabel})`, raw_interval_hours: s.interval_hours, is_first: true });
                }
            }

            // Validation for all message types
            for (let i = 0; i < steps.length; i++) {
                const m = steps[i];
                const msgNum = i + 1;
                if (m.OTYPE === 'TextSendMessage') {
                    if (!m.text || !m.text.trim()) {
                        showToast(`第 ${msgNum} 則文字訊息內容不能為空`, 'warning');
                        return;
                    }
                    if (m.text.length > 3000) {
                        showToast(`第 ${msgNum} 則文字訊息內容不能超過 3000 字`, 'warning');
                        return;
                    }
                } else if (m.OTYPE === 'ImageSendMessage') {
                    if (!m.original_content_url || !m.original_content_url.trim()) {
                        showToast(`第 ${msgNum} 則圖片訊息網址不能為空`, 'warning');
                        return;
                    }
                } else if (m.OTYPE === 'VideoSendMessage') {
                    if (!m.original_content_url || !m.original_content_url.trim()) {
                        showToast(`第 ${msgNum} 則影片訊息網址不能為空`, 'warning');
                        return;
                    }
                    if (!m.preview_image_url || !m.preview_image_url.trim()) {
                        showToast(`第 ${msgNum} 則影片預覽圖網址不能為空`, 'warning');
                        return;
                    }
                } else if (m.OTYPE === 'AudioSendMessage') {
                    if (!m.original_content_url || !m.original_content_url.trim()) {
                        showToast(`第 ${msgNum} 則音檔訊息網址不能為空`, 'warning');
                        return;
                    }
                } else if (m.OTYPE === 'FlexSendMessage') {
                    if (!m.alt_text || !m.alt_text.trim()) {
                        showToast(`第 ${msgNum} 則 Flex 訊息替代文字不能為空`, 'warning');
                        return;
                    }
                    if (!m.contents) {
                        showToast(`第 ${msgNum} 則 Flex 訊息內容不能為空`, 'warning');
                        return;
                    }
                }
            }

            setPreviewSteps(steps);
        } catch (err) {
            showToast('預覽生成失敗: ' + err.message, 'error');
        } finally {
            setPreviewLoading(false);
        }
    };
    // Helper to format hours to Day/Hour/Minute
    const formatInterval = (totalHours) => {
        const h = parseFloat(totalHours) || 0;
        const years = Math.floor(h / (24 * 365));
        const remYears = h % (24 * 365);
        const months = Math.floor(remYears / (24 * 30));
        const remMonths = remYears % (24 * 30);
        const days = Math.floor(remMonths / 24);
        const remainingHours = remMonths % 24;
        const hours = Math.floor(remainingHours);
        const minutes = Math.round((remainingHours - hours) * 60);

        let label = '';
        if (years > 0) label += `${years} 年 `;
        if (months > 0) label += `${months} 月 `;
        if (days > 0) label += `${days} 天 `;
        if (hours > 0) label += `${hours} 小時 `;
        if (minutes > 0) label += `${minutes} 分`;
        if (!label) label = '0 小時';

        return { years, months, days, hours, minutes, label: label.trim() };
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
        is_recurring: false, // Default to false (Project behavior)
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
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [schedulesLoading, setSchedulesLoading] = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = React.useRef(null);
    const prevProjectIdRef = React.useRef('');
    const selectedProjectIdRef = React.useRef('');
    const schedulesCacheRef = React.useRef({});
    const projectUsersCacheRef = React.useRef({});

    // Modal & Loading States
    const [isUserSelectModalOpen, setIsUserSelectModalOpen] = useState(false);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [isRichModalOpen, setIsRichModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [richModalConfig, setRichModalConfig] = useState({ initialTag: '', projectId: '', stepId: '', onSave: null });
    const [previewSteps, setPreviewSteps] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewBaseTime, setPreviewBaseTime] = useState('');

    const computedPreviewSteps = React.useMemo(() => {
        if (!previewBaseTime) return previewSteps;
        let currentTime = new Date(previewBaseTime).getTime();
        return previewSteps.map(step => {
            if (!step.is_first || step.raw_interval_hours === undefined) return step;
            const offsetMs = parseFloat(step.raw_interval_hours || 0) * 60 * 60 * 1000;
            currentTime += offsetMs;
            const targetTime = new Date(currentTime);
            const timeStr = targetTime.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            return {
                ...step,
                delay: `${step.delay}\n預計發送: ${timeStr}`
            };
        });
    }, [previewSteps, previewBaseTime]);

    const colors = [
        '#2196F3', '#4CAF50', '#FFD700', '#F44336', '#9C27B0',
        '#00BCD4', '#FF9800', '#795548', '#607D8B', '#E91E63'
    ];
    const [statsDateRange, setStatsDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [formErrors, setFormErrors] = useState({});

    const validateProjectForm = (data) => {
        const errors = {};
        if (!data.project_name?.trim()) errors.project_name = '專案名稱不能為空';
        else if (Array.isArray(projects) && projects.some(p => p.project_name?.trim() === data.project_name.trim())) {
            errors.project_name = '此旅程名稱已存在，請使用不同名稱';
        }
        if (!data.start_date) errors.start_date = '請設定開始日期';
        if (!data.end_date) errors.end_date = '請設定結束日期';
        if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
            errors.end_date = '結束日期必須在開始日期之後';
        }
        return errors;
    };

    const validateScheduleForm = (data) => {
        const errors = {};
        if (!data.message_content?.trim()) errors.message_content = '訊息內容不能為空';
        return errors;
    };

    const scrollToFirstError = (containerId) => {
        setTimeout(() => {
            const firstError = document.querySelector('.error-input');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
        }, 100);
    };


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
        fetchProjects(true);
    }, [location.pathname]);

    useEffect(() => {
        selectedProjectIdRef.current = selectedProjectId;
    }, [selectedProjectId]);

    useEffect(() => {
        if (selectedProjectId && selectedProjectId !== prevProjectIdRef.current) {
            prevProjectIdRef.current = selectedProjectId;

            // Project Switching Safety: Reset all unsaved editing states
            setEditingScheduleId(null);
            setEditScheduleFormData({});
            setShowAddScheduleForm(false);
            setNewSchedule({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
            setFormErrors({});
            setError('');

            // CRITICAL FIX: Clear old lists immediately OR LOAD FROM CACHE
            if (schedulesCacheRef.current[selectedProjectId]) {
                setSchedules(schedulesCacheRef.current[selectedProjectId]);
            } else {
                setSchedules([]);
            }

            if (projectUsersCacheRef.current[selectedProjectId]) {
                setProjectUsers(projectUsersCacheRef.current[selectedProjectId]);
            } else {
                setProjectUsers([]);
            }

            const project = projects.find(p => p.project_id == selectedProjectId);
            if (project) {
                setStatsDateRange({
                    start: project.start_date?.split('T')[0] || '',
                    end: project.end_date?.split('T')[0] || ''
                });
            }
        }
    }, [selectedProjectId, projects]);

    useEffect(() => {
        if (activeTab === 'schedules') {
            if (selectedProjectId) {
                fetchSchedules();
                fetchProjectStats(selectedProjectId);
            } else {
                setSchedules([]);
                setProjectStats({ tc: 0, cc: 0, ms: 0, mss: 0, msf: 0, completion_rate: 0 });
            }
        }
        if (activeTab === 'users') {
            if (selectedProjectId) {
                fetchProjectUsers(selectedProjectId);
            } else {
                setProjectUsers([]);
            }
        }
    }, [selectedProjectId, activeTab, statsDateRange.start, statsDateRange.end]);

    // Auto-fill Step ID
    useEffect(() => {
        if (!showAddScheduleForm) return;

        const effectiveProjectId = newSchedule.project_id || selectedProjectId;
        if (effectiveProjectId) {
            // Filter schedules for the selected project
            const projectSchedules = schedules.filter(s => s.project_id == effectiveProjectId);

            if (Array.isArray(projectSchedules) && projectSchedules.length > 0) {
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
                fetchProjects(false);
            }, 30000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab]);

    const handleExportProject = async (project) => {
        setIsExporting(true);
        showToast('已幫您匯出，你可先去執行其他作業', 'info');
        try {
            const schedRes = await api.get(`/schedules?project_id=${project.project_id}`);
            const schedulesData = Array.isArray(schedRes.data) ? schedRes.data : [];

            const schedulesWithQa = await Promise.all(schedulesData.map(async (s) => {
                const scheduleData = { ...s };
                if (s.message_content && s.message_content.startsWith('QA|')) {
                    const tag = s.message_content.substring(3);
                    try {
                        const qaRes = await api.get(`/qa-bank/${tag}`);
                        scheduleData.qa_payload = qaRes.data.msg_rpy || [];
                    } catch (e) {
                        console.warn(`Failed to fetch QA content for tag ${tag}`, e);
                        scheduleData.qa_payload = []; 
                    }
                } else {
                    scheduleData.qa_payload = null;
                }
                return scheduleData;
            }));

            const exportData = {
                version: "1.0",
                project: {
                    project_name: project.project_name,
                    is_enabled: project.is_enabled,
                    is_recurring: project.is_recurring,
                    anchor_config: project.anchor_config,
                    dormancy_config: project.dormancy_config
                },
                schedules: schedulesWithQa
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `${project.project_name || 'journey'}_export.json`);
            document.body.appendChild(downloadAnchorNode); 
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showToast('匯出成功！', 'success');
        } catch (err) {
            showToast('匯出失敗: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        updateTask({
            isProcessing: true,
            progress: 0,
            processingMessage: '正在讀取檔案...'
        });
        
        try {
            const fileReader = new FileReader();
            fileReader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.project || !data.schedules) {
                        throw new Error("無效的匯入檔格式：缺少 project 或 schedules");
                    }

                    const newProjectPayload = {
                        ...data.project,
                        project_name: `${data.project.project_name} (已匯入)`,
                        start_date: new Date().toISOString().slice(0, 16),
                        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
                    };

                    updateTask({ processingMessage: `正在建立專案「${newProjectPayload.project_name}」...` });
                    const createRes = await api.post('/projects', newProjectPayload);
                    const newProjectId = createRes.data.project_id || createRes.data.id;

                    const totalSchedules = data.schedules.length;
                    for (let i = 0; i < totalSchedules; i++) {
                        const s = data.schedules[i];
                        const progress = Math.round(((i + 1) / totalSchedules) * 100);
                        updateTask({
                            progress: progress,
                            processingMessage: `正在匯入步驟 ${i + 1}/${totalSchedules} (${progress}%)...`
                        });
                        
                        let finalMessageContent = s.message_content;

                        if (s.qa_payload && s.qa_payload.length > 0) {
                            const newTag = `cron_${newProjectId}_${s.step_id}`;
                            await api.post('/qa-bank', {
                                tag: newTag,
                                msg_rpy: s.qa_payload,
                                type: 'Sensor'
                            });
                            finalMessageContent = `QA|${newTag}`;
                        } 

                        await api.post('/schedules', {
                            project_id: newProjectId,
                            step_id: s.step_id,
                            interval_hours: s.interval_hours,
                            message_content: finalMessageContent
                        });
                    }

                    showToast(`匯入成功！已建立「${newProjectPayload.project_name}」`, 'success');
                    fetchProjects(true); 
                } catch (parseErr) {
                    showToast('讀取或解析檔案失敗: ' + parseErr.message, 'error');
                } finally {
                    resetTask();
                    if (fileInputRef.current) fileInputRef.current.value = ''; 
                }
            };
            fileReader.readAsText(file);
        } catch (err) {
            showToast('匯入失敗: ' + err.message, 'error');
            resetTask();
            if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
    };

    const fetchProjects = async (showLoader = false) => {
        if (showLoader) setProjectsLoading(true);
        try {
            // Add timestamp to prevent caching
            const res = await api.get('/projects', { params: { _t: new Date().getTime() } });
            setProjects(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError('無法取得專案列表');
        } finally {
            if (showLoader) setProjectsLoading(false);
        }
    };

    const fetchSchedules = async () => {
        if (activeTab !== 'schedules' || !selectedProjectId) return;
        
        const currentIdWhenStarted = selectedProjectId;
        
        // Show loader only if cache is empty
        const hasCache = schedulesCacheRef.current[selectedProjectId] && schedulesCacheRef.current[selectedProjectId].length > 0;
        if (!hasCache) {
            setSchedulesLoading(true);
            setSchedules([]);
        }
        
        try {
            const url = `/schedules?project_id=${selectedProjectId}`;
            const res = await api.get(url);
            
            // Race condition check: only update if the project hasn't changed
            if (selectedProjectIdRef.current !== currentIdWhenStarted) return;
            
            const sortedData = Array.isArray(res.data) ? res.data.sort((a, b) => (parseInt(a.step_id) || 0) - (parseInt(b.step_id) || 0)) : [];
            
            // Always update cache and state
            schedulesCacheRef.current[selectedProjectId] = sortedData;
            setSchedules(sortedData);
            setSchedulesLoading(false);
        } catch (err) {
            if (selectedProjectIdRef.current === currentIdWhenStarted) {
                console.error("Fetch schedules error:", err);
                setError('無法取得排程資料: ' + (err.response?.data?.error || err.message));
                setSchedulesLoading(false);
            }
        }
    };

    const fetchProjectUsers = async (projectId) => {
        if (!projectId) return;
        const currentIdWhenStarted = projectId;

        const hasCache = projectUsersCacheRef.current[projectId] && projectUsersCacheRef.current[projectId].length > 0;
        if (!hasCache) {
            setPageLoading(true);
            setProjectUsers([]);
        }

        try {
            const res = await api.get(`/projects/${projectId}/users`);
            if (selectedProjectIdRef.current !== currentIdWhenStarted) return;
            
            projectUsersCacheRef.current[projectId] = res.data;
            setProjectUsers(res.data);
        } catch (err) {
            console.error('No project users found:', err);
            if (selectedProjectIdRef.current === currentIdWhenStarted) {
                setProjectUsers([]);
            }
        } finally {
            if (selectedProjectIdRef.current === currentIdWhenStarted) {
                setPageLoading(false);
            }
        }
    };

    const fetchProjectStats = async (projectId) => {
        if (!projectId) return;
        setPageLoading(true);
        try {
            const resp = await api.get(`/projects/${projectId}/stats`, {
                params: {
                    start_date: statsDateRange.start,
                    end_date: statsDateRange.end
                }
            });
            setProjectStats(resp.data);
        } catch (err) {
            console.error('Error fetching project stats:', err);
        } finally {
            setPageLoading(false);
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
            showToast('匯出失敗: ' + err.message, 'error');
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
                showToast('匯入成功', 'success');
                fetchSchedules();
            } catch (err) {
                showToast('匯入失敗: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // User Selection Modal State

    // Drag and Drop Handlers
    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Ghost image styling or class can be added here
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const newSchedules = [...schedules];
        const draggedItem = newSchedules[draggedItemIndex];
        newSchedules.splice(draggedItemIndex, 1);
        newSchedules.splice(index, 0, draggedItem);
        
        setDraggedItemIndex(index);
        setSchedules(newSchedules);
    };

    const handleDragEnd = async () => {
        if (!selectedProjectId) return;
        
        updateTask({ isProcessing: true, processingMessage: '正在儲存新順序...' });
        try {
            const scheduleIds = schedules.filter(s => s.project_id == selectedProjectId).map(s => s.schedule_id);
            await api.post(`/projects/${selectedProjectId}/schedules/reorder`, { schedule_ids: scheduleIds });
            // Invalidate cache
            delete schedulesCacheRef.current[selectedProjectId];
            showToast('排序已更新', 'success');
            fetchSchedules();
        } catch (err) {
            showToast('更新順序失敗: ' + err.message, 'error');
        } finally {
            resetTask();
            setDraggedItemIndex(null);
        }
    };

    const handleAddUserToProject = () => {
        if (!selectedProjectId) {
            alert('請先選擇一個專案');
            return;
        }
        // Restrict user addition if no schedules are created for the selected project
        const projectSchedules = schedules.filter(s => s.project_id == selectedProjectId);
        if (projectSchedules.length === 0) {
            showToast('此專案尚未設定任何排程步驟，請先新增排程後再加入用戶。', 'warning');
            return;
        }
        setIsUserSelectModalOpen(true);
    };


    const handleBatchAdd = async (userIds) => {
        if (!userIds || userIds.length === 0) return;
        setIsBatchProcessing(true);
        try {
            await api.post(`/projects/${selectedProjectId}/users/batch-restart`, { user_ids: userIds });
            showToast(`已成功批次加入 ${userIds.length} 位用戶`, 'success');
            setIsUserSelectModalOpen(false);
            setTimeout(() => fetchProjectUsers(selectedProjectId), 1000);
        } catch (err) {
            showToast('批次加入失敗: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setIsBatchProcessing(false);
        }
    };

    const handleRemoveUser = async (userId) => {
        if (!window.confirm(`確定要將用戶 ${userId} 從此專案移除嗎？`)) return;
        try {
            await api.delete(`/projects/${selectedProjectId}/users/${userId}`);
            // Invalidate cache
            delete projectUsersCacheRef.current[selectedProjectId];
            fetchProjectUsers(selectedProjectId);
        } catch (err) {
            showToast('移除失敗: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    const handleRestartUser = async (userId) => {
        if (!window.confirm(`確定要重新啟動用戶 ${userId} 的專案進度嗎？(將重置回第一步)`)) return;
        try {
            await api.post(`/projects/${selectedProjectId}/users/${userId}/restart`);
            // Invalidate cache
            delete projectUsersCacheRef.current[selectedProjectId];
            fetchProjectUsers(selectedProjectId);
            showToast('已重置用戶進度', 'success');
        } catch (err) {
            showToast('重置失敗: ' + (err.response?.data?.message || err.message), 'error');
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
            is_recurring: project.is_recurring || false,
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
            updateTask({ isProcessing: true, processingMessage: '正在更新旅程設定...' });
            await api.put(`/projects/${editingProjectId}`, editProjectFormData);
            setEditingProjectId(null);
            fetchProjects();
            setError('');
            showToast('旅程設定已更新', 'success');
        } catch (err) {
            console.error("Update project error:", err);
            setError('更新失敗: ' + (err.response?.data?.error || err.message));
        } finally {
            resetTask();
        }
    };

    const handleDeleteProject = async (id, name, force = false, skipConfirm = false) => {
        const msg = force ? '確定要解除所有綁定並強制刪除嗎？' : `確定要刪除旅程「${name}」嗎？相關排程也可能受到影響。`;
        if (skipConfirm || window.confirm(msg)) {
            try {
                updateTask({ isProcessing: true, processingMessage: force ? `正在解除綁定並刪除旅程「${name}」...` : `正在刪除旅程「${name}」...` });
                const endpoint = force ? `/projects/${id}?force=true` : `/projects/${id}`;
                await api.delete(endpoint);
                showToast(`旅程「${name}」已刪除`, 'success');
                fetchProjects();
            } catch (err) {
                if (err.response && err.response.status === 409 && err.response.data.has_dependencies) {
                    resetTask();
                    const deps = err.response.data.dependencies || [];
                    const depText = deps.length > 0 ? `\n${deps.map(d => `• ${d}`).join('\n')}` : '';
                    const alertMsg = `⚠️ 無法刪除旅程「${name}」\n\n目前仍有以下項目與此旅程綁定：${depText}\n\n為防止誤刪正在運作中的功能，請先至對應功能解除綁定後，再執行刪除操作。`;
                    window.alert(alertMsg);
                    return;
                }
                showToast('刪除失敗: ' + (err.response?.data?.message || err.message), 'error');
            } finally {
                resetTask();
            }
        }
    };

    const handleCreateProject = async () => {
        const errors = validateProjectForm(newProject);
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            scrollToFirstError();
            setError('請先補齊必填欄位');
            return;
        }

        setIsCreatingProject(true);
        updateTask({ isProcessing: true, processingMessage: '正在建立新旅程...' });
        try {
            await api.post('/projects', newProject);
            setShowAddProjectForm(false);
            setNewProject({
                project_name: '',
                start_date: '',
                end_date: '',
                is_enabled: true,
                is_recurring: false,
                anchor_config: { type: 'immediate', day: 1, time: '09:00' },
                dormancy_config: { enabled: false, start: '23:00', end: '08:00' }
            });
            fetchProjects();
            setFormErrors({});
            setError('');
            showToast(`旅程「${newProject.project_name}」已建立`, 'success');
        } catch (err) {
            console.error("Create project error:", err);
            setError('建立失敗: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsCreatingProject(false);
            resetTask();
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
        setIsUpdatingSchedule(true);
        try {
            let finalMessageContent = editScheduleFormData.message_content;

            // Validation: Non-empty and max 3000 chars for text messages
            if (!finalMessageContent || !finalMessageContent.trim()) {
                setError('訊息內容不能為空');
                setIsUpdatingSchedule(false);
                return;
            }
            if (finalMessageContent.length > 3000) {
                setError('訊息內容不能超過 3000 字');
                setIsUpdatingSchedule(false);
                return;
            }

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

            // Invalidate cache
            delete schedulesCacheRef.current[editScheduleFormData.project_id];
            setEditingScheduleId(null);
            fetchSchedules();
            setError('');
            showToast('排程已更新', 'success');
        } catch (err) {
            setError(err.response?.data?.message || err.message || '排程更新失敗');
        } finally {
            setIsUpdatingSchedule(false);
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (window.confirm('確定要刪除此排程嗎？')) {
            await api.delete(`/schedules/${id}`);
            // Invalidate cache for current project
            delete schedulesCacheRef.current[selectedProjectId];
            showToast('排程步驟已刪除', 'success');
            fetchSchedules();
        }
    };

    const handleCreateSchedule = async () => {
        if (!selectedProjectId) {
            showToast('請先選擇您的旅程', 'warning');
            return;
        }
        const errors = validateScheduleForm(newSchedule);
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            scrollToFirstError();
            setError('請先補齊必填欄位');
            return;
        }

        setIsCreatingSchedule(true);
        try {
            let finalMessageContent = newSchedule.message_content;
            
            // Auto-calculate next step_id (last)
            const projectSchedules = schedules.filter(s => s.project_id == selectedProjectId);
            const nextStepId = projectSchedules.length > 0 
                ? Math.max(...projectSchedules.map(s => parseInt(s.step_id) || 0)) + 1 
                : 1;

            if (finalMessageContent && !finalMessageContent.startsWith('QA|')) {
                finalMessageContent = await saveAsRichMessage(finalMessageContent, selectedProjectId, nextStepId);
            }

            // Ensure interval_hours is valid
            const safeInterval = (newSchedule.interval_hours === '' || newSchedule.interval_hours === null)
                ? '0'
                : newSchedule.interval_hours;

            await api.post('/schedules', {
                ...newSchedule,
                project_id: selectedProjectId,
                step_id: nextStepId,
                interval_hours: safeInterval,
                message_content: finalMessageContent
            });

            // Invalidate cache
            delete schedulesCacheRef.current[selectedProjectId];
            setShowAddScheduleForm(false);
            setNewSchedule({ project_id: '', step_id: '', interval_hours: '', message_content: '' });
            fetchSchedules();
            setFormErrors({});
            setError('');
            showToast('新排程步驟已建立', 'success');
        } catch (err) {
            setError(err.response?.data?.message || err.message || '新增排程失敗');
        } finally {
            setIsCreatingSchedule(false);
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
                            onChange={() => setData({ ...data, anchor_config: { ...data.anchor_config, type: 'weekly', day: 1 } })}
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
        <div style={{ padding: '30px' }}>
            <div style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>自動旅程管理</h1>
                <p style={{ color: '#B0B0B0' }}>管理自動化推播旅程及其對應的執行排程</p>
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
                    <LayoutDashboard size={18} /> 旅程管理
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

            {activeTab === 'projects' ? (
                projectsLoading && projects.length === 0 ? (
                    <LoadingSpinner message="載入專案資料中..." />
                ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '20px' }}>專案列表</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="file" ref={fileInputRef} onChange={handleImportFileChange} accept=".json" style={{ display: 'none' }} />
                            <button className="secondary" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#333', color: '#fff', border: '1px solid #555' }} disabled={taskState.isProcessing}>
                                <Upload size={18} /> {taskState.isProcessing && taskState.progress > 0 ? '匯入中...' : '匯入旅程'}
                            </button>
                            <button className="primary" onClick={() => setShowAddProjectForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                <Plus size={18} /> 新增旅程
                            </button>
                        </div>
                    </div>

                    {showAddProjectForm && (
                        <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: '1 1 480px', minWidth: '300px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>專案名稱</label>
                                        <input
                                            type="text"
                                            className={formErrors.project_name ? 'error-input' : ''}
                                            value={newProject.project_name}
                                            onChange={(e) => {
                                                setNewProject({ ...newProject, project_name: e.target.value });
                                                if (formErrors.project_name) setFormErrors({ ...formErrors, project_name: null });
                                            }}
                                            style={{ width: '100%', borderColor: formErrors.project_name ? '#ff4d4d' : '', backgroundColor: formErrors.project_name ? 'rgba(255, 77, 77, 0.05)' : '' }}
                                        />
                                        {formErrors.project_name && <div style={{ color: '#ff4d4d', fontSize: '12px', marginTop: '4px' }}>{formErrors.project_name}</div>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        <div style={{ flex: '1 1 180px' }}>
                                            <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>開始時間</label>
                                            <input
                                                type="datetime-local"
                                                className={formErrors.start_date ? 'error-input' : ''}
                                                value={newProject.start_date}
                                                max={newProject.end_date || ''}
                                                onChange={(e) => {
                                                    setNewProject({ ...newProject, start_date: e.target.value });
                                                    if (formErrors.start_date) setFormErrors({ ...formErrors, start_date: null });
                                                }}
                                                style={{ width: '100%', borderColor: formErrors.start_date ? '#ff4d4d' : '', backgroundColor: formErrors.start_date ? 'rgba(255, 77, 77, 0.05)' : '' }}
                                            />
                                            {formErrors.start_date && <div style={{ color: '#ff4d4d', fontSize: '12px', marginTop: '4px' }}>{formErrors.start_date}</div>}
                                        </div>
                                        <div style={{ flex: '1 1 180px' }}>
                                            <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>結束時間</label>
                                            <input
                                                type="datetime-local"
                                                className={formErrors.end_date ? 'error-input' : ''}
                                                value={newProject.end_date}
                                                min={newProject.start_date || ''}
                                                onChange={(e) => {
                                                    setNewProject({ ...newProject, end_date: e.target.value });
                                                    if (formErrors.end_date) setFormErrors({ ...formErrors, end_date: null });
                                                }}
                                                style={{ width: '100%', borderColor: formErrors.end_date ? '#ff4d4d' : '', backgroundColor: formErrors.end_date ? 'rgba(255, 77, 77, 0.05)' : '' }}
                                            />
                                            {formErrors.end_date && <div style={{ color: '#ff4d4d', fontSize: '12px', marginTop: '4px' }}>{formErrors.end_date}</div>}
                                        </div>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0' }}>
                                        <input type="checkbox" checked={newProject.is_enabled} onChange={(e) => setNewProject({ ...newProject, is_enabled: e.target.checked })} /> 啟用專案
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0' }}>
                                        <input type="checkbox" checked={newProject.is_recurring} onChange={(e) => setNewProject({ ...newProject, is_recurring: e.target.checked })} /> 重複執行 (定時任務)
                                    </label>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 480px', minWidth: '300px' }}>
                                    {renderConfigInputs(newProject, setNewProject, false)}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', flex: '0 0 auto', marginLeft: 'auto' }}>
                                    <button className="primary" onClick={handleCreateProject} disabled={isCreatingProject} style={{ minWidth: '100px' }}>
                                        {isCreatingProject ? '儲存中...' : '儲存'}
                                    </button>
                                    <button onClick={() => setShowAddProjectForm(false)} disabled={isCreatingProject} style={{ background: '#444', minWidth: '80px' }}>取消</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {projects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 0', border: '2px dashed #333', borderRadius: '15px', marginTop: '20px' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
                                <LayoutDashboard size={80} style={{ color: '#333' }} />
                                <Plus size={24} style={{ position: 'absolute', bottom: 0, right: 0, color: 'var(--primary-yellow)' }} />
                            </div>
                            <h3 style={{ color: '#666', fontSize: '20px', marginBottom: '10px' }}>尚未建立自動旅程</h3>
                            <p style={{ color: '#444' }}>點擊右上角「新增旅程」或「匯入旅程」開始設定您的自動化推播流程</p>
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                                    {Array.isArray(projects) && projects.map((p) => (
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
                                                        <input type="datetime-local" value={(editProjectFormData.start_date || '').replace(' ', 'T').slice(0, 16)} max={(editProjectFormData.end_date || '').replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, start_date: e.target.value })} style={{ padding: '5px' }} />
                                                        <input type="datetime-local" value={(editProjectFormData.end_date || '').replace(' ', 'T').slice(0, 16)} min={(editProjectFormData.start_date || '').replace(' ', 'T').slice(0, 16)} onChange={e => setEditProjectFormData({ ...editProjectFormData, end_date: e.target.value })} style={{ padding: '5px' }} />
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#B0B0B0' }}>
                                                        {p.start_date?.slice(0, 16).replace('T', ' ') || '未設定'} <br />
                                                        ~ {p.end_date?.slice(0, 16).replace('T', ' ') || '未設定'}
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
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <button onClick={() => !isExporting && handleExportProject(p)} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: isExporting ? '#444' : 'rgba(33, 150, 243, 0.1)', color: isExporting ? '#888' : '#2196F3', border: isExporting ? '1px solid #555' : '1px solid currentColor', borderRadius: '4px', cursor: isExporting ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                                                            <Download size={14} /> 匯出
                                                        </button>
                                                        <Edit2 size={18} style={{ cursor: 'pointer', color: '#B0B0B0' }} onClick={() => handleEditProjectClick(p)} title="編輯" />
                                                        <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDeleteProject(p.project_id, p.project_name)} title="刪除" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>
                )
            ) : activeTab === 'schedules' ? (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <h3 style={{ fontSize: '20px' }}>排程步驟設定</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '8px' }}>
                                <Filter size={16} className="text-yellow" />
                                <span style={{ fontSize: '14px' }}>選擇旅程:</span>
                                <select
                                    value={selectedProjectId}
                                    onChange={e => setSelectedProjectId(e.target.value)}
                                    disabled={pageLoading}
                                    style={{ background: 'transparent', border: 'none', padding: '5px', opacity: pageLoading ? 0.5 : 1, cursor: pageLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    <option value="">請選擇旅程...</option>
                                    {Array.isArray(projects) && projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="primary" onClick={() => handlePreviewProject()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--secondary-black)', border: '1px solid var(--primary-yellow)', color: 'var(--primary-yellow)' }}>
                                <ImageIcon size={18} /> 預覽旅程
                            </button>
                            <button className="primary" onClick={() => setShowAddScheduleForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                                <Plus size={18} /> 新增排程
                            </button>
                        </div>
                    </div>

                    {showAddScheduleForm && (
                        <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #333' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#B0B0B0', marginBottom: '10px' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={parseFloat(newSchedule.interval_hours || '0') === 0}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setNewSchedule({ ...newSchedule, interval_hours: '0' });
                                                } else {
                                                    setNewSchedule({ ...newSchedule, interval_hours: (1/60).toString() }); // default to 1 min when unchecked
                                                }
                                            }}
                                        />
                                        不設定時間 (0年0月0天0時0分)
                                    </label>
                                    
                                    {parseFloat(newSchedule.interval_hours || '0') !== 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '11px', color: '#888', display: 'block' }}>年</label>
                                                    <input
                                                        type="number" min="0"
                                                        value={formatInterval(newSchedule.interval_hours).years}
                                                        onChange={e => {
                                                            const y = parseInt(e.target.value) || 0;
                                                            const { months, days, hours, minutes } = formatInterval(newSchedule.interval_hours);
                                                            setNewSchedule({ ...newSchedule, interval_hours: (y * 365 * 24 + months * 30 * 24 + days * 24 + hours + minutes / 60).toString() });
                                                        }}
                                                        style={{ width: '100%', padding: '4px' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '11px', color: '#888', display: 'block' }}>月</label>
                                                    <input
                                                        type="number" min="0"
                                                        value={formatInterval(newSchedule.interval_hours).months}
                                                        onChange={e => {
                                                            const m = parseInt(e.target.value) || 0;
                                                            const { years, days, hours, minutes } = formatInterval(newSchedule.interval_hours);
                                                            setNewSchedule({ ...newSchedule, interval_hours: (years * 365 * 24 + m * 30 * 24 + days * 24 + hours + minutes / 60).toString() });
                                                        }}
                                                        style={{ width: '100%', padding: '4px' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '11px', color: '#888', display: 'block' }}>天</label>
                                                    <input
                                                        type="number" min="0"
                                                        value={formatInterval(newSchedule.interval_hours).days}
                                                        onChange={e => {
                                                            const d = parseInt(e.target.value) || 0;
                                                            const { years, months, hours, minutes } = formatInterval(newSchedule.interval_hours);
                                                            setNewSchedule({ ...newSchedule, interval_hours: (years * 365 * 24 + months * 30 * 24 + d * 24 + hours + minutes / 60).toString() });
                                                        }}
                                                        style={{ width: '100%', padding: '4px' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '11px', color: '#888', display: 'block' }}>時</label>
                                                    <input
                                                        type="number" min="0"
                                                        value={formatInterval(newSchedule.interval_hours).hours}
                                                        onChange={e => {
                                                            const h = parseInt(e.target.value) || 0;
                                                            const { years, months, days, minutes } = formatInterval(newSchedule.interval_hours);
                                                            setNewSchedule({ ...newSchedule, interval_hours: (years * 365 * 24 + months * 30 * 24 + days * 24 + h + minutes / 60).toString() });
                                                        }}
                                                        style={{ width: '100%', padding: '4px' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '11px', color: '#888', display: 'block' }}>分</label>
                                                    <input
                                                        type="number" min="0"
                                                        value={formatInterval(newSchedule.interval_hours).minutes}
                                                        onChange={e => {
                                                            const m = parseInt(e.target.value) || 0;
                                                            const { years, months, days, hours } = formatInterval(newSchedule.interval_hours);
                                                            setNewSchedule({ ...newSchedule, interval_hours: (years * 365 * 24 + months * 30 * 24 + days * 24 + hours + m / 60).toString() });
                                                        }}
                                                        style={{ width: '100%', padding: '4px' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: '1 1 300px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', color: '#B0B0B0', marginBottom: '5px' }}>訊息內容</label>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <div style={{ flex: 1 }}>
                                            <input
                                                type="text"
                                                className={formErrors.message_content ? 'error-input' : ''}
                                                value={newSchedule.message_preview || newSchedule.message_content}
                                                onChange={e => {
                                                    setNewSchedule({ ...newSchedule, message_content: e.target.value });
                                                    if (formErrors.message_content) setFormErrors({ ...formErrors, message_content: null });
                                                }}
                                                disabled={newSchedule.message_content && newSchedule.message_content.startsWith('QA|')}
                                                style={{ width: '100%', backgroundColor: (newSchedule.message_content && newSchedule.message_content.startsWith('QA|')) ? '#444' : '' }}
                                                placeholder={(newSchedule.message_content && newSchedule.message_content.startsWith('QA|')) ? '多媒體訊息已設定' : '輸入文字或點擊右側按鈕'}
                                            />
                                            {formErrors.message_content && <div style={{ color: '#ff4d4d', fontSize: '11px', marginTop: '4px' }}>{formErrors.message_content}</div>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openRichEditor(
                                                newSchedule.message_content,
                                                selectedProjectId,
                                                newSchedule.step_id,
                                                (val, preview, isMultiple) => setNewSchedule(prev => ({ ...prev, message_content: val, message_preview: preview, is_multiple_messages: isMultiple }))
                                            )}
                                            title="編輯多媒體/Flex訊息"
                                            style={{ padding: '8px', background: '#333', border: '1px solid #444', color: 'var(--primary-yellow)' }}
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', paddingTop: '23px' }}>
                                    <button className="primary" onClick={handleCreateSchedule} disabled={isCreatingSchedule} style={{ minWidth: '80px' }}>
                                        {isCreatingSchedule ? '儲存中...' : '儲存'}
                                    </button>
                                    <button onClick={() => setShowAddScheduleForm(false)} style={{ background: '#444' }}>取消</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {pageLoading ? (
                        <div style={{ padding: '40px' }}>
                            <LoadingSpinner message="載入中..." />
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                                    {Array.isArray(schedules) && schedules.length > 0 ? (
                                        schedules.filter(s => s.project_id == selectedProjectId).map((s, index) => (
                                            <tr 
                                                key={s.schedule_id}
                                                draggable={editingScheduleId === null}
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={handleDragEnd}
                                                style={{ 
                                                    opacity: draggedItemIndex === index ? 0.5 : 1,
                                                    cursor: editingScheduleId === null ? 'grab' : 'default',
                                                    borderLeft: draggedItemIndex === index ? '4px solid var(--primary-yellow)' : 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <td style={{ fontSize: '13px', color: '#B0B0B0' }}>
                                                    {(() => {
                                                        const pId = parseInt(s.project_id);
                                                        const p = Array.isArray(projects) ? projects.find(pr => parseInt(pr.project_id) === pId) : null;
                                                        return p ? p.project_name : `ID: ${s.project_id}`;
                                                    })()}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <GripVertical size={16} style={{ cursor: 'grab', color: '#666' }} />
                                                        <span>{s.step_id}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {editingScheduleId === s.schedule_id ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#B0B0B0' }}>
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={parseFloat(editScheduleFormData.interval_hours || '0') === 0}
                                                                        onChange={e => {
                                                                            if (e.target.checked) {
                                                                                setEditScheduleFormData({ ...editScheduleFormData, interval_hours: '0' });
                                                                            } else {
                                                                                setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (1/60).toString() });
                                                                            }
                                                                        }}
                                                                    />
                                                                    不設定時間
                                                                </label>
                                                                {parseFloat(editScheduleFormData.interval_hours || '0') !== 0 && (
                                                                    <>
                                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                                            <div style={{ width: '45px' }}>
                                                                                <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>年</label>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    value={formatInterval(editScheduleFormData.interval_hours).years}
                                                                                    onChange={e => {
                                                                                        const y = parseInt(e.target.value) || 0;
                                                                                        const { months, days, hours, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                                        setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (y * 365 * 24 + months * 30 * 24 + days * 24 + hours + minutes / 60).toString() });
                                                                                    }}
                                                                                    style={{ width: '100%', padding: '2px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ width: '45px' }}>
                                                                                <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>月</label>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    value={formatInterval(editScheduleFormData.interval_hours).months}
                                                                                    onChange={e => {
                                                                                        const m = parseInt(e.target.value) || 0;
                                                                                        const { years, days, hours, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                                        setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (years * 365 * 24 + m * 30 * 24 + days * 24 + hours + minutes / 60).toString() });
                                                                                    }}
                                                                                    style={{ width: '100%', padding: '2px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ width: '45px' }}>
                                                                                <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>天</label>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    value={formatInterval(editScheduleFormData.interval_hours).days}
                                                                                    onChange={e => {
                                                                                        const d = parseInt(e.target.value) || 0;
                                                                                        const { years, months, hours, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                                        setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (years * 365 * 24 + months * 30 * 24 + d * 24 + hours + minutes / 60).toString() });
                                                                                    }}
                                                                                    style={{ width: '100%', padding: '2px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                                            <div style={{ width: '45px' }}>
                                                                                <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>時</label>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    value={formatInterval(editScheduleFormData.interval_hours).hours}
                                                                                    onChange={e => {
                                                                                        const h = parseInt(e.target.value) || 0;
                                                                                        const { years, months, days, minutes } = formatInterval(editScheduleFormData.interval_hours);
                                                                                        setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (years * 365 * 24 + months * 30 * 24 + days * 24 + h + minutes / 60).toString() });
                                                                                    }}
                                                                                    style={{ width: '100%', padding: '2px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ width: '45px' }}>
                                                                                <label style={{ fontSize: '10px', color: '#888', display: 'block' }}>分</label>
                                                                                <input
                                                                                    type="number" min="0"
                                                                                    value={formatInterval(editScheduleFormData.interval_hours).minutes}
                                                                                    onChange={e => {
                                                                                        const m = parseInt(e.target.value) || 0;
                                                                                        const { years, months, days, hours } = formatInterval(editScheduleFormData.interval_hours);
                                                                                        setEditScheduleFormData({ ...editScheduleFormData, interval_hours: (years * 365 * 24 + months * 30 * 24 + days * 24 + hours + m / 60).toString() });
                                                                                    }}
                                                                                    style={{ width: '100%', padding: '2px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                    ) : (
                                                        (() => {
                                                            const { days, hours, minutes } = formatInterval(s.interval_hours);
                                                            let text = '';
                                                            if (days > 0) text += `${days}天 `;
                                                            if (hours > 0) text += `${hours}時 `;
                                                            if (minutes > 0) text += `${minutes}分`;
                                                            return <span>{text || '0分'}</span>
                                                        })()
                                                    )}
                                                </td>
                                                <td style={{ maxWidth: '300px' }}>
                                                    {editingScheduleId === s.schedule_id ? (
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <input
                                                                    type="text"
                                                                    value={editScheduleFormData.message_preview || editScheduleFormData.message_content}
                                                                    onChange={e => setEditScheduleFormData({ ...editScheduleFormData, message_content: e.target.value })}
                                                                    disabled={editScheduleFormData.message_content && editScheduleFormData.message_content.startsWith('QA|') && editScheduleFormData.is_multiple_messages}
                                                                    style={{ width: '100%', backgroundColor: (editScheduleFormData.message_content && editScheduleFormData.message_content.startsWith('QA|') && editScheduleFormData.is_multiple_messages) ? '#444' : '' }}
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => openRichEditor(
                                                                    editScheduleFormData.message_content,
                                                                    editScheduleFormData.project_id,
                                                                    editScheduleFormData.step_id,
                                                                    (val, preview, isMultiple) => setEditScheduleFormData(prev => ({ ...prev, message_content: val, message_preview: preview, is_multiple_messages: isMultiple }))
                                                                )}
                                                                style={{ padding: '5px', background: '#333', border: '1px solid #444', color: 'var(--primary-yellow)' }}
                                                            >
                                                                <MessageSquare size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {s.message_preview || s.message_content}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingScheduleId === s.schedule_id ? (
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                            {isUpdatingSchedule ? (
                                                                <span style={{ fontSize: '12px', color: 'var(--primary-yellow)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <CircularProgress size={12} sx={{ color: 'var(--primary-yellow)' }} />
                                                                    儲存中...
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <Check className="text-yellow" style={{ cursor: 'pointer' }} onClick={handleUpdateSchedule} />
                                                                    <X style={{ cursor: 'pointer' }} onClick={() => setEditingScheduleId(null)} />
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '15px' }}>
                                                            <Edit2 size={18} style={{ cursor: 'pointer', color: '#B0B0B0' }} onClick={() => handleEditScheduleClick(s)} />
                                                            <Trash2 size={18} style={{ cursor: 'pointer', color: '#FF4D4D' }} onClick={() => handleDeleteSchedule(s.schedule_id, s.step_id)} />
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                                {schedulesLoading ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        <CircularProgress size={16} sx={{ color: 'var(--primary-yellow)' }} />
                                                        載入排程中...
                                                    </div>
                                                ) : (
                                                    selectedProjectId ? '此旅程尚無排程設定' : '請選擇旅程以查看排程'
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <h3 style={{ fontSize: '20px' }}>參與用戶列表</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '8px' }}>
                                <Filter size={16} className="text-yellow" />
                                <span style={{ fontSize: '14px' }}>選擇旅程:</span>
                                <select
                                    value={selectedProjectId}
                                    onChange={e => setSelectedProjectId(e.target.value)}
                                    disabled={pageLoading}
                                    style={{ background: 'transparent', border: 'none', padding: '5px', opacity: pageLoading ? 0.5 : 1, cursor: pageLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    <option value="">請選擇旅程...</option>
                                    {Array.isArray(projects) && projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <button className="primary" onClick={handleAddUserToProject} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                            <Plus size={18} /> 手動加入用戶
                        </button>
                    </div>

                    {pageLoading ? (
                        <div style={{ padding: '40px' }}>
                            <LoadingSpinner message="載入用戶中..." />
                        </div>
                    ) : (
                        <div style={{ backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                        <th>姓名</th>
                                        <th>目前步驟</th>
                                        <th>狀態</th>
                                        <th>時間資訊</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectUsers.length > 0 ? projectUsers.map((u, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: '600' }}>{u.user_name || '未命名'}</td>
                                            <td>{u.status === 'completed' ? '旅程完成' : (u.step_id || 'N/A')}</td>
                                            <td>
                                                {(() => {
                                                    const s = u.status || 'unknown';
                                                    let color = '#666';
                                                    let text = s;
                                                    let preview = null;
                                                    if (s === 'active' || s === 'Active') {
                                                        color = '#4CAF50';
                                                        text = '進行中';
                                                    }
                                                    if (s === 'completed') {
                                                        color = '#2196F3';
                                                        text = '已完成';
                                                    }
                                                    if (u.is_following === false && (s === 'active' || s === 'Active')) {
                                                        color = '#FF9800';
                                                        text = '已中斷';
                                                    }
                                                    const currentSchedule = schedules.find(sched => sched.project_id == selectedProjectId && sched.step_id == (u.step_id || (s === 'completed' ? Object.keys(schedules).length : 0)));
                                                    if ((s === 'active' || text === '已中斷') && currentSchedule && currentSchedule.message_preview) {
                                                        preview = <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text === '已中斷' ? '暫停於' : '即將發送'}: {currentSchedule.message_preview}</div>;
                                                    } else if (s === 'completed') {
                                                        const lastSched = [...schedules].filter(sched => sched.project_id == selectedProjectId).sort((a, b) => b.step_id - a.step_id)[0];
                                                        if (lastSched && lastSched.message_preview) {
                                                            preview = <div style={{ fontSize: '12px', color: '#888', marginTop: '4px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>完結於: {lastSched.message_preview}</div>;
                                                        }
                                                    }
                                                    return (
                                                        <div>
                                                            <span style={{ color, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {s === 'completed' ? <CheckCircle2 size={14} /> : (text === '已中斷' ? <Clock size={14} /> : <Circle size={14} />)}
                                                                {text}
                                                            </span>
                                                            {preview}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '12px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {u.joined_at && <div><span style={{ color: '#888' }}>進入/重開:</span> {new Date(u.joined_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}</div>}
                                                    {u.next_push_time && u.status === 'active' && <div><span style={{ color: '#888' }}>預計下步:</span> {new Date(u.next_push_time).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}</div>}
                                                    {!u.joined_at && !u.next_push_time && <span style={{color: '#666'}}>無資料</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleRestartUser(u.user_id)} style={{ padding: '4px 8px', background: '#333', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', color: 'var(--primary-yellow)' }}><RotateCcw size={14} /> 重啟</button>
                                                    <button onClick={() => handleRemoveUser(u.user_id)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#FF4D4D' }}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                                {selectedProjectId ? '無參與用戶' : '請選擇旅程以查看參與用戶'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
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
                onSelectBatch={handleBatchAdd}
                existingUsers={Array.isArray(projectUsers) ? projectUsers.map(u => u.user_id) : []}
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
                            <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd' }}>
                                <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>設定基準時間 (預覽計算用)：</label>
                                <input 
                                    type="datetime-local" 
                                    value={previewBaseTime} 
                                    onChange={e => setPreviewBaseTime(e.target.value)} 
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} 
                                />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                                {previewLoading && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
                                        <LoadingSpinner message="正在生成預覽..." />
                                    </div>
                                )}
                                <JourneyPreview steps={computedPreviewSteps} />
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

// Rich Message Editor Modal
const RichMessageModal = ({ isOpen, onClose, onSave, initialTag, initialText, projectId, stepId }) => {
    const { showToast } = useToast();
    const [tag, setTag] = useState(initialTag || '');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeMsgIndex, setActiveMsgIndex] = useState(0);
    const [isUploadingMsg, setIsUploadingMsg] = useState(null);

    const createEmptyMsg = () => ({ OTYPE: 'TextSendMessage', text: '' });

    const fetchExistingMessages = async (tagName) => {
        setLoading(true);
        try {
            const res = await api.get(`/qa-bank/${tagName}`);
            const msgsRaw = res.data.msg_rpy || [];
            let msgs = Array.isArray(msgsRaw) ? msgsRaw : [msgsRaw];
            msgs = msgs.map(m => {
                let parsed = typeof m === 'string' ? JSON.parse(m) : m;
                if (parsed.Line) return parsed.Line;
                return parsed;
            });
            if (msgs.length === 0) msgs = [createEmptyMsg()];
            setMessages(msgs);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setMessages([createEmptyMsg()]);
            } else {
                showToast('讀取失敗: ' + err.message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (!initialTag) {
                const defaultTag = `project_${projectId}_step_${stepId}_${Date.now()}`;
                setTag(defaultTag);
                if (initialText) {
                    setMessages([{ OTYPE: 'TextSendMessage', text: initialText }]);
                } else {
                    setMessages([createEmptyMsg()]);
                }
            } else {
                setTag(initialTag);
                fetchExistingMessages(initialTag);
            }
        }
    }, [isOpen, initialTag, initialText, projectId, stepId]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const payloadMessages = messages.map(m => {
                if (m.OTYPE === 'FlexSendMessage' && typeof m.contents === 'string') {
                    return { ...m, contents: JSON.parse(m.contents) };
                }
                return m;
            });

            // Validation: Ensure text is not empty
            for (let i = 0; i < payloadMessages.length; i++) {
                const msg = payloadMessages[i];
                if (msg.OTYPE === 'TextSendMessage' && (!msg.text || !msg.text.trim())) {
                    showToast(`訊息 #${i + 1} 內容不能空白`, 'warning');
                    setLoading(false);
                    return;
                }
                if ((msg.OTYPE === 'ImageSendMessage' || msg.OTYPE === 'VideoSendMessage' || msg.OTYPE === 'AudioSendMessage') && !msg.original_content_url?.trim()) {
                    showToast(`訊息 #${i + 1} 的 URL 連結不能空白`, 'warning');
                    setLoading(false);
                    return;
                } else if (msg.OTYPE === 'FlexSendMessage') {
                    if (!msg.contents || (typeof msg.contents === 'object' && Object.keys(msg.contents).length === 0)) {
                        showToast(`第 ${i + 1} 則 Flex 訊息內容未設定`, 'warning');
                        setLoading(false);
                        return;
                    }
                    // Deep validation for Flex links/return text
                    const contents = msg.contents;
                    const bubbles = (contents && contents.type === 'carousel') ? contents.contents : [contents];
                    for (let j = 0; j < bubbles.length; j++) {
                        const bubble = bubbles[j];
                        if (!bubble) continue;
                        const bubbleNum = (contents && contents.type === 'carousel') ? `卡片 #${j + 1}: ` : '';
                        if (bubble.hero?.action) {
                            const action = bubble.hero.action;
                            const val = action.uri || action.data || action.text || '';
                            if (!val.trim()) {
                                const typeLabel = (action.type === 'uri' || action.uri) ? '連結' : '回傳文字';
                                showToast(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}圖片點擊的${typeLabel}不能為空`, 'warning');
                                setLoading(false);
                                return;
                            }
                        }
                        const footerContents = bubble.footer?.contents || [];
                        const buttons = footerContents.filter(c => c && c.type === 'button');
                        for (let k = 0; k < buttons.length; k++) {
                            const btn = buttons[k];
                            const val = btn.action?.uri || btn.action?.data || btn.action?.text || '';
                            if (!val.trim()) {
                                const typeLabel = (btn.action?.type === 'uri' || btn.action?.uri) ? '連結' : '回傳文字';
                                showToast(`第 ${i + 1} 則 Flex 訊息 ${bubbleNum}按鈕 #${k + 1} 的${typeLabel}不能為空`, 'warning');
                                setLoading(false);
                                return;
                            }
                        }
                    }
                }
            }

            await api.post('/qa-bank', { tag, msg_rpy: payloadMessages, type: 'Sensor' });
            const firstMsg = payloadMessages[0];
            let previewText = '';
            if (firstMsg) {
                if (firstMsg.OTYPE === 'TextSendMessage') previewText = firstMsg.text;
                else if (firstMsg.OTYPE === 'FlexSendMessage') previewText = firstMsg.alt_text || 'Flex Message';
                else previewText = `[${firstMsg.OTYPE.replace('SendMessage', '')}]`;
            }
            onSave(tag, previewText, payloadMessages.length > 1);
            onClose();
        } catch (err) {
            showToast('儲存失敗: ' + err.message, 'error');
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
        else if (newType === 'ImageSendMessage' || newType === 'VideoSendMessage') {
            newMsg.original_content_url = '';
            newMsg.preview_image_url = '';
        } else if (newType === 'AudioSendMessage') {
            newMsg.original_content_url = '';
            newMsg.duration = 1000;
        } else if (newType === 'FlexSendMessage') {
            newMsg.alt_text = 'Flex Message';
            newMsg.contents = '{}';
        }
        newMsgs[index] = newMsg;
        setMessages(newMsgs);
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '800px', height: '80%', backgroundColor: '#222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px' }}>進階訊息編輯器</h2>
                    <X style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>
                <div style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                        {messages.map((m, i) => (
                            <div key={i} onClick={() => setActiveMsgIndex(i)} style={{ padding: '10px', backgroundColor: activeMsgIndex === i ? '#444' : '#333', borderRadius: '8px', cursor: 'pointer', border: activeMsgIndex === i ? '1px solid var(--primary-yellow)' : '1px solid transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px' }}>#{i + 1} {m.OTYPE.replace('SendMessage', '')}</span>
                                {messages.length > 1 && (
                                    <Trash2 size={14} color="#FF4D4D" onClick={(e) => {
                                        e.stopPropagation();
                                        const next = messages.filter((_, idx) => idx !== i);
                                        setMessages(next);
                                        if (activeMsgIndex >= next.length) setActiveMsgIndex(Math.max(0, next.length - 1));
                                    }} />
                                )}
                            </div>
                        ))}
                        {messages.length < 5 && <button onClick={() => { setMessages([...messages, createEmptyMsg()]); setActiveMsgIndex(messages.length); }} style={{ border: '1px dashed #666', background: 'transparent', padding: '10px', color: '#888' }}>+ 新增訊息</button>}
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#333', borderRadius: '8px', padding: '20px', overflowY: 'auto' }}>
                        {messages[activeMsgIndex] ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>類型</label>
                                    <select value={messages[activeMsgIndex].OTYPE} onChange={(e) => changeType(activeMsgIndex, e.target.value)} style={{ width: '100%', padding: '8px', background: '#222', border: 'none', color: '#fff' }}>
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
                                        <textarea value={messages[activeMsgIndex].text} onChange={(e) => updateMessage(activeMsgIndex, 'text', e.target.value)} rows={12} style={{ width: '100%', padding: '10px', background: '#222', border: 'none', color: '#fff' }} />
                                    </div>
                                )}
                                {messages[activeMsgIndex].OTYPE === 'ImageSendMessage' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>圖片連結 (URL)</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="text" value={messages[activeMsgIndex].original_content_url} onChange={(e) => {
                                                    const val = e.target.value;
                                                    const msgs = [...messages];
                                                    msgs[activeMsgIndex].original_content_url = val;
                                                    msgs[activeMsgIndex].preview_image_url = val;
                                                    setMessages(msgs);
                                                }} style={{ flex: 1, padding: '10px', background: '#222', border: 'none', color: '#fff' }} placeholder="https://..." />
                                                <label style={{ padding: '10px 15px', background: isUploadingMsg === `image_${activeMsgIndex}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `image_${activeMsgIndex}` ? '#888' : '#000', borderRadius: '4px', cursor: isUploadingMsg === `image_${activeMsgIndex}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `image_${activeMsgIndex}` ? 'none' : 'auto' }}>
                                                    {isUploadingMsg === `image_${activeMsgIndex}` ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} 
                                                    {isUploadingMsg === `image_${activeMsgIndex}` ? '上傳中...' : '上傳'}
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingMsg === `image_${activeMsgIndex}`} onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        if (file.size > 5 * 1024 * 1024) {
                                                            alert('圖片大小不可超過 5 MB');
                                                            e.target.value = '';
                                                            return;
                                                        }
                                                        setIsUploadingMsg(`image_${activeMsgIndex}`);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const res = await api.post('/upload/github', formData);
                                                            const msgs = [...messages];
                                                            msgs[activeMsgIndex].original_content_url = res.data.url;
                                                            msgs[activeMsgIndex].preview_image_url = res.data.url;
                                                            setMessages(msgs);
                                                        } catch (err) {
                                                            const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                            alert('哎呀，上傳失敗了：' + errorMsg);
                                                        } finally {
                                                            setIsUploadingMsg(null);
                                                            e.target.value = '';
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                        </div>
                                        {messages[activeMsgIndex].original_content_url && (
                                            <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                                <img src={messages[activeMsgIndex].original_content_url} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} alt="預覽圖片" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {messages[activeMsgIndex].OTYPE === 'VideoSendMessage' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa', marginBottom: '5px' }}>
                                                影片連結 (URL)
                                                <MuiTooltip title={<div style={{ padding: '4px' }}>˙可以將影片上傳至 YouTube 或其他雲端空間，並在此貼上影片網址。<br/>˙若必須直接上傳影片檔，請先使用線上壓縮工具將影片壓縮至 5MB 以內。</div>} placement="top" arrow>
                                                    <HelpCircle size={16} style={{ cursor: 'help', color: '#888' }} />
                                                </MuiTooltip>
                                            </label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="text" value={messages[activeMsgIndex].original_content_url} onChange={(e) => updateMessage(activeMsgIndex, 'original_content_url', e.target.value)} style={{ flex: 1, padding: '10px', background: '#222', border: 'none', color: '#fff' }} placeholder="https://..." />
                                                <label style={{ padding: '10px 15px', background: isUploadingMsg === `video_${activeMsgIndex}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `video_${activeMsgIndex}` ? '#888' : '#000', borderRadius: '4px', cursor: isUploadingMsg === `video_${activeMsgIndex}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `video_${activeMsgIndex}` ? 'none' : 'auto' }}>
                                                    {isUploadingMsg === `video_${activeMsgIndex}` ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} 
                                                    {isUploadingMsg === `video_${activeMsgIndex}` ? '上傳中...' : '上傳'}
                                                    <input type="file" accept="video/*" style={{ display: 'none' }} disabled={isUploadingMsg === `video_${activeMsgIndex}`} onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        if (file.size > 50 * 1024 * 1024) {
                                                            alert('影片大小不可超過 50 MB');
                                                            e.target.value = '';
                                                            return;
                                                        }
                                                        setIsUploadingMsg(`video_${activeMsgIndex}`);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const res = await api.post('/upload/github', formData);
                                                            updateMessage(activeMsgIndex, 'original_content_url', res.data.url);
                                                        } catch (err) {
                                                            const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                            alert('哎呀，上傳失敗了：' + errorMsg);
                                                        } finally {
                                                            setIsUploadingMsg(null);
                                                            e.target.value = '';
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>影片預覽圖連結 (Preview Image URL)</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="text" value={messages[activeMsgIndex].preview_image_url} onChange={(e) => updateMessage(activeMsgIndex, 'preview_image_url', e.target.value)} style={{ flex: 1, padding: '10px', background: '#222', border: 'none', color: '#fff' }} placeholder="https://..." />
                                                <label style={{ padding: '10px 15px', background: isUploadingMsg === `video_preview_${activeMsgIndex}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `video_preview_${activeMsgIndex}` ? '#888' : '#000', borderRadius: '4px', cursor: isUploadingMsg === `video_preview_${activeMsgIndex}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `video_preview_${activeMsgIndex}` ? 'none' : 'auto' }}>
                                                    {isUploadingMsg === `video_preview_${activeMsgIndex}` ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} 
                                                    {isUploadingMsg === `video_preview_${activeMsgIndex}` ? '上傳中...' : '上傳'}
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={isUploadingMsg === `video_preview_${activeMsgIndex}`} onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        if (file.size > 1 * 1024 * 1024) {
                                                            alert('預覽圖大小不可超過 1 MB，建議壓到 500 KB 以下');
                                                            e.target.value = '';
                                                            return;
                                                        }
                                                        setIsUploadingMsg(`video_preview_${activeMsgIndex}`);
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const res = await api.post('/upload/github', formData);
                                                            updateMessage(activeMsgIndex, 'preview_image_url', res.data.url);
                                                        } catch (err) {
                                                            const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                            alert('哎呀，上傳失敗了：' + errorMsg);
                                                        } finally {
                                                            setIsUploadingMsg(null);
                                                            e.target.value = '';
                                                        }
                                                    }} />
                                                </label>
                                            </div>
                                        </div>
                                        {messages[activeMsgIndex].original_content_url && (
                                            <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                                <video controls poster={messages[activeMsgIndex].preview_image_url} src={messages[activeMsgIndex].original_content_url} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {messages[activeMsgIndex].OTYPE === 'AudioSendMessage' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label style={{ display: 'block', color: '#aaa', marginBottom: '5px' }}>音檔連結 (URL)</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input type="text" value={messages[activeMsgIndex].original_content_url} onChange={(e) => updateMessage(activeMsgIndex, 'original_content_url', e.target.value)} style={{ flex: 1, padding: '10px', background: '#222', border: 'none', color: '#fff' }} placeholder="https://..." />
                                                <label style={{ padding: '10px 15px', background: isUploadingMsg === `audio_${activeMsgIndex}` ? '#555' : 'var(--primary-yellow)', color: isUploadingMsg === `audio_${activeMsgIndex}` ? '#888' : '#000', borderRadius: '4px', cursor: isUploadingMsg === `audio_${activeMsgIndex}` ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', pointerEvents: isUploadingMsg === `audio_${activeMsgIndex}` ? 'none' : 'auto' }}>
                                                    {isUploadingMsg === `audio_${activeMsgIndex}` ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} 
                                                    {isUploadingMsg === `audio_${activeMsgIndex}` ? '上傳中...' : '上傳'}
                                                    <input type="file" accept="audio/*" style={{ display: 'none' }} disabled={isUploadingMsg === `audio_${activeMsgIndex}`} onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        if (file.size > 30 * 1024 * 1024) {
                                                            alert('音檔大小不可超過 30 MB');
                                                            e.target.value = '';
                                                            return;
                                                        }
                                                        setIsUploadingMsg(`audio_${activeMsgIndex}`);
                                                        const audioObj = new Audio(URL.createObjectURL(file));
                                                        audioObj.onloadedmetadata = async () => {
                                                            const dur = Math.round(audioObj.duration * 1000);
                                                            URL.revokeObjectURL(audioObj.src);
                                                            const formData = new FormData();
                                                            formData.append('file', file);
                                                            try {
                                                                const res = await api.post('/upload/github', formData);
                                                                const msgs = [...messages];
                                                                msgs[activeMsgIndex].original_content_url = res.data.url;
                                                                msgs[activeMsgIndex].duration = dur;
                                                                setMessages(msgs);
                                                            } catch (err) {
                                                                const errorMsg = err.response?.status === 413 ? '這個檔案太大了！請將檔案縮小到 5MB 以內再試一次喔。' : '發生了一點小狀況，請稍後再試喔。';
                                                                alert('哎呀，上傳失敗了：' + errorMsg);
                                                            } finally {
                                                                setIsUploadingMsg(null);
                                                                e.target.value = '';
                                                            }
                                                        };
                                                        audioObj.onerror = () => {
                                                            setIsUploadingMsg(null);
                                                            e.target.value = '';
                                                            alert('無法讀取音檔長度');
                                                        };
                                                    }} />
                                                </label>
                                            </div>
                                        </div>
                                        {messages[activeMsgIndex].original_content_url && (
                                            <div style={{ marginTop: '10px' }}>
                                                <audio controls src={messages[activeMsgIndex].original_content_url} style={{ width: '100%' }} />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {messages[activeMsgIndex].OTYPE === 'FlexSendMessage' && (
                                    <div style={{ height: '500px', border: '1px solid #444' }}>
                                        <FlexMessageEditor key={activeMsgIndex} initialContent={messages[activeMsgIndex].contents} onSave={(val) => updateMessage(activeMsgIndex, 'contents', val)} onCancel={() => { }} />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                    <button onClick={onClose} style={{ background: '#444', padding: '10px 20px', border: 'none', color: '#fff' }}>取消</button>
                    <button onClick={handleSave} disabled={loading} style={{ background: 'var(--primary-yellow)', padding: '10px 20px', border: 'none', color: '#000', fontWeight: 'bold' }}>{loading ? '儲存中...' : '儲存'}</button>
                </div>
            </div>
        </div>
    );
};

const UserSelectModal = ({ isOpen, onClose, onSelectBatch, existingUsers = [] }) => {
    const [users, setUsers] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nameSearch, setNameSearch] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [processing, setProcessing] = useState(false);

    const parseTags = (tagStr) => {
        if (!tagStr) return [];
        try {
            if (typeof tagStr !== 'string') {
                if (Array.isArray(tagStr)) tagStr = JSON.stringify(tagStr);
                else tagStr = String(tagStr);
            }
            if (tagStr.startsWith('[') && tagStr.endsWith(']')) {
                return JSON.parse(tagStr.replace(/'/g, '"'));
            } else {
                return tagStr.split('|').map(t => t.trim()).filter(t => t);
            }
        } catch (e) {
            return [];
        }
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setSelectedUserIds([]); // Reset selection when opening
            Promise.all([
                api.get('/registered-users?source=private_var'),
                api.get('/tags')
            ]).then(([userRes, tagRes]) => {
                const userData = Array.isArray(userRes.data) ? userRes.data : [];
                setUsers(userData.filter(u => u && u.user_id));
                const tagData = Array.isArray(tagRes.data) ? tagRes.data : [];
                setAllTags(tagData.sort());
            }).catch(err => {
                console.error("Failed to load modal data:", err);
            }).finally(() => setLoading(false));
        }
    }, [isOpen]);

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const toggleUserSelection = (userId) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const filteredUsers = users.filter(u => {
        if (existingUsers.includes(u?.user_id)) return false;

        // Name Search
        const nTerm = nameSearch.toLowerCase();
        if (nTerm) {
            if (!String(u?.name || '').toLowerCase().includes(nTerm)) return false;
        }

        // Tag Search (AND logic)
        if (selectedTags.length > 0) {
            const userTags = parseTags(u.tags);

            if (!selectedTags.every(st => userTags.includes(st))) return false;
        }

        return true;
    });

    const handleSelectAll = () => {
        setSelectedUserIds(filteredUsers.map(u => u.user_id));
    };

    const handleDeselectAll = () => {
        setSelectedUserIds([]);
    };

    const handleSubmit = async () => {
        if (selectedUserIds.length === 0) {
            alert('請先選取至少一位用戶');
            return;
        }
        setProcessing(true);
        try {
            await onSelectBatch(selectedUserIds);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onClose={processing ? null : onClose} maxWidth="sm" fullWidth PaperProps={{ style: { backgroundColor: '#1A1A1A', color: '#fff' } }}>
            <DialogTitle style={{ borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                手動將用戶加入專案 (批次選擇)
                {!processing && <X style={{ cursor: 'pointer' }} onClick={onClose} />}
            </DialogTitle>
            <DialogContent style={{ paddingTop: '20px', position: 'relative' }}>
                {processing && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(26, 26, 26, 0.8)', zIndex: 10,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <LoadingSpinner message="正在批次加入用戶中，請耐心等待..." />
                        <div style={{ marginTop: '10px', color: '#aaa' }}>這可能需要一段時間，請勿關閉視窗</div>
                    </div>
                )}
                <div style={{ opacity: processing ? 0.3 : 1, pointerEvents: processing ? 'none' : 'auto' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            type="text"
                            placeholder="搜尋用戶名稱..."
                            value={nameSearch}
                            onChange={(e) => setNameSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' }}
                        />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ color: '#aaa', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>篩選標籤:</span>
                                {selectedTags.length > 0 && <span style={{ color: 'var(--primary-yellow)', cursor: 'pointer', fontSize: '12px' }} onClick={() => setSelectedTags([])}>清除篩選</span>}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '80px', overflowY: 'auto' }}>
                                {allTags.map(tag => (
                                    <span
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            backgroundColor: selectedTags.includes(tag) ? 'var(--primary-yellow)' : '#444',
                                            color: selectedTags.includes(tag) ? '#000' : '#fff',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <button onClick={handleSelectAll} style={{ padding: '4px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>全選目前過濾結果</button>
                            <button onClick={handleDeselectAll} style={{ padding: '4px 10px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>取消全選</button>
                        </div>

                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #333', borderRadius: '4px', background: '#111' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}><LoadingSpinner message="載入用戶中..." /></div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>無符合條件的用戶</div>
                            ) : (
                                <div style={{ padding: '0 10px' }}>
                                    {filteredUsers.map(u => (
                                        <div
                                            key={u.user_id}
                                            onClick={() => toggleUserSelection(u.user_id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '10px 0',
                                                borderBottom: '1px solid #222',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px',
                                                height: '18px',
                                                border: '2px solid' + (selectedUserIds.includes(u.user_id) ? 'var(--primary-yellow)' : '#555'),
                                                backgroundColor: selectedUserIds.includes(u.user_id) ? 'var(--primary-yellow)' : 'transparent',
                                                borderRadius: '3px',
                                                marginRight: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {selectedUserIds.includes(u.user_id) && <span style={{ color: '#000', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 'bold', color: selectedUserIds.includes(u.user_id) ? 'var(--primary-yellow)' : '#fff' }}>{u.name || '未命名用戶'}</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                    {parseTags(u.tags).length > 0 ? (
                                                        parseTags(u.tags).map((t, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '10px',
                                                                color: '#FFD700',
                                                                backgroundColor: 'rgba(255,215,0,0.1)',
                                                                padding: '2px 6px',
                                                                borderRadius: '8px',
                                                                border: '1px solid rgba(255,215,0,0.2)'
                                                            }}>
                                                                {t}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: '#666' }}>無標籤</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '12px', color: '#888' }}>
                            已選取 {selectedUserIds.length} 位用戶
                        </div>
                    </div>
            </DialogContent>
            <DialogActions style={{ borderTop: '1px solid #333', padding: '15px' }}>
                <button onClick={onClose} disabled={processing} style={{ background: '#444', color: '#fff', padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>取消</button>
                <button
                    onClick={handleSubmit}
                    disabled={processing || selectedUserIds.length === 0}
                    style={{
                        background: selectedUserIds.length > 0 ? 'var(--primary-yellow)' : '#333',
                        color: selectedUserIds.length > 0 ? '#000' : '#888',
                        padding: '8px 20px',
                        borderRadius: '4px',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: selectedUserIds.length > 0 ? 'pointer' : 'not-allowed'
                    }}
                >
                    {processing ? '處理中...' : `加入已選取用戶 (${selectedUserIds.length})`}
                </button>
            </DialogActions>
        </Dialog>
    );
};

export default ProjectsManagement;
