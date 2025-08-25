// DataAsk uses DataFrameManager for in-memory data processing
// API endpoints are defined directly in service files where needed

// API Configuration
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// UI constants
export const UI_CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
  MAX_QUERY_RESULTS: 1000,
  DEFAULT_PAGE_SIZE: 50,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB (updated to match config.ts)
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



// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed size',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload a CSV, XLS, or XLSX file.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
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