import { app, BrowserWindow, shell } from 'electron'
import * as path from 'path'

const isDev = process.env.NODE_ENV === 'development'

console.log('🔧 Electron starting...', { isDev, NODE_ENV: process.env.NODE_ENV })

function createWindow(): void {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    minHeight: 600,
    minWidth: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
  })

  // Show window when ready to prevent blank flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.log('✅ Electron window ready and shown')
  })

  // Load the React app
  if (isDev) {
    console.log('🌐 Loading development server: http://localhost:3000')
    mainWindow.loadURL('http://localhost:3000')
  } else {
    console.log('📁 Loading production build')
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'))
  }

  // Handle load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Failed to load:', { errorCode, errorDescription, validatedURL })
  })

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    console.log('🔴 Electron window closed')
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log('🚀 Electron app ready, creating window...')
  createWindow()

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

// Security: Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (navigationEvent, navigationURL) => {
    const parsedURL = new URL(navigationURL)
    
    if (parsedURL.origin !== 'http://localhost:3000' && !parsedURL.protocol.startsWith('file:')) {
      navigationEvent.preventDefault()
    }
  })
}) 