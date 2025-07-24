// Preload script for Electron security
// This runs in a sandboxed context before the web page loads

const { contextBridge } = require('electron')

// Expose minimal APIs to the renderer process if needed
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any secure APIs here if needed in the future
  platform: process.platform,
  version: process.versions.electron
})

console.log('Preload script loaded successfully') 