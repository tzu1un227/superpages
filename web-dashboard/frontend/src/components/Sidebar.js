import React from 'react';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Typography, Box, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../contexts/AuthContext';

import { useNavigate } from 'react-router-dom';

const drawerWidth = 240;

function Sidebar() {
  const theme = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.neutral.dark,
          color: theme.palette.neutral.light,
          borderRight: 'none',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" component="div" sx={{ color: theme.palette.common.white, fontWeight: 'bold' }}>
          Line-Bot 視覺化
        </Typography>
      </Box>
      <Divider sx={{ borderColor: theme.palette.neutral.main }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton selected={window.location.pathname === '/dashboard'} onClick={() => navigate('/dashboard')}>
            <ListItemIcon sx={{ color: theme.palette.common.white }}>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="儀表板" />
          </ListItemButton>
        </ListItem>


        {user?.role === 'admin' && (
          <ListItem disablePadding>
            <ListItemButton selected={window.location.pathname === '/admin'} onClick={() => navigate('/admin')}>
              <ListItemIcon sx={{ color: theme.palette.neutral.light }}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="帳號管理" />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      <Box sx={{ mt: 'auto' }}>
        <Divider />
        {isAuthenticated && user && (
          <Box sx={{
            p: 2,
            backgroundColor: theme.palette.neutral.dark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}>
            <Typography variant="body2" sx={{ color: theme.palette.common.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }} title={user.name || user.email}>
              {user.name || user.email}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={logout}
              sx={{
                minWidth: 'auto',
                px: 2,
                backgroundColor: theme.palette.error.main,
                '&:hover': {
                  backgroundColor: theme.palette.error.dark,
                },
              }}
            >
              登出
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export default Sidebar;

