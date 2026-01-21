import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import KeywordRankingChart from './KeywordRankingChart';

// Mock axios
jest.mock('axios');

describe('KeywordRankingChart', () => {
  const mockAvailableTags = ['tagA', 'tagB'];
  const mockInitialData = { data: [{ keyword: 'initial', count: 100 }] };
  const mockNewData = { data: [{ keyword: 'filtered', count: 50 }] };

  beforeEach(() => {
    // Reset mocks before each test
    axios.get.mockClear();
  });

  it('renders dropdown with tags and fetches initial data', async () => {
    axios.get.mockResolvedValue({ data: mockInitialData });

    render(
      <KeywordRankingChart
        startDate="2025-01-01"
        endDate="2025-01-31"
        availableTags={mockAvailableTags}
      />
    );

    // Wait for the initial fetch to complete
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    // Check that initial data is fetched with no tag
    expect(axios.get).toHaveBeenCalledWith('/dashboard/responses', {
      params: {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        tag: '',
        limit: 50
      }
    });

    // Check that the dropdown is rendered
    const dropdown = screen.getByLabelText('使用者標籤');
    expect(dropdown).toBeInTheDocument();

    // Open the dropdown to check options
    fireEvent.mouseDown(dropdown);

    // Check for "All" option and other tags
    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('tagA')).toBeInTheDocument();
      expect(screen.getByText('tagB')).toBeInTheDocument();
    });
  });

  it('fetches new data when a tag is selected from the dropdown', async () => {
    // Initial fetch
    axios.get.mockResolvedValueOnce({ data: mockInitialData });

    render(
      <KeywordRankingChart
        startDate="2025-01-01"
        endDate="2025-01-31"
        availableTags={mockAvailableTags}
      />
    );

    // Wait for the initial render and fetch
    await waitFor(() => {
      expect(screen.getByText('initial')).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledTimes(1);

    // Setup mock for the second fetch
    axios.get.mockResolvedValueOnce({ data: mockNewData });

    // Simulate user selecting a new tag
    const dropdown = screen.getByLabelText('使用者標籤');
    fireEvent.mouseDown(dropdown);
    const option = await screen.findByText('tagA');
    fireEvent.click(option);


    // Wait for the second fetch to complete
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    // Check that the second call was made with the correct tag
    expect(axios.get).toHaveBeenLastCalledWith('/dashboard/responses', {
      params: {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        tag: 'tagA',
        limit: 50
      }
    });

    // Check that the UI updates with the new data
    await waitFor(() => {
      expect(screen.getByText('filtered')).toBeInTheDocument();
      expect(screen.queryByText('initial')).not.toBeInTheDocument();
    });
  });
});
