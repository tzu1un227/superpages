import React, { useState, useRef, useEffect } from 'react';
import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Paper,
  Stack,
  useTheme
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import UserTrendChart from '../components/UserTrendChart';
import KeywordRankingChart from '../components/KeywordRankingChart';

function Dashboard() {
  const theme = useTheme();
  const { currentAccount } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('週');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 56); // Default to 8 weeks
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [availableTags, setAvailableTags] = useState([]);

  const chartRef = useRef(null);
  const [chartHeight, setChartHeight] = useState(0);

  // Use a ref to store the last valid start date to prevent invalid updates
  const previousStartDate = useRef(startDate);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    if (endDate > today) {
      alert('結束日期不能晚於今天！');
      setEndDate(today);
      return;
    }

    if (startDate > endDate) {
      alert('開始日期不能晚於結束日期！');
      // Revert to the last valid start date
      setStartDate(previousStartDate.current);
      return;
    }

    // If the date is valid, update the ref
    previousStartDate.current = startDate;
  }, [startDate, endDate]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setChartHeight(entry.contentRect.height);
      }
    });

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Box>
      {/* Filter Controls Card */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, mr: 1, flexShrink: 0 }}>
            篩選條件
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>週期</InputLabel>
              <Select value={selectedPeriod} label="週期" onChange={(e) => setSelectedPeriod(e.target.value)}>
                <MenuItem value="年">年</MenuItem>
                <MenuItem value="月">月</MenuItem>
                <MenuItem value="週">週</MenuItem>
                <MenuItem value="日">日</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="期間開始"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="期間結束"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Stack>
      </Paper>

      {/* Charts Grid */}
      {currentAccount ? (
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 200px)' }}>
          <Grid item xs={12} lg={8} sx={{ height: '100%' }}>
            <UserTrendChart
              selectedPeriod={selectedPeriod}
              startDate={startDate}
              endDate={endDate}
              onTagsUpdate={setAvailableTags}
              account={currentAccount?.id}
            />
          </Grid>
          <Grid item xs={12} lg={4} sx={{ height: '100%' }}>
            <KeywordRankingChart
              startDate={startDate}
              endDate={endDate}
              availableTags={availableTags}
              account={currentAccount?.id}
            />
          </Grid>
        </Grid>
      ) : (
        <Paper
          sx={{
            p: 5,
            textAlign: 'center',
            backgroundColor: theme.palette.background.default,
            border: `1px dashed ${theme.palette.divider}`
          }}
        >
          <Typography variant="h6" color="text.secondary">
            請先選擇一個 OA 帳號以查看數據
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default Dashboard;