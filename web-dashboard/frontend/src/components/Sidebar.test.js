import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

// Mock the useAuth hook
jest.mock('../contexts/AuthContext');

// A minimal theme to prevent errors from useTheme
const theme = createTheme({
  palette: {
    neutral: { dark: '#000', main: '#ccc', light: '#fff' },
    common: { white: '#fff' },
    secondary: { main: '#f00', dark: '#d00' },
  },
});

const renderWithProviders = (ui) => {
  return render(
    <ThemeProvider theme={theme}>
      <Router>{ui}</Router>
    </ThemeProvider>
  );
};

describe('Sidebar', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and links when unauthenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Line-Bot 視覺化')).toBeInTheDocument();
    expect(screen.getByText('儀表板')).toBeInTheDocument();

    // User info and logout button should not be present
    expect(screen.queryByText('登出')).not.toBeInTheDocument();
  });

  it('renders user info and logout button when authenticated', () => {
    const mockLogout = jest.fn();
    const mockUser = { name: 'Test User', email: 'test@example.com' };
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      logout: mockLogout,
    });

    renderWithProviders(<Sidebar />);

    // Title and links should still be there
    expect(screen.getByText('Line-Bot 視覺化')).toBeInTheDocument();
    expect(screen.getByText('儀表板')).toBeInTheDocument();

    // User info and logout should be present
    expect(screen.getByText('Test User')).toBeInTheDocument();
    const logoutButton = screen.getByRole('button', { name: '登出' });
    expect(logoutButton).toBeInTheDocument();

    // Clicking logout button calls the logout function
    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('displays email when user name is not available', () => {
    const mockLogout = jest.fn();
    const mockUser = { email: 'test@example.com' }; // No name
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: mockUser,
      logout: mockLogout,
    });

    renderWithProviders(<Sidebar />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
