const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Create test data directory
const testDataDir = path.join(__dirname, '..', 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Test data with various types
const testData = {
  // Small dataset for basic testing
  small: [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, salary: 50000.50, active: true, created_at: '2024-01-15' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, salary: 60000.75, active: false, created_at: '2024-02-20' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, salary: 75000.00, active: true, created_at: '2024-03-10' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28, salary: 55000.25, active: true, created_at: '2024-04-05' },
    { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 42, salary: 90000.00, active: false, created_at: '2024-05-12' }
  ],
  
  // Dataset with mixed types and null values
  mixed: [
    { product_id: 'P001', product_name: 'Widget', price: 19.99, quantity: 100, in_stock: true, last_updated: '2024-08-01 10:30:00' },
    { product_id: 'P002', product_name: 'Gadget', price: 29.99, quantity: null, in_stock: false, last_updated: '2024-08-02 14:15:00' },
    { product_id: 'P003', product_name: 'Doohickey', price: null, quantity: 50, in_stock: true, last_updated: null },
    { product_id: 'P004', product_name: 'Thingamajig', price: 39.99, quantity: 0, in_stock: false, last_updated: '2024-08-03 09:45:00' },
    { product_id: 'P005', product_name: null, price: 49.99, quantity: 25, in_stock: true, last_updated: '2024-08-04 16:20:00' }
  ],
  
  // Dataset with special characters and edge cases
  special: [
    { id: 1, description: 'Item with "quotes"', notes: 'Contains, commas', value: 123.45 },
    { id: 2, description: 'Item with\nnewline', notes: 'Contains\ttabs', value: 678.90 },
    { id: 3, description: 'Item with 中文 characters', notes: 'Unicode test 🚀', value: 111.11 },
    { id: 4, description: 'Item with \'single quotes\'', notes: 'Special chars: @#$%^&*()', value: 222.22 },
    { id: 5, description: '', notes: null, value: 0 }
  ]
};

// Generate large dataset for performance testing
function generateLargeDataset(rows) {
  const data = [];
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Emma', 'Oliver', 'Sophia', 'William', 'Ava'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Wilson', 'Davis', 'Miller', 'Garcia', 'Jones', 'Williams', 'Martinez'];
  const departments = ['Sales', 'Marketing', 'Engineering', 'HR', 'Finance', 'Operations', 'IT', 'Legal'];
  
  for (let i = 1; i <= rows; i++) {
    data.push({
      employee_id: `EMP${String(i).padStart(6, '0')}`,
      first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
      last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
      email: `employee${i}@company.com`,
      department: departments[Math.floor(Math.random() * departments.length)],
      salary: Math.floor(Math.random() * 100000) + 40000,
      hire_date: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      performance_score: (Math.random() * 5).toFixed(2),
      is_manager: Math.random() > 0.8,
      office_location: ['New York', 'San Francisco', 'London', 'Tokyo', 'Sydney'][Math.floor(Math.random() * 5)],
      years_experience: Math.floor(Math.random() * 20) + 1
    });
  }
  
  return data;
}

// Create CSV files
function createCSV(data, filename) {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  fs.writeFileSync(path.join(testDataDir, filename), csvContent);
  console.log(`✅ Created ${filename}`);
}

// Create Excel files
function createExcel(datasets, filename) {
  const wb = XLSX.utils.book_new();
  
  Object.entries(datasets).forEach(([sheetName, data]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  XLSX.writeFile(wb, path.join(testDataDir, filename));
  console.log(`✅ Created ${filename}`);
}

// Generate test files
console.log('🔧 Generating test files...\n');

// Small CSV files
createCSV(testData.small, 'employees_small.csv');
createCSV(testData.mixed, 'products_mixed.csv');
createCSV(testData.special, 'special_characters.csv');

// Large CSV files
console.log('\n📊 Generating large datasets...');
const medium = generateLargeDataset(10000);
const large = generateLargeDataset(50000);
const xlarge = generateLargeDataset(100000);

createCSV(medium, 'employees_10k.csv');
createCSV(large, 'employees_50k.csv');
createCSV(xlarge, 'employees_100k.csv');

// Excel files
console.log('\n📑 Creating Excel files...');
createExcel({ employees: testData.small, products: testData.mixed }, 'test_data.xlsx');
createExcel({ 
  Sheet1: medium.slice(0, 5000), 
  Sheet2: medium.slice(5000, 10000) 
}, 'employees_10k.xlsx');

// Edge case files
console.log('\n🔍 Creating edge case files...');

// Empty CSV
fs.writeFileSync(path.join(testDataDir, 'empty.csv'), '');
console.log('✅ Created empty.csv');

// Headers only CSV
fs.writeFileSync(path.join(testDataDir, 'headers_only.csv'), 'id,name,value\n');
console.log('✅ Created headers_only.csv');

// Single column CSV
createCSV([
  { value: 'Row 1' },
  { value: 'Row 2' },
  { value: 'Row 3' }
], 'single_column.csv');

// File size summary
console.log('\n📈 File sizes:');
fs.readdirSync(testDataDir).forEach(file => {
  const stats = fs.statSync(path.join(testDataDir, file));
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`   ${file}: ${sizeMB} MB`);
});

console.log('\n✨ Test files generated successfully!');