// Database service that handles both Electron and web modes
import '../types/electron.d.ts'
import { API_ENDPOINTS, DATABASE_TYPES, ERROR_MESSAGES } from '../utils/constants'
import {
  ConnectionConfig,
  TestConnectionResponse,
  CreateConnectionResponse,
  SchemaResponse,
  QueryResponse,
  ConnectionListResponse
} from '../types'
import { api } from './api'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

// SQLite connection constants
const SQLITE_CONNECTION_ID = 'sqlite_file' as const

// For SQLite in Electron, we store the current file path instead of connection IDs
let currentSQLiteFile: string | null = null

// Export individual functions for compatibility
export async function testConnection(config: ConnectionConfig & { type: string; name: string }): Promise<TestConnectionResponse> {
  return databaseService.testConnection(config);
}

export async function createConnection(config: ConnectionConfig & { type: string; name: string }): Promise<CreateConnectionResponse> {
  return databaseService.createConnection(config);
}

export async function updateConnection(connectionId: string, config: ConnectionConfig & { type: string; name: string }): Promise<CreateConnectionResponse> {
  return databaseService.updateConnection(connectionId, config);
}

export const databaseService = {
  // Test database connection
  async testConnection(config: ConnectionConfig & { type: string; name: string }): Promise<TestConnectionResponse> {
    if (isElectron() && config.type === DATABASE_TYPES.SQLITE) {
      // For SQLite in Electron, just validate the file
      const result = await window.electronAPI!.sqlite.validateFile(config.filename || '')
      return {
        success: result.valid,
        message: result.valid ? 'File is accessible' : (result.error || 'File validation failed')
      }
    } else {
      // Web mode or non-SQLite - use HTTP API
      try {
        return await api.post<TestConnectionResponse>(
          API_ENDPOINTS.DATABASE.TEST_CONNECTION,
          config
        )
      } catch (error) {
        return {
          success: false,
          message: (error as any)?.error || ERROR_MESSAGES.NETWORK_ERROR,
          error: (error as any)?.error
        }
      }
    }
  },

  // Create database connection
  async createConnection(config: ConnectionConfig & { type: string; name: string }): Promise<CreateConnectionResponse> {
    if (isElectron() && config.type === DATABASE_TYPES.SQLITE) {
      // For SQLite in Electron, just store the file path and return a fake connection ID
      const result = await window.electronAPI!.sqlite.validateFile(config.filename || '')
      if (result.valid) {
        currentSQLiteFile = config.filename || null
        return { 
          connectionId: SQLITE_CONNECTION_ID, 
          message: 'SQLite file ready' 
        }
      } else {
        return { error: result.error || 'File validation failed' }
      }
    } else {
      // Web mode or non-SQLite - use HTTP API
      try {
        return await api.post<CreateConnectionResponse>(
          API_ENDPOINTS.DATABASE.CREATE_CONNECTION,
          config
        )
      } catch (error) {
        return { error: (error as any)?.error || ERROR_MESSAGES.CONNECTION_FAILED }
      }
    }
  },

  // Update database connection
  async updateConnection(connectionId: string, _config: ConnectionConfig & { type: string; name: string }): Promise<CreateConnectionResponse> {
    // For now, just return success as connections are managed locally
    return {
      success: true,
      connectionId,
      message: 'Connection updated'
    }
  },

  // Get database schema
  async getSchema(connectionId: string): Promise<SchemaResponse> {
    if (isElectron() && connectionId === SQLITE_CONNECTION_ID && currentSQLiteFile) {
      return await window.electronAPI!.sqlite.getSchema(currentSQLiteFile)
    } else {
      // Web mode or non-SQLite - use HTTP API
      try {
        return await api.get<SchemaResponse>(`/api/db/connections/${connectionId}/schema`)
      } catch (error) {
        return { error: 'Failed to retrieve schema' }
      }
    }
  },

  // Execute SQL query
  async executeQuery(connectionId: string, sql: string, params?: unknown[]): Promise<QueryResponse> {
    if (isElectron() && connectionId === SQLITE_CONNECTION_ID && currentSQLiteFile) {
      return await window.electronAPI!.sqlite.executeQuery(currentSQLiteFile, sql, params)
    } else {
      // Web mode or non-SQLite - use HTTP API
      try {
        return await api.post<QueryResponse>(
          API_ENDPOINTS.DATABASE.EXECUTE_QUERY,
          { connectionId, sql, params }
        )
      } catch (error) {
        return { error: (error as any)?.error || ERROR_MESSAGES.QUERY_FAILED }
      }
    }
  },

  // List active connections
  async listConnections(): Promise<ConnectionListResponse> {
    // Always fetch connections from backend to get imported connections
    try {
      const response = await api.get<ConnectionListResponse>(API_ENDPOINTS.DATABASE.LIST_CONNECTIONS)
      
      // In Electron mode, also add the current SQLite file if it exists and isn't already in the list
      if (isElectron() && currentSQLiteFile) {
        const existingConnection = response.connections.find(c => c.config?.filename === currentSQLiteFile)
        if (!existingConnection) {
          response.connections.push({
            id: SQLITE_CONNECTION_ID,
            name: `SQLite: ${currentSQLiteFile.split('/').pop() || 'Database'}`,
            type: DATABASE_TYPES.SQLITE,
            config: { filename: currentSQLiteFile }
          })
        }
      }
      
      return response
    } catch (error) {
      // If backend is not available, return current SQLite file in Electron mode
      if (isElectron() && currentSQLiteFile) {
        return {
          connections: [{
            id: SQLITE_CONNECTION_ID,
            name: `SQLite: ${currentSQLiteFile.split('/').pop() || 'Database'}`,
            type: DATABASE_TYPES.SQLITE,
            config: { filename: currentSQLiteFile }
          }]
        }
      }
      return { connections: [] }
    }
  },

  // Delete connection
  async deleteConnection(connectionId: string): Promise<{ message: string; error?: string }> {
    if (isElectron() && connectionId === SQLITE_CONNECTION_ID) {
      // For SQLite in Electron, just clear the current file
      currentSQLiteFile = null
      return { message: 'SQLite file connection cleared' }
    } else {
      // Web mode - use HTTP API
      try {
        return await api.delete<{ message: string }>(`/api/db/connections/${connectionId}`)
      } catch (error) {
        return { message: 'Failed to delete connection', error: 'HTTP error' }
      }
    }
  }
}