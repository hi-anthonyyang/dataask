import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { dbRouter } from './api/db';
import { llmRouter } from './api/llm';
import { logger } from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - should come early
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Rate limiting configuration
const RATE_LIMITS = {
  ai: parseInt(process.env.RATE_LIMIT_AI || '20'),
  db: parseInt(process.env.RATE_LIMIT_DB || '60'), 
  general: parseInt(process.env.RATE_LIMIT_GENERAL || '100'),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') // 15 minutes
};

// Rate limiting helper
const createLimiter = (max: number, windowMs: number = RATE_LIMITS.windowMs, message?: string) => 
  rateLimit({
    windowMs,
    max,
    message: { error: message || 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    onLimitReached: (req) => {
      logger.warn('Rate limit exceeded', { 
        ip: req.ip, 
        path: req.path,
        limit: max,
        windowMinutes: windowMs / (60 * 1000)
      });
    }
  });

// AI endpoints - strict limits (expensive)
const aiLimiter = createLimiter(
  RATE_LIMITS.ai, 
  RATE_LIMITS.windowMs, 
  'Too many AI requests. Please wait before trying again.'
);

// Database endpoints - moderate limits  
const dbLimiter = createLimiter(
  RATE_LIMITS.db,
  RATE_LIMITS.windowMs,
  'Too many database requests. Please wait before trying again.'
);

// General endpoints - generous limits for everything else
const generalLimiter = createLimiter(RATE_LIMITS.general);

// Apply specific rate limiting to API routes
app.use('/api/llm', aiLimiter, llmRouter);
app.use('/api/db', dbLimiter, dbRouter);

// Apply general rate limiting to all other routes
app.use(generalLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'DataAsk Backend API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      database: '/api/db/*',
      llm: '/api/llm/*'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    rateLimits: {
      ai: `${RATE_LIMITS.ai} requests per ${RATE_LIMITS.windowMs / (60 * 1000)} minutes`,
      database: `${RATE_LIMITS.db} requests per ${RATE_LIMITS.windowMs / (60 * 1000)} minutes`,
      general: `${RATE_LIMITS.general} requests per ${RATE_LIMITS.windowMs / (60 * 1000)} minutes`
    }
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message || 'Something went wrong';

  res.status(err.status || 500).json({
    error: message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

export { app }; 