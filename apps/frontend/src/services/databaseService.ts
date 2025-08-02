// Database service that handles both Electron and web modes
import '../types/electron.d.ts'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

export const databaseService = {
  // Test database connection
  async testConnection(config: any): Promise<{ success: boolean; message: string; error?: string; guidance?: string[] }> {
    if (isElectron()) {
      const result = await window.electronAPI!.database.testConnection(config)
      return result
    } else {
      // Web mode - use HTTP API
      const response = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (isElectron()) {
      return await window.electronAPI!.database.createConnection(config)
    } else {
      // Web mode - use HTTP API
      const response = await fetch('/api/db/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { error: errorResult.error || 'Failed to create connection' }
      }
      
      return await response.json()
    }
  },

  // Get database schema
  async getSchema(connectionId: string): Promise<{ schema?: { tables: any[] }; error?: string }> {
    if (isElectron()) {
      return await window.electronAPI!.database.getSchema(connectionId)
    } else {
      // Web mode - use HTTP API
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
    if (isElectron()) {
      return await window.electronAPI!.database.executeQuery(connectionId, sql, params)
    } else {
      // Web mode - use HTTP API
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          sql,
          params
        })
      })
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Query execution failed' }))
        return { error: errorResult.error || 'Query execution failed' }
      }
      
      return await response.json()
    }
  },

  // List active connections
  async listConnections(): Promise<{ connections: Array<{ id: string; name: string; type: string; config?: any }> }> {
    if (isElectron()) {
      return await window.electronAPI!.database.listConnections()
    } else {
      // Web mode - use HTTP API
      const response = await fetch('/api/db/connections')
      
      if (!response.ok) {
        return { connections: [] }
      }
      
      return await response.json()
    }
  },

  // Delete connection
  async deleteConnection(connectionId: string): Promise<{ message: string; error?: string }> {
    if (isElectron()) {
      return await window.electronAPI!.database.deleteConnection(connectionId)
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