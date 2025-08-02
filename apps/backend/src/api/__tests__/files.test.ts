import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../../utils/database';
import router from '../files';

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/files', router);

describe('File Import API', () => {
  let mockDbManager: jest.Mocked<DatabaseManager>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbManager = {
      createConnection: jest.fn().mockResolvedValue('test-connection-id'),
      executeQuery: jest.fn().mockResolvedValue({ rows: [] }),
      getInstance: jest.fn()
    } as any;
    
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue(mockDbManager);
  });

  afterEach(() => {
    // Clean up any test files
    const uploadsDir = path.join(__dirname, '../../../../uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.readdirSync(uploadsDir).forEach(file => {
        if (file.startsWith('test-')) {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      });
    }
  });

  describe('POST /api/files/import', () => {
    it('should handle file upload and return import ID', async () => {
      const testCSV = 'Column1,Column2,Column3\nValue1,Value2,Value3\nValue4,Value5,Value6';
      const testFile = Buffer.from(testCSV);
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .field('tableName', 'test_table')
        .expect(200);

      expect(response.body).toHaveProperty('connectionId');
      expect(response.body).toHaveProperty('importId');
      expect(response.body.tableName).toBe('test_table');
      expect(response.body.rowCount).toBe(2);
    });

    it('should reject invalid file types', async () => {
      const testFile = Buffer.from('invalid content');
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.txt')
        .field('tableName', 'test_table')
        .expect(400);

      expect(response.body.error).toContain('Invalid file type');
    });

    it('should require table name', async () => {
      const testCSV = 'Column1,Column2\nValue1,Value2';
      const testFile = Buffer.from(testCSV);
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .expect(400);

      expect(response.body.error).toBe('Table name is required');
    });

    it('should use bulk insert for better performance', async () => {
      // Create a CSV with 150 rows to test bulk insert
      const headers = 'ID,Name,Value';
      const rows = Array.from({ length: 150 }, (_, i) => 
        `${i + 1},Name${i + 1},${Math.random() * 100}`
      );
      const testCSV = [headers, ...rows].join('\n');
      const testFile = Buffer.from(testCSV);
      
      await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test-bulk.csv')
        .field('tableName', 'bulk_test')
        .expect(200);

      // Verify bulk insert was used (100 rows per insert)
      const insertCalls = mockDbManager.executeQuery.mock.calls
        .filter(call => call[1].includes('INSERT INTO'));
      
      // Should have 2 bulk inserts (100 + 50 rows)
      expect(insertCalls.length).toBe(2);
      
      // First insert should have 100 value sets
      const firstInsert = insertCalls[0][1];
      const valueMatches = firstInsert.match(/\([^)]+\)/g);
      expect(valueMatches).not.toBeNull();
      expect(valueMatches!.length).toBe(100);
    });
  });

  describe('GET /api/files/import-progress/:importId', () => {
    it('should return progress for valid import ID', async () => {
      // First create an import to get an ID
      const testCSV = 'Column1\nValue1';
      const testFile = Buffer.from(testCSV);
      
      const importResponse = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .field('tableName', 'test_table');
      
      const { importId } = importResponse.body;
      
      // Check progress
      const progressResponse = await request(app)
        .get(`/api/files/import-progress/${importId}`)
        .expect(200);

      expect(progressResponse.body).toHaveProperty('importId', importId);
      expect(progressResponse.body).toHaveProperty('status');
      expect(progressResponse.body).toHaveProperty('progress');
    });

    it('should return 404 for invalid import ID', async () => {
      const response = await request(app)
        .get('/api/files/import-progress/invalid-id')
        .expect(404);

      expect(response.body.error).toBe('Import not found');
    });
  });

  describe('Performance optimizations', () => {
    it('should handle large files efficiently', async () => {
      // Create a large CSV (10,000 rows)
      const headers = 'ID,Name,Age,Email,Phone';
      const rows = Array.from({ length: 10000 }, (_, i) => 
        `${i + 1},User${i + 1},${20 + (i % 50)},user${i + 1}@example.com,555-${String(i).padStart(4, '0')}`
      );
      const testCSV = [headers, ...rows].join('\n');
      const testFile = Buffer.from(testCSV);
      
      const startTime = Date.now();
      
      await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test-large.csv')
        .field('tableName', 'large_test')
        .expect(200);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 5 seconds for 10k rows)
      expect(duration).toBeLessThan(5000);
      
      // Verify bulk inserts were used
      const insertCalls = mockDbManager.executeQuery.mock.calls
        .filter(call => call[1].includes('INSERT INTO'));
      
      // Should have 100 bulk insert calls (10,000 / 100)
      expect(insertCalls.length).toBe(100);
    });

    it('should wrap inserts in transaction', async () => {
      const testCSV = 'Column1\nValue1\nValue2';
      const testFile = Buffer.from(testCSV);
      
      await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .field('tableName', 'test_table')
        .expect(200);

      // Verify transaction commands
      const queryCalls = mockDbManager.executeQuery.mock.calls;
      const beginTx = queryCalls.find(call => call[1] === 'BEGIN TRANSACTION');
      const commitTx = queryCalls.find(call => call[1] === 'COMMIT');
      
      expect(beginTx).toBeDefined();
      expect(commitTx).toBeDefined();
    });

    it('should rollback on error', async () => {
      // Make insert fail
      mockDbManager.executeQuery.mockImplementation((connId, query) => {
        if (query.includes('INSERT INTO')) {
          throw new Error('Insert failed');
        }
        return Promise.resolve({ rows: [], fields: [], rowCount: 0 });
      });

      const testCSV = 'Column1\nValue1';
      const testFile = Buffer.from(testCSV);
      
      await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .field('tableName', 'test_table')
        .expect(500);

      // Verify rollback was called
      const rollbackCall = mockDbManager.executeQuery.mock.calls
        .find(call => call[1] === 'ROLLBACK');
      
      expect(rollbackCall).toBeDefined();
    });
  });

  describe('File validation', () => {
    it('should handle empty files', async () => {
      const testFile = Buffer.from('');
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'empty.csv')
        .field('tableName', 'test_table')
        .expect(400);

      expect(response.body.error).toContain('empty');
    });

    it('should handle files with only headers', async () => {
      const testCSV = 'Column1,Column2,Column3';
      const testFile = Buffer.from(testCSV);
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'headers-only.csv')
        .field('tableName', 'test_table')
        .expect(400);

      expect(response.body.error).toContain('no data rows');
    });

    it('should sanitize table names', async () => {
      const testCSV = 'Column1\nValue1';
      const testFile = Buffer.from(testCSV);
      
      const response = await request(app)
        .post('/api/files/import')
        .attach('file', testFile, 'test.csv')
        .field('tableName', 'test-table!@#$%')
        .expect(200);

      // Table name should be sanitized
      expect(response.body.tableName).toBe('test_table_____');
    });
  });
});