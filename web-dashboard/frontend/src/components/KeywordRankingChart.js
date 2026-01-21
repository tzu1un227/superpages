import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import axios from 'axios';
import { downloadCSV } from '../utils/csvUtils';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';

function KeywordRankingChart({ startDate, endDate, availableTags, account }) {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState(''); // Default to 'all'

  // ... (fetchData reused) ... since I am only editing the props and return, I should be careful not to delete logic I can't see. 
  // Wait, I should select the Function Definition line and the layout return.

  const fetchData = useCallback(async () => {
    // ... logic ...

    setLoading(true);
    try {
      if (!token) return;
      const params = {
        start_date: startDate,
        end_date: endDate,
        tag: selectedTag,
        limit: 50 // Fetch top 50
      };
      if (account) {
        params.account = account;
      }

      const response = await axios.get(`${API_BASE_URL}/dashboard/responses`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      // The new API format returns data directly in response.data.data
      const fetchedData = response.data.data || [];
      setData(fetchedData);
    } catch (error) {
      console.error('Error fetching keyword ranking data:', error);
      setData([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedTag, account, token]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [fetchData]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            用戶關鍵字排名
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="tag-select-label" shrink>使用者標籤</InputLabel>
              <Select
                labelId="tag-select-label"
                id="tag-select"
                value={selectedTag}
                label="使用者標籤"
                displayEmpty
                onChange={(e) => setSelectedTag(e.target.value)}
              >
                <MenuItem value="">
                  全部
                </MenuItem>
                {availableTags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              sx={{ minWidth: 120, height: 40 }}
              onClick={() => {
                // Format data for CSV
                const csvData = data.map((row, index) => ({
                  '排名': index + 1,
                  '關鍵字': row.keyword,
                  '次數': row.count
                }));
                downloadCSV(csvData, `keyword_ranking_${startDate}_${endDate}.csv`);
              }}
              disabled={!data || data.length === 0}
            >
              匯出 CSV
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
            <CircularProgress />
          </Box>
        ) : data.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
            <Typography>無可用數據</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ flex: '1 1 auto', overflowY: 'auto' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>排名</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>關鍵字</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>次數</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell
                      title={row.keyword}
                      sx={{
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {row.keyword}
                    </TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default KeywordRankingChart;