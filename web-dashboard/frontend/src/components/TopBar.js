import React from 'react';
import { AppBar, Toolbar, Typography, Button, Select, MenuItem, Box, FormControl, InputLabel } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@mui/material/styles';

const drawerWidth = 240;

function TopBar() {
    const { user, logout, myOAs, currentAccount, switchAccount } = useAuth();
    const theme = useTheme();

    return (
        <AppBar
            position="fixed"
            sx={{
                width: { sm: `calc(100% - ${drawerWidth}px)` },
                ml: { sm: `${drawerWidth}px` },
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: 1
            }}
        >
            <Toolbar>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                    {/* Page Title could go here, or leave empty */}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {myOAs.length > 0 ? (
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <Select
                                value={currentAccount?.id || ''}
                                onChange={(e) => switchAccount(e.target.value)}
                                displayEmpty
                                inputProps={{ 'aria-label': 'Select Account' }}
                            >
                                <MenuItem value="" disabled>
                                    選擇帳號
                                </MenuItem>
                                {myOAs.map((oa) => (
                                    <MenuItem key={oa.id} value={oa.id}>
                                        {oa.oa_name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            (尚無可用的 OA 設定)
                        </Typography>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default TopBar;
