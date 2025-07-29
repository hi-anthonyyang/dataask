import mysql from 'mysql2/promise';
import { DatabaseManager, ConnectionConfig } from '../database';

// Mock mysql2/promise
jest.mock('mysql2/promise');
const mockMysql = mysql as jest.Mocked<typeof mysql>;

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock sanitization functions
jest.mock('../../security/sanitize', () => ({
  sanitizeParams: jest.fn((params) => params),
  limitQueryResult: jest.fn((result) => result),
  validateQueryResult: jest.fn((result) => result),
}));

describe('DatabaseManager - MySQL Functionality', () => {
  let databaseManager: DatabaseManager;
  let mockConnection: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    databaseManager = DatabaseManager.getInstance();
    
    // Setup mock connection
    mockConnection = {
      execute: jest.fn(),
      end: jest.fn(),
      release: jest.fn(),
    };
    
    // Setup mock pool
    mockPool = {
      execute: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn(),
    };
    
    mockMysql.createConnection.mockResolvedValue(mockConnection);
    mockMysql.createPool.mockReturnValue(mockPool);
  });

  describe('MySQL Error Handling', () => {
    test('should handle CONNECTION_REFUSED error', async () => {
      const mysqlError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };
      
      mockMysql.createConnection.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const result = await databaseManager.testConnection(config);
      expect(result).toBe(false);
    });

    test('should handle ACCESS_DENIED error', async () => {
      const mysqlError = {
        code: 'ER_ACCESS_DENIED_ERROR',
        message: 'Access denied for user',
        sqlMessage: 'Access denied for user \'test_user\'@\'localhost\'',
      };
      
      mockMysql.createConnection.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'wrong_pass',
        },
      };
      
      const result = await databaseManager.testConnection(config);
      expect(result).toBe(false);
    });

    test('should handle DATABASE_NOT_EXISTS error', async () => {
      const mysqlError = {
        code: 'ER_BAD_DB_ERROR',
        message: 'Unknown database',
        sqlMessage: 'Unknown database \'nonexistent_db\'',
      };
      
      mockMysql.createConnection.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'nonexistent_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const result = await databaseManager.testConnection(config);
      expect(result).toBe(false);
    });

    test('should handle TABLE_NOT_EXISTS error during query execution', async () => {
      const mysqlError = {
        code: 'ER_NO_SUCH_TABLE',
        message: 'Table doesn\'t exist',
        sqlMessage: 'Table \'test_db.nonexistent_table\' doesn\'t exist',
      };
      
      mockPool.execute.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      
      await expect(
        databaseManager.executeQuery(connectionId, 'SELECT * FROM nonexistent_table', [])
      ).rejects.toThrow();
    });

    test('should handle SYNTAX_ERROR during query execution', async () => {
      const mysqlError = {
        code: 'ER_PARSE_ERROR',
        message: 'You have an error in your SQL syntax',
        sqlMessage: 'You have an error in your SQL syntax near \'INVALID SQL\'',
      };
      
      mockPool.execute.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      
      await expect(
        databaseManager.executeQuery(connectionId, 'INVALID SQL SYNTAX', [])
      ).rejects.toThrow();
    });

    test('should handle DUPLICATE_ENTRY error', async () => {
      const mysqlError = {
        code: 'ER_DUP_ENTRY',
        message: 'Duplicate entry',
        sqlMessage: 'Duplicate entry \'test@example.com\' for key \'email\'',
      };
      
      mockPool.execute.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      
      await expect(
        databaseManager.executeQuery(
          connectionId,
          'INSERT INTO users (email) VALUES (?)',
          ['test@example.com']
        )
      ).rejects.toThrow();
    });

    test('should handle LOCK_TIMEOUT error', async () => {
      const mysqlError = {
        code: 'ER_LOCK_WAIT_TIMEOUT',
        message: 'Lock wait timeout exceeded',
        sqlMessage: 'Lock wait timeout exceeded; try restarting transaction',
      };
      
      mockPool.execute.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      
      await expect(
        databaseManager.executeQuery(connectionId, 'UPDATE users SET name = ? WHERE id = ?', ['John', 1])
      ).rejects.toThrow();
    });

    test('should handle DEADLOCK error', async () => {
      const mysqlError = {
        code: 'ER_LOCK_DEADLOCK',
        message: 'Deadlock found when trying to get lock',
        sqlMessage: 'Deadlock found when trying to get lock; try restarting transaction',
      };
      
      mockPool.execute.mockRejectedValue(mysqlError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      
      await expect(
        databaseManager.executeQuery(connectionId, 'UPDATE accounts SET balance = ? WHERE id = ?', [1000, 1])
      ).rejects.toThrow();
    });
  });

  describe('MySQL Connection Management', () => {
    test('should successfully test MySQL connection', async () => {
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const result = await databaseManager.testConnection(config);
      
      expect(result).toBe(true);
      expect(mockMysql.createConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass',
        connectTimeout: expect.any(Number),
      });
      expect(mockConnection.execute).toHaveBeenCalledWith('SELECT 1');
      expect(mockConnection.end).toHaveBeenCalled();
    });

    test('should create MySQL connection pool with correct configuration', async () => {
      const mockResult = [[], []];
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      await databaseManager.executeQuery(connectionId, 'SELECT 1', []);
      
      expect(mockMysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_pass',
        connectionLimit: expect.any(Number),
        queueLimit: expect.any(Number),
        dateStrings: false,
        supportBigNumbers: true,
        bigNumberStrings: false,
        multipleStatements: false,
      });
    });

    test('should retry connection creation on failure', async () => {
      const retryError = {
        code: 'ETIMEDOUT',
        message: 'Connection timeout',
      };
      
      // First two attempts fail, third succeeds
      mockPool.getConnection
        .mockRejectedValueOnce(retryError)
        .mockRejectedValueOnce(retryError)
        .mockResolvedValueOnce(mockConnection);
      
      const mockResult = [[], []];
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      await databaseManager.executeQuery(connectionId, 'SELECT 1', []);
      
      expect(mockPool.getConnection).toHaveBeenCalledTimes(3);
    });

    test('should fail after maximum retries', async () => {
      const retryError = {
        code: 'ETIMEDOUT',
        message: 'Connection timeout',
      };
      
      mockPool.getConnection.mockRejectedValue(retryError);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      await expect(
        databaseManager.createConnection(config)
      ).rejects.toThrow();
      
      expect(mockPool.getConnection).toHaveBeenCalledTimes(3);
    });
  });

  describe('MySQL Parameter Validation', () => {
    test('should convert undefined parameters to null', async () => {
      const mockResult = [
        [{ id: 1, name: 'John' }],
        [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }]
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      await databaseManager.executeQuery(
        connectionId,
        'SELECT * FROM users WHERE name = ? AND age = ?',
        ['John', undefined]
      );
      
      // Verify that undefined was converted to null
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = ? AND age = ?',
        ['John', null]
      );
    });

    test('should preserve null parameters', async () => {
      const mockResult = [
        [{ id: 1, name: 'John' }],
        [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }]
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      await databaseManager.executeQuery(
        connectionId,
        'SELECT * FROM users WHERE name = ? AND age = ?',
        ['John', null]
      );
      
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = ? AND age = ?',
        ['John', null]
      );
    });

    test('should handle mixed parameter types', async () => {
      const mockResult = [
        [{ id: 1, name: 'John', active: true, score: 95.5 }],
        [
          { name: 'id', type: 'int' },
          { name: 'name', type: 'varchar' },
          { name: 'active', type: 'boolean' },
          { name: 'score', type: 'decimal' }
        ]
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      await databaseManager.executeQuery(
        connectionId,
        'SELECT * FROM users WHERE name = ? AND active = ? AND score > ? AND created_at = ?',
        ['John', true, 90.0, undefined]
      );
      
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE name = ? AND active = ? AND score > ? AND created_at = ?',
        ['John', true, 90.0, null]
      );
    });
  });

  describe('MySQL Query Execution', () => {
    test('should execute SELECT query successfully', async () => {
      const mockResult = [
        [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ],
        [
          { name: 'id', type: 'int' },
          { name: 'name', type: 'varchar' },
          { name: 'email', type: 'varchar' }
        ]
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const result = await databaseManager.executeQuery(connectionId, 'SELECT * FROM users', []);
      
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ id: 1, name: 'John', email: 'john@example.com' });
      expect(result.fields).toHaveLength(3);
      expect(result.fields[0]).toEqual({ name: 'id', type: 'int' });
      expect(result.rowCount).toBe(2);
    });

    test('should execute INSERT query successfully', async () => {
      const mockResult = [
        { insertId: 123, affectedRows: 1 },
        []
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const result = await databaseManager.executeQuery(
        connectionId,
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['Bob', 'bob@example.com']
      );
      
      expect(result.rows).toEqual({ insertId: 123, affectedRows: 1 });
      expect(result.rowCount).toBe(0);
    });

    test('should execute UPDATE query successfully', async () => {
      const mockResult = [
        { affectedRows: 2, changedRows: 2 },
        []
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const result = await databaseManager.executeQuery(
        connectionId,
        'UPDATE users SET active = ? WHERE created_at < ?',
        [false, '2023-01-01']
      );
      
      expect(result.rows).toEqual({ affectedRows: 2, changedRows: 2 });
    });

    test('should execute DELETE query successfully', async () => {
      const mockResult = [
        { affectedRows: 1 },
        []
      ];
      
      mockPool.execute.mockResolvedValue(mockResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const result = await databaseManager.executeQuery(
        connectionId,
        'DELETE FROM users WHERE id = ?',
        [123]
      );
      
      expect(result.rows).toEqual({ affectedRows: 1 });
    });
  });

  describe('MySQL Schema Operations', () => {
    test('should retrieve database schema successfully', async () => {
      const mockTablesResult = [
        [
          { table_name: 'users' },
          { table_name: 'products' },
          { table_name: 'orders' }
        ]
      ];
      
      const mockUsersColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          },
          {
            column_name: 'name',
            data_type: 'varchar',
            is_nullable: 'NO',
            column_default: null,
            column_key: ''
          },
          {
            column_name: 'email',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            column_key: 'UNI'
          }
        ]
      ];
      
      const mockProductsColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          },
          {
            column_name: 'title',
            data_type: 'varchar',
            is_nullable: 'NO',
            column_default: null,
            column_key: ''
          }
        ]
      ];
      
      const mockOrdersColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          }
        ]
      ];
      
      mockPool.execute
        .mockResolvedValueOnce(mockTablesResult)
        .mockResolvedValueOnce(mockUsersColumnsResult)
        .mockResolvedValueOnce(mockProductsColumnsResult)
        .mockResolvedValueOnce(mockOrdersColumnsResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const schema = await databaseManager.getSchema(connectionId);
      
      expect(schema.tables).toHaveLength(3);
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[0].columns).toHaveLength(3);
      expect(schema.tables[0].columns[0]).toEqual({
        name: 'id',
        type: 'int',
        nullable: false,
        primaryKey: true
      });
      expect(schema.tables[0].columns[1]).toEqual({
        name: 'name',
        type: 'varchar',
        nullable: false,
        primaryKey: false
      });
      expect(schema.tables[0].columns[2]).toEqual({
        name: 'email',
        type: 'varchar',
        nullable: true,
        primaryKey: false
      });
    });

    test('should handle schema retrieval with missing table names', async () => {
      const mockTablesResult = [
        [
          { table_name: 'users' },
          { table_name: null }, // This should be skipped
          { table_name: 'products' }
        ]
      ];
      
      const mockUsersColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          }
        ]
      ];
      
      const mockProductsColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          }
        ]
      ];
      
      mockPool.execute
        .mockResolvedValueOnce(mockTablesResult)
        .mockResolvedValueOnce(mockUsersColumnsResult)
        .mockResolvedValueOnce(mockProductsColumnsResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const schema = await databaseManager.getSchema(connectionId);
      
      expect(schema.tables).toHaveLength(2); // Only 2 tables, null table name skipped
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[1].name).toBe('products');
    });

    test('should continue with other tables when column retrieval fails', async () => {
      const mockTablesResult = [
        [
          { table_name: 'users' },
          { table_name: 'broken_table' },
          { table_name: 'products' }
        ]
      ];
      
      const mockUsersColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          }
        ]
      ];
      
      const mockProductsColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            column_key: 'PRI'
          }
        ]
      ];
      
      const columnError = {
        code: 'ER_NO_SUCH_TABLE',
        message: 'Table doesn\'t exist',
        sqlMessage: 'Table \'test_db.broken_table\' doesn\'t exist',
      };
      
      mockPool.execute
        .mockResolvedValueOnce(mockTablesResult)
        .mockResolvedValueOnce(mockUsersColumnsResult)
        .mockRejectedValueOnce(columnError) // broken_table fails
        .mockResolvedValueOnce(mockProductsColumnsResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const schema = await databaseManager.getSchema(connectionId);
      
      expect(schema.tables).toHaveLength(2); // Only successful tables
      expect(schema.tables[0].name).toBe('users');
      expect(schema.tables[1].name).toBe('products');
    });
  });

  describe('MySQL Table Metadata', () => {
    test('should retrieve table metadata successfully', async () => {
      const mockRowCountResult = [
        [{ row_count: 1250 }]
      ];
      
      const mockSizeResult = [
        [
          {
            size_mb: 15.25,
            data_size_mb: 12.50,
            index_size_mb: 2.75
          }
        ]
      ];
      
      mockPool.execute
        .mockResolvedValueOnce(mockRowCountResult)
        .mockResolvedValueOnce(mockSizeResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const metadata = await databaseManager.getTableMetadata(connectionId, 'users');
      
      expect(metadata.tableName).toBe('users');
      expect(metadata.rowCount).toBe(1250);
      expect(metadata.tableSize).toBe('15.25 MB');
      expect(metadata.dataSize).toBe('12.5 MB');
      expect(metadata.indexSize).toBe('2.75 MB');
      expect(metadata.schema).toBe('mysql');
      expect(metadata.owner).toBe('MySQL');
      expect(metadata.hasIndexes).toBe(true);
      expect(metadata.hasRules).toBe(false);
      expect(metadata.hasTriggers).toBe(false);
    });

    test('should handle table metadata with no indexes', async () => {
      const mockRowCountResult = [
        [{ row_count: 50 }]
      ];
      
      const mockSizeResult = [
        [
          {
            size_mb: 1.5,
            data_size_mb: 1.5,
            index_size_mb: 0
          }
        ]
      ];
      
      mockPool.execute
        .mockResolvedValueOnce(mockRowCountResult)
        .mockResolvedValueOnce(mockSizeResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const metadata = await databaseManager.getTableMetadata(connectionId, 'simple_table');
      
      expect(metadata.hasIndexes).toBe(false);
      expect(metadata.indexSize).toBe('Unknown');
    });

    test('should handle table metadata with missing size information', async () => {
      const mockRowCountResult = [
        [{ row_count: 100 }]
      ];
      
      const mockSizeResult = [[]]; // Empty result
      
      mockPool.execute
        .mockResolvedValueOnce(mockRowCountResult)
        .mockResolvedValueOnce(mockSizeResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const metadata = await databaseManager.getTableMetadata(connectionId, 'unknown_size_table');
      
      expect(metadata.rowCount).toBe(100);
      expect(metadata.tableSize).toBe('Unknown');
      expect(metadata.dataSize).toBe('Unknown');
      expect(metadata.indexSize).toBe('Unknown');
      expect(metadata.hasIndexes).toBe(false);
    });

    test('should sanitize table name in metadata queries', async () => {
      const mockRowCountResult = [
        [{ row_count: 10 }]
      ];
      
      const mockSizeResult = [
        [
          {
            size_mb: 0.1,
            data_size_mb: 0.1,
            index_size_mb: 0
          }
        ]
      ];
      
      mockPool.execute
        .mockResolvedValueOnce(mockRowCountResult)
        .mockResolvedValueOnce(mockSizeResult);
      
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      // Table name with special characters that should be sanitized
      await databaseManager.getTableMetadata(connectionId, 'user$_table!@#');
      
      // Verify the sanitized table name is used in queries - first call has no params, second has array
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('`user_table`')
      );
      expect(mockPool.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        ['user_table']
      );
    });
  });

  describe('MySQL Table Columns', () => {
    test('should retrieve table columns successfully', async () => {
      const mockColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            ordinal_position: 1,
            column_key: 'PRI'
          },
          {
            column_name: 'name',
            data_type: 'varchar',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: 255,
            numeric_precision: null,
            numeric_scale: null,
            ordinal_position: 2,
            column_key: ''
          },
          {
            column_name: 'email',
            data_type: 'varchar',
            is_nullable: 'YES',
            column_default: null,
            character_maximum_length: 320,
            numeric_precision: null,
            numeric_scale: null,
            ordinal_position: 3,
            column_key: 'UNI'
          },
          {
            column_name: 'balance',
            data_type: 'decimal',
            is_nullable: 'YES',
            column_default: '0.00',
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 2,
            ordinal_position: 4,
            column_key: ''
          }
        ]
      ];
      
      mockPool.execute.mockResolvedValue(mockColumnsResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const columns = await databaseManager.getTableColumns(connectionId, 'users');
      
      expect(columns).toHaveLength(4);
      
      expect(columns[0]).toEqual({
        name: 'id',
        type: 'int',
        nullable: false,
        defaultValue: undefined,
        maxLength: undefined,
        precision: 10,
        scale: undefined,
        position: 1,
        primaryKey: true
      });
      
      expect(columns[1]).toEqual({
        name: 'name',
        type: 'varchar',
        nullable: false,
        defaultValue: undefined,
        maxLength: 255,
        precision: undefined,
        scale: undefined,
        position: 2,
        primaryKey: false
      });
      
      expect(columns[2]).toEqual({
        name: 'email',
        type: 'varchar',
        nullable: true,
        defaultValue: undefined,
        maxLength: 320,
        precision: undefined,
        scale: undefined,
        position: 3,
        primaryKey: false
      });
      
      expect(columns[3]).toEqual({
        name: 'balance',
        type: 'decimal',
        nullable: true,
        defaultValue: '0.00',
        maxLength: undefined,
        precision: 10,
        scale: 2,
        position: 4,
        primaryKey: false
      });
    });

    test('should handle columns with uppercase field names', async () => {
      const mockColumnsResult = [
        [
          {
            COLUMN_NAME: 'id',
            DATA_TYPE: 'int',
            IS_NULLABLE: 'NO',
            COLUMN_DEFAULT: null,
            CHARACTER_MAXIMUM_LENGTH: null,
            NUMERIC_PRECISION: 10,
            NUMERIC_SCALE: 0,
            ORDINAL_POSITION: 1,
            COLUMN_KEY: 'PRI'
          }
        ]
      ];
      
      mockPool.execute.mockResolvedValue(mockColumnsResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      const columns = await databaseManager.getTableColumns(connectionId, 'users');
      
      expect(columns).toHaveLength(1);
      expect(columns[0]).toEqual({
        name: 'id',
        type: 'int',
        nullable: false,
        defaultValue: null,
        maxLength: null,
        precision: 10,
        scale: 0,
        position: 1,
        primaryKey: true
      });
    });

    test('should sanitize table name in column queries', async () => {
      const mockColumnsResult = [
        [
          {
            column_name: 'id',
            data_type: 'int',
            is_nullable: 'NO',
            column_default: null,
            character_maximum_length: null,
            numeric_precision: 10,
            numeric_scale: 0,
            ordinal_position: 1,
            column_key: 'PRI'
          }
        ]
      ];
      
      mockPool.execute.mockResolvedValue(mockColumnsResult);
      mockConnection.execute.mockResolvedValue([]);
      
      const config: ConnectionConfig = {
        type: 'mysql',
        name: 'test-connection',
        config: {
          host: 'localhost',
          port: 3306,
          database: 'test_db',
          username: 'test_user',
          password: 'test_pass',
        },
      };
      
      const connectionId = await databaseManager.createConnection(config);
      // Table name with special characters that should be sanitized
      await databaseManager.getTableColumns(connectionId, 'user$_table!@#');
      
      // Verify the sanitized table name is used in the query parameter
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.any(String),
        ['user_table']
      );
    });
  });
});