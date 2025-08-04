import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { dbRouter } from './api/db';
import { llmRouter } from './api/llm';
import authRouter from './api/auth';
import { createUserConnectionsRouter } from './api/user-connections';
import filesRouter from './api/files';
import { logger } from './utils/logger';
import { applyRateLimiting, healthCheck } from './security/rateLimiter';
import { AuthService } from './services/authService';
import { 
  DB_CONSTANTS, 
  API_MESSAGES, 
  SERVER_CONFIG, 
  APP_INFO, 
  HEALTH_CHECK 
} from './utils/constants';

// Create database pool for user management
const createDatabasePool = (): any | null => {
  // User authentication is currently disabled
  logger.info('User authentication is currently disabled');
  return null;
};

// Initialize database pool
const dbPool = createDatabasePool();

// Run migrations on startup
const runMigrations = async (): Promise<void> => {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    logger.info('Skipping database migrations (SKIP_MIGRATIONS=true)');
    return;
  }
  
  if (!dbPool) {
    logger.warn('Cannot run migrations: database pool not initialized');
    return;
  }
  
  try {
    // Migrations are not needed for SQLite-only setup
    logger.info('SQLite-only setup - no migrations needed');
  } catch (error) {
    logger.error('Failed to run database migrations:', error);
    // Don't exit the process, just log the error
    // This allows the app to start even if migrations fail
  }
};

// Initialize auth service
const initializeAuth = async () => {
  try {
    const authService = AuthService.getInstance();
    await authService.initialize();
    logger.info('Auth service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize auth service:', error);
  }
};

const app = express();

// Create async initialization function
export const initializeApp = async () => {
  // Initialize auth service before starting the server
  await initializeAuth();
  return app;
};

// Security middleware
app.use(helmet());

// Cookie parser for authentication
app.use(cookieParser());

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
app.use('/api/auth', authRouter);
app.use('/api/user/connections', createUserConnectionsRouter(dbPool!));
app.use('/api/db', dbRouter);
app.use('/api/llm', llmRouter);
app.use('/api/files', filesRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: APP_INFO.NAME,
    version: APP_INFO.VERSION,
    status: APP_INFO.STATUS,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || APP_INFO.ENVIRONMENT.DEVELOPMENT,
    features: {
      authentication: true,
      userConnections: true,
      databaseAnalysis: true,
      aiPoweredQueries: true
    },
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      userConnections: '/api/user/connections/*',
      database: '/api/db/*',
      llm: '/api/llm/*',
      files: '/api/files/*'
    }
  });
});

// Enhanced health check endpoint with rate limit configuration
app.get('/health', healthCheck);

// Database health check
app.get('/health/db', async (req, res) => {
  if (!dbPool) {
    return res.status(503).json({
      status: HEALTH_CHECK.STATUS.ERROR,
      service: HEALTH_CHECK.SERVICE.DATABASE,
      error: 'Database pool not initialized',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    await dbPool.query('SELECT 1');
    res.json({
      status: HEALTH_CHECK.STATUS.OK,
      service: HEALTH_CHECK.SERVICE.DATABASE,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: HEALTH_CHECK.STATUS.ERROR,
      service: HEALTH_CHECK.SERVICE.DATABASE,
      error: API_MESSAGES.DB_CONNECTION_FAILED,
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