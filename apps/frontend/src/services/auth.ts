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
      const response = await fetch(`${this.baseUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      this.user = result.user;
      this.notifyListeners();

      return result;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      this.user = result.user;
      this.notifyListeners();

      return result;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies
      });

      this.user = null;
      this.notifyListeners();
    } catch (error) {
      console.error('Logout failed:', error);
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
      const response = await fetch(`${this.baseUrl}/me`, {
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry getting current user
            return this.getCurrentUser();
          }
        }
        this.user = null;
        this.notifyListeners();
        return null;
      }

      const result = await response.json();
      this.user = result.user;
      this.notifyListeners();

      return result.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
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
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        credentials: 'include', // Include cookies
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
      console.error('Token refresh failed:', error);
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

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
export type { User, AuthResponse, RegisterData, LoginData, AuthError };