import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../utils/database';
import app from '../app';

describe('File Import API', () => {
  let dbManager: DatabaseManager;
  const testDataDir = path.join(__dirname, 'test-data');
  const uploadDir = path.join(process.cwd(), 'uploads');
  const dataDir = path.join(process.cwd(), 'data');

  beforeEach(async () => {
    // Ensure directories exist
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    dbManager = DatabaseManager.getInstance();
  });

  afterEach(async () => {
    // Clean up test files
    const testFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('import_') || f.startsWith('upload_'));
    for (const file of testFiles) {
      fs.unlinkSync(path.join(dataDir, file));
    }
  });

  describe('CSV Import', () => {
    it('should import a CSV file successfully', async () => {
      // Create test CSV file
      const csvContent = `Name,Age,Email
John Doe,30,john@example.com
Jane Smith,25,jane@example.com
Bob Johnson,35,bob@example.com`;
      
      const csvPath = path.join(testDataDir, 'test.csv');
      fs.writeFileSync(csvPath, csvContent);

      const response = await request(app)
        .post('/api/files/import')
        .attach('file', csvPath)
        .field('tableName', 'test_users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('connectionId');
      expect(response.body).toHaveProperty('tableName', 'test_users');
      expect(response.body).toHaveProperty('rowCount', 3);
      expect(response.body).toHaveProperty('columns', 3);

      // Verify connection exists
      const connections = await dbManager.listConnections();
      const connection = connections.find(c => c.id === response.body.connectionId);
      expect(connection).toBeDefined();
      expect(connection?.name).toBe('test_users');

      // Clean up
      fs.unlinkSync(csvPath);
    });

    it('should handle CSV with special characters', async () => {
      const csvContent = `Product,Price,Description
"Widget, Large",29.99,"A large widget with special chars: @#$%"
"Gadget ""Pro""",49.99,"Professional gadget with quotes"`;
      
      const csvPath = path.join(testDataDir, 'special.csv');
      fs.writeFileSync(csvPath, csvContent);

      const response = await request(app)
        .post('/api/files/import')
        .attach('file', csvPath)
        .field('tableName', 'products');

      expect(response.status).toBe(200);
      expect(response.body.rowCount).toBe(2);

      fs.unlinkSync(csvPath);
    });

    it('should reject empty CSV files', async () => {
      const csvPath = path.join(testDataDir, 'empty.csv');
      fs.writeFileSync(csvPath, '');

      const response = await request(app)
        .post('/api/files/import')
        .attach('file', csvPath)
        .field('tableName', 'empty_table');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('empty');

      fs.unlinkSync(csvPath);
    });
  });

  describe('SQLite Upload', () => {
    it('should upload a SQLite database successfully', async () => {
      // Create a test SQLite database
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(testDataDir, 'test.db');
      
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err: any) => {
          if (err) reject(err);
          
          db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT
          )`, (err: any) => {
            if (err) reject(err);
            
            db.run(`INSERT INTO users (name, email) VALUES (?, ?)`, 
              ['Test User', 'test@example.com'], (err: any) => {
              if (err) reject(err);
              
              db.close((err: any) => {
                if (err) reject(err);
                resolve();
              });
            });
          });
        });
      });

      const response = await request(app)
        .post('/api/files/upload-sqlite')
        .attach('file', dbPath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('connectionId');
      expect(response.body).toHaveProperty('name', 'test');
      expect(response.body).toHaveProperty('type', 'sqlite');

      // Verify connection exists
      const connections = await dbManager.listConnections();
      const connection = connections.find(c => c.id === response.body.connectionId);
      expect(connection).toBeDefined();

      // Clean up
      fs.unlinkSync(dbPath);
    });

    it('should reject non-SQLite files', async () => {
      const txtPath = path.join(testDataDir, 'notadb.txt');
      fs.writeFileSync(txtPath, 'This is not a database');

      const response = await request(app)
        .post('/api/files/upload-sqlite')
        .attach('file', txtPath);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid file type');

      fs.unlinkSync(txtPath);
    });

    it('should reject corrupted SQLite files', async () => {
      const dbPath = path.join(testDataDir, 'corrupted.db');
      fs.writeFileSync(dbPath, 'SQLite format 3\0corrupted data');

      const response = await request(app)
        .post('/api/files/upload-sqlite')
        .attach('file', dbPath);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid SQLite database');

      fs.unlinkSync(dbPath);
    });
  });

  describe('Connection Synchronization', () => {
    it('should make connection immediately available after import', async () => {
      const csvContent = `ID,Value\n1,Test`;
      const csvPath = path.join(testDataDir, 'sync-test.csv');
      fs.writeFileSync(csvPath, csvContent);

      const response = await request(app)
        .post('/api/files/import')
        .attach('file', csvPath)
        .field('tableName', 'sync_test');

      expect(response.status).toBe(200);
      const connectionId = response.body.connectionId;

      // Immediately check if connection is available
      const connections = await dbManager.listConnections();
      const connection = connections.find(c => c.id === connectionId);
      
      expect(connection).toBeDefined();
      expect(connection?.id).toBe(connectionId);
      expect(connection?.name).toBe('sync_test');

      fs.unlinkSync(csvPath);
    });

    it('should handle concurrent imports', async () => {
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        const csvContent = `ID,Value\n${i},Test${i}`;
        const csvPath = path.join(testDataDir, `concurrent-${i}.csv`);
        fs.writeFileSync(csvPath, csvContent);

        const promise = request(app)
          .post('/api/files/import')
          .attach('file', csvPath)
          .field('tableName', `concurrent_test_${i}`)
          .then(response => {
            fs.unlinkSync(csvPath);
            return response;
          });

        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All imports should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('connectionId');
      });

      // All connections should be available
      const connections = await dbManager.listConnections();
      const connectionIds = responses.map(r => r.body.connectionId);
      
      connectionIds.forEach(id => {
        const connection = connections.find(c => c.id === id);
        expect(connection).toBeDefined();
      });
    });
  });

  describe('File Type Detection', () => {
    it('should accept various CSV extensions', async () => {
      const extensions = ['.csv', '.CSV'];
      
      for (const ext of extensions) {
        const csvContent = `Col1,Col2\nVal1,Val2`;
        const csvPath = path.join(testDataDir, `test${ext}`);
        fs.writeFileSync(csvPath, csvContent);

        const response = await request(app)
          .post('/api/files/import')
          .attach('file', csvPath)
          .field('tableName', 'extension_test');

        expect(response.status).toBe(200);
        fs.unlinkSync(csvPath);
      }
    });

    it('should accept various SQLite extensions', async () => {
      const extensions = ['.db', '.sqlite', '.sqlite3'];
      const sqlite3 = require('sqlite3').verbose();
      
      for (const ext of extensions) {
        const dbPath = path.join(testDataDir, `test${ext}`);
        
        // Create valid SQLite file
        await new Promise<void>((resolve, reject) => {
          const db = new sqlite3.Database(dbPath, (err: any) => {
            if (err) reject(err);
            db.close((err: any) => {
              if (err) reject(err);
              resolve();
            });
          });
        });

        const response = await request(app)
          .post('/api/files/upload-sqlite')
          .attach('file', dbPath);

        expect(response.status).toBe(200);
        fs.unlinkSync(dbPath);
      }
    });
  });
});