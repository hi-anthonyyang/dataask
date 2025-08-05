// API Configuration
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

// Request Configuration
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// File Upload Configuration
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_FILE_TYPES = ['.csv', '.xlsx', '.xls'];

// UI Configuration
export const PAGE_SIZE = 50;
export const DEBOUNCE_DELAY = 300;