import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as sqlite3 from 'sqlite3'

const isDev = process.env.NODE_ENV === 'development'

console.log('🔧 Electron starting...', { isDev, NODE_ENV: process.env.NODE_ENV })

// Store active database connections
const activeConnections = new Map<string, sqlite3.Database>()

// Generate unique connection ID
function generateConnectionId(): string {
  return 'electron_' + Math.random().toString(36).substr(2, 9)
}

// IPC Handlers for file system operations and database management
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

  // Test SQLite database connection
  ipcMain.handle('db:testConnection', async (event, config) => {
    return new Promise((resolve) => {
      const { filename } = config.config
      
      if (!filename) {
        resolve({ success: false, message: 'SQLite filename is required' })
        return
      }

      // Test connection with timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, message: 'Connection test timed out' })
      }, 5000)

      const db = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, (err) => {
        clearTimeout(timeout)
        
        if (err) {
          resolve({ success: false, message: `SQLite connection failed: ${err.message}` })
        } else {
          // Test with a simple query
          db.get('SELECT 1 as test', (queryErr) => {
            db.close()
            if (queryErr) {
              resolve({ success: false, message: `SQLite test query failed: ${queryErr.message}` })
            } else {
              resolve({ success: true, message: 'Connection successful' })
            }
          })
        }
      })
    })
  })

  // Create SQLite database connection
  ipcMain.handle('db:createConnection', async (event, config) => {
    return new Promise((resolve) => {
      const { filename } = config.config
      const connectionId = generateConnectionId()
      
      const db = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
          resolve({ error: `Failed to connect to SQLite database: ${err.message}` })
        } else {
          activeConnections.set(connectionId, db)
          resolve({ connectionId, message: 'Connection created successfully' })
        }
      })
    })
  })

  // Get database schema
  ipcMain.handle('db:getSchema', async (event, connectionId) => {
    return new Promise((resolve) => {
      const db = activeConnections.get(connectionId)
      if (!db) {
        resolve({ error: 'Database connection not found' })
        return
      }

      db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `, (err, tables) => {
        if (err) {
          resolve({ error: `Failed to retrieve schema: ${err.message}` })
          return
        }

        const schemaPromises = tables.map((table: any) => {
          return new Promise((resolveTable) => {
            db.all(`PRAGMA table_info(${table.name})`, (colErr, columns) => {
              if (colErr) {
                resolveTable({ name: table.name, columns: [] })
              } else {
                const formattedColumns = columns.map((col: any) => ({
                  name: col.name,
                  type: col.type,
                  nullable: !col.notnull,
                  primaryKey: !!col.pk
                }))
                resolveTable({ name: table.name, columns: formattedColumns })
              }
            })
          })
        })

        Promise.all(schemaPromises).then((tablesWithColumns) => {
          resolve({ schema: { tables: tablesWithColumns } })
        })
      })
    })
  })

  // Execute SQL query
  ipcMain.handle('db:executeQuery', async (event, connectionId, sql, params = []) => {
    return new Promise((resolve) => {
      const db = activeConnections.get(connectionId)
      if (!db) {
        resolve({ error: 'Database connection not found' })
        return
      }

      const startTime = Date.now()
      
      db.all(sql, params, (err, rows) => {
        const executionTime = Date.now() - startTime
        
        if (err) {
          resolve({ error: err.message })
        } else {
          // Get column information from the first row
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

  // List active connections
  ipcMain.handle('db:listConnections', async () => {
    const connections = Array.from(activeConnections.keys()).map(id => ({
      id,
      name: `SQLite Database`,
      type: 'sqlite'
    }))
    return { connections }
  })

  // Delete connection
  ipcMain.handle('db:deleteConnection', async (event, connectionId) => {
    const db = activeConnections.get(connectionId)
    if (db) {
      return new Promise((resolve) => {
        db.close((err) => {
          activeConnections.delete(connectionId)
          if (err) {
            resolve({ error: `Failed to close connection: ${err.message}` })
          } else {
            resolve({ message: 'Connection deleted successfully' })
          }
        })
      })
    }
    return { message: 'Connection not found' }
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
  // Close all database connections before quitting
  activeConnections.forEach((db, connectionId) => {
    db.close()
  })
  activeConnections.clear()
  
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