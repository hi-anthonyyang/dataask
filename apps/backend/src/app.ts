import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { dbRouter } from './api/db';
import { llmRouter } from './api/llm';
import { logger } from './utils/logger';
import { applyRateLimiting, healthCheck } from './security/rateLimiter';

const app = express();

// Security middleware
app.use(helmet());

// Enhanced rate limiting with different limits for different endpoints
app.use(applyRateLimiting);

// CORS configuration
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

// API routes
app.use('/api/db', dbRouter);
app.use('/api/llm', llmRouter);

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

// Enhanced health check endpoint with rate limit configuration
app.get('/health', healthCheck);

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