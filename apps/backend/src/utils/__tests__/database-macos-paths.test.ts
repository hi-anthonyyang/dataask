import { DatabaseManager, ConnectionConfig } from '../database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sqlite3 from 'sqlite3';

describe('SQLite macOS Path Handling', () => {
  let databaseManager: DatabaseManager;
  let testDbPath: string;
  let homeTestDbPath: string;

  beforeAll(async () => {
    databaseManager = DatabaseManager.getInstance();
    
    // Create test database in /tmp (typical macOS temp location)
    testDbPath = '/tmp/test_macos_paths.db';
    
    // Create test database in user's home directory for ~ expansion tests
    homeTestDbPath = path.join(os.homedir(), 'test_macos_home.db');
    
    // Create test databases
    const createTestDb = (dbPath: string) => {
      return new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.serialize(() => {
            db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");
            db.run("INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')");
            db.run("INSERT INTO users (name, email) VALUES ('Jane Smith', 'jane@example.com')");
          });
          
          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    };

    await createTestDb(testDbPath);
    await createTestDb(homeTestDbPath);
  });

  afterAll(() => {
    // Clean up test databases
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(homeTestDbPath)) {
      fs.unlinkSync(homeTestDbPath);
    }
  });

  describe('macOS Absolute Path Handling', () => {
    test('should handle standard macOS absolute paths', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-absolute',
        type: 'sqlite',
        config: {
          filename: testDbPath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);
    });

    test('should handle macOS paths with /Users/ prefix', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-users',
        type: 'sqlite',
        config: {
          filename: homeTestDbPath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);
    });

    test('should handle paths with spaces (common in macOS)', async () => {
      const spacePath = '/tmp/test with spaces.db';
      
      // Create test db with spaces in name
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(spacePath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run("CREATE TABLE test (id INTEGER)", (err) => {
            if (err) reject(err);
            else {
              db.close(() => resolve());
            }
          });
        });
      });

      const config: ConnectionConfig = {
        name: 'test-macos-spaces',
        type: 'sqlite',
        config: {
          filename: spacePath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);

      // Clean up
      if (fs.existsSync(spacePath)) {
        fs.unlinkSync(spacePath);
      }
    });
  });

  describe('Home Directory Expansion', () => {
    test('should expand ~/ paths correctly', async () => {
      const relativePath = '~/test_macos_home.db';
      const config: ConnectionConfig = {
        name: 'test-macos-home-expansion',
        type: 'sqlite',
        config: {
          filename: relativePath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);
    });

    test('should handle ~/Documents/ paths', async () => {
      const documentsPath = path.join(os.homedir(), 'Documents');
      
      // Only test if Documents directory exists (common on macOS)
      if (fs.existsSync(documentsPath)) {
        const testDbInDocs = path.join(documentsPath, 'test_docs.db');
        
        // Create test database in Documents
        await new Promise<void>((resolve, reject) => {
          const db = new sqlite3.Database(testDbInDocs, (err) => {
            if (err) {
              reject(err);
              return;
            }
            db.run("CREATE TABLE test (id INTEGER)", (err) => {
              if (err) reject(err);
              else {
                db.close(() => resolve());
              }
            });
          });
        });

        const config: ConnectionConfig = {
          name: 'test-macos-documents',
          type: 'sqlite',
          config: {
            filename: '~/Documents/test_docs.db'
          }
        };

        const result = await databaseManager.testConnection(config);
        expect(result).toBe(true);

        // Clean up
        if (fs.existsSync(testDbInDocs)) {
          fs.unlinkSync(testDbInDocs);
        }
      }
    });

    test('should handle ~/Downloads/ paths', async () => {
      const downloadsPath = path.join(os.homedir(), 'Downloads');
      
      // Only test if Downloads directory exists (common on macOS)
      if (fs.existsSync(downloadsPath)) {
        const testDbInDownloads = path.join(downloadsPath, 'test_downloads.db');
        
        // Create test database in Downloads
        await new Promise<void>((resolve, reject) => {
          const db = new sqlite3.Database(testDbInDownloads, (err) => {
            if (err) {
              reject(err);
              return;
            }
            db.run("CREATE TABLE test (id INTEGER)", (err) => {
              if (err) reject(err);
              else {
                db.close(() => resolve());
              }
            });
          });
        });

        const config: ConnectionConfig = {
          name: 'test-macos-downloads',
          type: 'sqlite',
          config: {
            filename: '~/Downloads/test_downloads.db'
          }
        };

        const result = await databaseManager.testConnection(config);
        expect(result).toBe(true);

        // Clean up
        if (fs.existsSync(testDbInDownloads)) {
          fs.unlinkSync(testDbInDownloads);
        }
      }
    });
  });

  describe('Error Handling for macOS Paths', () => {
    test('should provide platform-specific error messages for non-existent files', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-nonexistent',
        type: 'sqlite',
        config: {
          filename: '/Users/nonexistent/database.db'
        }
      };

      await expect(databaseManager.testConnection(config)).rejects.toThrow(/SQLite file not found/);
      await expect(databaseManager.testConnection(config)).rejects.toThrow(/Platform:/);
      await expect(databaseManager.testConnection(config)).rejects.toThrow(/Browse.*button/);
    });

    test('should handle invalid home directory paths', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-invalid-home',
        type: 'sqlite',
        config: {
          filename: '~/nonexistent/database.db'
        }
      };

      await expect(databaseManager.testConnection(config)).rejects.toThrow(/SQLite file not found/);
    });

    test('should handle directory instead of file', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-directory',
        type: 'sqlite',
        config: {
          filename: '/tmp'  // This is a directory, not a file
        }
      };

      await expect(databaseManager.testConnection(config)).rejects.toThrow(/Path exists but is not a file/);
    });

    test('should handle paths with special characters', async () => {
      const specialPath = '/tmp/test-with-special-chars!@#$.db';
      
      // Create test db with special characters
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(specialPath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run("CREATE TABLE test (id INTEGER)", (err) => {
            if (err) reject(err);
            else {
              db.close(() => resolve());
            }
          });
        });
      });

      const config: ConnectionConfig = {
        name: 'test-macos-special-chars',
        type: 'sqlite',
        config: {
          filename: specialPath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);

      // Clean up
      if (fs.existsSync(specialPath)) {
        fs.unlinkSync(specialPath);
      }
    });
  });

  describe('Database Operations with macOS Paths', () => {
    test('should execute queries successfully with macOS paths', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-query',
        type: 'sqlite',
        config: {
          filename: testDbPath
        }
      };

      const connectionId = await databaseManager.createConnection(config);
      const result = await databaseManager.executeQuery(
        connectionId,
        'SELECT * FROM users',
        []
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toHaveProperty('name', 'John Doe');
      expect(result.rows[1]).toHaveProperty('name', 'Jane Smith');
      expect(result.rowCount).toBe(2);

      await databaseManager.deleteConnection(connectionId);
    });

    test('should get schema successfully with macOS paths', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-schema',
        type: 'sqlite',
        config: {
          filename: testDbPath
        }
      };

      const connectionId = await databaseManager.createConnection(config);
      const schema = await databaseManager.getSchema(connectionId);

      expect(schema.tables).toHaveLength(1);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[0].columns).toHaveLength(3);

      await databaseManager.deleteConnection(connectionId);
    });

    test('should handle concurrent connections with macOS paths', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-concurrent',
        type: 'sqlite',
        config: {
          filename: testDbPath
        }
      };

      // Create multiple connections simultaneously
      const connectionIds = await Promise.all([
        databaseManager.createConnection(config),
        databaseManager.createConnection(config),
        databaseManager.createConnection(config)
      ]);

      // Execute queries on all connections
      const results = await Promise.all(
        connectionIds.map((connId: string) => 
          databaseManager.executeQuery(connId, 'SELECT COUNT(*) as count FROM users', [])
        )
      );

      // All should succeed
      results.forEach((result: any) => {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].count).toBe(2);
      });

      // Close all connections
      await Promise.all(
        connectionIds.map((connId: string) => databaseManager.deleteConnection(connId))
      );
    });
  });

  describe('File Extension Validation', () => {
    test('should accept .db extension', async () => {
      const config: ConnectionConfig = {
        name: 'test-macos-db-ext',
        type: 'sqlite',
        config: {
          filename: testDbPath  // ends with .db
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);
    });

    test('should accept .sqlite extension', async () => {
      const sqlitePath = '/tmp/test.sqlite';
      
      // Create test database with .sqlite extension
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(sqlitePath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run("CREATE TABLE test (id INTEGER)", (err) => {
            if (err) reject(err);
            else {
              db.close(() => resolve());
            }
          });
        });
      });

      const config: ConnectionConfig = {
        name: 'test-macos-sqlite-ext',
        type: 'sqlite',
        config: {
          filename: sqlitePath
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);

      // Clean up
      if (fs.existsSync(sqlitePath)) {
        fs.unlinkSync(sqlitePath);
      }
    });

    test('should accept .sqlite3 extension', async () => {
      const sqlite3Path = '/tmp/test.sqlite3';
      
      // Create test database with .sqlite3 extension
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(sqlite3Path, (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run("CREATE TABLE test (id INTEGER)", (err) => {
            if (err) reject(err);
            else {
              db.close(() => resolve());
            }
          });
        });
      });

      const config: ConnectionConfig = {
        name: 'test-macos-sqlite3-ext',
        type: 'sqlite',
        config: {
          filename: sqlite3Path
        }
      };

      const result = await databaseManager.testConnection(config);
      expect(result).toBe(true);

      // Clean up
      if (fs.existsSync(sqlite3Path)) {
        fs.unlinkSync(sqlite3Path);
      }
    });
  });
});