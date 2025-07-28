import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Rate limit configuration from environment variables
const RATE_LIMIT_AI = parseInt(process.env.RATE_LIMIT_AI || '20');
const RATE_LIMIT_DB = parseInt(process.env.RATE_LIMIT_DB || '60');
const RATE_LIMIT_GENERAL = parseInt(process.env.RATE_LIMIT_GENERAL || '100');
const WINDOW_MINUTES = 15;

// Create rate limiters for different endpoint types
const createRateLimiter = (maxRequests: number, endpointType: string) => {
  return rateLimit({
    windowMs: WINDOW_MINUTES * 60 * 1000, // 15 minutes
    max: maxRequests,
    message: { 
      error: `Rate limit exceeded for ${endpointType} endpoints. Please try again later.`,
      limit: maxRequests,
      windowMinutes: WINDOW_MINUTES
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const violation = {
        level: 'warn',
        message: 'Rate limit exceeded',
        ip: req.ip,
        path: req.path,
        limit: maxRequests,
        windowMinutes: WINDOW_MINUTES,
        endpointType
      };
      
      logger.warn('Rate limit violation:', violation);
      
      res.status(429).json({
        error: `Rate limit exceeded for ${endpointType} endpoints`,
        limit: maxRequests,
        windowMinutes: WINDOW_MINUTES,
        retryAfter: Math.ceil(WINDOW_MINUTES * 60)
      });
    },
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip || 'unknown')
  });
};

// Create specific rate limiters
export const aiRateLimiter = createRateLimiter(RATE_LIMIT_AI, 'AI');
export const dbRateLimiter = createRateLimiter(RATE_LIMIT_DB, 'database');
export const generalRateLimiter = createRateLimiter(RATE_LIMIT_GENERAL, 'general');

// Middleware to apply rate limiting based on route
export const applyRateLimiting = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  // AI endpoints (LLM-related)
  if (path.startsWith('/api/llm')) {
    return aiRateLimiter(req, res, next);
  }
  
  // Database endpoints
  if (path.startsWith('/api/db')) {
    return dbRateLimiter(req, res, next);
  }
  
  // General endpoints (health, root, etc.)
  return generalRateLimiter(req, res, next);
};

// Get current rate limit configuration
export const getRateLimitConfig = () => ({
  ai: `${RATE_LIMIT_AI} requests per ${WINDOW_MINUTES} minutes`,
  database: `${RATE_LIMIT_DB} requests per ${WINDOW_MINUTES} minutes`,
  general: `${RATE_LIMIT_GENERAL} requests per ${WINDOW_MINUTES} minutes`
});

// Health check endpoint that shows current rate limit configuration
export const healthCheck = (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    rateLimits: getRateLimitConfig()
  });
}; 