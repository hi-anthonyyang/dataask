/**
 * Centralized API service for frontend HTTP requests.
 * 
 * Provides a unified interface for making API calls with consistent error
 * handling, authentication via cookies, and TypeScript type safety. Handles
 * all HTTP methods (GET, POST, PUT, DELETE) and file uploads with automatic
 * JSON parsing and error response formatting. All requests include credentials
 * for cookie-based authentication.
 */

export interface ApiError {
  error: string;
  details?: string | string[];
  code?: string;
  type?: string;
  guidance?: string[];
}

export class ApiService {
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: `HTTP ${response.status}: ${response.statusText}`,
          type: 'http_error'
        };
      }
      throw errorData;
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T;
    }

    return response.json();
  }

  private static getHeaders(includeContentType = true): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  static async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return this.handleResponse<T>(response);
  }

  static async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  static async put<T>(url: string, data: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });

    return this.handleResponse<T>(response);
  }

  static async delete<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return this.handleResponse<T>(response);
  }

  static async upload<T>(url: string, formData: FormData): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(false), // Don't set Content-Type for multipart
      credentials: 'include',
      body: formData
    });

    return this.handleResponse<T>(response);
  }
}

// Convenience functions for common API calls
export const api = {
  get: ApiService.get,
  post: ApiService.post,
  put: ApiService.put,
  delete: ApiService.delete,
  upload: ApiService.upload
};