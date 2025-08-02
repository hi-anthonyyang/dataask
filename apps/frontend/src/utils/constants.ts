// API endpoints
export const API_ENDPOINTS = {
  BASE_URL: (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:3001',
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
  },
  DATABASE: {
    TEST_CONNECTION: '/api/db/test-connection',
    CREATE_CONNECTION: '/api/db/create-connection',
    LIST_CONNECTIONS: '/api/db/list-connections',
    LIST_TABLES: '/api/db/list-tables',
    TABLE_METADATA: '/api/db/table-metadata',
    TABLE_PREVIEW: '/api/db/table-preview',
    EXECUTE_QUERY: '/api/db/execute-query',
  },
  LLM: {
    HEALTH: '/api/llm/health',
    CLASSIFY: '/api/llm/classify',
    GENERATE_SQL: '/api/llm/generate-sql',
    ANALYZE_RESULTS: '/api/llm/analyze-results',
  },
  FILES: {
    UPLOAD: '/api/files/upload',
    IMPORT: '/api/files/import',
  },
  USER_CONNECTIONS: {
    LIST: '/api/user/connections',
    CREATE: '/api/user/connections',
    UPDATE: '/api/user/connections',
    DELETE: '/api/user/connections',
  },
} as const;

// UI constants
export const UI_CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
  MAX_QUERY_RESULTS: 1000,
  DEFAULT_PAGE_SIZE: 50,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: ['.csv', '.xls', '.xlsx'],
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  CONNECTIONS: 'dataask_connections',
  CURRENT_CONNECTION: 'dataask_current_connection',
  QUERY_HISTORY: 'dataask_query_history',
  USER_PREFERENCES: 'dataask_preferences',
  ENCRYPTION_KEY: 'dataask-encryption-key',
  APP_STATE: 'dataask_app_state',
} as const;

// Database types
export const DATABASE_TYPES = {
  SQLITE: 'sqlite',
} as const;

// Query status
export const QUERY_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Failed to connect to database',
  QUERY_FAILED: 'Failed to execute query',
  INVALID_CREDENTIALS: 'Invalid username or password',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed size',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload a CSV, XLS, or XLSX file.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  CONNECTION_CREATED: 'Connection created successfully',
  CONNECTION_UPDATED: 'Connection updated successfully',
  CONNECTION_DELETED: 'Connection deleted successfully',
  QUERY_EXECUTED: 'Query executed successfully',
  FILE_IMPORTED: 'File imported successfully',
} as const;

// Chart colors
export const CHART_COLORS = {
  PRIMARY: '#3b82f6',
  SECONDARY: '#8b5cf6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  PALETTE: [
    '#3b82f6',
    '#8b5cf6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#6366f1',
  ],
} as const;

// Animation durations
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;