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

// Create database pool for user management
const createDatabasePool = (): Pool | null => {
  if (!process.env.POSTGRES_HOST && process.env.SKIP_MIGRATIONS === 'true') {
    logger.info('Skipping database pool creation (no POSTGRES_HOST and SKIP_MIGRATIONS=true)');
    return null;
  }
  
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'dataask_dev',
    user: process.env.POSTGRES_USER || 'dataask_user',
    password: process.env.POSTGRES_PASSWORD || 'dataask_dev_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
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
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Enable credentials for cookie authentication
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
app.use('/api/auth', createAuthRouter(dbPool));
app.use('/api/user/connections', createUserConnectionsRouter(dbPool));
app.use('/api/db', optionalAuth, dbRouter); // Make db routes optionally authenticated
app.use('/api/llm', optionalAuth, llmRouter); // Make llm routes optionally authenticated
app.use('/api/files', optionalAuth, filesRouter); // File import routes

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'DataAsk Backend API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
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
  try {
    await dbPool.query('SELECT 1');
    res.json({
      status: 'OK',
      service: 'Database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      service: 'Database',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await dbPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await dbPool.end();
  process.exit(0);
});

export { app, dbPool }; 