import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as sqlite3 from 'sqlite3'
import * as fs from 'fs'

const isDev = process.env.NODE_ENV === 'development'

console.log('🔧 Electron starting...', { isDev, NODE_ENV: process.env.NODE_ENV })

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

function executeSQLiteQuery(filePath: string, sql: string, params: any[] = []): Promise<any> {
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
            Object.keys(rows[0] as Record<string, any>).map(name => ({ name, type: 'unknown' })) : 
            []

          resolve({
            data: rows,
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
    for (const table of tablesResult.data) {
      const columnsResult = await executeSQLiteQuery(filePath, `PRAGMA table_info(${table.name})`)
      
      const columns = columnsResult.error ? [] : columnsResult.data.map((col: any) => ({
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
  console.log('🚀 Electron app ready, setting up IPC handlers...')
  setupIpcHandlers()
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