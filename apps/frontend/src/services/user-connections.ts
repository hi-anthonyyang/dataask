import { authService } from './auth';
import { handleApiError, handleConnectionError, logWarning, logInfo } from './error';

export interface UserConnection {
  id: string;
  name: string;
  type: 'sqlite';
  config: {
    filename?: string;
  };
  created_at: string;
  updated_at: string;
  last_used?: string;
}

export interface CreateConnectionData {
  name: string;
  type: 'sqlite';
  config: {
    filename?: string;
  };
}

export interface MigrationResult {
  message: string;
  results: Array<{
    name: string;
    status: 'success' | 'error';
    id?: string;
    error?: string;
  }>;
  errors: Array<{
    name: string;
    status: 'error';
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

class UserConnectionsService {
  private baseUrl = '/api/user/connections';

  /**
   * Get all user connections
   */
  async getConnections(): Promise<UserConnection[]> {
    try {
      const response = await authService.authenticatedFetch(this.baseUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch connections');
      }

      const result = await response.json();
      return result.connections;
    } catch (error) {
      const message = handleApiError(error, 'get connections');
      throw new Error(message);
    }
  }

  /**
   * Get a specific connection
   */
  async getConnection(connectionId: string): Promise<UserConnection> {
    try {
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${connectionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Connection not found');
        }
        throw new Error('Failed to fetch connection');
      }

      const result = await response.json();
      return result.connection;
    } catch (error) {
      const message = handleApiError(error, 'get connection');
      throw new Error(message);
    }
  }

  /**
   * Create a new connection
   */
  async createConnection(data: CreateConnectionData): Promise<UserConnection> {
    try {
      const response = await authService.authenticatedFetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create connection');
      }

      return result.connection;
    } catch (error) {
      const message = handleConnectionError(error, data.type);
      throw new Error(message);
    }
  }

  /**
   * Update a connection
   */
  async updateConnection(connectionId: string, data: CreateConnectionData): Promise<UserConnection> {
    try {
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${connectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Connection not found');
        }
        throw new Error(result.error || 'Failed to update connection');
      }

      return result.connection;
    } catch (error) {
      const message = handleApiError(error, 'update connection');
      throw new Error(message);
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Connection not found');
        }
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete connection');
      }
    } catch (error) {
      const message = handleApiError(error, 'delete connection');
      throw new Error(message);
    }
  }

  /**
   * Update connection last used timestamp
   */
  async updateLastUsed(connectionId: string): Promise<void> {
    try {
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${connectionId}/last-used`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        // Don't throw error for this, it's not critical
        logWarning('Failed to update connection last used timestamp');
      }
    } catch (error) {
      logWarning('Failed to update connection last used', { operation: 'updateLastUsed', connectionId });
      // Don't throw, this is not critical
    }
  }

  /**
   * Migrate connections from localStorage
   */
  async migrateConnections(connections: CreateConnectionData[]): Promise<MigrationResult> {
    try {
      const response = await authService.authenticatedFetch(`${this.baseUrl}/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connections }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to migrate connections');
      }

      return result;
    } catch (error) {
      const message = handleApiError(error, 'migrate connections');
      throw new Error(message);
    }
  }

  /**
   * Test a connection before saving (use existing API)
   */
  async testConnection(connectionData: CreateConnectionData): Promise<boolean> {
    try {
      const response = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          type: connectionData.type,
          name: connectionData.name,
          config: connectionData.config
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      handleConnectionError(error, config.type);
      return false;
    }
  }

  /**
   * Convert localStorage connection to server format
   */
  convertLocalStorageConnection(localConnection: Connection): CreateConnectionData {
    return {
      name: localConnection.name,
      type: localConnection.type,
      config: {
        filename: localConnection.config.filename,
      }
    };
  }

  /**
   * Sync connections with localStorage (for backward compatibility)
   */
  async syncWithLocalStorage(): Promise<void> {
    try {
      // Get server connections
      const serverConnections = await this.getConnections();
      
      // Update localStorage to match server (without passwords)
      const localStorageData = serverConnections.map(conn => ({
        id: conn.id,
        name: conn.name,
        type: conn.type,
        config: {
          ...conn.config,
          // Don't store password in localStorage
          password: undefined
        },
        lastConnected: conn.last_used ? new Date(conn.last_used) : undefined
      }));

      // Use the existing storage service format
      localStorage.setItem('dataask_connections', JSON.stringify(localStorageData));
    } catch (error) {
      logWarning('Failed to sync with localStorage', { operation: 'syncWithLocalStorage' });
      // Don't throw, this is not critical
    }
  }
}

// Export singleton instance
export const userConnectionsService = new UserConnectionsService();