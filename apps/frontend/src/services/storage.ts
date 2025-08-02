// Local storage service for persisting app state (DBeaver-style)
import CryptoJS from 'crypto-js'
import { STORAGE_KEYS, DATABASE_TYPES } from '../utils/constants'
import { logWarning } from './error'

// Secure encryption key derivation
const getEncryptionKey = (): string => {
  // Use environment variable if available, otherwise derive from domain
  const envKey = (window as Window & { __DATAASK_ENCRYPTION_KEY__?: string }).__DATAASK_ENCRYPTION_KEY__ || 
                 localStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
  
  if (envKey) return envKey;
  
  // Derive key from domain and timestamp for better security than hardcoded
  const domain = window.location.hostname || 'localhost';
  const appVersion = 'v1.0.0';
  const derivedKey = CryptoJS.SHA256(`dataask-${domain}-${appVersion}`).toString();
  
  // Cache the derived key
  localStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, derivedKey);
  return derivedKey;
};

const ENCRYPTION_KEY = getEncryptionKey();

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
      
      // Decrypt sensitive data (with migration from old base64)
      return connections.map(conn => ({
        ...conn,
        config: {
          ...conn.config,
          host: conn.config.host ? (() => {
            try {
              return CryptoJS.AES.decrypt(conn.config.host, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            } catch {
              return conn.config.host; // Return as-is if decryption fails (migration)
            }
          })() : undefined,
          database: conn.config.database ? (() => {
            try {
              return CryptoJS.AES.decrypt(conn.config.database, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            } catch {
              return conn.config.database; // Return as-is if decryption fails (migration)
            }
          })() : undefined,
          username: conn.config.username ? (() => {
            try {
              return CryptoJS.AES.decrypt(conn.config.username, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            } catch {
              return conn.config.username; // Return as-is if decryption fails (migration)
            }
          })() : undefined,
          password: conn.config.password ? (() => {
            try {
              // Try AES decryption first
              return CryptoJS.AES.decrypt(conn.config.password, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
            } catch {
              try {
                // Fallback to old base64 for migration
                const oldPassword = atob(conn.config.password);
                // Re-save with new encryption
                this.saveConnection({...conn, config: {...conn.config, password: oldPassword}});
                return oldPassword;
              } catch {
                return undefined;
              }
            }
          })() : undefined
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
      
      // Encrypt sensitive data (AES encryption)
      const encryptedConnection = {
        ...connection,
        config: {
          ...connection.config,
          host: connection.config.host ? CryptoJS.AES.encrypt(connection.config.host, ENCRYPTION_KEY).toString() : undefined,
          database: connection.config.database ? CryptoJS.AES.encrypt(connection.config.database, ENCRYPTION_KEY).toString() : undefined,
          username: connection.config.username ? CryptoJS.AES.encrypt(connection.config.username, ENCRYPTION_KEY).toString() : undefined,
          password: connection.config.password ? CryptoJS.AES.encrypt(connection.config.password, ENCRYPTION_KEY).toString() : undefined
        }
      }
      
      if (existingIndex >= 0) {
        connections[existingIndex] = encryptedConnection
      } else {
        connections.push(encryptedConnection)
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