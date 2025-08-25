/**
 * Authentication service stub
 * 
 * Authentication is currently disabled in DataAsk.
 * This service provides stub implementations to maintain
 * compatibility with existing auth-related components.
 */

interface User {
  id: string;
  email: string;
  role: string;
}

export class AuthService {
  // Stub implementation - authentication is disabled
  async getCurrentUser(): Promise<User | null> {
    // Return null to indicate no authenticated user
    return null;
  }

  async login(email: string, password: string): Promise<User> {
    throw new Error('Authentication is currently disabled');
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    throw new Error('Authentication is currently disabled');
  }

  async logout(): Promise<void> {
    // No-op since authentication is disabled
  }

  async authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
    // Pass through to regular fetch since auth is disabled
    return fetch(url, {
      ...options,
      credentials: 'include' // Include cookies for session management
    });
  }

  // Validation helpers for compatibility
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
