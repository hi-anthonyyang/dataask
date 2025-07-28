import { logger } from '../utils/logger';

export interface QueryValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedQuery?: string;
}

interface QueryResultField {
  name: string;
  type?: string;
}

interface QueryResult {
  rows: Record<string, any>[];
  fields: QueryResultField[];
  rowCount: number;
  executionTime?: number;
}

// Keywords that indicate write operations (not allowed)
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'EXEC', 'EXECUTE', 'CALL', 'MERGE', 'UPSERT', 'REPLACE',
  'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  'SET', 'PRAGMA', 'ATTACH', 'DETACH',
  'LOAD_FILE', 'INTO OUTFILE', 'INTO DUMPFILE', 'LOAD DATA'
];

// Allowed read-only keywords
const ALLOWED_KEYWORDS = [
  'SELECT', 'WITH', 'EXPLAIN', 'DESCRIBE', 'DESC', 'SHOW'
];

// Dangerous patterns to look for
const DANGEROUS_PATTERNS = [
  /;\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)/i,
  /UNION.*?(INSERT|UPDATE|DELETE|DROP)/i,
  /-{2}.*?(INSERT|UPDATE|DELETE|DROP)/i, // SQL comments trying to hide malicious code
  /\/\*.*?(INSERT|UPDATE|DELETE|DROP).*?\*\//i, // Block comments
  /xp_cmdshell/i, // SQL Server command execution
  /sp_executesql/i, // SQL Server dynamic SQL execution
  /\bCHAR\s*\(\s*\d+\s*\)/i, // CHAR() function often used in injections
  /\bSLEEP\s*\(/i, // MySQL SLEEP function
  /\bBENCHMARK\s*\(/i, // MySQL BENCHMARK function
];

/**
 * Validates that a SQL query is read-only and safe to execute
 */
export function validateQuery(sql: string): QueryValidationResult {
  const errors: string[] = [];
  
  if (!sql || sql.trim().length === 0) {
    return {
      isValid: false,
      errors: ['Query cannot be empty']
    };
  }

  // Normalize the query for analysis
  const normalizedQuery = sql.trim().toUpperCase();
  
  // Check if query starts with allowed keywords
  const startsWithAllowed = ALLOWED_KEYWORDS.some(keyword => 
    normalizedQuery.startsWith(keyword)
  );
  
  if (!startsWithAllowed) {
    errors.push(`Query must start with one of: ${ALLOWED_KEYWORDS.join(', ')}`);
  }

  // Check for forbidden keywords
  const foundForbidden = FORBIDDEN_KEYWORDS.filter(keyword => 
    normalizedQuery.includes(keyword)
  );
  
  if (foundForbidden.length > 0) {
    errors.push(`Forbidden operations detected: ${foundForbidden.join(', ')}`);
  }

  // Check for dangerous patterns
  const foundDangerousPatterns = DANGEROUS_PATTERNS.filter(pattern => 
    pattern.test(sql)
  );
  
  if (foundDangerousPatterns.length > 0) {
    errors.push('Potentially malicious SQL patterns detected');
  }

  // Check for multiple statements (semicolon followed by more SQL)
  const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
  if (statements.length > 1) {
    errors.push('Multiple SQL statements not allowed');
  }

  // Additional security checks
  if (sql.includes('xp_') || sql.includes('sp_')) {
    errors.push('System stored procedures not allowed');
  }

  // Check for potential SQL injection attempts
  const injectionPatterns = [
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /'\s*UNION\s*SELECT/i,
    /'\s*;\s*DROP/i
  ];

  const hasInjectionAttempt = injectionPatterns.some(pattern => pattern.test(sql));
  if (hasInjectionAttempt) {
    errors.push('Potential SQL injection attempt detected');
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logger.warn('Query validation failed', { 
      query: sql.substring(0, 200) + '...', 
      errors 
    });
  }

  return {
    isValid,
    errors,
    sanitizedQuery: isValid ? sql.trim() : undefined
  };
}

/**
 * Sanitizes query parameters to prevent injection
 */
export function sanitizeParams(params: unknown[]): unknown[] {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map(param => {
    if (typeof param === 'string') {
      // Basic string sanitization - remove potential SQL injection characters
      return param.replace(/[';\\]/g, '');
    }
    return param;
  });
}

/**
 * Validates that a query result set is safe to return
 */
export function validateQueryResult(result: QueryResult): boolean {
  // Check for potentially sensitive column names that shouldn't be returned
  const sensitiveColumns = ['password', 'secret', 'token', 'key', 'hash'];
  
  if (result.fields && Array.isArray(result.fields)) {
    const columnNames = result.fields.map((field: QueryResultField) => 
      field.name?.toLowerCase() || ''
    );
    
    const hasSensitiveData = columnNames.some((name: string) =>
      sensitiveColumns.some(sensitive => name.includes(sensitive))
    );

    if (hasSensitiveData) {
      logger.warn('Query result contains potentially sensitive columns', {
        columns: columnNames
      });
      return false;
    }
  }

  return true;
}

/**
 * Limits query result size to prevent memory exhaustion
 */
export function limitQueryResult(result: QueryResult, maxRows: number = 10000): QueryResult {
  if (!result || !result.rows) {
    return result;
  }

  if (result.rows.length > maxRows) {
    logger.info(`Query result limited to ${maxRows} rows (was ${result.rows.length})`);
    return {
      ...result,
      rows: result.rows.slice(0, maxRows),
      rowCount: maxRows
    };
  }

  return result;
} 