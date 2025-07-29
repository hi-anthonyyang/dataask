# MySQL Unit Tests

This directory contains comprehensive unit tests for MySQL-specific functionality in the DataAsk application.

## Test Files

### `database.mysql.test.ts`
Main test suite covering core MySQL functionality:

- **MySQL Error Handling**: Tests for all MySQL error codes and their proper mapping to user-friendly messages
- **Connection Management**: Tests for connection pooling, retry logic, and connection validation
- **Parameter Validation**: Tests for converting undefined parameters to null and handling various data types
- **Query Execution**: Tests for SELECT, INSERT, UPDATE, and DELETE operations
- **Schema Operations**: Tests for retrieving database schema, tables, and column information
- **Table Metadata**: Tests for getting table row counts, sizes, and metadata
- **Table Columns**: Tests for retrieving detailed column information including constraints

### `database.mysql.utilities.test.ts`
Utility functions and edge case testing:

- **Parameter Validation**: Tests for the `validateMySQLParameters` function
- **Error Code Mappings**: Validation of MySQL error code to internal error mappings
- **Error Message Generation**: Tests for user-friendly error message generation
- **Configuration Validation**: Tests for MySQL connection configuration validation
- **Table Name Sanitization**: Tests for sanitizing table names to prevent SQL injection
- **Data Type Handling**: Tests for MySQL-specific data types and constraints
- **Query Building**: Tests for MySQL-specific query patterns and syntax

## Running the Tests

### Prerequisites

Make sure you have the required dependencies installed:

```bash
cd apps/backend
npm install
```

### Running All Tests

```bash
npm test
```

### Running Only MySQL Tests

```bash
npm test -- --testPathPattern=mysql
```

### Running Tests with Coverage

```bash
npm run test:coverage
```

### Running Tests in Watch Mode

```bash
npm run test:watch
```

### Running Specific Test Files

```bash
# Run main MySQL tests
npm test -- database.mysql.test.ts

# Run utility tests
npm test -- database.mysql.utilities.test.ts
```

## Test Coverage

The tests cover the following MySQL-specific functionality:

### Error Handling (100% Coverage)
- Connection errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- Authentication errors (ER_ACCESS_DENIED_ERROR)
- Database errors (ER_BAD_DB_ERROR)
- Table errors (ER_NO_SUCH_TABLE)
- Column errors (ER_BAD_FIELD_ERROR)
- Query errors (ER_PARSE_ERROR)
- Constraint violations (ER_DUP_ENTRY)
- Lock timeouts and deadlocks
- Parameter mismatches

### Connection Management
- Connection pool creation with correct configuration
- Connection testing and validation
- Retry logic for failed connections
- Connection timeout handling
- Pool configuration validation

### Query Operations
- Parameterized query execution
- Parameter validation and sanitization
- Result set processing
- Field metadata extraction
- Row count calculation

### Schema Operations
- Database schema retrieval
- Table listing and filtering
- Column information extraction
- Constraint detection
- Primary key identification

### Security Features
- Table name sanitization
- Parameter validation
- SQL injection prevention
- Input validation

## Test Structure

Each test file follows this structure:

```typescript
describe('Feature Group', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  describe('Specific Feature', () => {
    test('should handle specific scenario', () => {
      // Test implementation
    });
  });
});
```

## Mocking Strategy

The tests use comprehensive mocking:

- **mysql2/promise**: Mocked to simulate MySQL driver behavior
- **Logger**: Mocked to capture logging calls
- **Security functions**: Mocked to focus on MySQL-specific logic

## Common Test Patterns

### Error Testing
```typescript
const mysqlError = {
  code: 'ER_ACCESS_DENIED_ERROR',
  message: 'Access denied',
  sqlMessage: 'Access denied for user'
};

mockMysql.createConnection.mockRejectedValue(mysqlError);
const result = await databaseManager.testConnection(config);
expect(result).toBe(false);
```

### Success Testing
```typescript
const mockResult = [
  [{ id: 1, name: 'John' }],
  [{ name: 'id', type: 'int' }]
];

mockPool.execute.mockResolvedValue(mockResult);
const result = await databaseManager.executeQuery(config, 'SELECT * FROM users', []);
expect(result.rows).toHaveLength(1);
```

## Troubleshooting

### Common Issues

1. **Tests failing due to missing mocks**: Ensure all external dependencies are properly mocked
2. **Timeout errors**: Increase Jest timeout if needed for integration tests
3. **Mock not working**: Check that the mock is set up before the module is imported

### Debug Mode

Run tests with debug output:

```bash
npm test -- --verbose --detectOpenHandles
```

## Contributing

When adding new MySQL functionality:

1. Add corresponding unit tests
2. Follow the existing test structure
3. Mock external dependencies
4. Test both success and error scenarios
5. Update this README if needed

## Test Data

The tests use realistic test data that mirrors the production database schema:

- Users table with id, name, email columns
- Products table with standard e-commerce fields
- Orders table with relationships
- Various data types (strings, numbers, booleans, dates)
- Different constraint types (primary keys, unique constraints, foreign keys)