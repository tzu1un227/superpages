import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

// Mock child components to prevent deep rendering and focus test on Dashboard
jest.mock('../components/UserTrendChart', () => () => <div data-testid="user-trend-chart" />);
jest.mock('../components/KeywordRankingChart', () => () => <div data-testid="keyword-ranking-chart" />);

describe('Dashboard', () => {
  it('renders filter controls and charts', () => {
    render(<Dashboard />);

    // Check for filter controls
    expect(screen.getByText('篩選條件')).toBeInTheDocument();
    expect(screen.getByLabelText('週期')).toBeInTheDocument();
    expect(screen.getByLabelText('期間開始')).toBeInTheDocument();
    expect(screen.getByLabelText('期間結束')).toBeInTheDocument();

    // Check that child components are rendered
    expect(screen.getByTestId('user-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('keyword-ranking-chart')).toBeInTheDocument();
  });
});
