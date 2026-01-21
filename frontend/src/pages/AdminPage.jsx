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
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../api';

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
    const [pageId, setPageId] = useState(''); // Selected page ID
    const [dbUrl, setDbUrl] = useState('');

    const axiosInstance = axios.create({
        baseURL: API_BASE_URL,
        headers: { Authorization: `Bearer ${token}` }
    });

    const fetchData = async () => {
        // Fetch Users
        try {
            const usersRes = await axiosInstance.get('admin/users');
            setUsers(usersRes.data);
        } catch (error) {
            console.error("Error fetching users", error);
        }

        // Fetch OA Configs
        try {
            const oaRes = await axiosInstance.get('admin/oa_configs');
            setOaConfigs(oaRes.data);
        } catch (error) {
            console.error("Error fetching OA configs", error);
        }

        // Fetch Pages
        try {
            const pagesRes = await axiosInstance.get('admin/pages');
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
                await axiosInstance.put(`/admin/users/${currentUser.id}`, payload);
            } else {
                await axiosInstance.post('/admin/users', payload);
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
                await axiosInstance.delete(`admin/users/${id}`);
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };

    // --- OA Handlers ---
    const handleSaveOA = async () => {
        try {
            const payload = {
                page_id: pageId,
                oa_name: oaName,
                db_url: dbUrl // This is "Settings" or "Remote DB URL"
            };
            if (currentOA) {
                await axiosInstance.put(`admin/oa_configs/${currentOA.id}`, payload);
            } else {
                await axiosInstance.post('admin/oa_configs', payload);
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
        setPageId('');
        setDbUrl('');
    };

    const openEditOA = (oa) => {
        setCurrentOA(oa);
        setOaName(oa.oa_name);
        setPageId(oa.page_id);
        setDbUrl(oa.db_url);
        setOpenOADialog(true);
    };

    const handleDeleteOA = async (id) => {
        if (window.confirm("確認刪除 OA 設定?")) {
            try {
                await axiosInstance.delete(`admin/oa_configs/${id}`);
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
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
                    <Tab label="用戶管理" />
                    <Tab label="官方帳號 (OA) 設定" />
                </Tabs>
            </Box>

            {/* User Management Tab */}
            <TabPanel value={tabValue} index={0}>
                <Button variant="contained" onClick={() => { resetUserForm(); setOpenUserDialog(true); }} sx={{ mb: 2 }}>
                    新增用戶
                </Button>
                <TableContainer component={Paper} sx={{ backgroundColor: '#FFD700', color: '#1A1A1A' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>姓名</TableCell>
                                <TableCell sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>Email</TableCell>
                                <TableCell sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>可使用的 OA</TableCell>
                                <TableCell sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>角色</TableCell>
                                <TableCell sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>{user.name || '-'}</TableCell>
                                    <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>{user.email}</TableCell>
                                    <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>
                                        {user.role === 'admin' ? '全部 (管理員)' :
                                            user.allowed_oa_configs && user.allowed_oa_configs.length > 0 ? (
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {user.allowed_oa_configs.map(oaId => {
                                                        const oa = oaConfigs.find(c => c.id === oaId);
                                                        return <Chip key={oaId} label={oa ? oa.oa_name : oaId} size="small" sx={{ backgroundColor: '#1A1A1A', color: '#FFD700' }} />;
                                                    })}
                                                </Box>
                                            ) : '無'
                                        }
                                    </TableCell>
                                    <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>{user.role === 'admin' ? '管理員' : '一般用戶'}</TableCell>
                                    <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>
                                        <IconButton onClick={() => openEditUser(user)} sx={{ color: '#1A1A1A' }}>
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
                <Button variant="contained" onClick={() => { resetOAForm(); setOpenOADialog(true); }} sx={{ mb: 2 }}>
                    新增 OA 設定
                </Button>
                <TableContainer component={Paper} sx={{ backgroundColor: '#FFD700', color: '#1A1A1A' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell width="15%" sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>OA 名稱</TableCell>
                                <TableCell width="15%" sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>頁面</TableCell>
                                <TableCell width="55%" sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>設定</TableCell>
                                <TableCell width="15%" sx={{ color: '#1A1A1A', fontWeight: 'bold', borderBottom: '2px solid #1A1A1A' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {oaConfigs.map((oa) => {
                                const page = pages.find(p => p.id === oa.page_id);
                                return (
                                    <TableRow key={oa.id}>
                                        <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>{oa.oa_name}</TableCell>
                                        <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>{page ? page.name : oa.page_id}</TableCell>
                                        <TableCell sx={{ wordBreak: 'break-all', color: '#1A1A1A', borderBottom: '1px solid #333' }}>{oa.db_url}</TableCell>
                                        <TableCell sx={{ color: '#1A1A1A', borderBottom: '1px solid #333' }}>
                                            <IconButton onClick={() => openEditOA(oa)} sx={{ color: '#1A1A1A' }}>
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
                        backgroundColor: '#FFD700',
                        color: '#1A1A1A'
                    }
                }}
            >
                <DialogTitle sx={{ color: '#1A1A1A' }}>{currentUser ? '編輯用戶' : '新增用戶'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="姓名"
                        fullWidth
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        sx={{ input: { color: '#1A1A1A' }, label: { color: '#333' } }}
                    />
                    <TextField
                        margin="dense"
                        label="Email 地址"
                        type="email"
                        fullWidth
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        sx={{ input: { color: '#1A1A1A' }, label: { color: '#333' } }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={newUserRole === 'admin'}
                                onChange={(e) => setNewUserRole(e.target.checked ? 'admin' : 'user')}
                                sx={{ color: '#1A1A1A', '&.Mui-checked': { color: '#1A1A1A' } }}
                            />
                        }
                        label="是否為管理員?"
                        sx={{ color: '#1A1A1A' }}
                    />

                    {newUserRole !== 'admin' && (
                        <FormControl fullWidth margin="dense">
                            <InputLabel id="oa-select-label" sx={{ color: '#333' }}>可使用的 OA 設定</InputLabel>
                            <Select
                                labelId="oa-select-label"
                                multiple
                                value={selectedOAs}
                                onChange={(e) => setSelectedOAs(e.target.value)}
                                input={<OutlinedInput label="可使用的 OA 設定" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => {
                                            const config = oaConfigs.find(oa => oa.id === value);
                                            return <Chip key={value} label={config ? config.oa_name : value} sx={{ backgroundColor: '#1A1A1A', color: '#FFD700' }} />;
                                        })}
                                    </Box>
                                )}
                                sx={{ color: '#1A1A1A', '.MuiOutlinedInput-notchedOutline': { borderColor: '#333' } }}
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
                    <Button onClick={() => setOpenUserDialog(false)} sx={{ color: '#1A1A1A' }}>取消</Button>
                    <Button onClick={handleAddUser} sx={{ color: '#1A1A1A' }}>{currentUser ? '更新' : '新增'}</Button>
                </DialogActions>
            </Dialog>

            {/* OA Dialog */}
            <Dialog
                open={openOADialog}
                onClose={() => setOpenOADialog(false)}
                PaperProps={{
                    sx: {
                        backgroundColor: '#FFD700',
                        color: '#1A1A1A'
                    }
                }}
            >
                <DialogTitle sx={{ color: '#1A1A1A' }}>{currentOA ? '編輯' : '新增'} OA 設定</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="OA 名稱"
                        fullWidth
                        value={oaName}
                        onChange={(e) => setOaName(e.target.value)}
                        sx={{ input: { color: '#1A1A1A' }, label: { color: '#333' } }}
                    />

                    <FormControl fullWidth margin="dense">
                        <InputLabel id="page-select-label" sx={{ color: '#333' }}>對應頁面</InputLabel>
                        <Select
                            labelId="page-select-label"
                            value={pageId}
                            label="對應頁面"
                            onChange={(e) => setPageId(e.target.value)}
                            sx={{ color: '#1A1A1A', '.MuiOutlinedInput-notchedOutline': { borderColor: '#333' } }}
                        >
                            {pages.map((page) => (
                                <MenuItem key={page.id} value={page.id}>
                                    {page.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        margin="dense"
                        label="設定"
                        fullWidth
                        value={dbUrl}
                        onChange={(e) => setDbUrl(e.target.value)}
                        sx={{ input: { color: '#1A1A1A' }, label: { color: '#333' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenOADialog(false)} sx={{ color: '#1A1A1A' }}>取消</Button>
                    <Button onClick={handleSaveOA} sx={{ color: '#1A1A1A' }}>儲存</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default AdminPage;
