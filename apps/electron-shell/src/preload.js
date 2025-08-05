// Preload script for Electron security
// This runs in a sandboxed context before the web page loads

const { contextBridge, ipcRenderer } = require('electron')

// Expose minimal APIs to the renderer process if needed
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any secure APIs here if needed in the future
  platform: process.platform,
  version: process.versions.electron,
  
  // File system APIs for file access
  fileSystem: {
    // Check if a file exists and is accessible
    fileExists: (filePath) => {
      return ipcRenderer.invoke('fs:fileExists', filePath)
    },
    
    // Get file stats (size, permissions, etc.)
    getFileStats: (filePath) => {
      return ipcRenderer.invoke('fs:getFileStats', filePath)
    },
    
    // Normalize and resolve file paths across platforms
    resolvePath: (filePath) => {
      return ipcRenderer.invoke('fs:resolvePath', filePath)
    },
    
    // Get user's home directory
    getHomeDirectory: () => {
      return ipcRenderer.invoke('fs:getHomeDirectory')
    }
  },
  
  // File dialog APIs
  dialog: {
    // Open file dialog for CSV/Excel files
    openFile: () => {
      return ipcRenderer.invoke('dialog:openFile')
    }
  }
})

console.log('Preload script loaded successfully') 