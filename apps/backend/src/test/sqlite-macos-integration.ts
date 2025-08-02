#!/usr/bin/env ts-node

/**
 * SQLite macOS Path Integration Test
 * 
 * This script demonstrates and tests the SQLite functionality
 * with various macOS file path formats to ensure cross-platform compatibility.
 */

import { DatabaseManager, ConnectionConfig } from '../utils/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sqlite3 from 'sqlite3';

interface TestResult {
  testName: string;
  path: string;
  success: boolean;
  error?: string;
  details?: any;
}

class SQLiteMacOSIntegrationTester {
  private databaseManager: DatabaseManager;
  private testResults: TestResult[] = [];
  private tempFiles: string[] = [];

  constructor() {
    this.databaseManager = DatabaseManager.getInstance();
  }

  /**
   * Create a test SQLite database
   */
  private async createTestDatabase(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.serialize(() => {
          db.run(`CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);

          db.run(`CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT
          )`);

          // Insert sample data
          const productStmt = db.prepare("INSERT INTO products (name, price, category) VALUES (?, ?, ?)");
          productStmt.run("MacBook Pro", 2499.99, "Electronics");
          productStmt.run("iPhone 15", 999.99, "Electronics");
          productStmt.run("AirPods Pro", 249.99, "Accessories");
          productStmt.finalize();

          const customerStmt = db.prepare("INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)");
          customerStmt.run("John Doe", "john@example.com", "+1-555-0123");
          customerStmt.run("Jane Smith", "jane@example.com", "+1-555-0456");
          customerStmt.finalize();
        });

        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Test a specific path format
   */
  private async testPathFormat(testName: string, dbPath: string): Promise<TestResult> {
    const result: TestResult = {
      testName,
      path: dbPath,
      success: false
    };

    try {
      // Test connection
      const config: ConnectionConfig = {
        name: `test-${testName.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'sqlite',
        filename: dbPath
      };

      const connectionTest = await this.databaseManager.testConnection(config);
      if (!connectionTest) {
        throw new Error('Connection test failed');
      }

      // Test operations
      const connectionId = await this.databaseManager.createConnection(config);

      // Test query execution
      const queryResult = await this.databaseManager.executeQuery(
        connectionId,
        'SELECT COUNT(*) as total_products FROM products WHERE category = ?',
        ['Electronics']
      );

      // Test schema retrieval
      const schema = await this.databaseManager.getSchema(connectionId);

      // Test complex query
      const complexQuery = await this.databaseManager.executeQuery(
        connectionId,
        `SELECT p.name, p.price, p.category 
         FROM products p 
         WHERE p.price > ? 
         ORDER BY p.price DESC`,
        [500]
      );

      await this.databaseManager.deleteConnection(connectionId);

      result.success = true;
      result.details = {
        electronicsCount: queryResult.rows[0].total_products,
        tablesFound: schema.tables.length,
        expensiveProducts: complexQuery.rows.length,
        sampleProduct: complexQuery.rows[0]
      };

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Run all path format tests
   */
  async runTests(): Promise<void> {
    console.log('🧪 SQLite macOS Path Integration Test');
    console.log('=====================================\n');

    // Test paths to create and test
    const testPaths = [
      {
        name: 'Absolute /tmp path',
        path: '/tmp/macos_test_absolute.db'
      },
      {
        name: 'Home directory expansion',
        path: '~/macos_test_home.db'
      },
      {
        name: 'Path with spaces',
        path: '/tmp/macOS Test Database.db'
      },
      {
        name: 'Path with special characters',
        path: '/tmp/test-db_v2.1@2024.db'
      }
    ];

    // Add Documents and Downloads paths if they exist
    const documentsPath = path.join(os.homedir(), 'Documents');
    const downloadsPath = path.join(os.homedir(), 'Downloads');

    if (fs.existsSync(documentsPath)) {
      testPaths.push({
        name: '~/Documents/ path',
        path: '~/Documents/macos_test_docs.db'
      });
    }

    if (fs.existsSync(downloadsPath)) {
      testPaths.push({
        name: '~/Downloads/ path',
        path: '~/Downloads/macos_test_downloads.db'
      });
    }

    // Create test databases and run tests
    for (const testPath of testPaths) {
      console.log(`📁 Testing: ${testPath.name}`);
      console.log(`   Path: ${testPath.path}`);

      try {
        // Resolve path for file creation
        let actualPath = testPath.path;
        if (actualPath.startsWith('~/')) {
          actualPath = path.join(os.homedir(), actualPath.slice(2));
        }

        // Create test database
        await this.createTestDatabase(actualPath);
        this.tempFiles.push(actualPath);

        // Test the path
        const result = await this.testPathFormat(testPath.name, testPath.path);
        this.testResults.push(result);

        if (result.success) {
          console.log(`   ✅ SUCCESS`);
          console.log(`      - Electronics products: ${result.details.electronicsCount}`);
          console.log(`      - Tables found: ${result.details.tablesFound}`);
          console.log(`      - Expensive products: ${result.details.expensiveProducts}`);
          if (result.details.sampleProduct) {
            console.log(`      - Sample product: ${result.details.sampleProduct.name} ($${result.details.sampleProduct.price})`);
          }
        } else {
          console.log(`   ❌ FAILED: ${result.error}`);
        }

      } catch (error) {
        console.log(`   ❌ SETUP FAILED: ${error instanceof Error ? error.message : String(error)}`);
        this.testResults.push({
          testName: testPath.name,
          path: testPath.path,
          success: false,
          error: `Setup failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      console.log('');
    }

    // Test error handling
    console.log('🚫 Testing Error Handling');
    console.log('==========================\n');

    const errorTests = [
      {
        name: 'Non-existent file',
        path: '/Users/nonexistent/database.db'
      },
      {
        name: 'Invalid home expansion',
        path: '~/nonexistent/database.db'
      },
      {
        name: 'Directory instead of file',
        path: '/tmp'
      }
    ];

    for (const errorTest of errorTests) {
      console.log(`🔍 Testing: ${errorTest.name}`);
      console.log(`   Path: ${errorTest.path}`);

      try {
        const config: ConnectionConfig = {
          name: `error-test-${errorTest.name.toLowerCase().replace(/\s+/g, '-')}`,
          type: 'sqlite',
          filename: errorTest.path
        };

        await this.databaseManager.testConnection(config);
        console.log(`   ❌ UNEXPECTED SUCCESS (should have failed)`);
      } catch (error) {
        console.log(`   ✅ CORRECTLY FAILED: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      }

      console.log('');
    }
  }

  /**
   * Print test summary
   */
  printSummary(): void {
    console.log('📊 Test Summary');
    console.log('===============\n');

    const successCount = this.testResults.filter(r => r.success).length;
    const totalCount = this.testResults.length;

    console.log(`Total Tests: ${totalCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${totalCount - successCount}`);
    console.log(`Success Rate: ${((successCount / totalCount) * 100).toFixed(1)}%\n`);

    if (successCount === totalCount) {
      console.log('🎉 All tests passed! SQLite macOS path handling is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the output above for details.');
      
      console.log('\nFailed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.testName}: ${r.error}`);
        });
    }

    console.log('\n🔧 Platform Information:');
    console.log(`   OS: ${os.platform()} ${os.release()}`);
    console.log(`   Architecture: ${os.arch()}`);
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Home Directory: ${os.homedir()}`);
  }

  /**
   * Clean up temporary files
   */
  cleanup(): void {
    console.log('\n🧹 Cleaning up temporary files...');
    
    for (const filePath of this.tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`   Deleted: ${filePath}`);
        }
      } catch (error) {
        console.log(`   Failed to delete ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

// Run the integration test
async function main() {
  const tester = new SQLiteMacOSIntegrationTester();

  try {
    await tester.runTests();
    tester.printSummary();
  } catch (error) {
    console.error('Integration test failed:', error);
    process.exit(1);
  } finally {
    tester.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { SQLiteMacOSIntegrationTester };