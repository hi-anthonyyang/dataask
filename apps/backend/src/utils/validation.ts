/**
 * Centralized validation and type conversion utilities
 * Consolidates validation logic from across the application
 */

import { z } from 'zod';
import { ColumnType } from '../types';

/**
 * SQL Query validation
 */
export interface QueryValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedQuery?: string;
}

// Common SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(DROP|DELETE|TRUNCATE|ALTER)\s+TABLE\b)/gi,
  /(\b(DROP|ALTER)\s+DATABASE\b)/gi,
  /(\bEXEC(UTE)?\s*\()/gi,
  /(--\s*$|\/\*|\*\/|;.*--)/gm,
  /(\bUNION\s+ALL\s+SELECT\b)/gi,
  /(\bINTO\s+(OUTFILE|DUMPFILE)\b)/gi,
  /(\bLOAD_FILE\s*\()/gi,
];

export function validateSQLQuery(sql: string): QueryValidationResult {
  // Check for empty query
  if (!sql || sql.trim().length === 0) {
    return {
      isValid: false,
      error: 'Query cannot be empty'
    };
  }

  // Check query length
  const trimmedQuery = sql.trim();
  if (trimmedQuery.length > 50000) {
    return {
      isValid: false,
      error: 'Query is too long (max 50,000 characters)'
    };
  }

  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        isValid: false,
        error: 'Query contains potentially dangerous SQL patterns'
      };
    }
  }

  // Basic syntax validation
  const upperQuery = trimmedQuery.toUpperCase();
  const hasValidStart = /^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|SHOW|DESCRIBE|EXPLAIN)/i.test(trimmedQuery);
  
  if (!hasValidStart && !upperQuery.includes('SELECT')) {
    return {
      isValid: false,
      error: 'Query must start with a valid SQL command'
    };
  }

  return {
    isValid: true,
    sanitizedQuery: trimmedQuery
  };
}

/**
 * Table name sanitization
 */
export function sanitizeTableName(tableName: string): string {
  // Remove any characters that aren't alphanumeric or underscore
  return tableName.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Quote table name for SQL
 */
export function quoteTableName(tableName: string, dbType: 'postgresql' | 'mysql' | 'sqlite'): string {
  const sanitized = sanitizeTableName(tableName);
  
  switch (dbType) {
    case 'mysql':
      return `\`${sanitized}\``;
    case 'postgresql':
    case 'sqlite':
    default:
      return `"${sanitized}"`;
  }
}

/**
 * Parameter sanitization
 */
export function sanitizeParameters(params: unknown[]): unknown[] {
  return params.map(param => {
    // Convert undefined to null for database compatibility
    if (param === undefined) {
      return null;
    }
    
    // Handle special types
    if (param instanceof Date) {
      return param.toISOString();
    }
    
    // Ensure strings don't contain null bytes
    if (typeof param === 'string') {
      return param.replace(/\0/g, '');
    }
    
    return param;
  });
}

/**
 * Column type detection for file imports
 */
export function detectColumnType(values: unknown[]): ColumnType {
  if (values.length === 0) return 'TEXT';

  let integerCount = 0;
  let realCount = 0;
  let dateCount = 0;
  const sampleSize = Math.min(values.length, 100);

  for (let i = 0; i < sampleSize; i++) {
    const value = values[i];
    if (value == null || value === '') continue;

    const strValue = String(value).trim();
    
    // Check for integer
    if (/^-?\d+$/.test(strValue)) {
      integerCount++;
    }
    // Check for real number
    else if (/^-?\d+\.?\d*$/.test(strValue)) {
      realCount++;
    }
    // Check for date
    else if (isValidDate(strValue)) {
      dateCount++;
    }
  }

  const threshold = sampleSize * 0.8; // 80% confidence

  if (integerCount >= threshold) return 'INTEGER';
  if (realCount >= threshold) return 'REAL';
  if (dateCount >= threshold) return 'DATE';
  
  return 'TEXT';
}

/**
 * Date validation
 */
export function isValidDate(value: string): boolean {
  if (!value) return false;
  
  // Common date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/,                  // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/,                    // DD-MM-YYYY
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,  // ISO 8601
  ];
  
  const matchesPattern = datePatterns.some(pattern => pattern.test(value));
  if (!matchesPattern) return false;
  
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.length > 6;
}

/**
 * Value type conversion
 */
export function convertValueToType(value: unknown, type: ColumnType): unknown {
  if (value == null || value === '') return null;

  const strValue = String(value).trim();

  switch (type) {
    case 'INTEGER':
      const intVal = parseInt(strValue, 10);
      return isNaN(intVal) ? null : intVal;
      
    case 'REAL':
      const floatVal = parseFloat(strValue);
      return isNaN(floatVal) ? null : floatVal;
      
    case 'DATE':
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString();
      
    case 'TEXT':
    default:
      return strValue;
  }
}

/**
 * Connection configuration validation
 */
export const ConnectionConfigSchema = z.object({
  type: z.enum(['postgresql', 'mysql', 'sqlite']),
  name: z.string().min(1).max(255),
  config: z.object({
    // PostgreSQL & MySQL
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    // SQLite
    filename: z.string().optional(),
    // SSL Configuration
    sslEnabled: z.boolean().optional(),
    sslMode: z.enum(['require', 'prefer', 'allow', 'disable']).optional(),
    sslCa: z.string().optional(),
    sslCert: z.string().optional(),
    sslKey: z.string().optional(),
    sslRejectUnauthorized: z.boolean().optional(),
    // Connection Timeouts
    connectionTimeout: z.number().optional(),
    queryTimeout: z.number().optional(),
    // SSH Tunnel Configuration
    sshEnabled: z.boolean().optional(),
    sshHost: z.string().optional(),
    sshPort: z.number().optional(),
    sshUsername: z.string().optional(),
    sshPassword: z.string().optional(),
    sshPrivateKey: z.string().optional(),
    sshPassphrase: z.string().optional(),
  })
});

/**
 * Validate connection configuration
 */
export function validateConnectionConfig(config: unknown): z.infer<typeof ConnectionConfigSchema> {
  return ConnectionConfigSchema.parse(config);
}

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Password strength validation
 */
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score++;
    if (password.length >= 12) score++;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Password should contain lowercase letters');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Password should contain uppercase letters');
  } else {
    score++;
  }

  if (!/\d/.test(password)) {
    feedback.push('Password should contain numbers');
  } else {
    score++;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password should contain special characters');
  } else {
    score++;
  }

  return {
    isValid: password.length >= 8 && score >= 3,
    score: Math.min(score, 4),
    feedback
  };
}

/**
 * File validation
 */
export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
}

export function validateFileSize(sizeInBytes: number, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes <= maxSizeBytes;
}

/**
 * Number range validation
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Port number validation
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && isInRange(port, 1, 65535);
}

/**
 * Hostname validation
 */
export function isValidHostname(hostname: string): boolean {
  const hostnameRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}(?<!-)\.)*[a-zA-Z0-9-]{1,63}(?<!-)$/;
  return hostnameRegex.test(hostname) || isValidIPAddress(hostname);
}

/**
 * IP address validation
 */
export function isValidIPAddress(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) return true;
  
  // IPv6 (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;
  return ipv6Regex.test(ip);
}