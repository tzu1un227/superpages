import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Checkbox,
    FormControlLabel,
    IconButton,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Chip,
    OutlinedInput
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function AdminPage() {
    const [tabValue, setTabValue] = useState(0);
    const { token } = useAuth();

    // User Management State
    const [users, setUsers] = useState([]);
    const [openUserDialog, setOpenUserDialog] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); // For edit
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('user');
    const [selectedOAs, setSelectedOAs] = useState([]); // For allowed_oa_configs

    // OA Config Management State
    const [oaConfigs, setOaConfigs] = useState([]);
    const [pages, setPages] = useState([]); // List of pages
    const [openOADialog, setOpenOADialog] = useState(false);
    const [currentOA, setCurrentOA] = useState(null); // For edit
    const [oaName, setOaName] = useState('');
    const [pageIds, setPageIds] = useState([]); // Selected page IDs (Array)
    const [dbUrl, setDbUrl] = useState('');
    const [socketUrl, setSocketUrl] = useState('');
    const [appName, setAppName] = useState('');
    const [lineToken, setLineToken] = useState('');
    const [lineSecret, setLineSecret] = useState('');
    const [lineSecret, setLineSecret] = useState('');
    const [oaValidated, setOaValidated] = useState(false);

    // axiosInstance removed in favor of shared api


    const fetchData = async () => {
        // Fetch Users
        try {
            const usersRes = await api.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } });
            setUsers(usersRes.data);
        } catch (error) {
            console.error("Error fetching users", error);
            alert("無法取得用戶列表: " + (error.response?.data?.message || error.message));
        }

        // Fetch OA Configs
        try {
            const oaRes = await api.get('/admin/oa_configs', { headers: { Authorization: `Bearer ${token}` } });
            setOaConfigs(oaRes.data);
        } catch (error) {
            console.error("Error fetching OA configs", error);
        }

        // Fetch Pages
        try {
            const pagesRes = await api.get('/admin/pages', { headers: { Authorization: `Bearer ${token}` } });
            setPages(pagesRes.data);
        } catch (error) {
            console.error("Error fetching pages", error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token]);

    // --- User Handlers ---
    const handleAddUser = async () => {
        try {
            const payload = {
                name: newUserName,
                email: newUserEmail,
                role: newUserRole,
                allowed_oa_configs: selectedOAs
            };

            if (currentUser) {
                await api.put(`/admin/users/${currentUser.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                await api.post('/admin/users', payload, { headers: { Authorization: `Bearer ${token}` } });
            }

            setOpenUserDialog(false);
            resetUserForm();
            fetchData();
        } catch (error) {
            alert(`${currentUser ? '更新' : '新增'}用戶失敗: ` + (error.response?.data?.message || error.message));
        }
    };

    const resetUserForm = () => {
        setCurrentUser(null);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserRole('user');
        setSelectedOAs([]);
    };

    const openEditUser = (user) => {
        setCurrentUser(user);
        setNewUserName(user.name || '');
        setNewUserEmail(user.email);
        setNewUserRole(user.role);
        setSelectedOAs(user.allowed_oa_configs || []);
        setOpenUserDialog(true);
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("確認刪除用戶?")) {
            try {
                await api.delete(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };

    // --- OA Handlers ---
    const handleSaveOA = async () => {
        setOaValidated(true);
        try {
            // Validation Logic: Check all fields
            const isValid = 
                oaName.trim() !== '' &&
                pageIds.length > 0 &&
                dbUrl.trim() !== '' &&
                socketUrl.trim() !== '' &&
                appName.trim() !== '' &&
                lineToken.trim() !== '' &&
                lineSecret.trim() !== '';

            if (!isValid) {
                alert("請填寫所有必填欄位。標記為紅色的項目尚未完成。");
                return;
            }

            const payload = {
                page_ids: pageIds,
                oa_name: oaName,
                db_url: dbUrl,
                other_settings: {
                    socket_url: socketUrl,
                    app_name: appName.trim(),
                    line_token: lineToken,
                    line_secret: lineSecret
                }
            };
            if (currentOA) {
                await api.put(`/admin/oa_configs/${currentOA.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                await api.post('/admin/oa_configs', payload, { headers: { Authorization: `Bearer ${token}` } });
            }
            setOpenOADialog(false);
            resetOAForm();
            fetchData();
        } catch (error) {
            alert("儲存 OA 設定失敗: " + (error.response?.data?.message || error.message));
        }
    };

    const resetOAForm = () => {
        setCurrentOA(null);
        setOaName('');
        setPageIds([]);
        setDbUrl('');
        setSocketUrl('');
        setAppName('');
        setLineToken('');
        setLineSecret('');
        setOaValidated(false);
    };

    const openEditOA = (oa) => {
        setCurrentOA(oa);
        setOaName(oa.oa_name);
        setPageIds(oa.page_ids || []);
        setDbUrl(oa.db_url);
        setSocketUrl(oa.other_settings?.socket_url || '');
        setAppName(oa.other_settings?.app_name || '');
        setLineToken(oa.other_settings?.line_token || '');
        setLineSecret(oa.other_settings?.line_secret || '');
        setOaValidated(false);
        setOpenOADialog(true);
    };

    const handleDeleteOA = async (id) => {
        if (window.confirm("確認刪除 OA 設定?")) {
            try {
                await api.delete(`/admin/oa_configs/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };



    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" gutterBottom>
                帳號管理
            </Typography>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="admin tabs"
                    sx={{
                        '& .MuiTab-root': { color: '#B0B0B0' },
                        '& .Mui-selected': { color: 'var(--primary-yellow) !important' },
                        '& .MuiTabs-indicator': { backgroundColor: 'var(--primary-yellow)' }
                    }}
                >
                    <Tab label="用戶管理" />
                    <Tab label="權限設定" />
                </Tabs>
            </Box>

            {/* User Management Tab */}
            <TabPanel value={tabValue} index={0}>
                <Button variant="contained" onClick={() => { resetUserForm(); setOpenUserDialog(true); }} sx={{ mb: 2, backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold', '&:hover': { backgroundColor: '#e6c200' } }}>
                    新增用戶
                </Button>
                <TableContainer component={Paper} sx={{ backgroundColor: 'var(--secondary-black)', color: 'white' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>姓名</TableCell>
                                <TableCell sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>Email</TableCell>
                                <TableCell sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>可使用的權限</TableCell>
                                <TableCell sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>角色</TableCell>
                                <TableCell sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id} hover sx={{ '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.05)' } }}>
                                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>{user.name || '-'}</TableCell>
                                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>{user.email}</TableCell>
                                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>
                                        {user.role === 'admin' ? '全部 (管理員)' :
                                            user.allowed_oa_configs && user.allowed_oa_configs.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {user.allowed_oa_configs.map(oaId => {
                                                        const oa = oaConfigs.find(c => c.id === oaId);
                                                        return <Chip key={oaId} label={oa ? oa.oa_name : oaId} size="small" sx={{ backgroundColor: '#444', color: 'white' }} />;
                                                    })}
                                                </Box>
                                            ) : '無'
                                        }
                                    </TableCell>
                                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>{user.role === 'admin' ? '管理員' : '一般用戶'}</TableCell>
                                    <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>
                                        <IconButton onClick={() => openEditUser(user)} sx={{ color: 'var(--primary-yellow)' }}>
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton onClick={() => handleDeleteUser(user.id)} color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            {/* OA Config Tab */}
            <TabPanel value={tabValue} index={1}>
                <Button variant="contained" onClick={() => { resetOAForm(); setOpenOADialog(true); }} sx={{ mb: 2, backgroundColor: 'var(--primary-yellow)', color: '#2A2A2A', fontWeight: 'bold', '&:hover': { backgroundColor: '#e6c200' } }}>
                    新增權限設定
                </Button>
                <TableContainer component={Paper} sx={{ backgroundColor: 'var(--secondary-black)', color: 'white' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell width="20%" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>權限名稱</TableCell>
                                <TableCell width="60%" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>可存取頁面</TableCell>
                                <TableCell width="20%" sx={{ color: 'var(--primary-yellow)', fontWeight: 'bold', borderBottom: '2px solid var(--primary-yellow)' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {oaConfigs.map((oa) => {
                                // For page_ids list
                                const pageNames = (oa.page_ids || []).map(pid => {
                                    const p = pages.find(pg => pg.id === pid);
                                    return p ? (p.description || p.name) : pid;
                                }).join(', ');

                                return (
                                    <TableRow key={oa.id} hover sx={{ '&:hover': { backgroundColor: 'rgba(255, 215, 0, 0.05)' } }}>
                                        <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>{oa.oa_name}</TableCell>
                                        <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>
                                            {pageNames}
                                        </TableCell>
                                        <TableCell sx={{ color: 'white', borderBottom: '1px solid #333' }}>
                                            <IconButton onClick={() => openEditOA(oa)} sx={{ color: 'var(--primary-yellow)' }}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton onClick={() => handleDeleteOA(oa.id)} color="error">
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            {/* User Dialog */}
            <Dialog
                open={openUserDialog}
                onClose={() => setOpenUserDialog(false)}
                PaperProps={{
                    sx: {
                        backgroundColor: 'var(--secondary-black)',
                        color: 'white',
                        border: '1px solid #333'
                    }
                }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>{currentUser ? '編輯用戶' : '新增用戶'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="姓名"
                        fullWidth
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                    <TextField
                        margin="dense"
                        label="Email 地址"
                        type="email"
                        fullWidth
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={newUserRole === 'admin'}
                                onChange={(e) => setNewUserRole(e.target.checked ? 'admin' : 'user')}
                                sx={{ color: '#B0B0B0', '&.Mui-checked': { color: 'var(--primary-yellow)' } }}
                            />
                        }
                        label="是否為管理員?"
                        sx={{ color: 'white' }}
                    />

                    {newUserRole !== 'admin' && (
                        <FormControl fullWidth margin="dense">
                            <InputLabel id="oa-select-label" sx={{ color: '#B0B0B0' }}>可使用的權限</InputLabel>
                            <Select
                                labelId="oa-select-label"
                                multiple
                                value={selectedOAs}
                                onChange={(e) => setSelectedOAs(e.target.value)}
                                input={<OutlinedInput label="可使用的權限" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const config = oaConfigs.find(oa => oa.id === value);
                                            return <Chip key={value} label={config ? config.oa_name : value} sx={{ backgroundColor: '#444', color: 'white' }} />;
                                        })}
                                    </Box>
                                )}
                                sx={{
                                    color: 'white',
                                    '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-yellow)' }
                                }}
                            >
                                {oaConfigs.map((oa) => (
                                    <MenuItem key={oa.id} value={oa.id}>
                                        {oa.oa_name} (ID: {oa.id})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenUserDialog(false)} sx={{ color: '#B0B0B0' }}>取消</Button>
                    <Button onClick={handleAddUser} sx={{ color: 'var(--primary-yellow)' }}>{currentUser ? '更新' : '新增'}</Button>
                </DialogActions>
            </Dialog>

            {/* OA Dialog */}
            <Dialog
                open={openOADialog}
                onClose={() => setOpenOADialog(false)}
                PaperProps={{
                    sx: {
                        backgroundColor: 'var(--secondary-black)',
                        color: 'white',
                        border: '1px solid #333'
                    }
                }}
            >
                <DialogTitle sx={{ color: 'var(--primary-yellow)' }}>{currentOA ? '編輯' : '新增'} 權限設定</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="權限名稱"
                        fullWidth
                        error={oaValidated && !oaName.trim()}
                        helperText={oaValidated && !oaName.trim() ? "請輸入權限名稱" : ""}
                        value={oaName}
                        onChange={(e) => setOaName(e.target.value)}
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />

                    <FormControl fullWidth margin="dense" error={oaValidated && pageIds.length === 0}>
                        <InputLabel id="page-select-label" sx={{ color: '#B0B0B0' }}>可存取頁面</InputLabel>
                        <Select
                            labelId="page-select-label"
                            multiple
                            value={pageIds}
                            label="可存取頁面"
                            onChange={(e) => setPageIds(e.target.value)}
                            input={<OutlinedInput label="可存取頁面" />}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => {
                                        const p = pages.find(pg => pg.id === value);
                                        return <Chip key={value} label={p ? (p.description || p.name) : value} sx={{ backgroundColor: '#444', color: 'white' }} />;
                                    })}
                                </Box>
                            )}
                            sx={{
                                color: 'white',
                                '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--primary-yellow)' }
                            }}
                        >
                            {pages.map((page) => (
                                <MenuItem key={page.id} value={page.id}>
                                    <Checkbox checked={pageIds.indexOf(page.id) > -1} sx={{ color: '#B0B0B0', '&.Mui-checked': { color: 'var(--primary-yellow)' } }} />
                                    {page.description || page.name}
                                </MenuItem>
                            ))}
                        </Select>
                        {oaValidated && pageIds.length === 0 && <FormHelperText sx={{ color: '#f44336' }}>請至少選擇一個頁面</FormHelperText>}
                    </FormControl>

                    <TextField
                        margin="dense"
                        label="資料庫連線字串 (DB URL)"
                        fullWidth
                        error={oaValidated && !dbUrl.trim()}
                        helperText={oaValidated && !dbUrl.trim() ? "請輸入資料庫連線字串" : ""}
                        value={dbUrl}
                        onChange={(e) => setDbUrl(e.target.value)}
                        placeholder="postgresql://user:pass@host:port/dbname"
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                    <TextField
                        margin="dense"
                        label="WebSocket URL"
                        fullWidth
                        error={oaValidated && !socketUrl.trim()}
                        helperText={oaValidated && !socketUrl.trim() ? "請輸入 WebSocket URL" : ""}
                        value={socketUrl}
                        onChange={(e) => setSocketUrl(e.target.value)}
                        placeholder="http://127.0.0.1:3000"
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                    <TextField
                        margin="dense"
                        label="App Name (各平台獨立資料表名稱後綴)"
                        fullWidth
                        error={oaValidated && !appName.trim()}
                        helperText={oaValidated && !appName.trim() ? "此欄位為必填項目，用於確保各平台資料隔離" : "對應資料庫中的 table:{app_name} 格式"}
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="例如: 5013"
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } },
                            '& .MuiFormHelperText-root': { color: (oaValidated && !appName.trim()) ? '#f44336' : '#B0B0B0' }
                        }}
                    />

                    <Typography variant="h6" sx={{ mt: 2, mb: 1, fontSize: '1rem', color: 'var(--primary-yellow)' }}>LINE Messaging API 設定</Typography>
                    <TextField
                        margin="dense"
                        label="LINE Channel Access Token"
                        fullWidth
                        type="password"
                        error={oaValidated && !lineToken.trim()}
                        helperText={oaValidated && !lineToken.trim() ? "請輸入 Access Token" : ""}
                        value={lineToken}
                        onChange={(e) => setLineToken(e.target.value)}
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                    <TextField
                        margin="dense"
                        label="LINE Channel Secret"
                        fullWidth
                        type="password"
                        error={oaValidated && !lineSecret.trim()}
                        helperText={oaValidated && !lineSecret.trim() ? "請輸入 Channel Secret" : ""}
                        value={lineSecret}
                        onChange={(e) => setLineSecret(e.target.value)}
                        sx={{
                            input: { color: 'white' },
                            label: { color: '#B0B0B0' },
                            '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: '#555' }, '&:hover fieldset': { borderColor: '#888' }, '&.Mui-focused fieldset': { borderColor: 'var(--primary-yellow)' } }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenOADialog(false)} sx={{ color: '#B0B0B0' }}>取消</Button>
                    <Button onClick={handleSaveOA} sx={{ color: 'var(--primary-yellow)' }}>儲存</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default AdminPage;
