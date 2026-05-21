import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InsightsIcon from '@mui/icons-material/Insights';
import LaunchIcon from '@mui/icons-material/Launch';
import api from '../api';
import TagInput from '../components/TagInput';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

const fieldSx = {
  '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': { color: 'white' },
  '& .MuiInputLabel-root': { color: '#B0B0B0' },
  '& .MuiFormHelperText-root': { color: '#888' },
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

const answerTypes = [
  { value: 'text', label: '文字' },
  { value: 'number', label: '數字' },
  { value: 'single_choice', label: '單選' },
  { value: 'multiple_choice', label: '多選' },
  { value: 'phone', label: '手機' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: '日期' },
];

const emptyQuestion = () => ({
  content: '',
  answer_type: 'text',
  required: true,
  condition_type: '1',
  condition_detail: '',
  optionsText: '',
  tags: [],
});

const LIFF_ENTRY_URL = 'https://liff.line.me/2009851813-AgTeSa4r';

export default function Questionnaire() {
  const { oaId } = useParams();
  const { myOAs } = useAuth();
  const { showToast } = useToast();
  const authHeaders = useMemo(() => ({ headers: { 'X-OA-ID': oaId } }), [oaId]);
  const botAppName = useMemo(() => {
    const currentOA = myOAs.find(oa => oa.id.toString() === oaId?.toString());
    return currentOA?.other_settings?.app_name || '';
  }, [myOAs, oaId]);

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [editingSurveyKey, setEditingSurveyKey] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'published',
    startTime: '',
    endTime: '',
    finishMessage: '感謝你的填寫',
    questions: [emptyQuestion()],
  });

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await api.get('/liff-questionnaires', authHeaders);
      setSurveys(res.data.surveys || []);
    } catch (e) {
      showToast(e.response?.data?.error || '讀取 LIFF 問卷失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveys();
    setEditingSurveyKey(null);
    resetForm();
  }, [oaId]);

  const updateQuestion = (index, patch) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const makeLiffUrl = (survey) => {
    const url = new URL(LIFF_ENTRY_URL);
    url.searchParams.set('oaId', oaId);
    url.searchParams.set('surveyId', survey.survey_key);
    const appName = survey.bot_app_name || botAppName;
    if (appName) url.searchParams.set('botAppName', appName);
    return url.toString();
  };

  const copyText = async (text, message = '已複製') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(message, 'success');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            showToast(message, 'success');
          } else {
            showToast('複製連結失敗，請手動複製', 'warning');
          }
        } catch (err) {
          showToast('複製連結失敗，請手動複製', 'warning');
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('複製連結失敗，請手動複製', 'warning');
    }
  };

  const handleStartEdit = async (survey) => {
    setSaving(true);
    try {
      const res = await api.get(`/liff-questionnaires/${survey.survey_key}`, authHeaders);
      const detail = res.data.survey;
      setEditingSurveyKey(detail.survey_key);
      setForm({
        title: detail.title || '',
        description: detail.description || '',
        status: detail.status || 'published',
        startTime: detail.start_time ? detail.start_time.replace(' ', 'T') : '',
        endTime: detail.end_time ? detail.end_time.replace(' ', 'T') : '',
        finishMessage: detail.finish_message || '感謝你的填寫',
        questions: detail.questions.map(q => ({
          id: q.id,
          content: q.content || '',
          answer_type: q.answer_type || 'text',
          required: q.required !== undefined ? q.required : true,
          condition_type: q.condition_type || '1',
          condition_detail: q.condition_detail || '',
          optionsText: Array.isArray(q.options) ? q.options.join(',') : (q.options || ''),
          tags: q.tags || [],
        })),
      });
      showToast(`已載入問卷「${detail.title}」`, 'info');
    } catch (e) {
      showToast(e.response?.data?.error || '讀取問卷詳情失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSurveyKey(null);
    resetForm();
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      status: 'published',
      startTime: '',
      endTime: '',
      finishMessage: '感謝你的填寫',
      questions: [emptyQuestion()],
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showToast('請輸入問卷名稱', 'error');
      return;
    }
    if (form.questions.some(q => !q.content.trim())) {
      showToast('每一題都需要題目內容', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        bot_app_name: botAppName,
        start_time: form.startTime,
        end_time: form.endTime,
        finish_message: form.finishMessage,
        questions: form.questions.map((q, index) => ({
          id: q.id,
          content: q.content,
          answer_type: q.answer_type,
          required: q.required,
          condition_type: q.answer_type === 'number' ? '2' : q.answer_type === 'phone' ? '5' : q.answer_type === 'email' ? '6' : q.answer_type === 'date' ? '7' : q.answer_type.includes('choice') ? '3' : q.condition_type,
          condition_detail: q.condition_detail,
          options: q.optionsText,
          tags: q.tags,
          question_no: index + 1,
        })),
      };
      
      let res;
      if (editingSurveyKey) {
        res = await api.put(`/liff-questionnaires/${editingSurveyKey}`, payload, authHeaders);
        showToast('LIFF 問卷已更新', 'success');
      } else {
        res = await api.post('/liff-questionnaires', payload, authHeaders);
        showToast('LIFF 問卷已建立', 'success');
      }
      
      const survey = res.data.survey;
      await fetchSurveys();
      resetForm();
      setEditingSurveyKey(null);
      
      if (!editingSurveyKey) {
        setSelectedSurvey(survey);
        await copyText(makeLiffUrl(survey), '問卷已建立，LIFF 連結也已複製');
      }
    } catch (e) {
      showToast(e.response?.data?.error || (editingSurveyKey ? '更新問卷失敗' : '建立問卷失敗'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (survey) => {
    if (!window.confirm(`確定刪除「${survey.title}」？作答資料也會一起刪除。`)) return;
    try {
      await api.delete(`/liff-questionnaires/${survey.survey_key}`, authHeaders);
      showToast('問卷已刪除', 'success');
      fetchSurveys();
    } catch (e) {
      showToast(e.response?.data?.error || '刪除失敗', 'error');
    }
  };

  const openResponses = async (survey) => {
    setSelectedSurvey(survey);
    setResponsesOpen(true);
    setLoadingResponses(true);
    try {
      const res = await api.get(`/liff-questionnaires/${survey.survey_key}/responses`, authHeaders);
      setResponses(res.data.responses || []);
    } catch (e) {
      showToast(e.response?.data?.error || '讀取作答失敗', 'error');
    } finally {
      setLoadingResponses(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '420px minmax(0, 1fr)', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', mb: 2 }}>
          LIFF 問卷管理
        </Typography>

        <Paper sx={{ p: 2, background: '#222', border: '1px solid #444' }}>
          <Typography sx={{ color: '#fff', fontWeight: 'bold', mb: 2 }}>
            {editingSurveyKey ? '編輯問卷' : '建立問卷'}
          </Typography>
          <TextField fullWidth size="small" label="問卷名稱" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} sx={{ ...fieldSx, mb: 2 }} />
          <TextField fullWidth multiline minRows={2} size="small" label="問卷說明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} sx={{ ...fieldSx, mb: 2 }} />


          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
            <TextField size="small" type="datetime-local" label="開始時間" InputLabelProps={{ shrink: true }} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} sx={fieldSx} />
            <TextField size="small" type="datetime-local" label="結束時間" InputLabelProps={{ shrink: true }} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} sx={fieldSx} />
          </Box>

          <TextField fullWidth size="small" label="完成訊息" value={form.finishMessage} onChange={e => setForm({ ...form, finishMessage: e.target.value })} sx={{ ...fieldSx, mb: 2 }} />

          <Divider sx={{ borderColor: '#444', my: 2 }} />
          {form.questions.map((q, index) => (
            <Paper key={index} sx={{ p: 1.5, mb: 1.5, background: '#2a2a2a', border: '1px solid #444' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                <Typography sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', flex: 1 }}>第 {index + 1} 題</Typography>
                <Tooltip title="刪除題目">
                  <span>
                    <IconButton size="small" disabled={form.questions.length === 1} onClick={() => setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }))} sx={{ color: '#e57373' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <TextField fullWidth size="small" label="題目內容" value={q.content} onChange={e => updateQuestion(index, { content: e.target.value })} sx={{ ...fieldSx, mb: 1.5 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 1, mb: 1.5 }}>
                <FormControl size="small">
                  <InputLabel sx={{ color: '#B0B0B0' }}>答案類型</InputLabel>
                  <Select value={q.answer_type} label="答案類型" onChange={e => updateQuestion(index, { answer_type: e.target.value })} sx={selectSx}>
                    {answerTypes.map(type => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={<Switch checked={q.required} onChange={e => updateQuestion(index, { required: e.target.checked })} />}
                  label={<Typography sx={{ color: '#ddd' }}>必填</Typography>}
                />
              </Box>
              {(q.answer_type === 'single_choice' || q.answer_type === 'multiple_choice') && (
                <TextField fullWidth size="small" label="選項" helperText="用逗號分隔" value={q.optionsText} onChange={e => updateQuestion(index, { optionsText: e.target.value })} sx={{ ...fieldSx, mb: 1.5 }} />
              )}
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ color: '#B0B0B0', fontSize: '0.85rem', mb: 0.5 }}>答此題後加入標籤</Typography>
                <TagInput
                  tags={q.tags || []}
                  onChange={tags => updateQuestion(index, { tags })}
                  placeholder="選擇或輸入標籤..."
                  singleSelect
                />
                <Typography sx={{ color: '#888', fontSize: '0.75rem', mt: 0.5 }}>使用者有填寫此題時會加入標籤</Typography>
              </Box>
            </Paper>
          ))}

          <Button startIcon={<AddIcon />} onClick={() => setForm(prev => ({ ...prev, questions: [...prev.questions, emptyQuestion()] }))} sx={{ color: 'var(--primary-yellow)', mb: 2 }}>
            新增題目
          </Button>

          <Button fullWidth variant="contained" disabled={saving} onClick={handleSubmit} sx={{ background: 'var(--primary-yellow)', color: '#111', fontWeight: 'bold', mb: editingSurveyKey ? 1 : 0 }}>
            {saving ? (editingSurveyKey ? '儲存中...' : '建立中...') : (editingSurveyKey ? '儲存修改' : '建立 LIFF 問卷並複製連結')}
          </Button>
          {editingSurveyKey && (
            <Button fullWidth variant="outlined" onClick={handleCancelEdit} sx={{ mt: 1, color: '#aaa', borderColor: '#555', '&:hover': { borderColor: '#888' }, fontWeight: 'bold' }}>
              取消編輯
            </Button>
          )}
        </Paper>
      </Box>

      <Box>
        <Alert severity="info" sx={{ mb: 2, background: '#1e2a38', color: '#d7e3f4' }}>
          新版問卷不再寫入 Q_bank；題目、限制和回答都存在 LIFF 問卷專用表。標籤依各題設定，使用者作答後自動上標。
        </Alert>
        {loading ? (
          <CircularProgress sx={{ color: 'var(--primary-yellow)' }} />
        ) : surveys.length === 0 ? (
          <Typography sx={{ color: '#888' }}>還沒有 LIFF 問卷。</Typography>
        ) : (
          surveys.map(survey => (
            <Paper key={survey.survey_key} sx={{ p: 2, mb: 2, background: '#222', border: '1px solid #444' }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>{survey.title}</Typography>
                  <Typography sx={{ color: '#999', fontSize: '0.85rem', mt: 0.5 }}>surveyId: {survey.survey_key}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                    <Chip size="small" label={`${survey.question_count} 題`} sx={{ background: '#333', color: '#ddd' }} />
                    <Chip size="small" label={`${survey.response_count} 份作答`} sx={{ background: '#333', color: '#ddd' }} />
                    <Chip size="small" label={survey.status === 'published' ? '開放中' : '草稿'} sx={{ background: survey.status === 'published' ? '#2e7d32' : '#555', color: '#fff' }} />
                    {(survey.question_tags || []).map(tag => <Chip key={tag} size="small" label={tag} sx={{ background: '#4b3f12', color: '#ffe082' }} />)}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="編輯問卷">
                    <IconButton onClick={() => handleStartEdit(survey)} sx={{ color: '#4fc3f7' }}><EditIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="查看作答">
                    <IconButton onClick={() => openResponses(survey)} sx={{ color: '#ffb300' }}><InsightsIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="複製 LIFF 連結">
                    <IconButton onClick={() => copyText(makeLiffUrl(survey), 'LIFF 連結已複製')} sx={{ color: '#81c784' }}><ContentCopyIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="開啟 LIFF 連結">
                    <IconButton component="a" href={makeLiffUrl(survey)} target="_blank" rel="noreferrer" sx={{ color: '#4fc3f7' }}><LaunchIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="刪除">
                    <IconButton onClick={() => handleDelete(survey)} sx={{ color: '#e57373' }}><DeleteIcon /></IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          ))
        )}
      </Box>

      <Dialog open={responsesOpen} onClose={() => setResponsesOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{selectedSurvey?.title} 作答情況</DialogTitle>
        <DialogContent dividers sx={{ background: '#1f1f1f' }}>
          {loadingResponses ? (
            <CircularProgress sx={{ color: 'var(--primary-yellow)' }} />
          ) : responses.length === 0 ? (
            <Typography sx={{ color: '#888' }}>目前沒有作答。</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#ddd' }}>使用者</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>時間</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>標籤/來源</TableCell>
                  <TableCell sx={{ color: '#ddd' }}>答案</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {responses.map(row => (
                  <TableRow key={row.response_id}>
                    <TableCell sx={{ color: '#fff', verticalAlign: 'top' }}>
                      <div>{row.display_name}</div>
                      <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>{row.line_user_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#ccc', verticalAlign: 'top' }}>{row.submitted_at}</TableCell>
                    <TableCell sx={{ color: '#ccc', verticalAlign: 'top' }}>
                      {(row.source_meta?.default_tags || []).map(tag => <Chip key={tag} size="small" label={tag} sx={{ mr: 0.5, mb: 0.5, background: '#4b3f12', color: '#ffe082' }} />)}
                      {row.source_meta?.bot_app_name && <Typography sx={{ color: '#888', fontSize: '0.75rem' }}>bot: {row.source_meta.bot_app_name}</Typography>}
                    </TableCell>
                    <TableCell sx={{ color: '#ddd' }}>
                      {row.answers.map(answer => (
                        <Box key={answer.question_id} sx={{ mb: 1 }}>
                          <Typography sx={{ color: '#aaa', fontSize: '0.78rem' }}>Q{answer.question_no}. {answer.question}</Typography>
                          <Typography sx={{ color: '#fff' }}>{answer.answer || '-'}</Typography>
                        </Box>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
