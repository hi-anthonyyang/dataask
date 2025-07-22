// Local storage service for persisting app state (DBeaver-style)

interface SavedConnection {
  id: string
  name: string
  type: 'postgresql' | 'sqlite'
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
  private static readonly CONNECTIONS_KEY = 'dataask_connections'
  private static readonly APP_STATE_KEY = 'dataask_app_state'
  
  // Connection Management
  static saveConnection(connection: SavedConnection): void {
    try {
      const connections = this.getConnections()
      const existingIndex = connections.findIndex(c => c.id === connection.id)
      
      // Encrypt sensitive data (basic obfuscation for MVP)
      const encryptedConnection = {
        ...connection,
        config: {
          ...connection.config,
          password: connection.config.password ? btoa(connection.config.password) : undefined
        }
      }
      
      if (existingIndex >= 0) {
        connections[existingIndex] = encryptedConnection
      } else {
        connections.push(encryptedConnection)
      }
      
      localStorage.setItem(this.CONNECTIONS_KEY, JSON.stringify(connections))
    } catch (error) {
      console.warn('Failed to save connection:', error)
    }
  }
  
  static getConnections(): SavedConnection[] {
    try {
      const data = localStorage.getItem(this.CONNECTIONS_KEY)
      if (!data) return []
      
      const connections = JSON.parse(data) as SavedConnection[]
      
      // Decrypt sensitive data
      return connections.map(conn => ({
        ...conn,
        config: {
          ...conn.config,
          password: conn.config.password ? atob(conn.config.password) : undefined
        },
        lastConnected: conn.lastConnected ? new Date(conn.lastConnected) : undefined
      }))
    } catch (error) {
      console.warn('Failed to load connections:', error)
      return []
    }
  }
  
  static removeConnection(connectionId: string): void {
    try {
      const connections = this.getConnections().filter(c => c.id !== connectionId)
      localStorage.setItem(this.CONNECTIONS_KEY, JSON.stringify(connections))
    } catch (error) {
      console.warn('Failed to remove connection:', error)
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
      console.warn('Failed to update connection timestamp:', error)
    }
  }
  
  // App State Management
  static saveAppState(state: Partial<AppState>): void {
    try {
      const currentState = this.getAppState()
      const newState = { ...currentState, ...state }
      localStorage.setItem(this.APP_STATE_KEY, JSON.stringify(newState))
    } catch (error) {
      console.warn('Failed to save app state:', error)
    }
  }
  
  static getAppState(): AppState {
    try {
      const data = localStorage.getItem(this.APP_STATE_KEY)
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
      console.warn('Failed to load app state:', error)
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
      console.warn('Failed to save query to history:', error)
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
      console.warn('Failed to load query history:', error)
      return []
    }
  }
  
  // Utility Methods
  static clearAllData(): void {
    try {
      localStorage.removeItem(this.CONNECTIONS_KEY)
      localStorage.removeItem(this.APP_STATE_KEY)
    } catch (error) {
      console.warn('Failed to clear storage:', error)
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
          password: undefined // Don't export passwords
        }
      }))
      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.warn('Failed to export connections:', error)
      return '[]'
    }
  }
}

export default StorageService
export type { SavedConnection, AppState } 