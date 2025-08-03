/**
 * SQLite Connection Test Script
 * 
 * This script tests the SQLite connection functionality
 * including file selection and connection creation.
 */

import { testConnection, createConnection, databaseService } from '../services/database'
import { ConnectionConfig } from '../types'

// Test configuration
const testConfig: ConnectionConfig & { type: string; name: string } = {
  type: 'sqlite',
  name: 'Test SQLite Database',
  filename: './test-database.sqlite'
}

async function runTests() {
  console.log('🧪 SQLite Connection Test Suite\n')

  try {
    // Test 1: Test Connection
    console.log('1. Testing SQLite connection...')
    const testResult = await testConnection(testConfig)
    
    if (testResult.success) {
      console.log('✅ Connection test passed:', testResult.message)
    } else {
      console.log('❌ Connection test failed:', testResult.error || testResult.message)
    }

    // Test 2: Create Connection
    console.log('\n2. Creating SQLite connection...')
    const createResult = await createConnection(testConfig)
    
    if (createResult.success && createResult.connectionId) {
      console.log('✅ Connection created successfully')
      console.log('   Connection ID:', createResult.connectionId)
      
      // Test 3: Get Schema
      console.log('\n3. Retrieving database schema...')
      const schemaResult = await databaseService.getSchema(createResult.connectionId)
      
      if (schemaResult.schema) {
        console.log('✅ Schema retrieved successfully')
        console.log('   Tables:', schemaResult.schema.tables.length)
        schemaResult.schema.tables.forEach(table => {
          console.log(`   - ${table.name} (${table.columns.length} columns)`)
        })
      } else {
        console.log('❌ Failed to retrieve schema:', schemaResult.error)
      }

      // Test 4: Execute Query
      console.log('\n4. Executing test query...')
      const queryResult = await databaseService.executeQuery(
        createResult.connectionId,
        'SELECT name FROM sqlite_master WHERE type="table"'
      )
      
      if (queryResult.data) {
        console.log('✅ Query executed successfully')
        console.log('   Tables found:', queryResult.rowCount)
      } else {
        console.log('❌ Query failed:', queryResult.error)
      }

      // Test 5: List Connections
      console.log('\n5. Listing active connections...')
      const listResult = await databaseService.listConnections()
      
      if (listResult.connections) {
        console.log('✅ Connections listed successfully')
        listResult.connections.forEach(conn => {
          console.log(`   - ${conn.name} (${conn.type})`)
        })
      }

    } else {
      console.log('❌ Failed to create connection:', createResult.error)
    }

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error)
  }

  console.log('\n🏁 Test suite completed')
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests()
}

export { runTests }