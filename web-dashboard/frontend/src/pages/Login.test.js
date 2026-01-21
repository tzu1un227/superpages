import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import Login from './Login';

// Mock Google OAuth
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Mock the Google Login component
jest.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }) => (
    <button
      onClick={() => onSuccess({ credential: 'mock_credential' })}
      data-testid="google-login-button"
    >
      Google Login
    </button>
  ),
  GoogleOAuthProvider: ({ children }) => <div>{children}</div>,
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper function to render with providers
const renderWithProviders = (ui) => {
  return render(
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <Router>
          {ui}
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders login page with Google login button', () => {
    renderWithProviders(<Login />);

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Sign in with your Google account')).toBeInTheDocument();
    expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
  });

  test('successful login redirects to dashboard', async () => {
    // Mock successful login
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'jwt_token', user: { email: 'test@example.com' } }),
      })
    );

    renderWithProviders(<Login />);

    const googleButton = screen.getByTestId('google-login-button');
    act(() => {
      fireEvent.click(googleButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(localStorage.getItem('jwt')).toBe('jwt_token');

    global.fetch.mockRestore();
  });

  test('failed login shows error message', async () => {
    // Mock failed login
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Login failed' }),
      })
    );

    renderWithProviders(<Login />);

    const googleButton = screen.getByTestId('google-login-button');
    act(() => {
      fireEvent.click(googleButton);
    });

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
    expect(localStorage.getItem('jwt')).toBeNull();

    global.fetch.mockRestore();
  });
});