import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { dbRouter } from './api/db';
import { llmRouter } from './api/llm';
import { createAuthRouter } from './api/auth';
import { createUserConnectionsRouter } from './api/userConnections';
import filesRouter from './api/files';
import { logger } from './utils/logger';
import { applyRateLimiting, healthCheck } from './security/rateLimiter';
import { MigrationRunner } from './utils/migrations';
import { optionalAuth } from './utils/auth';
import { 
  DB_CONSTANTS, 
  API_MESSAGES, 
  SERVER_CONFIG, 
  APP_INFO, 
  HEALTH_CHECK 
} from './utils/constants';

// Create database pool for user management
const createDatabasePool = (): Pool | null => {
  // Skip database pool creation if migrations are disabled and no host is configured
  if (!process.env.POSTGRES_HOST && process.env.SKIP_MIGRATIONS === 'true') {
    logger.info('Skipping database pool creation (no POSTGRES_HOST and SKIP_MIGRATIONS=true)');
    return null;
  }
  
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || DB_CONSTANTS.DEFAULT_HOST,
    port: parseInt(process.env.POSTGRES_PORT || String(DB_CONSTANTS.DEFAULT_PORT.POSTGRESQL)),
    database: process.env.POSTGRES_DB || DB_CONSTANTS.DEFAULT_DATABASE,
    user: process.env.POSTGRES_USER || DB_CONSTANTS.DEFAULT_USER,
    password: process.env.POSTGRES_PASSWORD || DB_CONSTANTS.DEFAULT_PASSWORD,
    max: DB_CONSTANTS.POOL.MAX_CONNECTIONS,
    idleTimeoutMillis: DB_CONSTANTS.POOL.IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_CONSTANTS.POOL.CONNECTION_TIMEOUT_MS,
    // SSL configuration for production
    ssl: process.env.NODE_ENV === APP_INFO.ENVIRONMENT.PRODUCTION ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    } : process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: false // Allow self-signed certs in development
    } : false
  });

  return pool;
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
    const migrationRunner = new MigrationRunner(dbPool);
    await migrationRunner.runMigrations();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run database migrations:', error);
    // Don't exit the process, just log the error
    // This allows the app to start even if migrations fail
  }
};

// Initialize migrations (don't await to avoid blocking startup)
runMigrations();

const app = express();

// Security middleware
app.use(helmet());

// Cookie parser for authentication
app.use(cookieParser());

// Enhanced rate limiting with different limits for different endpoints
app.use(applyRateLimiting);

// CORS configuration with credentials support
const corsOptions = {
  origin: process.env.CORS_ORIGIN || SERVER_CONFIG.DEFAULT_CORS_ORIGIN,
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
app.use('/api/auth', createAuthRouter(dbPool!));
app.use('/api/user/connections', createUserConnectionsRouter(dbPool!));
app.use('/api/db', optionalAuth, dbRouter); // Make db routes optionally authenticated
app.use('/api/llm', optionalAuth, llmRouter); // Make llm routes optionally authenticated
app.use('/api/files', optionalAuth, filesRouter); // File import routes

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