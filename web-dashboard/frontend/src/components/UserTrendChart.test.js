import React from 'react';
import { render, screen, act } from '@testing-library/react';
import axios from 'axios';
import UserTrendChart from './UserTrendChart';

// Mock axios
jest.mock('axios');

// Mock Recharts components to avoid complex rendering in jsdom
jest.mock('recharts', () => {
    const OriginalRecharts = jest.requireActual('recharts');
    return {
        ...OriginalRecharts,
        ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
        LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
        Line: () => <div />,
        XAxis: () => <div />,
        YAxis: () => <div />,
        CartesianGrid: () => <div />,
        Tooltip: () => <div />,
        Legend: () => <div />,
    };
});


describe('UserTrendChart', () => {
    it('fetches data and calls onTagsUpdate with extracted tags', async () => {
        const mockTags = ['tag1', 'tag2', 'tag3'];
        const mockData = [
            { tag: '2025-01-01', category: 'tag1', count: 10 },
            { tag: '2025-01-01', category: 'tag2', count: 5 },
            { tag: '2025-01-02', category: 'tag1', count: 12 },
            { tag: '2025-01-02', category: 'tag3', count: 8 },
        ];
        axios.get.mockResolvedValue({ data: mockData });

        const onTagsUpdate = jest.fn();

        await act(async () => {
            render(
                <UserTrendChart
                    selectedPeriod="週"
                    startDate="2025-01-01"
                    endDate="2025-01-07"
                    onTagsUpdate={onTagsUpdate}
                />
            );
        });

        // Verify that onTagsUpdate was called
        expect(onTagsUpdate).toHaveBeenCalledTimes(1);

        // Verify that it was called with the unique tags from the mock data
        // We use a Set to ignore order differences
        const expectedTags = new Set(mockTags);
        const actualTags = new Set(onTagsUpdate.mock.calls[0][0]);
        expect(actualTags).toEqual(expectedTags);
    });
});
