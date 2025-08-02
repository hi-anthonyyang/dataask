/**
 * Enhanced API client with automatic authentication handling
 * Combines the base API service with auth refresh capabilities
 */

import { api } from './api';
import type { ApiError } from './api';

class ApiClient {
  private refreshTokenFn?: () => Promise<boolean>;

  /**
   * Set the refresh token function to be used on 401 errors
   */
  setRefreshTokenFunction(fn: () => Promise<boolean>) {
    this.refreshTokenFn = fn;
  }

  /**
   * Make a GET request with automatic token refresh
   */
  async get<T>(url: string): Promise<T> {
    try {
      return await api.get<T>(url);
    } catch (error: any) {
      if (error?.status === 401 && this.refreshTokenFn) {
        const refreshed = await this.refreshTokenFn();
        if (refreshed) {
          return await api.get<T>(url);
        }
      }
      throw error;
    }
  }

  /**
   * Make a POST request with automatic token refresh
   */
  async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      return await api.post<T>(url, data);
    } catch (error: any) {
      if (error?.status === 401 && this.refreshTokenFn) {
        const refreshed = await this.refreshTokenFn();
        if (refreshed) {
          return await api.post<T>(url, data);
        }
      }
      throw error;
    }
  }

  /**
   * Make a PUT request with automatic token refresh
   */
  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      return await api.put<T>(url, data);
    } catch (error: any) {
      if (error?.status === 401 && this.refreshTokenFn) {
        const refreshed = await this.refreshTokenFn();
        if (refreshed) {
          return await api.put<T>(url, data);
        }
      }
      throw error;
    }
  }

  /**
   * Make a DELETE request with automatic token refresh
   */
  async delete<T>(url: string): Promise<T> {
    try {
      return await api.delete<T>(url);
    } catch (error: any) {
      if (error?.status === 401 && this.refreshTokenFn) {
        const refreshed = await this.refreshTokenFn();
        if (refreshed) {
          return await api.delete<T>(url);
        }
      }
      throw error;
    }
  }

  /**
   * Upload a file with automatic token refresh
   */
  async upload<T>(url: string, formData: FormData): Promise<T> {
    try {
      return await api.upload<T>(url, formData);
    } catch (error: any) {
      if (error?.status === 401 && this.refreshTokenFn) {
        const refreshed = await this.refreshTokenFn();
        if (refreshed) {
          return await api.upload<T>(url, formData);
        }
      }
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();