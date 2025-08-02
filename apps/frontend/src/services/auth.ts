import { API_BASE_URL } from '../config';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

interface AuthResponse extends AuthTokens {
  user?: User;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load tokens from localStorage on initialization
    this.loadFromStorage();
  }

  // Static validation methods
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
    }
    return { isValid: true };
  }

  private loadFromStorage(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from storage:', e);
      }
    }
  }

  private saveToStorage(): void {
    if (this.accessToken) {
      localStorage.setItem('accessToken', this.accessToken);
    } else {
      localStorage.removeItem('accessToken');
    }

    if (this.refreshToken) {
      localStorage.setItem('refreshToken', this.refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }

    if (this.user) {
      localStorage.setItem('user', JSON.stringify(this.user));
    } else {
      localStorage.removeItem('user');
    }
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data: AuthResponse = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken || null;
    this.user = data.user || null;
    this.saveToStorage();

    return this.user!;
  }

  async login(email: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: AuthTokens = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken || null;

    // Get user info
    await this.fetchCurrentUser();
    this.saveToStorage();

    return this.user!;
  }

  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.saveToStorage();
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      // Clear auth state on refresh failure
      this.logout();
      throw new Error('Token refresh failed');
    }

    const data: { accessToken: string } = await response.json();
    this.accessToken = data.accessToken;
    this.saveToStorage();

    return data.accessToken;
  }

  async fetchCurrentUser(): Promise<User | null> {
    if (!this.accessToken) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        try {
          await this.refreshAccessToken();
          // Retry the request
          return this.fetchCurrentUser();
        } catch (error) {
          this.logout();
          return null;
        }
      }
      throw new Error('Failed to fetch user');
    }

    const data = await response.json();
    this.user = data.user;
    this.saveToStorage();

    return this.user;
  }

  getAuthHeaders(): Record<string, string> {
    if (!this.accessToken) {
      return {};
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
    };
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Helper method to make authenticated requests
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders(),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        // Retry the request with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...this.getAuthHeaders(),
          },
        });
      } catch (error) {
        // Refresh failed, logout
        this.logout();
        throw new Error('Authentication failed');
      }
    }

    return response;
  }
}

// Export singleton instance
export const authService = new AuthService();

// Export class for testing
export { AuthService };