import React, { useState, useEffect, useMemo } from 'react';
import { Paper, Typography, Select, MenuItem, FormControl, InputLabel, Box, useTheme, Checkbox, FormControlLabel, Tooltip, Button } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import { downloadCSV } from '../utils/csvUtils';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';

const colors = ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD'];
const totalColor = '#0D47A1';

// Generates human-readable ticks based on the data's max value.
const generateNiceTicks = (maxValue, tickCount = 5) => {
  if (maxValue <= 0) return [0];

  const range = maxValue;
  const rawInterval = range / (tickCount - 1);
  const exponent = Math.floor(Math.log10(rawInterval));
  const powerOf10 = 10 ** exponent;
  const mantissa = rawInterval / powerOf10;

  let niceMantissa;
  if (mantissa > 5) {
    niceMantissa = 10;
  } else if (mantissa > 2) {
    niceMantissa = 5;
  } else {
    niceMantissa = 2;
  }

  const niceInterval = niceMantissa * powerOf10;

  const ticks = [];
  let currentTick = 0;
  while (currentTick <= maxValue) {
    ticks.push(currentTick);
    currentTick += niceInterval;
  }
  return ticks;
};

const UserTrendChart = ({ selectedPeriod, startDate, endDate, onTagsUpdate, account }) => {
  const theme = useTheme();
  const { token } = useAuth();
  const [selectedDataType, setSelectedDataType] = useState('訊息');
  const [chartData, setChartData] = useState([]);
  const [tags, setTags] = useState([]);
  const [visibleTags, setVisibleTags] = useState(new Set());

  const [yAxisProps, setYAxisProps] = useState({ domain: [0, 100], ticks: [0, 25, 50, 75, 100] });
  const [lastToggled, setLastToggled] = useState(null); // For selective animation

  const handleDataTypeChange = (event) => {
    setSelectedDataType(event.target.value);
  };

  const handleTagVisibilityChange = (tag) => {
    setLastToggled(tag); // Track the last toggled item for animation control
    setVisibleTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) newSet.delete(tag);
      else newSet.add(tag);
      return newSet;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLastToggled(null);
      try {
        const dataTypeMap = { '訊息': 'Message', '加入好友': 'Follow', '人數': 'user' };
        const apiCategory = dataTypeMap[selectedDataType];
        if (!apiCategory || !token) return;

        const params = {
          period: selectedPeriod,
          start_date: startDate,
          end_date: endDate,
          data_type: apiCategory
        };
        if (account) {
          params.account = account;
        }

        const response = await axios.get(`${API_BASE_URL}/dashboard/user_trend`, {
          params,
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = response.data;
        if (!Array.isArray(data)) { setChartData([]); setTags([]); return; }

        const processed = {}; // Key: time unit (tag), Value: object with categories as keys
        const uniqueCategories = new Set();

        data.forEach(item => {
          // Allow empty category, fallback to specific string
          if (!item.tag || typeof item.count !== 'number') return;

          const timeKey = item.tag;
          const categoryKey = item.category || "(無標籤)";

          uniqueCategories.add(categoryKey);

          if (!processed[timeKey]) {
            processed[timeKey] = { name: timeKey, total: 0 };
          }

          processed[timeKey][categoryKey] = (processed[timeKey][categoryKey] || 0) + item.count;
          processed[timeKey].total += item.count;
        });

        const categoriesArray = Array.from(uniqueCategories);
        const processedArray = Object.values(processed);

        processedArray.forEach(item => {
          categoriesArray.forEach(cat => {
            if (!(cat in item)) item[cat] = 0;
          });
        });
        processedArray.sort((a, b) => a.name && b.name ? a.name.localeCompare(b.name) : 0);

        setChartData(processedArray);
        setTags(categoriesArray); // Tags are the categories, which represent the lines
        if (onTagsUpdate) {
          onTagsUpdate(categoriesArray);
        }
        setVisibleTags(new Set([...categoriesArray, '總計']));

      } catch (error) { console.error('Error in fetchData:', error); }
    };
    if (startDate && endDate) fetchData();
  }, [selectedPeriod, startDate, endDate, selectedDataType, onTagsUpdate, account, token]);

  // Effect to calculate Y-axis domain and ticks
  useEffect(() => {
    if (chartData.length === 0) {
      setYAxisProps({ domain: [0, 10], ticks: [0, 5, 10] });
      return;
    }
    let maxY = 0;
    chartData.forEach(item => {
      tags.forEach(tag => { // Iterate through visible categories (lines)
        if (visibleTags.has(tag) && item[tag] > maxY) maxY = item[tag];
      });
      if (visibleTags.has('總計') && item.total > maxY) maxY = item.total;
    });

    if (maxY === 0) { // Handle case where all visible data is 0
      setYAxisProps({ domain: [0, 10], ticks: [0, 5, 10] });
    } else {
      setYAxisProps({
        domain: [0, Math.ceil(maxY * 1.01)], // Set domain to actual max with slight padding
        ticks: generateNiceTicks(maxY)      // But use nice ticks for labels
      });
    }
  }, [chartData, visibleTags, tags]);

  const CustomizedLegend = ({ tags, visibleTags, handleTagVisibilityChange }) => {
    const allItems = useMemo(() => [...tags.map((tag, index) => ({ value: tag, color: colors[index % colors.length] })), { value: '總計', color: totalColor }], [tags]);
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', mt: 2 }}>
        {allItems.map(entry => (
          <FormControlLabel key={entry.value} control={
            <Checkbox checked={visibleTags.has(entry.value)} onChange={() => handleTagVisibilityChange(entry.value)} sx={{ color: entry.color, '&.Mui-checked': { color: entry.color }, '&.Mui-checked ~ .MuiFormControlLabel-label': { opacity: 1 } }} />
          } label={entry.value} sx={{ mr: 2, '.MuiFormControlLabel-label': { opacity: 0.6, transition: 'opacity 0.3s' } }} />
        ))}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">用戶互動趨勢</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>資料類型</InputLabel>
            <Select value={selectedDataType} label="資料類型" onChange={handleDataTypeChange}>
              <MenuItem value="訊息">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  訊息
                  <Tooltip title="傳到官方帳號的訊息總數" placement="right" arrow>
                    <InfoOutlinedIcon sx={{ fontSize: '1.1rem', ml: 1.5, color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              </MenuItem>
              <MenuItem value="加入好友">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  加入好友
                  <Tooltip title="將官方帳戶加入好友的人數" placement="right" arrow>
                    <InfoOutlinedIcon sx={{ fontSize: '1.1rem', ml: 1.5, color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              </MenuItem>
              <MenuItem value="人數">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  人數
                  <Tooltip title="至少互動一次的用戶數" placement="right" arrow>
                    <InfoOutlinedIcon sx={{ fontSize: '1.1rem', ml: 1.5, color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            sx={{ minWidth: 120, height: 40 }}
            onClick={() => {
              // Format data for CSV
              // Flatten the chartData which is currently [{name: 'date', total: 10, 'Tag A': 5, 'Tag B': 5}, ...]
              const csvData = chartData.map(item => {
                const row = { '時間': item.name, '總計': item.total };
                tags.forEach(tag => {
                  if (tag !== 'total') {
                    row[tag] = item[tag] !== undefined ? item[tag] : 0;
                  }
                });
                return row;
              });
              downloadCSV(csvData, `user_trend_${selectedDataType}_${startDate}_${endDate}.csv`);
            }}
            disabled={!chartData || chartData.length === 0}
          >
            匯出 CSV
          </Button>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} animationDuration={500} {...yAxisProps} />
            <RechartsTooltip wrapperStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.7)', padding: '4px' }} contentStyle={{ backgroundColor: 'transparent' }} labelStyle={{ marginBottom: '8px', fontWeight: 'bold', opacity: 0.5 }} />
            <Legend content={<CustomizedLegend {...{ tags, visibleTags, handleTagVisibilityChange }} />} />

            {tags.map((tag, index) => {
              const isToggled = lastToggled === tag;
              const isFullRefresh = lastToggled === null;
              return visibleTags.has(tag) && (
                <Line key={tag} type="linear" dataKey={tag} name={tag} stroke={colors[index % colors.length]} strokeWidth={1} dot={chartData.length === 1 ? { r: 4 } : false}
                  isAnimationActive={isToggled || isFullRefresh} // Animate only if it's the item just toggled, or if it's a full data refresh
                  animationDuration={500} />
              )
            })}

            {visibleTags.has('總計') && (
              <Line type="linear" dataKey="total" name="總計" stroke={totalColor} strokeWidth={2} dot={chartData.length === 1 ? { r: 4 } : false}
                isAnimationActive={lastToggled === '總計' || lastToggled === null}
                animationDuration={500} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper >
  );
};

export default UserTrendChart;