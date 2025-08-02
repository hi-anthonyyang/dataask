// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Auth Configuration
export const AUTH_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_KEY = 'user';

// Request Configuration
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// File Upload Configuration
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_FILE_TYPES = ['.csv', '.xlsx', '.xls', '.db', '.sqlite', '.sqlite3'];

// UI Configuration
export const PAGE_SIZE = 50;
export const DEBOUNCE_DELAY = 300;