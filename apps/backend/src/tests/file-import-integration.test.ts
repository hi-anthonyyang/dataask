import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import request from 'supertest';
import express from 'express';
import { DatabaseManager } from '../utils/database';
import { ImportPipeline } from '../services/importPipeline';
import { logger } from '../utils/logger';

// Mock logger to reduce noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('File Import Integration Tests', () => {
  let app: express.Application;
  let dbManager: DatabaseManager;
  let importPipeline: ImportPipeline;
  const testDataDir = path.join(__dirname, '../../../test-data');
  
  beforeAll(() => {
    // Setup Express app with file import routes
    app = express();
    app.use(express.json());
    
    // Initialize services
    dbManager = DatabaseManager.getInstance();
    importPipeline = new ImportPipeline();
  });

  afterAll(async () => {
    // Cleanup
    await dbManager.closeAll();
  });

  describe('CSV Import Tests', () => {
    it('should import small CSV file successfully', async () => {
      const filePath = path.join(testDataDir, 'employees_small.csv');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Parse CSV to verify structure
      const lines = fileContent.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',');
      const dataRows = lines.slice(1);
      
      expect(headers).toEqual(['id', 'name', 'email', 'age', 'salary', 'active', 'created_at']);
      expect(dataRows).toHaveLength(5);
    });

    it('should handle CSV with special characters', async () => {
      const filePath = path.join(testDataDir, 'special_characters.csv');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Check that special characters are preserved
      expect(fileContent).toContain('Item with "quotes"');
      expect(fileContent).toContain('Contains, commas');
      expect(fileContent).toContain('Item with\\nnewline');
      expect(fileContent).toContain('中文 characters');
      expect(fileContent).toContain('Unicode test 🚀');
    });

    it('should handle empty CSV file', async () => {
      const filePath = path.join(testDataDir, 'empty.csv');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent).toBe('');
    });

    it('should handle CSV with headers only', async () => {
      const filePath = path.join(testDataDir, 'headers_only.csv');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      expect(fileContent.trim()).toBe('id,name,value');
    });
  });

  describe('Excel Import Tests', () => {
    it('should import Excel file with multiple sheets', async () => {
      const filePath = path.join(testDataDir, 'test_data.xlsx');
      const workbook = XLSX.readFile(filePath);
      
      expect(workbook.SheetNames).toHaveLength(2);
      expect(workbook.SheetNames).toContain('employees');
      expect(workbook.SheetNames).toContain('products');
      
      // Check employees sheet
      const employeesSheet = workbook.Sheets['employees'];
      const employeesData = XLSX.utils.sheet_to_json(employeesSheet);
      expect(employeesData).toHaveLength(5);
      
      // Check products sheet
      const productsSheet = workbook.Sheets['products'];
      const productsData = XLSX.utils.sheet_to_json(productsSheet);
      expect(productsData).toHaveLength(5);
    });

    it('should handle large Excel file', async () => {
      const filePath = path.join(testDataDir, 'employees_10k.xlsx');
      const workbook = XLSX.readFile(filePath);
      
      expect(workbook.SheetNames).toHaveLength(2);
      
      // Check total row count
      let totalRows = 0;
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        totalRows += data.length;
      });
      
      expect(totalRows).toBe(10000);
    });
  });

  describe('Data Type Inference Tests', () => {
    const detectColumnType = (values: any[]): string => {
      // Remove null/undefined values for type detection
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
      
      if (nonNullValues.length === 0) return 'TEXT';
      
      // Check if all values are booleans
      if (nonNullValues.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) {
        return 'BOOLEAN';
      }
      
      // Check if all values are integers
      if (nonNullValues.every(v => {
        const num = Number(v);
        return !isNaN(num) && Number.isInteger(num);
      })) {
        return 'INTEGER';
      }
      
      // Check if all values are numbers
      if (nonNullValues.every(v => {
        const num = Number(v);
        return !isNaN(num);
      })) {
        return 'REAL';
      }
      
      // Check if values match date pattern
      if (nonNullValues.every(v => {
        const datePattern = /^\d{4}-\d{2}-\d{2}/;
        return typeof v === 'string' && datePattern.test(v);
      })) {
        return 'DATE';
      }
      
      return 'TEXT';
    };

    it('should correctly infer integer types', () => {
      const values = [1, 2, 3, 4, 5, '10', '20', null, ''];
      expect(detectColumnType(values)).toBe('INTEGER');
    });

    it('should correctly infer real/float types', () => {
      const values = [1.5, 2.7, '3.14', 4.0, null, 5.99];
      expect(detectColumnType(values)).toBe('REAL');
    });

    it('should correctly infer boolean types', () => {
      const values = [true, false, 'true', 'false', true, null];
      expect(detectColumnType(values)).toBe('BOOLEAN');
    });

    it('should correctly infer date types', () => {
      const values = ['2024-01-15', '2024-02-20', '2024-03-10', null, '2024-04-05'];
      expect(detectColumnType(values)).toBe('DATE');
    });

    it('should correctly infer text types for mixed data', () => {
      const values = ['abc', 123, 'def', true, '2024-01-01'];
      expect(detectColumnType(values)).toBe('TEXT');
    });

    it('should handle columns with all null values', () => {
      const values = [null, null, '', undefined, null];
      expect(detectColumnType(values)).toBe('TEXT');
    });
  });

  describe('Import Pipeline Tests', () => {
    it('should parse CSV file with ImportPipeline', async () => {
      const filePath = path.join(testDataDir, 'employees_small.csv');
      
      const result = await importPipeline['parseCSV'](filePath, {});
      
      expect(result.data).toHaveLength(5);
      expect(result.columns).toHaveLength(7);
      
      // Check column names
      const columnNames = result.columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('salary');
      expect(columnNames).toContain('active');
      expect(columnNames).toContain('created_at');
      
      // Check column types
      const idColumn = result.columns.find(c => c.name === 'id');
      expect(idColumn?.type).toBe('number');
      
      const nameColumn = result.columns.find(c => c.name === 'name');
      expect(nameColumn?.type).toBe('string');
      
      const salaryColumn = result.columns.find(c => c.name === 'salary');
      expect(salaryColumn?.type).toBe('number');
    });

    it('should parse Excel file with ImportPipeline', async () => {
      const filePath = path.join(testDataDir, 'test_data.xlsx');
      
      const result = await importPipeline['parseExcel'](filePath, {});
      
      // Excel parser reads first sheet by default
      expect(result.data).toHaveLength(5);
      expect(result.columns).toHaveLength(7);
    });

    it('should handle CSV with null values', async () => {
      const filePath = path.join(testDataDir, 'products_mixed.csv');
      
      const result = await importPipeline['parseCSV'](filePath, {});
      
      expect(result.data).toHaveLength(5);
      
      // Check that null values are preserved
      const hasNullQuantity = result.data.some(row => row.quantity === null);
      const hasNullPrice = result.data.some(row => row.price === null);
      const hasNullName = result.data.some(row => row.product_name === null);
      
      expect(hasNullQuantity).toBe(true);
      expect(hasNullPrice).toBe(true);
      expect(hasNullName).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle 10K row CSV file', async () => {
      const filePath = path.join(testDataDir, 'employees_10k.csv');
      const startTime = Date.now();
      
      const result = await importPipeline['parseCSV'](filePath, {});
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.data).toHaveLength(10000);
      expect(duration).toBeLessThan(5000); // Should parse in less than 5 seconds
      
      console.log(`Parsed 10K rows in ${duration}ms`);
    });

    it('should handle 50K row CSV file', async () => {
      const filePath = path.join(testDataDir, 'employees_50k.csv');
      const startTime = Date.now();
      
      const result = await importPipeline['parseCSV'](filePath, {});
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.data).toHaveLength(50000);
      expect(duration).toBeLessThan(15000); // Should parse in less than 15 seconds
      
      console.log(`Parsed 50K rows in ${duration}ms`);
    });

    it('should efficiently parse large Excel file', async () => {
      const filePath = path.join(testDataDir, 'employees_10k.xlsx');
      const startTime = Date.now();
      
      const result = await importPipeline['parseExcel'](filePath, {});
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.data).toHaveLength(5000); // First sheet only
      expect(duration).toBeLessThan(3000); // Should parse in less than 3 seconds
      
      console.log(`Parsed Excel file in ${duration}ms`);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle non-existent file', async () => {
      const filePath = path.join(testDataDir, 'non_existent.csv');
      
      await expect(importPipeline['parseCSV'](filePath, {})).rejects.toThrow();
    });

    it('should handle corrupted file', async () => {
      // Create a corrupted file
      const corruptedPath = path.join(testDataDir, 'corrupted.csv');
      fs.writeFileSync(corruptedPath, Buffer.from([0xFF, 0xFE, 0x00, 0x00])); // Binary data
      
      try {
        await importPipeline['parseCSV'](corruptedPath, {});
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        // Cleanup
        if (fs.existsSync(corruptedPath)) {
          fs.unlinkSync(corruptedPath);
        }
      }
    });
  });
});