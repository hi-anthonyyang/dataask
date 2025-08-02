import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { applyRateLimiting } from '../security/rateLimiter';
import { 
  handleZodError,
  sendBadRequest,
  sendUnauthorized,
  sendServerError
} from '../utils/errors';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string()
});

// Apply rate limiting to auth endpoints
applyRateLimiting(router, '/register', { max: 5, windowMs: 15 * 60 * 1000 }); // 5 requests per 15 minutes
applyRateLimiting(router, '/login', { max: 10, windowMs: 15 * 60 * 1000 }); // 10 requests per 15 minutes

// Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const validationResult = RegisterSchema.safeParse(req.body);
    if (!validationResult.success) {
      return handleZodError(res, validationResult.error);
    }

    const { email, password, name } = validationResult.data;
    const authService = AuthService.getInstance();

    try {
      const user = await authService.register(email, password, name);
      const tokens = await authService.login(email, password, req.ip, req.get('user-agent'));

      logger.info(`User registered: ${email}`);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        ...tokens
      });
    } catch (error: any) {
      if (error.message === 'User already exists') {
        return res.status(409).json({ error: 'User already exists' });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Registration error:', error);
    sendServerError(res, 'Registration failed');
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const validationResult = LoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return handleZodError(res, validationResult.error);
    }

    const { email, password } = validationResult.data;
    const authService = AuthService.getInstance();

    try {
      const tokens = await authService.login(
        email, 
        password, 
        req.ip, 
        req.get('user-agent')
      );

      logger.info(`User logged in: ${email}`);

      res.json(tokens);
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        return sendUnauthorized(res, 'Invalid credentials');
      }
      throw error;
    }
  } catch (error) {
    logger.error('Login error:', error);
    sendServerError(res, 'Login failed');
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const validationResult = RefreshTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      return handleZodError(res, validationResult.error);
    }

    const { refreshToken } = validationResult.data;
    const authService = AuthService.getInstance();

    try {
      const { accessToken } = await authService.refreshAccessToken(refreshToken);
      res.json({ accessToken });
    } catch (error: any) {
      if (error.message.includes('Invalid or expired refresh token')) {
        return sendUnauthorized(res, 'Invalid or expired refresh token');
      }
      throw error;
    }
  } catch (error) {
    logger.error('Token refresh error:', error);
    sendServerError(res, 'Token refresh failed');
  }
});

// Logout endpoint (requires authentication)
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res, 'Not authenticated');
    }

    const refreshToken = req.body.refreshToken;
    const authService = AuthService.getInstance();

    await authService.logout(req.user.id, refreshToken);

    logger.info(`User logged out: ${req.user.email}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    sendServerError(res, 'Logout failed');
  }
});

// Get current user endpoint (requires authentication)
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res, 'Not authenticated');
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    logger.error('Get user error:', error);
    sendServerError(res, 'Failed to get user information');
  }
});

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

export default router;