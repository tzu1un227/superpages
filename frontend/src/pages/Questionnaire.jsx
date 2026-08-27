import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Step,
    StepLabel,
    Stepper,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import InsightsIcon from '@mui/icons-material/Insights';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import TagInput from '../components/TagInput';

const CONDITION_OPTIONS = [
    { value: '1', label: '不限格式' },
    { value: '2', label: '只能輸入數字' },
    { value: '3', label: '必須符合指定選項' },
    { value: '4', label: '限制字數範圍' },
    { value: '5', label: '手機格式 (09 開頭 10 碼)' },
    { value: '6', label: 'Email 格式' },
    { value: '7', label: '日期格式 (YYYY-MM-DD)' },
];

const STEPS = ['基本資料', '題目設定', '建立確認'];

const fieldSx = {
    '& .MuiInputBase-input': { color: 'white' },
    '& .MuiInputLabel-root': { color: '#B0B0B0' },
    '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: '#555' },
        '&:hover fieldset': { borderColor: '#888' },
        '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' },
    },
};

const selectSx = {
    color: 'white',
    '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-yellow)' },
    '.MuiSvgIcon-root': { color: '#B0B0B0' },
};

const emptyQuestion = () => ({
    content: '',
    cond: '1',
    cond_detail: '',
    tags: [],
    _min: '',
    _max: '',
});

function QuestionCard({ q, index, total, onChange, onDelete, onMoveUp, onMoveDown }) {
    const needDetail = q.cond === '3' || q.cond === '4';

    return (
        <Paper sx={{ p: 2, mb: 2, background: '#2a2a2a', border: '1px solid #444' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
                    第 {index + 1} 題
                </Typography>
                <Box>
                    <Tooltip title="上移">
                        <span>
                            <IconButton size="small" disabled={index === 0} onClick={onMoveUp} sx={{ color: '#888' }}>
                                <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="下移">
                        <span>
                            <IconButton size="small" disabled={index === total - 1} onClick={onMoveDown} sx={{ color: '#888' }}>
                                <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="刪除題目">
                        <IconButton size="small" onClick={onDelete} sx={{ color: '#e57373' }}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <TextField
                fullWidth
                size="small"
                label="題目內容"
                value={q.content}
                onChange={e => onChange({ ...q, content: e.target.value })}
                sx={{ ...fieldSx, mb: 2 }}
                InputLabelProps={{ sx: { color: '#B0B0B0' } }}
            />

            <FormControl fullWidth size="small" sx={{ mb: needDetail ? 2 : 0 }}>
                <InputLabel sx={{ color: '#B0B0B0' }}>回答限制</InputLabel>
                <Select
                    value={q.cond}
                    label="回答限制"
                    onChange={e => onChange({ ...q, cond: e.target.value, cond_detail: '', _min: '', _max: '' })}
                    sx={selectSx}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: '#2a2a2a', color: 'white' } } }}
                >
                    {CONDITION_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {q.cond === '3' && (
                <TextField
                    fullWidth
                    size="small"
                    label="允許選項（用逗號分隔）"
                    value={q.cond_detail}
                    onChange={e => onChange({ ...q, cond_detail: e.target.value })}
                    sx={fieldSx}
                    InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                />
            )}

            {q.cond === '4' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        type="number"
                        label="最小字數"
                        value={q._min}
                        onChange={e => onChange({ ...q, _min: e.target.value, cond_detail: `${e.target.value},${q._max}` })}
                        sx={{ ...fieldSx, flex: 1 }}
                        InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                    />
                    <TextField
                        size="small"
                        type="number"
                        label="最大字數（-1 代表不限）"
                        value={q._max}
                        onChange={e => onChange({ ...q, _max: e.target.value, cond_detail: `${q._min},${e.target.value}` })}
                        sx={{ ...fieldSx, flex: 1 }}
                        InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                    />
                </Box>
            )}

            <Box sx={{ mt: 2 }}>
                <Typography sx={{ color: '#B0B0B0', fontSize: '0.85rem', mb: 0.5 }}>回答此題後自動上標籤</Typography>
                <TagInput
                    tags={q.tags || []}
                    onChange={newTags => onChange({ ...q, tags: newTags })}
                    placeholder="輸入標籤並按 Enter"
                />
            </Box>
        </Paper>
    );
}

const formatDisplayName = (name) => {
    if (!name) return '';
    return name.replace(/^關鍵字回覆 \- /, '').replace(/ \- 工程用法則$/, '').replace(/工程用法則$/, '').replace(/ \- 問卷管理$/, '').replace(/^問卷管理 \- /, '').replace(/ \- 關鍵字回覆$/, '');
};

export default function Questionnaire() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const { oaId } = useParams();

    const authHeaders = useMemo(() => ({
        headers: {
            Authorization: `Bearer ${token}`,
            'X-OA-ID': oaId,
        }
    }), [token, oaId]);

    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    const [questionnaires, setQuestionnaires] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [expandedNote, setExpandedNote] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, note: '' });

    const [responsesDialog, setResponsesDialog] = useState({ open: false, note: '', responses: [], questions: [], loading: false });

    const [projectsList, setProjectsList] = useState([]);
    const [richMenusList, setRichMenusList] = useState([]);

    const [activeStep, setActiveStep] = useState(0);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [note, setNote] = useState('');
    const [trigger, setTrigger] = useState('');
    const [finishMsg, setFinishMsg] = useState('問卷已完成，謝謝您的參與！');
    const [finishTags, setFinishTags] = useState([]);
    const [finishJourney, setFinishJourney] = useState('');
    const [finishMenu, setFinishMenu] = useState('');
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [enableReview, setEnableReview] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(null);

    const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const res = await api.get('/questionnaire/groups', authHeaders);
            setGroups(res.data.groups || []);
        } catch (e) {
            showToast(e.response?.data?.error || '讀取群組失敗', 'error');
        } finally {
            setLoadingGroups(false);
        }
    };

    const fetchList = async () => {
        setLoadingList(true);
        try {
            const res = await api.get('/questionnaire/list', authHeaders);
            let qs = res.data.questionnaires || [];
            qs = qs.filter(q => q.note && q.note.includes('問卷管理'));
            setQuestionnaires(qs);
        } catch (e) {
            showToast(e.response?.data?.error || '讀取問卷失敗', 'error');
        } finally {
            setLoadingList(false);
        }
    };

    const fetchProjectsAndMenus = async () => {
        try {
            const [projRes, rmRes] = await Promise.all([
                api.get('/projects', authHeaders),
                api.get('/richmenu/metadata', authHeaders),
            ]);
            setProjectsList(Array.isArray(projRes.data) ? projRes.data : (projRes.data?.projects || []));
            setRichMenusList(Array.isArray(rmRes.data) ? rmRes.data : []);
        } catch (e) {
            console.error('Failed to fetch projects or rich menus:', e);
        }
    };

    useEffect(() => {
        setGroups([]);
        setQuestionnaires([]);
        resetForm();
        fetchGroups();
        fetchList();
        fetchProjectsAndMenus();
    }, [oaId]);

    const groupedQuestionnaires = useMemo(() => {
        const map = new Map();
        questionnaires.forEach(item => {
            const key = item.group_name || '未分組';
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(item);
        });
        return [...map.entries()];
    }, [questionnaires]);

    const resetForm = () => {
        setSelectedGroupId('');
        setNote('');
        setTrigger('');
        setFinishMsg('問卷已完成，謝謝您的參與！');
        setFinishTags([]);
        setFinishJourney('');
        setFinishMenu('');
        setQuestions([emptyQuestion()]);
        setEnableReview(false);
        setStartTime('');
        setEndTime('');
        setIsEditing(null);
        setActiveStep(0);
    };

    const handleExpandNote = async (questionnaireNote) => {
        if (expandedNote === questionnaireNote) {
            setExpandedNote(null);
            return;
        }

        setExpandedNote(questionnaireNote);
        setLoadingPreview(true);
        try {
            const res = await api.get(`/questionnaire/detail/${encodeURIComponent(questionnaireNote)}`, authHeaders);
            setPreviewRows(res.data.questions || []);
        } catch (e) {
            showToast(e.response?.data?.error || '讀取問卷內容失敗', 'error');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleEdit = async (questionnaireNote) => {
        try {
            const res = await api.get(`/questionnaire/detail/${encodeURIComponent(questionnaireNote)}`, authHeaders);
            const data = res.data;
            setSelectedGroupId(data.group_id || '');
            setNote(formatDisplayName(data.note) || '');
            setTrigger(data.trigger || '');
            setFinishMsg(data.finish_msg || '問卷已完成，謝謝您的參與！');
            setFinishTags(data.finish_tags || []);
            setFinishJourney(data.finish_journey ? String(data.finish_journey) : '');
            setFinishMenu(data.finish_menu ? String(data.finish_menu) : '');
            setEnableReview(Boolean(data.enable_review));
            setStartTime(data.start_time || '');
            setEndTime(data.end_time || '');
            setQuestions((data.questions || []).map(q => {
                const question = { ...q, tags: q.tags || [], _min: '', _max: '' };
                if (question.cond === '4') {
                    const [min = '', max = ''] = (question.cond_detail || '').split(',');
                    question._min = min;
                    question._max = max;
                }
                return question;
            }));
            setIsEditing(questionnaireNote);
            setActiveStep(0);
            showToast(`已載入問卷「${formatDisplayName(questionnaireNote)}」`, 'info');
        } catch (e) {
            showToast(e.response?.data?.error || '載入問卷失敗', 'error');
        }
    };

    const handleCopy = async (questionnaireNote) => {
        await handleEdit(questionnaireNote);
        setIsEditing(null);
        setNote(prev => `${prev} - 複製`);
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/questionnaire/${encodeURIComponent(deleteDialog.note)}`, authHeaders);
            setDeleteDialog({ open: false, note: '' });
            if (expandedNote === deleteDialog.note) {
                setExpandedNote(null);
            }
            showToast(`問卷「${formatDisplayName(deleteDialog.note)}」已刪除`, 'success');
            fetchList();
        } catch (e) {
            showToast(e.response?.data?.error || '刪除問卷失敗', 'error');
        }
    };

    const handleCreateGroup = async () => {
        try {
            const res = await api.post('/questionnaire/groups', { name: newGroupName }, authHeaders);
            setNewGroupName('');
            setGroupDialogOpen(false);
            await fetchGroups();
            if (res.data?.group?.id) {
                setSelectedGroupId(res.data.group.id);
            }
            showToast('群組建立成功', 'success');
        } catch (e) {
            showToast(e.response?.data?.error || '建立群組失敗', 'error');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        try {
            await api.delete(`/questionnaire/groups/${groupId}`, authHeaders);
            if (String(selectedGroupId) === String(groupId)) {
                setSelectedGroupId('');
            }
            await fetchGroups();
            await fetchList();
            showToast('群組已刪除', 'success');
        } catch (e) {
            showToast(e.response?.data?.error || '刪除群組失敗', 'error');
        }
    };

    const handleOpenResponses = async (questionnaireNote) => {
        setResponsesDialog({ open: true, note: questionnaireNote, responses: [], questions: [], loading: true });
        try {
            const res = await api.get(`/questionnaire/responses/${encodeURIComponent(questionnaireNote)}`, authHeaders);
            setResponsesDialog({
                open: true,
                note: questionnaireNote,
                responses: res.data.responses || [],
                questions: res.data.questions || [],
                loading: false,
            });
        } catch (e) {
            setResponsesDialog(prev => ({ ...prev, loading: false }));
            showToast(e.response?.data?.error || '讀取填答結果失敗', 'error');
        }
    };

    const updateQuestion = (index, value) => {
        setQuestions(prev => prev.map((item, idx) => idx === index ? value : item));
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, emptyQuestion()]);
    };

    const deleteQuestion = (index) => {
        setQuestions(prev => prev.filter((_, idx) => idx !== index));
    };

    const moveQuestionUp = (index) => {
        setQuestions(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveQuestionDown = (index) => {
        setQuestions(prev => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const step1Valid = selectedGroupId && note.trim() && trigger.trim() && finishMsg.trim();
    const step2Valid = questions.length > 0 && questions.every(q => {
        if (!q.content.trim()) return false;
        if (q.cond === '3' && !q.cond_detail.trim()) return false;
        if (q.cond === '4') {
            const parts = q.cond_detail.split(',');
            if (parts.length !== 2) return false;
            if (parts.some(part => part.trim() === '' || Number.isNaN(Number(part.trim())))) return false;
        }
        return true;
    });

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            if (isEditing) {
                await api.delete(`/questionnaire/${encodeURIComponent(isEditing)}`, authHeaders);
            }

            const payload = {
                group_id: selectedGroupId,
                note: '問卷管理 - ' + formatDisplayName(note),
                trigger,
                finish_msg: finishMsg,
                finish_tags: finishTags,
                finish_journey: finishJourney,
                finish_menu: finishMenu,
                questions: questions.map(q => ({
                    content: q.content,
                    cond: q.cond,
                    cond_detail: q.cond_detail,
                    tags: q.tags || [],
                })),
                enable_review: enableReview,
                start_time: startTime,
                end_time: endTime,
            };

            const res = await api.post('/questionnaire/build', payload, authHeaders);
            showToast(res.data?.message || '問卷建立成功', 'success');
            await fetchList();
            resetForm();
        } catch (e) {
            showToast(e.response?.data?.error || '儲存問卷失敗', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 4, minHeight: '80vh' }}>
            <Box sx={{ width: 360, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold' }}>
                        問卷群組與列表
                    </Typography>
                    <Button
                        startIcon={<GroupAddIcon />}
                        variant="outlined"
                        onClick={() => setGroupDialogOpen(true)}
                        sx={{ color: 'var(--primary-yellow)', borderColor: 'var(--primary-yellow)' }}
                    >
                        新增群組
                    </Button>
                </Box>

                <Paper sx={{ p: 2, mb: 2, background: '#222', border: '1px solid #444' }}>
                    <Typography sx={{ color: '#B0B0B0', mb: 1, fontSize: '0.9rem' }}>已建立的群組</Typography>
                    {loadingGroups ? (
                        <CircularProgress size={20} sx={{ color: 'var(--primary-yellow)' }} />
                    ) : groups.length === 0 ? (
                        <Typography sx={{ color: '#777', fontSize: '0.9rem' }}>目前還沒有群組，請先建立群組再新增問卷。</Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {groups.map(group => (
                                <Chip
                                    key={group.id}
                                    label={`${group.name} (${group.questionnaire_count})`}
                                    onDelete={group.questionnaire_count === 0 ? () => handleDeleteGroup(group.id) : undefined}
                                    sx={{
                                        background: String(selectedGroupId) === String(group.id) ? '#5c4b00' : '#333',
                                        color: 'white',
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                </Paper>

                {loadingList ? (
                    <CircularProgress size={24} sx={{ color: 'var(--primary-yellow)' }} />
                ) : questionnaires.length === 0 ? (
                    <Typography sx={{ color: '#777' }}>目前沒有問卷。</Typography>
                ) : groupedQuestionnaires.map(([groupName, items]) => (
                    <Box key={groupName} sx={{ mb: 2.5 }}>
                        <Typography sx={{ color: '#B0B0B0', fontSize: '0.9rem', mb: 1 }}>{groupName}</Typography>
                        {items.map(item => (
                            <Paper key={item.note} sx={{ mb: 1, background: '#222', border: '1px solid #444', overflow: 'hidden' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5 }}>
                                    <Box sx={{ flex: 1, cursor: 'pointer' }} onClick={() => handleExpandNote(item.note)}>
                                        <Typography sx={{ color: 'white', fontWeight: 'bold' }}>{formatDisplayName(item.note)}</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                            <Chip label={`ID: ${item.id}`} size="small" sx={{ height: 20, background: '#333', color: '#aaa' }} />
                                            {item.enable_review && <Chip label="可回顧" size="small" sx={{ height: 20, background: '#2e7d32', color: 'white' }} />}
                                            {(item.start_time || item.end_time) && <Chip label="有限時" size="small" sx={{ height: 20, background: '#1565c0', color: 'white' }} />}
                                        </Box>
                                    </Box>
                                    <IconButton size="small" onClick={() => handleExpandNote(item.note)} sx={{ color: '#888' }}>
                                        {expandedNote === item.note ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                </Box>

                                {expandedNote === item.note && (
                                    <Box sx={{ px: 2, pb: 2, background: '#1a1a1a' }}>
                                        <Divider sx={{ borderColor: '#333', mb: 1.5 }} />
                                        {loadingPreview ? (
                                            <CircularProgress size={16} sx={{ color: '#888' }} />
                                        ) : (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography sx={{ color: '#888', fontSize: '0.75rem', mb: 1 }}>題目預覽</Typography>
                                                {previewRows.map((row, index) => (
                                                    <Typography key={index} sx={{ color: '#ccc', fontSize: '0.8rem', mb: 0.5 }}>
                                                        {index + 1}. {row.content}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        )}

                                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <Tooltip title="查看填答結果">
                                                <IconButton size="small" onClick={() => handleOpenResponses(item.note)} sx={{ color: '#ffb300' }}>
                                                    <InsightsIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="編輯問卷">
                                                <IconButton size="small" onClick={() => handleEdit(item.note)} sx={{ color: '#4fc3f7' }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="複製問卷">
                                                <IconButton size="small" onClick={() => handleCopy(item.note)} sx={{ color: '#81c784' }}>
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="刪除問卷">
                                                <IconButton size="small" onClick={() => setDeleteDialog({ open: true, note: item.note })} sx={{ color: '#e57373' }}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                )}
                            </Paper>
                        ))}
                    </Box>
                ))}
            </Box>

            <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', mb: 3, fontWeight: 'bold' }}>
                    {isEditing ? `編輯問卷：${formatDisplayName(isEditing)}` : '建立新問卷'}
                </Typography>

                <Stepper
                    activeStep={activeStep}
                    sx={{
                        mb: 4,
                        '& .MuiStepLabel-label': { color: '#888' },
                        '& .MuiStepLabel-label.Mui-active': { color: 'var(--primary-yellow)' },
                        '& .MuiStepIcon-root': { color: '#444' },
                        '& .MuiStepIcon-root.Mui-active': { color: 'var(--primary-yellow)' },
                        '& .MuiStepIcon-root.Mui-completed': { color: 'var(--primary-yellow)' },
                    }}
                >
                    {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {activeStep === 0 && (
                    <Box>
                        <Alert severity="info" sx={{ mb: 2, background: '#1e2a38', color: '#d7e3f4' }}>
                            先建立群組，再從群組中建立問卷。
                        </Alert>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel sx={{ color: '#B0B0B0' }}>問卷群組</InputLabel>
                            <Select
                                value={selectedGroupId}
                                label="問卷群組"
                                onChange={e => setSelectedGroupId(e.target.value)}
                                sx={selectSx}
                                MenuProps={{ PaperProps: { sx: { backgroundColor: '#2a2a2a', color: 'white' } } }}
                            >
                                {groups.map(group => (
                                    <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label="問卷名稱"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            sx={{ ...fieldSx, mb: 2 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />
                        <TextField
                            fullWidth
                            label="觸發指令"
                            value={trigger}
                            onChange={e => setTrigger(e.target.value)}
                            helperText="使用者在 LINE 輸入這段文字後會開始填寫問卷。"
                            FormHelperTextProps={{ sx: { color: '#666' } }}
                            sx={{ ...fieldSx, mb: 2 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />
                        <TextField
                            fullWidth
                            label="完成訊息"
                            value={finishMsg}
                            onChange={e => setFinishMsg(e.target.value)}
                            sx={{ ...fieldSx, mb: 2 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={enableReview}
                                    onChange={e => setEnableReview(e.target.checked)}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--primary-yellow)' },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--primary-yellow)' },
                                    }}
                                />
                            }
                            label="送出前允許使用者回顧答案"
                            sx={{ color: '#B0B0B0', mb: 2 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                fullWidth
                                type="datetime-local"
                                label="開始時間"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                sx={fieldSx}
                                InputLabelProps={{ shrink: true, sx: { color: '#B0B0B0' } }}
                            />
                            <TextField
                                fullWidth
                                type="datetime-local"
                                label="結束時間"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                sx={fieldSx}
                                InputLabelProps={{ shrink: true, sx: { color: '#B0B0B0' } }}
                            />
                        </Box>

                        {/* 問卷完成後動作 */}
                        <Box sx={{ mt: 3, p: 2, border: '1px solid #444', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)' }}>
                            <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1.5, fontSize: '0.95rem' }}>
                                問卷完成後動作
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                                <Typography sx={{ color: '#B0B0B0', fontSize: '0.85rem', mb: 0.5 }}>完成後標籤</Typography>
                                <TagInput
                                    tags={finishTags}
                                    onChange={setFinishTags}
                                    placeholder="輸入完成後標籤並按 Enter"
                                />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                                <FormControl fullWidth sx={{ ...fieldSx, flex: 1 }}>
                                    <InputLabel sx={{ color: '#B0B0B0' }}>加入自動旅程</InputLabel>
                                    <Select
                                        value={finishJourney}
                                        label="加入自動旅程"
                                        onChange={e => setFinishJourney(e.target.value)}
                                        sx={selectSx}
                                        MenuProps={{ PaperProps: { sx: { bgcolor: '#222', color: 'white' } } }}
                                    >
                                        <MenuItem value="">-- 不加入旅程 --</MenuItem>
                                        {projectsList.map(p => (
                                            <MenuItem key={p.project_id || p.id} value={String(p.project_id || p.id)}>
                                                {p.project_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth sx={{ ...fieldSx, flex: 1 }}>
                                    <InputLabel sx={{ color: '#B0B0B0' }}>切換圖文選單</InputLabel>
                                    <Select
                                        value={finishMenu}
                                        label="切換圖文選單"
                                        onChange={e => setFinishMenu(e.target.value)}
                                        sx={selectSx}
                                        MenuProps={{ PaperProps: { sx: { bgcolor: '#222', color: 'white' } } }}
                                    >
                                        <MenuItem value="">-- 不切換選單 --</MenuItem>
                                        {richMenusList.map(m => {
                                            const menuVal = m.ui_uuid || m.richMenuId || m.rich_menu_id || m.id;
                                            return (
                                                <MenuItem key={menuVal} value={String(menuVal)}>
                                                    {m.name || m.richMenuId || m.rich_menu_id}
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Box>
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box>
                        {questions.map((question, index) => (
                            <QuestionCard
                                key={index}
                                q={question}
                                index={index}
                                total={questions.length}
                                onChange={next => updateQuestion(index, next)}
                                onDelete={() => deleteQuestion(index)}
                                onMoveUp={() => moveQuestionUp(index)}
                                onMoveDown={() => moveQuestionDown(index)}
                            />
                        ))}
                        <Button
                            startIcon={<AddIcon />}
                            onClick={addQuestion}
                            variant="outlined"
                            sx={{ color: 'var(--primary-yellow)', borderColor: 'var(--primary-yellow)' }}
                        >
                            新增題目
                        </Button>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box>
                        <Paper sx={{ p: 2, background: '#222', mb: 2, border: '1px solid #444' }}>
                            <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1 }}>基本資料</Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>群組：{groups.find(group => String(group.id) === String(selectedGroupId))?.name || '-'}</Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>問卷名稱：{note}</Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>觸發指令：{trigger}</Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>完成訊息：{finishMsg}</Typography>
                            {(finishTags.length > 0 || finishJourney || finishMenu) && (
                                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #444' }}>
                                    <Typography sx={{ color: 'var(--primary-yellow)', fontSize: '0.9rem', mb: 0.5 }}>完成後動作：</Typography>
                                    {finishTags.length > 0 && (
                                        <Typography sx={{ color: 'white', fontSize: '0.85rem' }}>
                                            • 完成後標籤：{finishTags.join(', ')}
                                        </Typography>
                                    )}
                                    {finishJourney && (
                                        <Typography sx={{ color: 'white', fontSize: '0.85rem' }}>
                                            • 加入旅程：{projectsList.find(p => String(p.project_id || p.id) === String(finishJourney))?.project_name || finishJourney}
                                        </Typography>
                                    )}
                                    {finishMenu && (
                                        <Typography sx={{ color: 'white', fontSize: '0.85rem' }}>
                                            • 切換選單：{richMenusList.find(m => String(m.ui_uuid || m.richMenuId || m.rich_menu_id || m.id) === String(finishMenu))?.name || finishMenu}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Paper>

                        <Paper sx={{ p: 2, background: '#222', border: '1px solid #444' }}>
                            <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1 }}>
                                題目清單（共 {questions.length} 題）
                            </Typography>
                            {questions.map((question, index) => (
                                <Box key={index} sx={{ mb: 1.5, pl: 1, borderLeft: '2px solid #555' }}>
                                    <Typography sx={{ color: 'white' }}>Q{index + 1}. {question.content}</Typography>
                                    <Typography sx={{ color: '#888', fontSize: '0.85rem' }}>
                                        限制：{CONDITION_OPTIONS.find(item => item.value === question.cond)?.label}
                                        {question.cond_detail ? ` / ${question.cond_detail}` : ''}
                                    </Typography>
                                </Box>
                            ))}
                        </Paper>
                    </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                    <Button onClick={resetForm} sx={{ color: '#B0B0B0' }}>
                        重設
                    </Button>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {activeStep > 0 && (
                            <Button onClick={() => setActiveStep(step => step - 1)} sx={{ color: '#B0B0B0' }}>
                                上一步
                            </Button>
                        )}
                        {activeStep < 2 ? (
                            <Button
                                variant="contained"
                                disabled={(activeStep === 0 && !step1Valid) || (activeStep === 1 && !step2Valid)}
                                onClick={() => setActiveStep(step => step + 1)}
                                sx={{ backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold' }}
                            >
                                下一步
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                disabled={submitting}
                                onClick={handleSubmit}
                                sx={{ backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold' }}
                            >
                                {submitting ? <CircularProgress size={20} /> : (isEditing ? '儲存修改' : '建立問卷')}
                            </Button>
                        )}
                    </Box>
                </Box>
            </Box>

            <Dialog
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
                PaperProps={{ sx: { background: '#222', color: 'white', border: '1px solid #444', minWidth: 420 } }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>建立問卷群組</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="群組名稱"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        sx={{ ...fieldSx, mt: 1 }}
                        InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGroupDialogOpen(false)} sx={{ color: '#B0B0B0' }}>取消</Button>
                    <Button onClick={handleCreateGroup} variant="contained" sx={{ backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A' }}>
                        建立
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, note: '' })}
                PaperProps={{ sx: { background: '#222', color: 'white', border: '1px solid #444' } }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>刪除問卷</DialogTitle>
                <DialogContent>
                    <Typography>確定要刪除問卷「{formatDisplayName(deleteDialog.note)}」嗎？這會移除該問卷的規則。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, note: '' })} sx={{ color: '#B0B0B0' }}>取消</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">刪除</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={responsesDialog.open}
                onClose={() => setResponsesDialog({ open: false, note: '', responses: [], questions: [], loading: false })}
                maxWidth="lg"
                fullWidth
                PaperProps={{ sx: { background: '#161616', color: 'white', border: '1px solid #444' } }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>
                    問卷填答結果：{formatDisplayName(responsesDialog.note)}
                </DialogTitle>
                <DialogContent dividers sx={{ borderColor: '#333' }}>
                    {responsesDialog.loading ? (
                        <CircularProgress size={24} sx={{ color: 'var(--primary-yellow)' }} />
                    ) : responsesDialog.responses.length === 0 ? (
                        <Typography sx={{ color: '#888' }}>目前還沒有填答資料。</Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {responsesDialog.responses.map(response => (
                                <Paper key={response.user_id} sx={{ p: 2, background: '#222', border: '1px solid #444' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                        <Box>
                                            <Typography sx={{ color: 'white', fontWeight: 'bold' }}>{response.display_name || response.user_id}</Typography>
                                            <Typography sx={{ color: '#888', fontSize: '0.8rem' }}>{response.user_id}</Typography>
                                        </Box>
                                        <Chip
                                            label={`已答 ${response.answered_count}/${responsesDialog.questions.length}`}
                                            size="small"
                                            sx={{ background: '#5c4b00', color: 'white' }}
                                        />
                                    </Box>
                                    {response.answers.map(answer => (
                                        <Box key={answer.question_no} sx={{ mb: 1.25, pl: 1, borderLeft: '2px solid #555' }}>
                                            <Typography sx={{ color: '#ddd', fontSize: '0.9rem' }}>
                                                Q{answer.question_no}. {answer.question}
                                            </Typography>
                                            <Typography sx={{ color: answer.answer ? 'white' : '#777', mt: 0.25 }}>
                                                {answer.answer || '未作答'}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Paper>
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResponsesDialog({ open: false, note: '', responses: [], questions: [], loading: false })} sx={{ color: '#B0B0B0' }}>
                        關閉
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
