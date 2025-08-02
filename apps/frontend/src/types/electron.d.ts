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

  sqlite: {
    validateFile: (filePath: string) => Promise<{
      valid: boolean
      error?: string
    }>
    getSchema: (filePath: string) => Promise<{
      schema?: { tables: any[] }
      error?: string
    }>
    executeQuery: (filePath: string, sql: string, params?: any[]) => Promise<{
      data?: any[]
      rowCount?: number
      fields?: any[]
      executionTime?: number
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