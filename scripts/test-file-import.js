const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.blue);
  console.log('='.repeat(60));
}

function logTest(name, status, details = '') {
  const statusSymbol = status === 'pass' ? '✅' : '❌';
  const statusColor = status === 'pass' ? colors.green : colors.red;
  console.log(`${statusSymbol} ${name} ${statusColor}[${status.toUpperCase()}]${colors.reset} ${details}`);
}

// Data type inference testing
function testDataTypeInference() {
  logSection('DATA TYPE INFERENCE TESTS');

  const detectColumnType = (values) => {
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    
    if (nonNullValues.length === 0) return 'TEXT';
    
    // Check if all values are booleans
    if (nonNullValues.every(v => typeof v === 'boolean' || v === 'true' || v === 'false' || v === true || v === false)) {
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

  // Test cases
  const testCases = [
    {
      name: 'Integer detection',
      values: [1, 2, 3, '4', '5', null, ''],
      expected: 'INTEGER'
    },
    {
      name: 'Real number detection',
      values: [1.5, 2.7, '3.14', 4.0, null],
      expected: 'REAL'
    },
    {
      name: 'Boolean detection',
      values: [true, false, 'true', 'false', null],
      expected: 'BOOLEAN'
    },
    {
      name: 'Date detection',
      values: ['2024-01-15', '2024-02-20', '2024-03-10', null],
      expected: 'DATE'
    },
    {
      name: 'Text detection (mixed types)',
      values: ['abc', 123, true, '2024-01-01'],
      expected: 'TEXT'
    },
    {
      name: 'Empty column detection',
      values: [null, null, '', undefined],
      expected: 'TEXT'
    }
  ];

  testCases.forEach(test => {
    const result = detectColumnType(test.values);
    const passed = result === test.expected;
    logTest(
      test.name,
      passed ? 'pass' : 'fail',
      `Expected: ${test.expected}, Got: ${result}`
    );
  });
}

// CSV parsing tests
async function testCSVParsing() {
  logSection('CSV PARSING TESTS');

  const testFiles = [
    {
      name: 'Small CSV file',
      file: 'employees_small.csv',
      expectedRows: 5,
      expectedColumns: 7
    },
    {
      name: 'CSV with special characters',
      file: 'special_characters.csv',
      expectedRows: 5,
      expectedColumns: 4
    },
    {
      name: 'Single column CSV',
      file: 'single_column.csv',
      expectedRows: 3,
      expectedColumns: 1
    }
  ];

  for (const test of testFiles) {
    try {
      const filePath = path.join(TEST_DATA_DIR, test.file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        logTest(test.name, 'fail', 'Empty file');
        continue;
      }

      const headers = lines[0].split(',');
      const dataRows = lines.slice(1);
      
      const rowsPassed = dataRows.length === test.expectedRows;
      const columnsPassed = headers.length === test.expectedColumns;
      
      logTest(
        test.name,
        rowsPassed && columnsPassed ? 'pass' : 'fail',
        `Rows: ${dataRows.length}/${test.expectedRows}, Columns: ${headers.length}/${test.expectedColumns}`
      );
    } catch (error) {
      logTest(test.name, 'fail', error.message);
    }
  }
}

// Excel parsing tests
async function testExcelParsing() {
  logSection('EXCEL PARSING TESTS');

  const testFiles = [
    {
      name: 'Multi-sheet Excel file',
      file: 'test_data.xlsx',
      expectedSheets: 2,
      expectedData: { employees: 5, products: 5 }
    },
    {
      name: 'Large Excel file',
      file: 'employees_10k.xlsx',
      expectedSheets: 2,
      totalRows: 10000
    }
  ];

  for (const test of testFiles) {
    try {
      const filePath = path.join(TEST_DATA_DIR, test.file);
      const workbook = XLSX.readFile(filePath);
      
      const sheetsPassed = workbook.SheetNames.length === test.expectedSheets;
      
      let details = `Sheets: ${workbook.SheetNames.length}/${test.expectedSheets}`;
      let allPassed = sheetsPassed;
      
      if (test.expectedData) {
        for (const [sheetName, expectedRows] of Object.entries(test.expectedData)) {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          const rowsPassed = data.length === expectedRows;
          allPassed = allPassed && rowsPassed;
          details += `, ${sheetName}: ${data.length}/${expectedRows} rows`;
        }
      }
      
      if (test.totalRows) {
        let totalRows = 0;
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          totalRows += data.length;
        });
        const totalPassed = totalRows === test.totalRows;
        allPassed = allPassed && totalPassed;
        details += `, Total rows: ${totalRows}/${test.totalRows}`;
      }
      
      logTest(test.name, allPassed ? 'pass' : 'fail', details);
    } catch (error) {
      logTest(test.name, 'fail', error.message);
    }
  }
}

// Performance tests
async function testPerformance() {
  logSection('PERFORMANCE TESTS');

  const performanceTests = [
    {
      name: '10K rows CSV parsing',
      file: 'employees_10k.csv',
      maxDuration: 2000,
      type: 'csv'
    },
    {
      name: '50K rows CSV parsing',
      file: 'employees_50k.csv',
      maxDuration: 5000,
      type: 'csv'
    },
    {
      name: '10K rows Excel parsing',
      file: 'employees_10k.xlsx',
      maxDuration: 3000,
      type: 'excel'
    }
  ];

  for (const test of performanceTests) {
    try {
      const filePath = path.join(TEST_DATA_DIR, test.file);
      const startTime = Date.now();
      
      if (test.type === 'csv') {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        // Simulate parsing
        lines.forEach(line => line.split(','));
      } else {
        const workbook = XLSX.readFile(filePath);
        workbook.SheetNames.forEach(sheetName => {
          XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });
      }
      
      const duration = Date.now() - startTime;
      const passed = duration <= test.maxDuration;
      
      logTest(
        test.name,
        passed ? 'pass' : 'fail',
        `Duration: ${duration}ms (max: ${test.maxDuration}ms)`
      );
    } catch (error) {
      logTest(test.name, 'fail', error.message);
    }
  }
}

// API integration test
async function testAPIImport() {
  logSection('API IMPORT TESTS');

  log('⚠️  Note: API tests require the backend server to be running', colors.yellow);
  
  const testFile = path.join(TEST_DATA_DIR, 'employees_small.csv');
  
  try {
    // Check if server is running
    const healthCheck = await fetch(`${API_BASE_URL}/health`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      log('Backend server is not running. Skipping API tests.', colors.yellow);
      return;
    }

    // Test file import
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('tableName', 'test_import_table');

    const response = await fetch(`${API_BASE_URL}/api/files/import`, {
      method: 'POST',
      body: form
    });

    const result = await response.json();
    
    if (response.ok && result.connectionId) {
      logTest('File import API', 'pass', `Connection ID: ${result.connectionId}`);
    } else {
      logTest('File import API', 'fail', result.error || 'Unknown error');
    }
  } catch (error) {
    logTest('File import API', 'fail', error.message);
  }
}

// Edge case tests
function testEdgeCases() {
  logSection('EDGE CASE TESTS');

  const edgeCases = [
    {
      name: 'Empty CSV file',
      file: 'empty.csv',
      test: (content) => content === ''
    },
    {
      name: 'Headers only CSV',
      file: 'headers_only.csv',
      test: (content) => {
        const lines = content.trim().split('\n');
        return lines.length === 1 && lines[0] === 'id,name,value';
      }
    },
    {
      name: 'File size check - 100K rows',
      file: 'employees_100k.csv',
      test: (content, stats) => {
        const sizeMB = stats.size / 1024 / 1024;
        return sizeMB > 5 && sizeMB < 15; // Should be between 5-15MB
      }
    }
  ];

  edgeCases.forEach(testCase => {
    try {
      const filePath = path.join(TEST_DATA_DIR, testCase.file);
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      
      const passed = testCase.test(content, stats);
      logTest(testCase.name, passed ? 'pass' : 'fail');
    } catch (error) {
      logTest(testCase.name, 'fail', error.message);
    }
  });
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '🧪 FILE IMPORT TEST SUITE'.padStart(40));
  console.log('📁 Test data directory: ' + TEST_DATA_DIR);
  console.log('🌐 API endpoint: ' + API_BASE_URL);
  
  // Run all tests
  testDataTypeInference();
  await testCSVParsing();
  await testExcelParsing();
  await testPerformance();
  testEdgeCases();
  await testAPIImport();
  
  logSection('TEST SUMMARY');
  log('All tests completed!', colors.green);
  log('\nTo run specific tests, you can call individual test functions:', colors.cyan);
  log('  - testDataTypeInference()');
  log('  - testCSVParsing()');
  log('  - testExcelParsing()');
  log('  - testPerformance()');
  log('  - testEdgeCases()');
  log('  - testAPIImport()');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

// Export for use in other scripts
module.exports = {
  testDataTypeInference,
  testCSVParsing,
  testExcelParsing,
  testPerformance,
  testEdgeCases,
  testAPIImport,
  runAllTests
};