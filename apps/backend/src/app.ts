import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { llmRouter } from './api/llm';

import filesRouter from './api/files';
import dataframesRouter from './api/dataframes';
import { logger } from './utils/logger';
import { applyRateLimiting, healthCheck } from './security/rateLimiter';

import { 
  API_MESSAGES, 
  SERVER_CONFIG, 
  APP_INFO, 
  HEALTH_CHECK 
} from './utils/constants';

// DataAsk uses in-memory DataFrameManager for data storage
// No database setup required



const app = express();

// Create async initialization function
export const initializeApp = async () => {
  return app;
};

// Security middleware
app.use(helmet());



// Enhanced rate limiting with different limits for different endpoints
app.use(applyRateLimiting);

// CORS configuration with credentials support
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN || 'http://localhost:3000')
    : true, // Allow all origins in development
  credentials: true, // Enable credentials for cookie authentication
  optionsSuccessStatus: SERVER_CONFIG.CORS_SUCCESS_STATUS,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: SERVER_CONFIG.JSON_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API routes
app.use('/api/llm', llmRouter);
app.use('/api/files', filesRouter);
app.use('/api/dataframes', dataframesRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: APP_INFO.NAME,
    version: APP_INFO.VERSION,
    status: APP_INFO.STATUS,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || APP_INFO.ENVIRONMENT.DEVELOPMENT,
    features: {
      fileAnalysis: true,
      aiPoweredQueries: true
    },
    endpoints: {
      health: '/health',
      llm: '/api/llm/*',
      files: '/api/files/*',
      dataframes: '/api/dataframes/*'
    }
  });
});

// Health check endpoint
app.get('/health', healthCheck);

// API health check endpoint (for compatibility)
app.get('/api/health', healthCheck);

// DataFrameManager health check
app.get('/health/dataframes', async (req, res) => {
  try {
    const dfManager = (await import('./utils/dataFrameManager')).DataFrameManager.getInstance();
    const dataframes = dfManager.listDataFrames();
    
    res.json({
      status: HEALTH_CHECK.STATUS.OK,
      service: 'DataFrameManager',
      dataframes_count: dataframes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('DataFrameManager health check failed:', error);
    res.status(503).json({
      status: HEALTH_CHECK.STATUS.ERROR,
      service: 'DataFrameManager',
      error: 'DataFrameManager unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handler
app.use((err: Error & { statusCode?: number; status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === APP_INFO.ENVIRONMENT.PRODUCTION 
    ? API_MESSAGES.INTERNAL_ERROR 
    : err.message || 'Something went wrong';

  res.status(err.status || 500).json({
    error: message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: API_MESSAGES.ROUTE_NOT_FOUND,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (dbPool) {
    await dbPool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (dbPool) {
    await dbPool.end();
  }
  process.exit(0);
});

export { app, dbPool }; 