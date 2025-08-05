import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

const isDev = process.env.NODE_ENV === 'development'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const FRONTEND_URL = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../../frontend/dist/index.html')}`

console.log('🔧 Electron starting...', { isDev, NODE_ENV: process.env.NODE_ENV, BACKEND_URL, FRONTEND_URL })

// IPC Handlers for file system operations
function setupIpcHandlers(): void {
  // Handle file dialog for opening CSV/Excel files
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select CSV or Excel File',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.canceled) {
      return { canceled: true }
    }
    
    return {
      canceled: false,
      filePath: result.filePaths[0]
    }
  })

  // File system handlers
  ipcMain.handle('fs:fileExists', async (event, filePath) => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:getFileStats', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath)
      return {
        exists: true,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        readable: true,
        path: path.resolve(filePath)
      }
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('fs:resolvePath', async (event, filePath) => {
    return path.resolve(filePath)
  })

  ipcMain.handle('fs:getHomeDirectory', async () => {
    return require('os').homedir()
  })
}

function createWindow(): void {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  })

  // Set window title
  mainWindow.setTitle('DataAsk')

  // Load the frontend
  mainWindow.loadURL(FRONTEND_URL)

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    if (isDev) {
      // Open DevTools in development
      mainWindow.webContents.openDevTools()
    }
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    ;(global as any).mainWindow = null
  })

  // Store reference to window
  ;(global as any).mainWindow = mainWindow
}

// App event handlers
app.whenReady().then(() => {
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })
})

// Handle app quit
app.on('before-quit', () => {
  console.log('🔄 Electron shutting down...')
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
}) 
}) 