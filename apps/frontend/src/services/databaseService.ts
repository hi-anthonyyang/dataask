// Database service that handles both Electron and web modes
import '../types/electron.d.ts'
import { API_ENDPOINTS, DATABASE_TYPES, ERROR_MESSAGES } from '../utils/constants'
import {
  ConnectionConfig,
  TestConnectionResponse,
  CreateConnectionResponse,
  SchemaResponse,
  QueryResponse,
  ConnectionListResponse,
  Connection,
  DatabaseField,
  DatabaseSchema
} from '../types'
import { api } from './api'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

// SQLite connection constants
const SQLITE_CONNECTION_ID = 'sqlite_file' as const

// For SQLite in Electron, we store the current file path instead of connection IDs
let currentSQLiteFile: string | null = null

export const databaseService = {
  // Test database connection
  async testConnection(config: ConnectionConfig & { type: string; name: string }): Promise<TestConnectionResponse> {
    if (isElectron() && config.type === DATABASE_TYPES.SQLITE) {
      // For SQLite in Electron, just validate the file
      const result = await window.electronAPI!.sqlite.validateFile(config.config.filename)
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
      const result = await window.electronAPI!.sqlite.validateFile(config.config.filename)
      if (result.valid) {
        currentSQLiteFile = config.config.filename
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
    if (isElectron() && currentSQLiteFile) {
      // For SQLite in Electron, return the current file as a connection
      return {
        connections: [{
          id: SQLITE_CONNECTION_ID,
          name: `SQLite: ${currentSQLiteFile.split('/').pop() || 'Database'}`,
          type: DATABASE_TYPES.SQLITE,
          config: { filename: currentSQLiteFile }
        }]
      }
    } else {
      // Web mode - use HTTP API
      try {
        return await api.get<ConnectionListResponse>(API_ENDPOINTS.DATABASE.LIST_CONNECTIONS)
      } catch (error) {
        return { connections: [] }
      }
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