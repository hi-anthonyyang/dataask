// Database connection constants
export const DB_CONSTANTS = {
  CONNECTION_TIMEOUT_MS: 10000,
} as const;

// API response messages
export const API_MESSAGES = {
  CONNECTION_SUCCESS: 'Connection successful',
  CONNECTION_FAILED: 'Connection failed',
  INVALID_PARAMS: 'Invalid connection parameters',
  INTERNAL_ERROR: 'Internal Server Error',
  ROUTE_NOT_FOUND: 'Route not found',
  DB_CONNECTION_FAILED: 'Database connection failed',
} as const;

// Server configuration
export const SERVER_CONFIG = {
  DEFAULT_PORT: 3001,
  JSON_LIMIT: '50mb',
  CORS_SUCCESS_STATUS: 200,
  DEFAULT_CORS_ORIGIN: ['http://localhost:3000', 'http://localhost:5173'],
} as const;

// Application metadata
export const APP_INFO = {
  NAME: 'DataAsk Backend API',
  VERSION: '1.0.0',
  STATUS: 'Running',
  ENVIRONMENT: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
  },
} as const;

// Health check constants
export const HEALTH_CHECK = {
  STATUS: {
    OK: 'OK',
    ERROR: 'ERROR',
  },
  SERVICE: {
    DATABASE: 'Database',
  },
} as const;

// Query validation limits
export const QUERY_LIMITS = {
  MIN_QUERY_LENGTH: 1,
  MAX_PREVIEW_ROWS: 1000,
  DEFAULT_PREVIEW_ROWS: 100,
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_EXTENSIONS: ['.csv', '.xls', '.xlsx'],
} as const;

// JWT token expiration
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
} as const;

// LLM Model configuration for cost optimization
export const LLM_MODEL_CONFIG = {
  CLASSIFICATION: 'gpt-4o-mini',     // Simple JSON output - 95% cheaper
  NL_TO_SQL: 'gpt-4o',               // Needs accuracy - 83% cheaper  
  ANALYSIS: 'gpt-4o',                // Needs quality - 83% cheaper
  SUMMARIZATION: 'gpt-3.5-turbo'     // Short outputs - 92% cheaper
} as const;

// LLM API messages
export const LLM_MESSAGES = {
  API_KEY_NOT_CONFIGURED: 'OpenAI API key not configured or invalid. Please set a valid OPENAI_API_KEY in your environment variables.',
  API_KEY_PLACEHOLDER: 'OpenAI API key not configured or using placeholder key',
  API_READY: 'OpenAI API is ready',
  CONFIGURE_API_KEY: 'Please configure a valid OPENAI_API_KEY environment variable',
  CLIENT_NOT_INITIALIZED: 'OpenAI client not initialized',
} as const;