import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../../App'

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    loading: false,
  }),
}))

// Mock all the page components
vi.mock('../LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}))

vi.mock('../RegisterPage', () => ({
  default: () => <div data-testid="register-page">Register Page</div>,
}))

vi.mock('../DataAskApp', () => ({
  default: () => <div data-testid="dataask-app">DataAsk App</div>,
}))

vi.mock('../ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    
    // Since we're at root path and user is null, should redirect to login
    expect(screen.getByTestId('dataask-app')).toBeInTheDocument()
  })
})