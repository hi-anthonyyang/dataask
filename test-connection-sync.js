const fs = require('fs');
const path = require('path');

// Test CSV content
const csvContent = `Name,Age,Email
Test User,25,test@example.com
Another User,30,another@example.com`;

// Create test CSV file
const testFile = path.join(__dirname, 'test-import.csv');
fs.writeFileSync(testFile, csvContent);

console.log('Created test CSV file:', testFile);

// Create form data
const FormData = require('form-data');
const form = new FormData();
form.append('file', fs.createReadStream(testFile));
form.append('tableName', 'test_connection_sync');

// Make request to import endpoint
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/files/import',
  method: 'POST',
  headers: form.getHeaders()
};

console.log('Sending import request...');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      const result = JSON.parse(data);
      console.log('Connection ID:', result.connectionId);
      
      // Now check if connection is available
      setTimeout(() => {
        const listOptions = {
          hostname: 'localhost',
          port: 3001,
          path: '/api/db/connections',
          method: 'GET'
        };
        
        const listReq = http.request(listOptions, (listRes) => {
          let listData = '';
          
          listRes.on('data', (chunk) => {
            listData += chunk;
          });
          
          listRes.on('end', () => {
            console.log('\nConnections list response:', listData);
            const connections = JSON.parse(listData);
            const found = connections.connections?.find(c => c.id === result.connectionId);
            
            if (found) {
              console.log('✅ SUCCESS: Connection found in list!', found);
            } else {
              console.log('❌ FAILED: Connection not found in list');
              console.log('Available connections:', connections.connections?.map(c => ({ id: c.id, name: c.name })));
            }
            
            // Clean up
            fs.unlinkSync(testFile);
          });
        });
        
        listReq.on('error', (e) => {
          console.error('Error listing connections:', e);
        });
        
        listReq.end();
      }, 1000);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
  fs.unlinkSync(testFile);
});

form.pipe(req);