// Preload script for Electron security
// This runs in a sandboxed context before the web page loads

const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

// Expose minimal APIs to the renderer process if needed
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any secure APIs here if needed in the future
  platform: process.platform,
  version: process.versions.electron,
  
  // File system APIs for SQLite database access
  fileSystem: {
    // Check if a file exists and is accessible
    fileExists: (filePath) => {
      try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      } catch {
        return false
      }
    },
    
    // Get file stats (size, permissions, etc.)
    getFileStats: (filePath) => {
      try {
        const stats = fs.statSync(filePath)
        return {
          exists: true,
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          readable: true, // We'll assume readable if we can stat it
          path: path.resolve(filePath)
        }
      } catch (error) {
        return {
          exists: false,
          error: error.message
        }
      }
    },
    
    // Normalize and resolve file paths across platforms
    resolvePath: (filePath) => {
      return path.resolve(filePath)
    },
    
    // Get user's home directory
    getHomeDirectory: () => {
      return require('os').homedir()
    }
  },
  
  // File dialog APIs
  dialog: {
    // Open file dialog for SQLite databases
    openDatabase: () => {
      return ipcRenderer.invoke('dialog:openDatabase')
    }
  }
})

console.log('Preload script loaded successfully') 