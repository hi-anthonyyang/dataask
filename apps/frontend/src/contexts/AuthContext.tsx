import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Authentication is currently disabled in DataAsk
// This provider maintains compatibility with auth-dependent components
const AUTH_DISABLED = true;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!AUTH_DISABLED);

  useEffect(() => {
    if (!AUTH_DISABLED) {
      checkAuth();
    }
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    if (AUTH_DISABLED) {
      throw new Error('Authentication is currently disabled');
    }
    const user = await authService.login(email, password);
    setUser(user);
  };

  const register = async (email: string, password: string, name?: string) => {
    if (AUTH_DISABLED) {
      throw new Error('Authentication is currently disabled');
    }
    const user = await authService.register(email, password, name);
    setUser(user);
  };

  const logout = async () => {
    if (!AUTH_DISABLED) {
      await authService.logout();
    }
    setUser(null);
  };

  const refreshAuth = async () => {
    if (AUTH_DISABLED) return;
    await checkAuth();
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 