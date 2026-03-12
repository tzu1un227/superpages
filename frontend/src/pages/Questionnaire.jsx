import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Divider, IconButton, TextField,
    Select, MenuItem, FormControl, InputLabel, Paper, Chip,
    Stepper, Step, StepLabel, Dialog, DialogTitle, DialogContent,
    DialogActions, CircularProgress, Alert, Tooltip, Switch, FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import api from '../api';

const CONDITION_OPTIONS = [
    { value: '1', label: '1. 無限制（任何文字）' },
    { value: '2', label: '2. 必須為純數字' },
    { value: '3', label: '3. 必須為特定選項（自訂）' },
    { value: '4', label: '4. 字數限制（大於與小於）' },
    { value: '5', label: '5. 台灣手機號碼（09 開頭 10 碼）' },
    { value: '6', label: '6. Email 格式' },
    { value: '7', label: '7. 日期格式（YYYY-MM-DD）' },
];

const sx = {
    input: { color: 'white' },
    label: { color: '#B0B0B0' },
    '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: '#555' },
        '&:hover fieldset': { borderColor: '#888' },
        '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' }
    }
};

const selectSx = {
    color: 'white',
    '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-yellow)' },
    '.MuiSvgIcon-root': { color: '#B0B0B0' }
};

const emptyQuestion = () => ({ content: '', cond: '1', cond_detail: '', _min: '', _max: '' });

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
                    <IconButton size="small" onClick={onDelete} sx={{ color: '#e57373' }}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            <TextField
                fullWidth
                size="small"
                label="題目文字"
                value={q.content}
                onChange={e => onChange({ ...q, content: e.target.value })}
                sx={{ ...sx, mb: 2 }}
                InputLabelProps={{ sx: { color: '#B0B0B0' } }}
            />

            <FormControl fullWidth size="small" sx={{ mb: needDetail ? 2 : 0 }}>
                <InputLabel sx={{ color: '#B0B0B0' }}>答案條件</InputLabel>
                <Select
                    value={q.cond}
                    label="答案條件"
                    onChange={e => onChange({ ...q, cond: e.target.value, cond_detail: '', _min: '', _max: '' })}
                    sx={selectSx}
                    MenuProps={{ PaperProps: { sx: { backgroundColor: '#2a2a2a', color: 'white' } } }}
                >
                    {CONDITION_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ '&:hover': { background: '#444' } }}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {q.cond === '3' && (
                <TextField
                    fullWidth
                    size="small"
                    label="選項內容（用逗號分隔，例：是,否）"
                    value={q.cond_detail}
                    onChange={e => onChange({ ...q, cond_detail: e.target.value })}
                    sx={sx}
                    InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                />
            )}

            {q.cond === '4' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        label="最少字數"
                        type="number"
                        value={q._min}
                        onChange={e => onChange({ ...q, _min: e.target.value, cond_detail: `${e.target.value},${q._max}` })}
                        sx={{ ...sx, flex: 1 }}
                        InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        inputProps={{ min: 0 }}
                    />
                    <TextField
                        size="small"
                        label="最多字數（-1 表示無上限）"
                        type="number"
                        value={q._max}
                        onChange={e => onChange({ ...q, _max: e.target.value, cond_detail: `${q._min},${e.target.value}` })}
                        sx={{ ...sx, flex: 1 }}
                        InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        inputProps={{ min: -1 }}
                    />
                </Box>
            )}
        </Paper>
    );
}

const STEPS = ['基本資訊', '新增題目', '確認送出'];

export default function Questionnaire() {
    const { token } = useAuth();
    const { oaId } = useParams();

    // List state
    const [questionnaires, setQuestionnaires] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [expandedNote, setExpandedNote] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, note: '' });

    // Builder state
    const [activeStep, setActiveStep] = useState(0);
    const [note, setNote] = useState('');
    const [trigger, setTrigger] = useState('');
    const [finishMsg, setFinishMsg] = useState('感謝您的填寫！');
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [enableReview, setEnableReview] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [alert, setAlert] = useState(null);

    const authHeaders = { headers: { Authorization: `Bearer ${token}`, 'X-OA-ID': oaId } };

    const fetchList = async () => {
        setLoadingList(true);
        try {
            const res = await api.get('/questionnaire/list', authHeaders);
            setQuestionnaires(res.data.questionnaires || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => { fetchList(); }, [oaId]);

    const handleExpandNote = async (n) => {
        if (expandedNote === n) { setExpandedNote(null); return; }
        setExpandedNote(n);
        setLoadingPreview(true);
        try {
            const res = await api.get(`/questionnaire/${n}`, authHeaders);
            setPreviewRows(res.data);
        } catch (e) { console.error(e); }
        finally { setLoadingPreview(false); }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/questionnaire/${deleteDialog.note}`, authHeaders);
            setDeleteDialog({ open: false, note: '' });
            if (expandedNote === deleteDialog.note) setExpandedNote(null);
            fetchList();
        } catch (e) {
            setAlert({ severity: 'error', msg: '刪除失敗: ' + (e.response?.data?.error || e.message) });
        }
    };

    // Question helpers
    const updateQ = (i, q) => setQuestions(prev => { const a = [...prev]; a[i] = q; return a; });
    const addQ = () => setQuestions(prev => [...prev, emptyQuestion()]);
    const deleteQ = (i) => setQuestions(prev => prev.filter((_, idx) => idx !== i));
    const moveUp = (i) => setQuestions(prev => { const a = [...prev];[a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; });
    const moveDown = (i) => setQuestions(prev => { const a = [...prev];[a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; });

    const step1Valid = note.trim() && trigger.trim() && finishMsg.trim();
    const step2Valid = questions.length > 0 && questions.every(q => {
        if (!q.content.trim()) return false;
        if (q.cond === '3' && !q.cond_detail.trim()) return false;
        if (q.cond === '4') {
            const parts = q.cond_detail.split(',');
            if (parts.length !== 2) return false;
            if (parts.some(p => p.trim() === '' || isNaN(parseInt(p.trim())))) return false;
        }
        return true;
    });

    const handleSubmit = async () => {
        setSubmitting(true);
        setAlert(null);
        try {
            const res = await api.post('/questionnaire/build', {
                note, trigger, finish_msg: finishMsg,
                questions: questions.map(q => ({ content: q.content, cond: q.cond, cond_detail: q.cond_detail })),
                enable_review: enableReview,
                start_time: startTime,
                end_time: endTime
            }, authHeaders);
            setAlert({ severity: 'success', msg: res.data.message || `問卷「${note}」已成功建立！` });
            fetchList();
            // Reset form
            setNote(''); setTrigger(''); setFinishMsg('感謝您的填寫！');
            setQuestions([emptyQuestion()]); setEnableReview(false);
            setStartTime(''); setEndTime('');
            setActiveStep(0);
        } catch (e) {
            setAlert({ severity: 'error', msg: e.response?.data?.error || '建立失敗' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 4, minHeight: '80vh' }}>
            {/* ─── Left: Questionnaire List ─── */}
            <Box sx={{ width: 300, flexShrink: 0 }}>
                <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', mb: 2, fontWeight: 'bold' }}>
                    已建立的問卷
                </Typography>
                {loadingList ? (
                    <CircularProgress size={24} sx={{ color: 'var(--primary-yellow)' }} />
                ) : questionnaires.length === 0 ? (
                    <Typography sx={{ color: '#666', fontSize: '0.9rem' }}>尚無問卷，請在右側建立。</Typography>
                ) : questionnaires.map(q => (
                    <Paper key={q.note} sx={{ mb: 1, background: '#222', border: '1px solid #444' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
                            <Box sx={{ flex: 1, cursor: 'pointer', '&:hover': { color: 'var(--primary-yellow)' } }} onClick={() => handleExpandNote(q.note)}>
                                <Typography sx={{ color: 'white', fontWeight: 'bold' }}>
                                    {q.note}
                                </Typography>
                                <Typography sx={{ color: '#666', fontSize: '0.75rem' }}>
                                    ID: {q.id} | {q.rules_count} 條法則
                                </Typography>
                            </Box>
                            <IconButton size="small" onClick={() => handleExpandNote(q.note)} sx={{ color: '#888' }}>
                                {expandedNote === q.note ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            <IconButton size="small" onClick={() => setDeleteDialog({ open: true, note: q.note })} sx={{ color: '#e57373' }}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        {expandedNote === q.note && (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <Divider sx={{ borderColor: '#333', mb: 1 }} />
                                {loadingPreview ? <CircularProgress size={16} sx={{ color: '#888' }} /> : (
                                    <Typography sx={{ color: '#aaa', fontSize: '0.78rem' }}>
                                        共 {previewRows.length} 條法則（含防呆）
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Paper>
                ))}
            </Box>

            {/* ─── Right: Builder ─── */}
            <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ color: 'var(--primary-yellow)', mb: 3, fontWeight: 'bold' }}>
                    建立新問卷
                </Typography>

                {alert && (
                    <Alert severity={alert.severity} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
                        {alert.msg}
                    </Alert>
                )}

                <Stepper activeStep={activeStep} sx={{
                    mb: 4,
                    '& .MuiStepLabel-label': { color: '#888' },
                    '& .MuiStepLabel-label.Mui-active': { color: 'var(--primary-yellow)' },
                    '& .MuiStepLabel-label.Mui-completed': { color: '#aaa' },
                    '& .MuiStepIcon-root': { color: '#444' },
                    '& .MuiStepIcon-root.Mui-active': { color: 'var(--primary-yellow)' },
                    '& .MuiStepIcon-root.Mui-completed': { color: 'var(--primary-yellow)' },
                }}>
                    {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
                </Stepper>

                {/* Step 0: Basic Info */}
                {activeStep === 0 && (
                    <Box>
                        <Typography sx={{ color: '#B0B0B0', mb: 2 }}>設定問卷的基本資料。</Typography>
                        <TextField
                            fullWidth label="問卷名稱" value={note}
                            onChange={e => setNote(e.target.value)}
                            helperText="問卷的標題或備註，可填中文 (例如：2024 客戶滿意度調查)"
                            FormHelperTextProps={{ sx: { color: '#666' } }}
                            sx={{ ...sx, mb: 2 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />
                        <TextField
                            fullWidth label="觸發指令" value={trigger}
                            onChange={e => setTrigger(e.target.value)}
                            helperText="使用者在 LINE 輸入此文字即可啟動問卷，例如：開始填寫"
                            FormHelperTextProps={{ sx: { color: '#666' } }}
                            sx={{ ...sx, mb: 2 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />
                        <TextField
                            fullWidth label="完成訊息" value={finishMsg}
                            onChange={e => setFinishMsg(e.target.value)}
                            helperText="使用者完成全部問題後顯示的訊息"
                            FormHelperTextProps={{ sx: { color: '#666' } }}
                            sx={{ ...sx, mb: 3 }}
                            InputLabelProps={{ sx: { color: '#B0B0B0' } }}
                        />

                        <Divider sx={{ borderColor: '#444', mb: 3 }} />

                        <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1 }}>進階設定</Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={enableReview}
                                    onChange={e => setEnableReview(e.target.checked)}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': { color: 'var(--primary-yellow)' },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: 'var(--primary-yellow)' }
                                    }}
                                />
                            }
                            label="啟用答案檢查步驟 (使用者最後可預覽並確認答案)"
                            sx={{ color: '#B0B0B0', mb: 2, display: 'block' }}
                        />

                        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <TextField
                                fullWidth
                                label="問卷開始時間"
                                type="datetime-local"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                sx={sx}
                                InputLabelProps={{ shrink: true, sx: { color: '#B0B0B0' } }}
                            />
                            <TextField
                                fullWidth
                                label="問卷結束時間"
                                type="datetime-local"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                sx={sx}
                                InputLabelProps={{ shrink: true, sx: { color: '#B0B0B0' } }}
                            />
                        </Box>
                        <Typography sx={{ color: '#666', fontSize: '0.8rem', mt: 1 }}>
                            若不設定時間，則問卷將持續有效。
                        </Typography>
                    </Box>
                )}

                {/* Step 1: Questions */}
                {activeStep === 1 && (
                    <Box>
                        <Typography sx={{ color: '#B0B0B0', mb: 2 }}>新增題目，並為每一題設定答案條件。</Typography>
                        {questions.map((q, i) => (
                            <QuestionCard
                                key={i} q={q} index={i} total={questions.length}
                                onChange={(nq) => updateQ(i, nq)}
                                onDelete={() => deleteQ(i)}
                                onMoveUp={() => moveUp(i)}
                                onMoveDown={() => moveDown(i)}
                            />
                        ))}
                        <Button
                            startIcon={<AddIcon />}
                            onClick={addQ}
                            sx={{ color: 'var(--primary-yellow)', borderColor: 'var(--primary-yellow)', mt: 1 }}
                            variant="outlined"
                        >
                            新增題目
                        </Button>
                    </Box>
                )}

                {/* Step 2: Confirm */}
                {activeStep === 2 && (
                    <Box>
                        <Typography sx={{ color: '#B0B0B0', mb: 2 }}>請確認問卷資料後送出建立。</Typography>
                        <Paper sx={{ p: 2, background: '#222', mb: 2, border: '1px solid #444' }}>
                            <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1 }}>基本資訊</Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>問卷名稱：<Chip label={note} size="small" sx={{ background: '#444', color: 'white' }} /></Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>觸發指令：<Chip label={trigger} size="small" sx={{ background: '#444', color: 'white' }} /></Typography>
                            <Typography sx={{ color: 'white', mb: 0.5 }}>完成訊息：{finishMsg}</Typography>
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #333' }}>
                                <Typography sx={{ color: 'white', mb: 0.5, fontSize: '0.9rem' }}>
                                    答案檢查：{enableReview ? <Chip label="已開啟" size="small" color="success" /> : <Chip label="未開啟" size="small" variant="outlined" sx={{ color: '#888' }} />}
                                </Typography>
                                {(startTime || endTime) && (
                                    <Typography sx={{ color: '#aaa', fontSize: '0.9rem', mt: 1 }}>
                                        有效時段：{startTime || '不限'} ~ {endTime || '不限'}
                                    </Typography>
                                )}
                            </Box>
                        </Paper>
                        <Paper sx={{ p: 2, background: '#222', border: '1px solid #444' }}>
                            <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 1 }}>題目列表（共 {questions.length} 題）</Typography>
                            {questions.map((q, i) => (
                                <Box key={i} sx={{ mb: 1, pl: 1, borderLeft: '2px solid #555' }}>
                                    <Typography sx={{ color: 'white', fontSize: '0.9rem' }}>
                                        Q{i + 1}：{q.content}
                                    </Typography>
                                    <Typography sx={{ color: '#888', fontSize: '0.8rem' }}>
                                        條件：{CONDITION_OPTIONS.find(o => o.value === q.cond)?.label}
                                        {q.cond_detail ? `  ▸  ${q.cond_detail}` : ''}
                                    </Typography>
                                </Box>
                            ))}
                        </Paper>
                    </Box>
                )}

                {/* Navigation */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                    {activeStep > 0 && (
                        <Button onClick={() => setActiveStep(s => s - 1)} sx={{ color: '#B0B0B0' }}>
                            上一步
                        </Button>
                    )}
                    {activeStep < 2 && (
                        <Button
                            variant="contained"
                            disabled={(activeStep === 0 && !step1Valid) || (activeStep === 1 && !step2Valid)}
                            onClick={() => setActiveStep(s => s + 1)}
                            sx={{ backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold', '&:hover': { backgroundColor: '#e6c200' } }}
                        >
                            下一步
                        </Button>
                    )}
                    {activeStep === 2 && (
                        <Button
                            variant="contained"
                            disabled={submitting}
                            onClick={handleSubmit}
                            sx={{ backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold', '&:hover': { backgroundColor: '#e6c200' } }}
                        >
                            {submitting ? <CircularProgress size={20} /> : '建立問卷'}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, note: '' })}
                PaperProps={{ sx: { background: '#222', color: 'white', border: '1px solid #444' } }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>確認刪除問卷</DialogTitle>
                <DialogContent>
                    <Typography>確定要刪除問卷「<strong>{deleteDialog.note}</strong>」的所有法則嗎？此動作無法復原。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, note: '' })} sx={{ color: '#B0B0B0' }}>取消</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">刪除</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
