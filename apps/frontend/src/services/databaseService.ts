// Database service that handles both Electron and web modes
import '../types/electron.d.ts'
import { API_ENDPOINTS, DATABASE_TYPES, ERROR_MESSAGES } from '../utils/constants'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

// SQLite connection constants
const SQLITE_CONNECTION_ID = 'sqlite_file' as const
const HTTP_HEADERS = { 'Content-Type': 'application/json' } as const

// For SQLite in Electron, we store the current file path instead of connection IDs
let currentSQLiteFile: string | null = null

export const databaseService = {
  // Test database connection
  async testConnection(config: any): Promise<{ success: boolean; message: string; error?: string; guidance?: string[] }> {
    if (isElectron() && config.type === DATABASE_TYPES.SQLITE) {
      // For SQLite in Electron, just validate the file
      const result = await window.electronAPI!.sqlite.validateFile(config.config.filename)
      return {
        success: result.valid,
        message: result.valid ? 'File is accessible' : (result.error || 'File validation failed')
      }
    } else {
      // Web mode or non-SQLite - use HTTP API
      const response = await fetch(API_ENDPOINTS.DATABASE.TEST_CONNECTION, {
        method: 'POST',
        headers: HTTP_HEADERS,
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }))
        return {
          success: false,
          message: errorResult.error || `Server error (${response.status}): ${response.statusText}`
        }
      }
      
      return await response.json()
    }
  },

  // Create database connection
  async createConnection(config: any): Promise<{ connectionId?: string; message?: string; error?: string }> {
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
      const response = await fetch(API_ENDPOINTS.DATABASE.CREATE_CONNECTION, {
        method: 'POST',
        headers: HTTP_HEADERS,
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { error: errorResult.error || ERROR_MESSAGES.CONNECTION_FAILED }
      }
      
      return await response.json()
    }
  },

  // Get database schema
  async getSchema(connectionId: string): Promise<{ schema?: { tables: any[] }; error?: string }> {
    if (isElectron() && connectionId === SQLITE_CONNECTION_ID && currentSQLiteFile) {
      return await window.electronAPI!.sqlite.getSchema(currentSQLiteFile)
    } else {
      // Web mode or non-SQLite - use HTTP API
      const response = await fetch(`/api/db/connections/${connectionId}/schema`)
      
      if (!response.ok) {
        return { error: 'Failed to retrieve schema' }
      }
      
      return await response.json()
    }
  },

  // Execute SQL query
  async executeQuery(connectionId: string, sql: string, params?: any[]): Promise<{
    data?: any[]
    rowCount?: number
    fields?: any[]
    executionTime?: number
    error?: string
  }> {
    if (isElectron() && connectionId === SQLITE_CONNECTION_ID && currentSQLiteFile) {
      return await window.electronAPI!.sqlite.executeQuery(currentSQLiteFile, sql, params)
    } else {
      // Web mode or non-SQLite - use HTTP API
      const response = await fetch(API_ENDPOINTS.DATABASE.EXECUTE_QUERY, {
        method: 'POST',
        headers: HTTP_HEADERS,
        body: JSON.stringify({
          connectionId,
          sql,
          params
        })
      })
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: ERROR_MESSAGES.QUERY_FAILED }))
        return { error: errorResult.error || ERROR_MESSAGES.QUERY_FAILED }
      }
      
      return await response.json()
    }
  },

  // List active connections
  async listConnections(): Promise<{ connections: Array<{ id: string; name: string; type: string; config?: any }> }> {
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
      const response = await fetch(API_ENDPOINTS.DATABASE.LIST_CONNECTIONS)
      
      if (!response.ok) {
        return { connections: [] }
      }
      
      return await response.json()
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
      const response = await fetch(`/api/db/connections/${connectionId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        return { message: 'Failed to delete connection', error: 'HTTP error' }
      }
      
      return await response.json()
    }
  }
}