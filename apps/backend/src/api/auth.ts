import { Router } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { UserService, CreateUserData } from '../utils/userService';
import { AuthService, authenticateToken, AuthenticatedRequest } from '../utils/auth';
import { logger } from '../utils/logger';
import { applyRateLimiting } from '../security/rateLimiter';

const router = Router();

// Initialize user service (will be set in the factory function)
let userService: UserService;

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    // Create user
    const user = await userService.createUser({ email, password });

    // Generate tokens
    const tokens = AuthService.generateTokens(user);

    // Set secure cookies
    AuthService.setAuthCookies(res, tokens);

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        email_verified: user.email_verified
      },
      message: 'Registration successful'
    });

  } catch (error) {
    logger.error('Registration failed:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    }

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }
      
      if (error.message.includes('Password validation failed')) {
        return res.status(400).json({ error: error.message });
      }
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    // Authenticate user
    const user = await userService.authenticateUser(email, password);

    if (!user) {
      // Use generic message to prevent email enumeration
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const tokens = AuthService.generateTokens(user);

    // Set secure cookies
    AuthService.setAuthCookies(res, tokens);

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        last_login: user.last_login,
        email_verified: user.email_verified
      },
      message: 'Login successful'
    });

  } catch (error) {
    logger.error('Login failed:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    // Clear authentication cookies
    AuthService.clearAuthCookies(res);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Token refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const payload = AuthService.verifyRefreshToken(refreshToken);

    // Get user from database
    const user = await userService.getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new tokens
    const tokens = AuthService.generateTokens(user);

    // Set new cookies
    AuthService.setAuthCookies(res, tokens);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified
      },
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    logger.error('Token refresh failed:', error);
    
    // Clear cookies on refresh failure
    AuthService.clearAuthCookies(res);
    
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Get current user endpoint
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get fresh user data from database
    const user = await userService.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login,
        email_verified: user.email_verified
      }
    });

  } catch (error) {
    logger.error('Get user failed:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// Health check for auth service
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Authentication',
    timestamp: new Date().toISOString()
  });
});

// Factory function to create router with dependencies
export const createAuthRouter = (pool: Pool): Router => {
  userService = new UserService(pool);
  return router;
};

export { router as authRouter };