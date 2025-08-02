// TypeScript declarations for Electron APIs exposed via preload script

interface ElectronAPI {
  platform: string
  version: string
  
  fileSystem: {
    fileExists: (filePath: string) => boolean
    getFileStats: (filePath: string) => {
      exists: boolean
      size?: number
      isFile?: boolean
      isDirectory?: boolean
      readable?: boolean
      path?: string
      error?: string
    }
    resolvePath: (filePath: string) => string
    getHomeDirectory: () => string
  }
  
  dialog: {
    openDatabase: () => Promise<{
      canceled: boolean
      filePath?: string
    }>
  }

  database: {
    testConnection: (config: any) => Promise<{
      success: boolean
      message: string
    }>
    createConnection: (config: any) => Promise<{
      connectionId?: string
      message?: string
      error?: string
    }>
    getSchema: (connectionId: string) => Promise<{
      schema?: { tables: any[] }
      error?: string
    }>
    executeQuery: (connectionId: string, sql: string, params?: any[]) => Promise<{
      data?: any[]
      rowCount?: number
      fields?: any[]
      executionTime?: number
      error?: string
    }>
    listConnections: () => Promise<{
      connections: Array<{
        id: string
        name: string
        type: string
      }>
    }>
    deleteConnection: (connectionId: string) => Promise<{
      message: string
      error?: string
    }>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}