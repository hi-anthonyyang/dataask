import { handleAuthError, logInfo } from './error';
import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../utils/constants';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_login?: string;
  email_verified: boolean;
}

interface AuthResponse {
  user: User;
  message?: string;
}

interface RegisterData {
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthError {
  error: string;
  details?: string[];
}

class AuthService {
  private baseUrl = '/api/auth';
  private user: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Set up the refresh token function for the API client
    apiClient.setRefreshTokenFunction(() => this.refreshToken());
  }

  /**
   * Add listener for authentication state changes
   */
  onAuthStateChange(listener: (user: User | null) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.user));
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const result = await apiClient.post<AuthResponse>(
        `${this.baseUrl}/register`,
        data
      );

      this.user = result.user;
      this.notifyListeners();

      return result;
    } catch (error) {
      const message = handleAuthError(error, 'registration');
      throw new Error(message);
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const result = await apiClient.post<AuthResponse>(
        `${this.baseUrl}/login`,
        data
      );

      this.user = result.user;
      this.notifyListeners();

      return result;
    } catch (error) {
      const message = handleAuthError(error, 'login');
      throw new Error(message);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/logout`);

      this.user = null;
      this.notifyListeners();
    } catch (error) {
      handleAuthError(error, 'logout');
      // Still clear local state even if server logout fails
      this.user = null;
      this.notifyListeners();
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const result = await apiClient.get<{ user: User }>(`${this.baseUrl}/me`);
      this.user = result.user;
      this.notifyListeners();
      return result.user;
    } catch (error) {
      handleAuthError(error, 'get current user');
      this.user = null;
      this.notifyListeners();
      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      // Use the base api service to avoid infinite recursion
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        this.user = null;
        this.notifyListeners();
        return false;
      }

      const result = await response.json();
      this.user = result.user;
      this.notifyListeners();

      return true;
    } catch (error) {
      handleAuthError(error, 'token refresh');
      this.user = null;
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Get current user (synchronous)
   */
  getUser(): User | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.user !== null;
  }

  /**
   * Initialize auth service (call on app startup)
   */
  async initialize(): Promise<void> {
    await this.getCurrentUser();
  }

  /**
   * Make authenticated API request
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always include cookies
    });

    // If unauthorized, try to refresh token
    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry the original request
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      }
    }

    return response;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance and class
export const authService = new AuthService();
export { AuthService };
export type { User, AuthResponse, RegisterData, LoginData, AuthError };