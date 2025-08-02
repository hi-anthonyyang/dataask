import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const authService = AuthService.getInstance();
    
    try {
      const user = await authService.verifyToken(token);
      req.user = user;
      next();
    } catch (error) {
      logger.warn('Invalid token attempt:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};

// Optional: middleware to attach user to request without requiring authentication
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const authService = AuthService.getInstance();
      
      try {
        const user = await authService.verifyToken(token);
        req.user = user;
      } catch (error) {
        // Invalid token, but continue without user
        logger.debug('Optional auth: invalid token');
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};