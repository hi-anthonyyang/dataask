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

// Development mode bypass - REMOVE IN PRODUCTION
const DEV_MODE_BYPASS = process.env.NODE_ENV === 'development' && window.location.search.includes('devmode=true');
const DEV_USER: User = {
  id: 'dev-user-123',
  email: 'dev@example.com',
  role: 'admin'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEV_MODE_BYPASS ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(!DEV_MODE_BYPASS);

  useEffect(() => {
    if (!DEV_MODE_BYPASS) {
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
    if (DEV_MODE_BYPASS) {
      setUser(DEV_USER);
      return;
    }
    const user = await authService.login(email, password);
    setUser(user);
  };

  const register = async (email: string, password: string, name?: string) => {
    if (DEV_MODE_BYPASS) {
      setUser(DEV_USER);
      return;
    }
    const user = await authService.register(email, password, name);
    setUser(user);
  };

  const logout = async () => {
    if (!DEV_MODE_BYPASS) {
      await authService.logout();
    }
    setUser(null);
  };

  const refreshAuth = async () => {
    if (DEV_MODE_BYPASS) return;
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