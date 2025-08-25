/**
 * Centralized API service for frontend HTTP requests.
 * 
 * Provides a unified interface for making API calls with consistent error
 * handling, authentication via cookies, and TypeScript type safety. Handles
 * all HTTP methods (GET, POST, PUT, DELETE) and file uploads with automatic
 * JSON parsing and error response formatting. All requests include credentials
 * for cookie-based authentication.
 */

import { API_BASE_URL } from '../utils/constants';

export interface ApiError {
  error: string;
  details?: string | string[];
  code?: string;
  type?: string;
  guidance?: string[];
}

export class ApiService {
  private static getFullUrl(url: string): string {
    // If URL is already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Otherwise, prepend the base URL
    return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Special handling for 401 - let it bubble up for token refresh
      if (response.status === 401) {
        throw { status: 401, error: 'Unauthorized' };
      }
      
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
    const fullUrl = this.getFullUrl(url);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return this.handleResponse<T>(response);
  }

  static async post<T>(url: string, data?: unknown): Promise<T> {
    const fullUrl = this.getFullUrl(url);
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  static async put<T>(url: string, data: unknown): Promise<T> {
    const fullUrl = this.getFullUrl(url);
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(data)
    });

    return this.handleResponse<T>(response);
  }

  static async delete<T>(url: string): Promise<T> {
    const fullUrl = this.getFullUrl(url);
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return this.handleResponse<T>(response);
  }

  static async upload<T>(url: string, formData: FormData): Promise<T> {
    const fullUrl = this.getFullUrl(url);
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: this.getHeaders(false), // Don't set Content-Type for multipart
      credentials: 'include',
      body: formData
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make an API request with automatic token refresh on 401
   */
  static async request<T>(
    url: string,
    options: RequestInit & { refreshToken?: () => Promise<boolean> }
  ): Promise<T> {
    const fullUrl = this.getFullUrl(url);
    try {
      const response = await fetch(fullUrl, {
        ...options,
        credentials: 'include'
      });
      
      return this.handleResponse<T>(response);
    } catch (error: any) {
      // If unauthorized and we have a refresh function, try to refresh
      if (error?.status === 401 && options.refreshToken) {
        const refreshed = await options.refreshToken();
        if (refreshed) {
          // Retry the original request
          const retryResponse = await fetch(fullUrl, {
            ...options,
            credentials: 'include'
          });
          return this.handleResponse<T>(retryResponse);
        }
      }
      throw error;
    }
  }
}

// Convenience functions for common API calls
export const api = {
  get: ApiService.get.bind(ApiService),
  post: ApiService.post.bind(ApiService),
  put: ApiService.put.bind(ApiService),
  delete: ApiService.delete.bind(ApiService),
  upload: ApiService.upload.bind(ApiService),
  request: ApiService.request.bind(ApiService),
};