import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { TOKEN_EXPIRY } from './constants';

export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  email_verified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// JWT Configuration
// Note: These secrets should be set via environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';

export class AuthService {
  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    // Using 12 salt rounds for high security - balances security and performance
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access and refresh tokens
   */
  static generateTokens(user: Pick<User, 'id' | 'email'>): AuthTokens {
    const accessPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      type: 'access'
    };

    const refreshPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN,
      issuer: 'dataask',
      audience: 'dataask-users'
    });

    const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
      expiresIn: TOKEN_EXPIRY.REFRESH_TOKEN,
      issuer: 'dataask',
      audience: 'dataask-users'
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET, {
        issuer: 'dataask',
        audience: 'dataask-users'
      }) as JWTPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'dataask',
        audience: 'dataask-users'
      }) as JWTPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Generate secure random token for email verification/password reset
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Set authentication cookies
   */
  static setAuthCookies(res: Response, tokens: AuthTokens): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (short-lived)
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    // Refresh token cookie (longer-lived)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth'
    });
  }

  /**
   * Clear authentication cookies
   */
  static clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });
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
  static isValidPassword(password: string): { valid: boolean; errors: string[] } {
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

/**
 * Authentication middleware
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to get token from cookies first, then Authorization header
    let token = req.cookies.accessToken;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const payload = AuthService.verifyAccessToken(token);
    
    // Add user info to request (you'd typically fetch full user from DB here)
    req.user = {
      id: payload.userId,
      email: payload.email,
      created_at: new Date(),
      updated_at: new Date(),
      email_verified: true
    };

    next();
  } catch (error) {
    logger.warn('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies.accessToken;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      const payload = AuthService.verifyAccessToken(token);
      req.user = {
        id: payload.userId,
        email: payload.email,
        created_at: new Date(),
        updated_at: new Date(),
        email_verified: true
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};