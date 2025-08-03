import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as sqlite3 from 'sqlite3'
import * as fs from 'fs'
import { spawn, ChildProcess } from 'child_process'

const isDev = process.env.NODE_ENV === 'development'

console.log('🔧 Electron starting...', { isDev, NODE_ENV: process.env.NODE_ENV })

// Backend server process management
let backendProcess: ChildProcess | null = null

function startBackendServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting backend server...')
    
    const backendPath = path.join(__dirname, '../../backend')
    const command = isDev ? 'npm' : 'node'
    const args = isDev ? ['run', 'dev'] : ['dist/server.js']
    
    backendProcess = spawn(command, args, {
      cwd: backendPath,
      env: { ...process.env, PORT: '3001' },
      shell: true
    })
    
    backendProcess.stdout?.on('data', (data) => {
      console.log(`[Backend] ${data}`)
      // Look for server ready message
      if (data.toString().includes('server running on port')) {
        console.log('✅ Backend server ready')
        resolve()
      }
    })
    
    backendProcess.stderr?.on('data', (data) => {
      console.error(`[Backend Error] ${data}`)
    })
    
    backendProcess.on('error', (error) => {
      console.error('❌ Failed to start backend server:', error)
      reject(error)
    })
    
    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend server exited with code ${code} and signal ${signal}`)
      backendProcess = null
    })
    
    // Set a timeout for server startup
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        resolve() // Assume server started even if we didn't see the message
      } else {
        reject(new Error('Backend server startup timeout'))
      }
    }, 10000) // 10 second timeout
  })
}

function stopBackendServer(): void {
  if (backendProcess && !backendProcess.killed) {
    console.log('🛑 Stopping backend server...')
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

// Simple SQLite operations - no connection management needed
function validateSQLiteFile(filePath: string): { valid: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' }
    }
    
    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' }
    }
    
    // Try to access the file for reading
    fs.accessSync(filePath, fs.constants.R_OK)
    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Cannot access file: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

function executeSQLiteQuery(filePath: string, sql: string, params: unknown[] = []): Promise<{
  data?: Record<string, unknown>[];
  rowCount?: number;
  fields?: Array<{name: string; type: string}>;
  executionTime?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        resolve({ error: `Failed to open database: ${err.message}` })
        return
      }

      const startTime = Date.now()
      db.all(sql, params, (queryErr, rows) => {
        const executionTime = Date.now() - startTime
        
        db.close() // Always close immediately after query
        
        if (queryErr) {
          resolve({ error: queryErr.message })
        } else {
          const fields = rows.length > 0 ? 
                          Object.keys(rows[0] as Record<string, unknown>).map(name => ({ name, type: 'unknown' })) : 
            []

          resolve({
            data: rows as Record<string, unknown>[],
            rowCount: rows.length,
            fields,
            executionTime
          })
        }
      })
    })
  })
}

// IPC Handlers for file system operations and simple SQLite access
function setupIpcHandlers(): void {
  // Handle file dialog for opening SQLite databases
  ipcMain.handle('dialog:openDatabase', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select SQLite Database',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
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
        error: error.message
      }
    }
  })

  ipcMain.handle('fs:resolvePath', async (event, filePath) => {
    return path.resolve(filePath)
  })

  ipcMain.handle('fs:getHomeDirectory', async () => {
    return require('os').homedir()
  })

  // Simple SQLite file validation
  ipcMain.handle('sqlite:validateFile', async (event, filePath) => {
    return validateSQLiteFile(filePath)
  })

  // Get SQLite database schema
  ipcMain.handle('sqlite:getSchema', async (event, filePath) => {
    const validation = validateSQLiteFile(filePath)
    if (!validation.valid) {
      return { error: validation.error }
    }

    // Get tables
    const tablesResult = await executeSQLiteQuery(filePath, `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    if (tablesResult.error) {
      return { error: tablesResult.error }
    }

    // Get columns for each table
    const tables = []
    for (const table of tablesResult.data || []) {
      const columnsResult = await executeSQLiteQuery(filePath, `PRAGMA table_info(${table.name})`)
      
      const columns = columnsResult.error ? [] : (columnsResult.data || []).map((col) => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        primaryKey: !!col.pk
      }))

      tables.push({ name: table.name, columns })
    }

    return { schema: { tables } }
  })

  // Execute SQLite query
  ipcMain.handle('sqlite:executeQuery', async (event, filePath, sql, params = []) => {
    const validation = validateSQLiteFile(filePath)
    if (!validation.valid) {
      return { error: validation.error }
    }

    return await executeSQLiteQuery(filePath, sql, params)
  })

  // Open file dialog for SQLite files
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select SQLite Database',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const fileName = path.basename(filePath)
      return { 
        success: true, 
        filePath,
        fileName
      }
    }

    return { success: false, canceled: true }
  })
}

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

  // Set Content Security Policy to remove the warning
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': isDev 
          ? ["default-src 'self' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*"]
          : ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"]
      }
    })
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
app.whenReady().then(async () => {
  console.log('🚀 Electron app ready, setting up IPC handlers...')
  
  // Start backend server first
  try {
    await startBackendServer()
  } catch (error) {
    console.error('Failed to start backend server:', error)
    dialog.showErrorBox('Backend Server Error', 'Failed to start the backend server. The application may not work properly.')
  }
  
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackendServer()
    app.quit()
  }
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

// Clean up on app quit
app.on('before-quit', () => {
  console.log('🔴 App quitting, cleaning up...')
  stopBackendServer()
})

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT')
  stopBackendServer()
  app.quit()
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM')
  stopBackendServer()
  app.quit()
}) 