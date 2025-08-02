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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}