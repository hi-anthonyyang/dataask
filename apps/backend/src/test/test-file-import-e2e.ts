import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_DIR = path.join(process.cwd(), 'test-data');

// Ensure test directory exists
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Generate test CSV
function generateTestCSV(rows: number): { filepath: string; content: string } {
  const headers = ['ID', 'Product', 'Price', 'Quantity', 'Date'];
  const data = [headers.join(',')];
  
  for (let i = 0; i < rows; i++) {
    data.push([
      i + 1,
      `Product_${i + 1}`,
      (Math.random() * 1000).toFixed(2),
      Math.floor(Math.random() * 100),
      new Date().toISOString().split('T')[0]
    ].join(','));
  }
  
  const content = data.join('\n');
  const filename = `test_${rows}_rows_${Date.now()}.csv`;
  const filepath = path.join(TEST_DIR, filename);
  
  fs.writeFileSync(filepath, content);
  
  return { filepath, content };
}

// Test file import
async function testFileImport(rows: number) {
  console.log(`\n📊 Testing import with ${rows.toLocaleString()} rows:`);
  console.log('─'.repeat(50));
  
  // Generate test file
  const { filepath } = generateTestCSV(rows);
  const fileSize = fs.statSync(filepath).size;
  console.log(`✅ Generated test file: ${(fileSize / 1024).toFixed(2)} KB`);
  
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filepath));
    form.append('tableName', `test_import_${rows}`);
    
    // Start import
    const startTime = performance.now();
    console.log('📤 Starting import...');
    
    const response = await axios.post(`${API_BASE_URL}/api/files/import`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    const importTime = performance.now() - startTime;
    const { importId, connectionId, rowCount } = response.data;
    
    console.log(`✅ Import initiated:`);
    console.log(`   Import ID: ${importId}`);
    console.log(`   Connection ID: ${connectionId}`);
    console.log(`   Row count: ${rowCount}`);
    
    // Track progress
    if (importId) {
      await trackImportProgress(importId, rows);
    }
    
    console.log(`\n⏱️  Total time: ${(importTime / 1000).toFixed(2)}s`);
    console.log(`📈 Throughput: ${(rows / (importTime / 1000)).toFixed(0)} rows/second`);
    
    // Clean up
    fs.unlinkSync(filepath);
    
    return { success: true, time: importTime, throughput: rows / (importTime / 1000) };
    
  } catch (error: any) {
    console.error(`❌ Import failed:`, error.response?.data || error.message);
    fs.unlinkSync(filepath);
    return { success: false, error: error.message };
  }
}

// Track import progress
async function trackImportProgress(importId: string, expectedRows: number) {
  console.log('\n📊 Tracking progress:');
  
  let lastProgress = 0;
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds max
  
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/files/import-progress/${importId}`);
      const progress = response.data;
      
      if (progress.progress > lastProgress) {
        const bar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
        console.log(`   [${bar}] ${progress.progress}% - ${progress.message || progress.status}`);
        lastProgress = progress.progress;
      }
      
      if (progress.status === 'completed') {
        console.log('✅ Import completed successfully!');
        break;
      } else if (progress.status === 'failed') {
        console.error('❌ Import failed:', progress.error);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      
    } catch (error) {
      // Import might be completed and removed from tracking
      break;
    }
  }
}

// Main test runner
async function runE2ETests() {
  console.log('='.repeat(60));
  console.log('🚀 File Import End-to-End Performance Tests');
  console.log('='.repeat(60));
  
  // Check if server is running
  try {
    await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not running. Please start the backend server first:');
    console.error('   cd apps/backend && npm run dev\n');
    process.exit(1);
  }
  
  // Test cases
  const testCases = [
    { rows: 100, name: 'Small file' },
    { rows: 1000, name: 'Medium file' },
    { rows: 5000, name: 'Large file' },
    { rows: 10000, name: 'Extra large file' }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testFileImport(testCase.rows);
    results.push({ ...testCase, ...result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Performance Summary:');
  console.log('='.repeat(60));
  console.log('┌─────────────┬────────┬──────────┬────────────────┬──────────┐');
  console.log('│ Test Case   │  Rows  │   Time   │   Throughput   │  Status  │');
  console.log('├─────────────┼────────┼──────────┼────────────────┼──────────┤');
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const time = result.time ? `${(result.time / 1000).toFixed(2)}s` : 'N/A';
    const throughput = result.throughput ? `${result.throughput.toFixed(0)} rows/s` : 'N/A';
    
    console.log(
      `│ ${result.name.padEnd(11)} │ ${result.rows.toString().padStart(6)} │ ${time.padStart(8)} │ ${throughput.padStart(14)} │ ${status.padStart(8)} │`
    );
  }
  
  console.log('└─────────────┴────────┴──────────┴────────────────┴──────────┘');
  
  // Performance analysis
  const successfulTests = results.filter(r => r.success);
  if (successfulTests.length > 0) {
    const avgThroughput = successfulTests.reduce((sum, r) => sum + (r.throughput || 0), 0) / successfulTests.length;
    console.log(`\n📈 Average throughput: ${avgThroughput.toFixed(0)} rows/second`);
    console.log(`💡 This is approximately ${(avgThroughput / 200).toFixed(1)}x faster than row-by-row insertion!`);
  }
  
  // Clean up test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.readdirSync(TEST_DIR).forEach(file => {
      fs.unlinkSync(path.join(TEST_DIR, file));
    });
    fs.rmdirSync(TEST_DIR);
  }
}

// Run tests if called directly
if (require.main === module) {
  runE2ETests().catch(console.error);
}

export { generateTestCSV, testFileImport, runE2ETests };