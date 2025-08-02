# Cross-Platform SQLite Support

DataAsk now provides enhanced cross-platform support for SQLite databases, addressing compatibility issues between macOS, Windows, and Linux environments.

## Features

### 🎯 **Enhanced File Path Resolution**
- **Platform Detection**: Automatically detects the operating system and provides platform-specific guidance
- **Path Normalization**: Handles different path formats across operating systems
- **Home Directory Expansion**: Supports `~/` shortcuts on Unix-like systems
- **Better Error Messages**: Provides actionable suggestions when files aren't found

### 🗂️ **Native File Browser Integration (Electron)**
- **Browse Button**: Native file dialog for selecting SQLite databases
- **Real-time Validation**: Instant feedback on file existence and accessibility
- **File Type Filtering**: Automatically filters for `.db`, `.sqlite`, `.sqlite3` files
- **Cross-platform Paths**: Automatically handles platform-specific path formats

### 🌐 **Web Fallback Support**
- **Upload Option**: File upload capability when running in web browsers
- **Graceful Degradation**: Seamlessly switches between native and web interfaces

## Usage

### In Electron App (Desktop)

1. **Using the Browse Button** (Recommended)
   - Click "Browse..." next to the file path input
   - Select your SQLite database file using the native file dialog
   - Path is automatically populated and validated

2. **Manual Path Entry**
   - Enter the full path to your SQLite database
   - Supports various formats:
     - **macOS**: `/Users/username/Documents/database.db`
     - **Windows**: `C:\Users\username\Documents\database.db`
     - **Linux**: `/home/username/Documents/database.db`
   - Home directory shortcuts: `~/Documents/database.db`

### In Web Browser

1. **Upload File** (Coming Soon)
   - Click "Upload" to select and upload your SQLite file
   - File is temporarily stored for analysis

## Platform-Specific Considerations

### macOS
- Use forward slashes: `/Users/username/path/to/database.db`
- Home directory: `~/Documents/database.db`
- Common locations: `/Users/[username]/Downloads/`, `/Users/[username]/Documents/`

### Windows
- Use backslashes or forward slashes: `C:\Users\username\database.db`
- Network paths supported: `\\server\share\database.db`
- Common locations: `C:\Users\[username]\Downloads\`, `C:\Users\[username]\Documents\`

### Linux
- Use forward slashes: `/home/username/database.db`
- Home directory: `~/database.db`
- Common locations: `/home/[username]/Downloads/`, `/home/[username]/Documents/`

## Error Handling

The enhanced error handling provides specific guidance based on your platform:

```
SQLite file not found: /path/to/database.db

Platform: macOS
Suggestions:
• Verify the file path is correct for your operating system
• On macOS, use the "Browse..." button to select the file
• Ensure the file has a .db, .sqlite, or .sqlite3 extension
• Check that the file is not in a restricted directory
```

## Technical Implementation

### Backend Enhancements
- **Enhanced Path Resolution**: `apps/backend/src/utils/database.ts`
  - Cross-platform path normalization
  - Home directory expansion
  - Better file existence checks
  - Platform-specific error messages

### Frontend Enhancements
- **File Browser Integration**: `apps/frontend/src/components/ConnectionModal.tsx`
  - Native file dialog support
  - Real-time file validation
  - TypeScript definitions for Electron APIs

### Electron Integration
- **IPC Handlers**: `apps/electron-shell/src/main.ts`
  - File dialog implementation
  - Cross-platform file access
- **Preload Script**: `apps/electron-shell/src/preload.js`
  - Secure file system APIs
  - Platform detection

## Migration Guide

### For Existing Users
1. **Update your file paths** to use the correct format for your operating system
2. **Use the Browse button** for the most reliable file selection
3. **Check file permissions** if you encounter access errors

### For Developers
1. **Use the new Electron APIs** for file system operations
2. **Import TypeScript definitions** for proper type safety
3. **Handle both Electron and web environments** in your components

## Troubleshooting

### Common Issues

1. **"File not found" errors**
   - Use the Browse button to ensure correct path
   - Check file permissions
   - Verify file extension is `.db`, `.sqlite`, or `.sqlite3`

2. **Permission denied**
   - Ensure the directory is readable
   - On macOS, grant Full Disk Access if needed
   - Check that the file isn't locked by another application

3. **Path format issues**
   - Use forward slashes on Unix-like systems
   - Use backslashes or forward slashes on Windows
   - Avoid spaces in file names when possible

### Getting Help

If you encounter issues:
1. Check the error message for platform-specific guidance
2. Try using the Browse button instead of manual path entry
3. Verify file permissions and accessibility
4. Check the console for detailed error logs

## Future Enhancements

- **Drag & Drop Support**: Drop SQLite files directly onto the interface
- **Recent Files**: Quick access to recently used databases
- **Cloud Storage Integration**: Support for databases stored in cloud services
- **Database Creation**: Create new SQLite databases from the interface