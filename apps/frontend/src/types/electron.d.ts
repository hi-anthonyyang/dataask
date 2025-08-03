// TypeScript declarations for Electron APIs exposed via preload script
import type { DatabaseSchema, DatabaseField } from './index'

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
    openFile: () => Promise<{
      success: boolean
      canceled?: boolean
      filePath?: string
      fileName?: string
    }>
  }

  sqlite: {
    validateFile: (filePath: string) => Promise<{
      valid: boolean
      error?: string
    }>
    getSchema: (filePath: string) => Promise<{
      schema?: DatabaseSchema
      error?: string
    }>
          executeQuery: (filePath: string, sql: string, params?: unknown[]) => Promise<{
        data?: Record<string, unknown>[]
        rowCount?: number
        fields?: DatabaseField[]
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