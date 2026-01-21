import { apiCall, fetchUserTrend, fetchResponses } from './api';

// Mock localStorage
describe('api', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch.mockRestore();
  });

  test('apiCall includes JWT in headers when available', async () => {
    localStorage.setItem('jwt', 'test_token');
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await apiCall('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test_token',
        }),
      })
    );
  });

  test('apiCall handles 401 by redirecting to login', async () => {
    // Mock window.location
    delete global.window.location;
    global.window.location = { href: '' };

    global.fetch.mockResolvedValue({
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    await expect(apiCall('/test')).rejects.toThrow('Unauthorized');
    expect(global.window.location.href).toBe('/login');
    expect(localStorage.getItem('jwt')).toBeNull();
  });

  test('fetchUserTrend calls correct endpoint with params', async () => {
    localStorage.setItem('jwt', 'test_token');
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await fetchUserTrend({ period: '週', start_date: '2023-01-01', end_date: '2023-01-31' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/dashboard/user_trend?period=週&start_date=2023-01-01&end_date=2023-01-31',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test_token',
        }),
      })
    );
  });

  test('fetchResponses calls correct endpoint with params', async () => {
    localStorage.setItem('jwt', 'test_token');
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await fetchResponses({ start_date: '2023-01-01', end_date: '2023-01-31' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/dashboard/responses?start_date=2023-01-01&end_date=2023-01-31',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test_token',
        }),
      })
    );
  });
});