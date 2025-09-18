// Local storage service for persisting app state (DBeaver-style)
import { STORAGE_KEYS, DATABASE_TYPES } from '../utils/constants'
import { logWarning } from './error'

// Type definitions
type DatabaseType = typeof DATABASE_TYPES[keyof typeof DATABASE_TYPES];

interface SavedConnection {
  id: string
  name: string
  type: DatabaseType
  config: {
    host?: string
    port?: number
    database?: string
    username?: string
    password?: string
    filename?: string
  }
  lastConnected?: Date
}

interface AppState {
  selectedConnectionId: string | null
  leftPanelWidth: number
  isLeftPanelMinimized: boolean
  expandedTables: string[]
  queryHistory: { connectionId: string; query: string; timestamp: Date }[]
}

class StorageService {
  // Get all saved connections
  static getConnections(): SavedConnection[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONNECTIONS)
      if (!data) return []
      
      const connections = JSON.parse(data) as SavedConnection[]
      
      // Return connections without sensitive data
      return connections.map(conn => ({
        ...conn,
        config: {
          ...conn.config,
          host: undefined,     // Remove sensitive host data
          database: undefined, // Remove sensitive database name
          username: undefined, // Remove sensitive username
          password: undefined  // Remove sensitive password
        },
        lastConnected: conn.lastConnected ? new Date(conn.lastConnected) : undefined
      }))
    } catch (error) {
      logWarning('Failed to load connections', { operation: 'loadConnections' })
      return []
    }
  }
  
  static saveConnection(connection: SavedConnection): void {
    try {
      const connections = this.getConnections()
      const existingIndex = connections.findIndex(c => c.id === connection.id)
      
      // Store connection without sensitive data
      const sanitizedConnection = {
        ...connection,
        config: {
          ...connection.config,
          host: undefined,     // Don't store sensitive host data
          database: undefined, // Don't store sensitive database name
          username: undefined, // Don't store sensitive username
          password: undefined  // Don't store sensitive password
        }
      }
      
      if (existingIndex >= 0) {
        connections[existingIndex] = sanitizedConnection
      } else {
        connections.push(sanitizedConnection)
      }
      
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections))
    } catch (error) {
      logWarning('Failed to save connection', { operation: 'saveConnection', connectionId: connection.id })
    }
  }
  
  static removeConnection(connectionId: string): void {
    try {
      const connections = this.getConnections().filter(c => c.id !== connectionId)
      localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections))
    } catch (error) {
      logWarning('Failed to remove connection', { operation: 'removeConnection', connectionId })
    }
  }
  
  static updateConnectionLastUsed(connectionId: string): void {
    try {
      const connections = this.getConnections()
      const connection = connections.find(c => c.id === connectionId)
      if (connection) {
        connection.lastConnected = new Date()
        this.saveConnection(connection)
      }
    } catch (error) {
      logWarning('Failed to update connection timestamp', { operation: 'updateConnectionTimestamp', connectionId })
    }
  }
  
  // App State Management
  static saveAppState(state: Partial<AppState>): void {
    try {
      const currentState = this.getAppState()
      const newState = { ...currentState, ...state }
      localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(newState))
    } catch (error) {
      logWarning('Failed to save app state', { operation: 'saveAppState' })
    }
  }
  
  static getAppState(): AppState {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APP_STATE)
      if (!data) {
        return this.getDefaultAppState()
      }
      
      const state = JSON.parse(data) as AppState
      
      // Convert date strings back to Date objects
      state.queryHistory = state.queryHistory?.map(query => ({
        ...query,
        timestamp: new Date(query.timestamp)
      })) || []
      
      return { ...this.getDefaultAppState(), ...state }
    } catch (error) {
      logWarning('Failed to load app state', { operation: 'getAppState' })
      return this.getDefaultAppState()
    }
  }
  
  private static getDefaultAppState(): AppState {
    return {
      selectedConnectionId: null,
      leftPanelWidth: 320,
      isLeftPanelMinimized: false,
      expandedTables: [],
      queryHistory: []
    }
  }
  
  // Query History
  static addToQueryHistory(connectionId: string, query: string): void {
    try {
      const state = this.getAppState()
      const historyEntry = {
        connectionId,
        query,
        timestamp: new Date()
      }
      
      // Keep last 50 queries per connection
      state.queryHistory = [
        historyEntry,
        ...state.queryHistory.filter(h => h.connectionId === connectionId).slice(0, 49),
        ...state.queryHistory.filter(h => h.connectionId !== connectionId)
      ]
      
      this.saveAppState({ queryHistory: state.queryHistory })
    } catch (error) {
      logWarning('Failed to save query to history', { operation: 'saveQueryToHistory', connectionId })
    }
  }
  
  static getQueryHistory(connectionId: string): { query: string; timestamp: Date }[] {
    try {
      const state = this.getAppState()
      return state.queryHistory
        .filter(h => h.connectionId === connectionId)
        .map(h => ({ query: h.query, timestamp: h.timestamp }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      logWarning('Failed to load query history', { operation: 'getQueryHistory', connectionId })
      return []
    }
  }
  
  // Utility Methods
  static clearAllData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CONNECTIONS)
      localStorage.removeItem(STORAGE_KEYS.APP_STATE)
    } catch (error) {
      logWarning('Failed to clear storage', { operation: 'clearAll' })
    }
  }
  
  static exportConnections(): string {
    try {
      const connections = this.getConnections()
      // Remove sensitive data for export
      const exportData = connections.map(conn => ({
        ...conn,
        config: {
          ...conn.config,
          host: undefined,     // Don't export encrypted host
          database: undefined, // Don't export encrypted database name
          username: undefined, // Don't export encrypted username
          password: undefined  // Don't export passwords
        }
      }))
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      logWarning('Failed to export connections', { operation: 'exportConnections' })
      return '[]'
    }
  }
}

export default StorageService
export type { SavedConnection, AppState } 