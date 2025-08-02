/**
 * Unified error handling service for the frontend
 * Provides consistent error logging, user notifications, and error tracking
 */

import { ApiError } from '../types';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorContext {
  operation?: string;
  component?: string;
  userId?: string;
  connectionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorReport {
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: ErrorContext;
  error?: Error | unknown;
  stack?: string;
}

class ErrorService {
  private errorHistory: ErrorReport[] = [];
  private readonly maxHistorySize = 100;
  private isDevelopment = (import.meta as any).env?.DEV || false;

  /**
   * Log an error with context and optional user notification
   */
  logError(
    message: string,
    error?: unknown,
    context?: ErrorContext,
    severity: ErrorSeverity = 'error'
  ): void {
    const errorReport: ErrorReport = {
      message,
      severity,
      timestamp: new Date(),
      context,
      error,
      stack: error instanceof Error ? error.stack : undefined
    };

    // Add to history
    this.addToHistory(errorReport);

    // Log to console in development
    if (this.isDevelopment) {
      const consoleMethod = severity === 'warning' ? 'warn' : 'error';
      console[consoleMethod](`[${severity.toUpperCase()}] ${message}`, {
        error,
        context,
        stack: errorReport.stack
      });
    } else {
      // In production, only log errors and critical issues
      if (severity === 'error' || severity === 'critical') {
        console.error(`[${severity.toUpperCase()}] ${message}`);
      }
    }

    // TODO: In production, send to error tracking service (e.g., Sentry)
    if (!this.isDevelopment && (severity === 'error' || severity === 'critical')) {
      this.sendToErrorTracking(errorReport);
    }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    this.logError(message, undefined, context, 'warning');
  }

  /**
   * Log info message
   */
  logInfo(message: string, context?: ErrorContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context);
    }
  }

  /**
   * Handle API errors with appropriate user messages
   */
  handleApiError(error: unknown, operation: string): string {
    let userMessage = 'An unexpected error occurred. Please try again.';
    
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = error as ApiError;
      userMessage = apiError.error || apiError.message || userMessage;
      
      // Log the full error
      this.logError(`API Error during ${operation}`, error, {
        operation,
        metadata: {
          statusCode: apiError.statusCode,
          validationErrors: apiError.validationErrors
        }
      });
    } else if (error instanceof Error) {
      // Network errors or other JS errors
      if (error.message.includes('Failed to fetch')) {
        userMessage = 'Unable to connect to the server. Please check your connection and try again.';
      } else if (error.message.includes('NetworkError')) {
        userMessage = 'Network error occurred. Please check your internet connection.';
      }
      
      this.logError(`Error during ${operation}`, error, { operation });
    } else {
      this.logError(`Unknown error during ${operation}`, error, { operation });
    }
    
    return userMessage;
  }

  /**
   * Handle connection errors with specific guidance
   */
  handleConnectionError(error: unknown, connectionType?: string): string {
    const baseMessage = this.handleApiError(error, 'connection');
    
    // Add connection-specific guidance
    if (connectionType === 'sqlite' && baseMessage.includes('connect')) {
      return `${baseMessage} For SQLite, ensure the file path is correct and the file exists.`;
    }
    
    return baseMessage;
  }

  /**
   * Handle file operation errors
   */
  handleFileError(error: unknown, operation: string): string {
    const errorMessage = this.handleApiError(error, `file ${operation}`);
    
    if (errorMessage.includes('too large')) {
      return 'File is too large. Please use a file smaller than 50MB.';
    } else if (errorMessage.includes('Invalid file type')) {
      return 'Invalid file type. Please upload a CSV, XLS, or XLSX file.';
    }
    
    return errorMessage;
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error: unknown, operation: string): string {
    const errorMessage = this.handleApiError(error, `auth ${operation}`);
    
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return 'Your session has expired. Please log in again.';
    } else if (errorMessage.includes('already exists')) {
      return 'An account with this email already exists.';
    } else if (errorMessage.includes('Invalid email or password')) {
      return 'Invalid email or password. Please try again.';
    }
    
    return errorMessage;
  }

  /**
   * Get error history for debugging
   */
  getErrorHistory(): ErrorReport[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Add error to history with size limit
   */
  private addToHistory(errorReport: ErrorReport): void {
    this.errorHistory.push(errorReport);
    
    // Keep only the most recent errors
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Send error to tracking service (placeholder for future implementation)
   */
  private sendToErrorTracking(errorReport: ErrorReport): void {
    // TODO: Implement error tracking service integration
    // For now, just log that we would send it
    if (this.isDevelopment) {
      console.log('Would send to error tracking:', errorReport);
    }
  }

  /**
   * Create a user-friendly error message from various error types
   */
  getUserMessage(error: unknown, defaultMessage = 'An error occurred'): string {
    if (!error) return defaultMessage;
    
    if (typeof error === 'string') return error;
    
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('error' in error && typeof error.error === 'string') {
        return error.error;
      }
    }
    
    return defaultMessage;
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Export convenience functions
export const logError = errorService.logError.bind(errorService);
export const logWarning = errorService.logWarning.bind(errorService);
export const logInfo = errorService.logInfo.bind(errorService);
export const handleApiError = errorService.handleApiError.bind(errorService);
export const handleConnectionError = errorService.handleConnectionError.bind(errorService);
export const handleFileError = errorService.handleFileError.bind(errorService);
export const handleAuthError = errorService.handleAuthError.bind(errorService);