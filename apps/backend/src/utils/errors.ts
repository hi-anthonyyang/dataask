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
 * Handles generic errors with proper logging
 */
export function handleGenericError(res: Response, error: unknown, defaultMessage: string): Response {
  logger.error(`${defaultMessage}:`, error);
  
  const message = error instanceof Error ? error.message : defaultMessage;
  return res.status(500).json({ error: message });
}



/**
 * Standard error response functions for consistent API error handling
 */

export function sendBadRequest(res: Response, message: string, details?: unknown): Response {
  logger.warn(`Bad request: ${message}`, details);
  return res.status(400).json({ error: message });
}



export function sendServerError(res: Response, error: unknown, message: string, details?: unknown): Response {
  logger.error(`${message}:`, error, details);
  
  // In production, don't expose internal error details
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment && error instanceof Error ? error.message : message;
  
  return res.status(500).json({ error: errorMessage });
}