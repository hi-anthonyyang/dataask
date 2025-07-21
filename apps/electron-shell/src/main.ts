import { app, BrowserWindow, shell } from 'electron'
import * as path from 'path'

const isDev = process.env.NODE_ENV === 'development'

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
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../../assets/icon.png'), // TODO: Add icon
  })

  // Load the React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
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
  contents.on('new-window', (navigationEvent, navigationURL, frameName, disposition) => {
    navigationEvent.preventDefault()
    shell.openExternal(navigationURL)
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