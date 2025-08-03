# SQLite Connection Guide

This guide explains how to use the SQLite connection functionality in DataAsk, including the connection creation form and file browser/picker features.

## Features

### 1. Connection Creation Form

The connection modal provides an intuitive interface for creating and managing SQLite database connections:

- **Connection Name**: A friendly name for your database connection
- **Database File**: The path to your SQLite database file
- **Test Connection**: Verify the connection before saving
- **File Browser**: Native file picker in Electron, HTML file input in web mode

### 2. File Browser/Picker

#### Electron Mode
When running in Electron, the application uses the native file dialog:
- Click the "Browse" button to open the system file picker
- Filter shows SQLite files (`.db`, `.sqlite`, `.sqlite3`) by default
- Full file path is captured and displayed
- Automatic name suggestion based on the filename

#### Web Mode
When running in a web browser:
- Uses HTML file input for file selection
- Limited to filename only (no full path access due to browser security)
- Supports the same file extensions as Electron mode

### 3. Connection Testing

Before saving a connection, you can test it to ensure:
- The file exists and is accessible
- The file is a valid SQLite database
- Read permissions are available

## Usage

### Creating a New Connection

1. Click the "Add Connection" button in the main interface
2. The connection modal will open with the following fields:
   - **Connection Name**: Enter a descriptive name (defaults to "SQLite Database")
   - **Database File**: Either:
     - Type the full path manually
     - Click "Browse" to use the file picker (Electron)
     - Click "Browse" to select a file (Web - filename only)
3. Click "Test Connection" to verify the database is accessible
4. Click "Add Connection" to save the connection

### Editing an Existing Connection

1. Click the edit button next to an existing connection
2. Modify the connection details as needed
3. Test the connection if you've changed the file path
4. Click "Update" to save changes

## Test Database

A test SQLite database is included for demonstration purposes:
- Location: `/workspace/test-database.sqlite`
- Contains sample tables: `users`, `products`, `orders`
- Pre-populated with test data

To create a new test database, run:
```bash
node scripts/create-test-db.js
```

## Running Tests

### Unit Tests
The ConnectionModal component has comprehensive test coverage:

```bash
cd apps/frontend
npm test -- ConnectionModal.test.tsx
```

Tests cover:
- Basic rendering and modal states
- Form interactions and validation
- File browser functionality (both Electron and web modes)
- Connection testing and creation
- Error handling

### Integration Tests
To test the full connection flow:

```typescript
import { runTests } from './src/test/test-sqlite-connection'
runTests()
```

## Technical Implementation

### Frontend Components
- **ConnectionModal.tsx**: Main UI component for connection management
- **database.ts**: Service layer for database operations
- **electron.d.ts**: TypeScript definitions for Electron APIs

### Electron Integration
- **main.ts**: IPC handlers for file dialog and SQLite operations
- **preload.js**: Secure API exposure to renderer process

### Key Features
1. **Platform Detection**: Automatically detects Electron vs web environment
2. **Graceful Fallback**: Falls back to HTML file input if Electron dialog fails
3. **Path Validation**: Validates file existence and accessibility
4. **Smart Defaults**: Suggests connection names based on filename

## Security Considerations

1. **Electron Context Isolation**: All file system access is handled through IPC
2. **Path Validation**: File paths are validated before database operations
3. **Read-Only by Default**: Initial connections are read-only for safety
4. **No Direct File System Access**: Web mode has no direct file system access

## Troubleshooting

### Common Issues

1. **"File not found" error**
   - Ensure the file path is correct and absolute
   - Check file permissions
   - Verify the file exists at the specified location

2. **"Not a valid SQLite database" error**
   - Ensure the file is actually a SQLite database
   - Check if the file is corrupted
   - Try opening it with a SQLite client

3. **Browse button not working**
   - In Electron: Check console for IPC errors
   - In Web: Ensure browser allows file input
   - Try the fallback manual path entry

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'dataask:*')
```

## Future Enhancements

1. **Drag and Drop**: Support dragging SQLite files into the modal
2. **Recent Files**: Show recently used database files
3. **Cloud Storage**: Support for cloud-hosted SQLite files
4. **Multiple Connections**: Connect to multiple databases simultaneously
5. **Connection Profiles**: Save and load connection profiles