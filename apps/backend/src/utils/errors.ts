/**
 * Centralized error handling utilities for the backend API.
 * 
 * Provides consistent error responses across all endpoints with proper
 * logging, status codes, and user-friendly messages. Handles Zod validation
 * errors, database errors, and generic errors with appropriate HTTP status
 * codes and response formats. Includes connection error guidance for common
 * network and database connectivity issues.
 */

import { Response } from 'express';
import { z } from 'zod';
import { logger } from './logger';

export interface ErrorResponse {
  error: string;
  details?: string | string[];
  code?: string;
  type?: string;
  guidance?: string[];
}

/**
 * Database error with additional metadata
 */
export interface DatabaseErrorInfo {
  code?: string;
  message: string;
  originalError?: Error | unknown;
}

/**
 * Handles Zod validation errors consistently
 */
export function handleZodError(res: Response, error: z.ZodError, message = 'Invalid request parameters'): Response {
  const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
  logger.warn('Validation error:', { errors });
  
  return res.status(400).json({
    error: message,
    details: errors.length === 1 ? errors[0] : errors
  });
}

/**
 * Handles database errors with enhanced error information
 */
export function handleDatabaseError(res: Response, error: unknown, context?: string): Response {
  logger.error(`Database error${context ? ` in ${context}` : ''}:`, error);
  
  if (error instanceof Error && 'code' in error) {
    const dbError = error as DatabaseErrorInfo;
    return res.status(500).json({
      error: dbError.message,
      code: dbError.code,
      type: 'database_error'
    });
  }
  
  const message = error instanceof Error ? error.message : 'Database operation failed';
  return res.status(500).json({
    error: message,
    type: 'database_error'
  });
}

/**
 * Handles generic errors with proper logging
 */
export function handleGenericError(res: Response, error: unknown, defaultMessage: string): Response {
  logger.error(`${defaultMessage}:`, error);
  
  const message = error instanceof Error ? error.message : defaultMessage;
  return res.status(500).json({ error: message });
}

/**
 * Provides connection error guidance based on error message
 */
export function getConnectionErrorGuidance(errorMessage: string): string[] | undefined {
  const guidanceMap: Record<string, string[]> = {
    'ENOTFOUND': [
      'The hostname could not be resolved. Please check:',
      '• Verify the hostname spelling in your connection settings',
      '• Confirm the database server exists and is accessible',
      '• Check if you\'re using the correct network/region',
      '• Ensure DNS resolution is working correctly'
    ],
    'ECONNREFUSED': [
      'Connection was refused. Please check:',
      '• The database server is running and accepting connections',
      '• Firewall/security groups allow connections on the database port',
      '• The port number is correct',
      '• Network connectivity between client and server'
    ],
    'timeout': [
      'Connection timed out. Please check:',
      '• Network connectivity to the database server',
      '• Firewall rules and security groups',
      '• Database server is responsive',
      '• Connection timeout settings'
    ],
    'EACCES': [
      'Permission denied. Please check:',
      '• Database user has proper permissions',
      '• Authentication credentials are correct',
      '• SSL/TLS certificate permissions (if applicable)',
      '• File system permissions for SQLite databases'
    ]
  };
  
  for (const [key, guidance] of Object.entries(guidanceMap)) {
    if (errorMessage.includes(key)) {
      return guidance;
    }
  }
  
  return undefined;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string,
  includeGuidance = false
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  
  const response: ErrorResponse = {
    error: errorMessage
  };
  
  if (error instanceof Error && 'code' in error) {
    response.code = (error as Error & { code?: string }).code;
    response.type = 'database_error';
  }
  
  if (includeGuidance) {
    const guidance = getConnectionErrorGuidance(errorMessage);
    if (guidance) {
      response.guidance = guidance;
    }
  }
  
  return response;
}

/**
 * Standard error response functions for consistent API error handling
 */

export function sendBadRequest(res: Response, message: string, details?: unknown): Response {
  logger.warn(`Bad request: ${message}`, details);
  return res.status(400).json({ error: message });
}

export function sendUnauthorized(res: Response, message = 'Unauthorized'): Response {
  logger.warn(`Unauthorized access attempt: ${message}`);
  return res.status(401).json({ error: message });
}

export function sendForbidden(res: Response, message = 'Forbidden'): Response {
  logger.warn(`Forbidden access attempt: ${message}`);
  return res.status(403).json({ error: message });
}

export function sendNotFound(res: Response, resource: string): Response {
  const message = `${resource} not found`;
  logger.warn(message);
  return res.status(404).json({ error: message });
}

export function sendConflict(res: Response, message: string): Response {
  logger.warn(`Conflict: ${message}`);
  return res.status(409).json({ error: message });
}

export function sendServerError(res: Response, error: unknown, message: string, details?: unknown): Response {
  logger.error(`${message}:`, error, details);
  
  // In production, don't expose internal error details
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment && error instanceof Error ? error.message : message;
  
  return res.status(500).json({ error: errorMessage });
}