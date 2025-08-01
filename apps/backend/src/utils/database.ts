import { Pool, Client } from 'pg';
import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import { promisify } from 'util';
// Using require to avoid TypeScript module declaration issues
const { v4: uuidv4 } = require('uuid');
import { logger } from './logger';
import { sanitizeParams, limitQueryResult, validateQueryResult } from '../security/sanitize';
import { SSHTunnelManager, SSHTunnelConfig, TunnelConnection } from './sshTunnel';

/**
 * Database Manager with SSL/TLS Security
 * 
 * SECURITY FEATURES:
 * - SSL/TLS encryption for PostgreSQL and MySQL connections
 * - Environment-based certificate configuration
 * - Production-ready SSL validation
 * - Development mode with optional SSL support
 * 
 * ENVIRONMENT VARIABLES:
 * - DB_SSL_ENABLED: Enable SSL in development (default: false)
 * - DB_SSL_REJECT_UNAUTHORIZED: Validate SSL certificates (default: true in production)
 * - DB_SSL_CA: Certificate Authority certificate
 * - DB_SSL_CERT: Client certificate (optional)
 * - DB_SSL_KEY: Client private key (optional)
 */

// MySQL-specific error handling
interface MySQLError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

class DatabaseError extends Error {
  public code: string;
  public originalError?: any;
  public context?: any;

  constructor(message: string, code: string, originalError?: any, context?: any) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.originalError = originalError;
    this.context = context;
  }
}

// MySQL error code mappings
const MYSQL_ERROR_CODES = {
  // Connection errors
  'ECONNREFUSED': 'CONNECTION_REFUSED',
  'ETIMEDOUT': 'CONNECTION_TIMEOUT', 
  'ENOTFOUND': 'HOST_NOT_FOUND',
  'ER_ACCESS_DENIED_ERROR': 'ACCESS_DENIED',
  'ER_BAD_DB_ERROR': 'DATABASE_NOT_EXISTS',
  'ER_UNKNOWN_ERROR': 'UNKNOWN_ERROR',
  
  // Query errors
  'ER_PARSE_ERROR': 'SYNTAX_ERROR',
  'ER_NO_SUCH_TABLE': 'TABLE_NOT_EXISTS',
  'ER_BAD_FIELD_ERROR': 'COLUMN_NOT_EXISTS',
  'ER_DUP_ENTRY': 'DUPLICATE_ENTRY',
  'ER_DATA_TOO_LONG': 'DATA_TOO_LONG',
  'ER_LOCK_WAIT_TIMEOUT': 'LOCK_TIMEOUT',
  'ER_LOCK_DEADLOCK': 'DEADLOCK',
  
  // Parameter errors
  'ER_WRONG_PARAMCOUNT': 'PARAMETER_COUNT_MISMATCH',
  'ER_TRUNCATED_WRONG_VALUE': 'INVALID_DATA_TYPE',
};

function handleMySQLError(error: MySQLError, context?: any): DatabaseError {
  const errorCode = error.code || 'UNKNOWN_ERROR';
  const mappedCode = MYSQL_ERROR_CODES[errorCode as keyof typeof MYSQL_ERROR_CODES] || 'MYSQL_ERROR';
  
  let userMessage = '';
  
  switch (mappedCode) {
    case 'CONNECTION_REFUSED':
      userMessage = 'Unable to connect to MySQL server. Please check if the server is running and accessible.';
      break;
    case 'CONNECTION_TIMEOUT':
      userMessage = 'Connection to MySQL server timed out. Please check your network connection.';
      break;
    case 'HOST_NOT_FOUND':
      userMessage = 'MySQL server host not found. Please verify the hostname or IP address.';
      break;
    case 'ACCESS_DENIED':
      userMessage = 'Access denied. Please check your MySQL username and password.';
      break;
    case 'DATABASE_NOT_EXISTS':
      userMessage = `Database '${context?.database || 'unknown'}' does not exist.`;
      break;
    case 'TABLE_NOT_EXISTS':
      userMessage = `Table '${context?.table || 'unknown'}' does not exist.`;
      break;
    case 'COLUMN_NOT_EXISTS':
      userMessage = `Column '${context?.column || 'unknown'}' does not exist.`;
      break;
    case 'SYNTAX_ERROR':
      userMessage = 'SQL syntax error. Please check your query.';
      break;
    case 'PARAMETER_COUNT_MISMATCH':
      userMessage = 'Parameter count mismatch in SQL query.';
      break;
    case 'DUPLICATE_ENTRY':
      userMessage = 'Duplicate entry violates unique constraint.';
      break;
    case 'LOCK_TIMEOUT':
      userMessage = 'Query timed out waiting for table lock. Please try again.';
      break;
    case 'DEADLOCK':
      userMessage = 'Deadlock detected. Transaction was rolled back.';
      break;
    default:
      userMessage = error.sqlMessage || error.message || 'Unknown MySQL error occurred.';
  }
  
  return new DatabaseError(userMessage, mappedCode, error, context);
}

// Parameter validation helper
function validateMySQLParameters(params: any[]): any[] {
  return params.map((param, index) => {
    if (param === undefined) {
      logger.warn(`Parameter at index ${index} is undefined, converting to null`);
      return null;
    }
    return param;
  });
}

// Database configuration constants
const DATABASE_CONFIG = {
  connection: {
    testTimeoutMs: parseInt(process.env.DB_TEST_TIMEOUT_MS || '5000'),
    poolMaxConnections: parseInt(process.env.DB_POOL_MAX_CONNECTIONS || '5'),
    poolIdleTimeoutMs: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000'),
    poolConnectionTimeoutMs: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '10000'),
  },
  query: {
    defaultPreviewLimit: parseInt(process.env.DB_DEFAULT_PREVIEW_LIMIT || '100'),
    maxPreviewLimit: parseInt(process.env.DB_MAX_PREVIEW_LIMIT || '1000'),
    maxExecutionTimeMs: parseInt(process.env.DB_MAX_EXECUTION_TIME_MS || '30000'),
  },
  mysql: {
    // MySQL-specific optimizations
    queueLimit: parseInt(process.env.MYSQL_QUEUE_LIMIT || '0'),
    enableQueryLogging: process.env.NODE_ENV === 'development',
  }
};

interface ConnectionConfig {
  type: 'postgresql' | 'sqlite' | 'mysql';
  name: string;
  config: {
    // PostgreSQL & MySQL
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    // SQLite
    filename?: string;
    // SSL Configuration
    sslEnabled?: boolean;
    sslMode?: 'require' | 'prefer' | 'allow' | 'disable';
    sslCa?: string;
    sslCert?: string;
    sslKey?: string;
    sslRejectUnauthorized?: boolean;
    // Connection Timeouts
    connectionTimeout?: number;
    queryTimeout?: number;
    // SSH Tunnel Configuration
    sshEnabled?: boolean;
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
    sshPassword?: string;
    sshPrivateKey?: string;
    sshPassphrase?: string;
  };
}

interface QueryResult {
  rows: any[];
  fields: any[];
  rowCount: number;
  executionTime?: number;
}

interface SchemaTable {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
  }[];
}

interface DatabaseSchema {
  tables: SchemaTable[];
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private connections: Map<string, any> = new Map();
  private connectionConfigs: Map<string, ConnectionConfig> = new Map();

  // Singleton pattern to persist connections across API calls
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private constructor() {} // Private constructor for singleton

  /**
   * Create SSH tunnel if configured
   */
  private async createSSHTunnelIfNeeded(config: ConnectionConfig): Promise<{ host: string; port: number; tunnel?: TunnelConnection }> {
    if (!config.config.sshEnabled || !config.config.sshHost) {
      return { host: config.config.host || 'localhost', port: config.config.port || 5432 };
    }

    const sshManager = SSHTunnelManager.getInstance();
    const sshConfig: SSHTunnelConfig = {
      host: config.config.sshHost,
      port: config.config.sshPort || 22,
      username: config.config.sshUsername || '',
      password: config.config.sshPassword,
      privateKey: config.config.sshPrivateKey,
      passphrase: config.config.sshPassphrase,
    };

    try {
      const tunnel = await sshManager.createTunnel(
        sshConfig,
        config.config.host || 'localhost',
        config.config.port || 5432
      );

      logger.info(`SSH tunnel established for ${config.name}: localhost:${tunnel.localPort}`);
      return { host: 'localhost', port: tunnel.localPort, tunnel };
    } catch (error) {
      logger.error(`Failed to create SSH tunnel for ${config.name}:`, error);
      throw new Error(`SSH tunnel connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get SSL configuration from connection config
   */
  private getSSLConfig(config: ConnectionConfig): any {
    if (!config.config.sslEnabled) {
      return false;
    }

    const sslConfig: any = {};

    // Use connection-specific SSL settings if provided
    if (config.config.sslMode) {
      sslConfig.rejectUnauthorized = config.config.sslMode === 'require';
    } else {
      sslConfig.rejectUnauthorized = config.config.sslRejectUnauthorized !== false;
    }

    if (config.config.sslCa) {
      sslConfig.ca = config.config.sslCa;
    }
    if (config.config.sslCert) {
      sslConfig.cert = config.config.sslCert;
    }
    if (config.config.sslKey) {
      sslConfig.key = config.config.sslKey;
    }

    // Fallback to environment variables if not specified in config
    if (!sslConfig.ca && process.env.DB_SSL_CA) {
      sslConfig.ca = process.env.DB_SSL_CA;
    }
    if (!sslConfig.cert && process.env.DB_SSL_CERT) {
      sslConfig.cert = process.env.DB_SSL_CERT;
    }
    if (!sslConfig.key && process.env.DB_SSL_KEY) {
      sslConfig.key = process.env.DB_SSL_KEY;
    }

    return sslConfig;
  }

  /**
   * Test a database connection without storing it
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      if (config.type === 'postgresql') {
        return await this.testPostgreSQLConnection(config);
      } else if (config.type === 'sqlite') {
        return await this.testSQLiteConnection(config);
      } else if (config.type === 'mysql') {
        return await this.testMySQLConnection(config);
      }
      return false;
    } catch (error) {
      logger.error('Connection test failed:', error);
      throw error; // Re-throw to allow API to return specific error message
    }
  }

  /**
   * Create and store a new database connection
   */
  async createConnection(config: ConnectionConfig): Promise<string> {
    const connectionId = uuidv4();
    
    try {
      let connection: any;

      if (config.type === 'postgresql') {
        connection = await this.createPostgreSQLConnection(config);
      } else if (config.type === 'sqlite') {
        connection = await this.createSQLiteConnection(config);
      } else if (config.type === 'mysql') {
        connection = await this.createMySQLConnection(config);
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.connections.set(connectionId, connection);
      this.connectionConfigs.set(connectionId, config);

      logger.info(`Database connection created: ${config.name} (${config.type})`);
      return connectionId;

    } catch (error) {
      logger.error('Failed to create database connection:', error);
      throw new Error(`Failed to connect to ${config.type} database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a SQL query on a specific connection
   */
  async executeQuery(connectionId: string, sql: string, params: any[] = []): Promise<QueryResult> {
    const connection = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);

    if (!connection || !config) {
      throw new Error('Database connection not found');
    }

    const sanitizedParams = sanitizeParams(params);
    const startTime = Date.now();

    try {
      let result: QueryResult;

      // Create query execution promise
      const queryPromise = (async () => {
        if (config.type === 'postgresql') {
          return await this.executePostgreSQLQuery(connection, sql, sanitizedParams);
        } else if (config.type === 'sqlite') {
          return await this.executeSQLiteQuery(connection, sql, sanitizedParams);
        } else if (config.type === 'mysql') {
          return await this.executeMySQLQuery(connection, sql, sanitizedParams);
        } else {
          throw new Error(`Unsupported database type: ${config.type}`);
        }
      })();

      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query execution timed out')), DATABASE_CONFIG.query.maxExecutionTimeMs);
      });

      result = await Promise.race([queryPromise, timeoutPromise]);

      result.executionTime = Date.now() - startTime;

      // Validate and limit the result
      if (!validateQueryResult(result)) {
        throw new Error('Query result contains sensitive data');
      }

      const limitedResult = limitQueryResult(result);
      
      logger.info(`Query executed successfully in ${result.executionTime}ms`, {
        connectionId,
        rowCount: result.rowCount
      });

      return limitedResult;

    } catch (error) {
      // Enhanced error logging with connection context
      const connectionContext = {
        connectionId,
        type: config?.type,
        name: config?.name
      };
      
      logger.error('Query execution failed:', { 
        connectionId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        context: connectionContext
      });
      
      // Re-throw with additional context if it's a MySQL error
      if (config?.type === 'mysql' && error instanceof Error) {
        const dbError = error as DatabaseError;
        if (dbError.code) {
          // Already processed MySQL error, just re-throw
          throw error;
        } else {
          // Raw MySQL error, process it
          const processedError = handleMySQLError(error as MySQLError, connectionContext);
          throw processedError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const connection = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);

    if (!connection || !config) {
      throw new Error('Database connection not found');
    }

    try {
      if (config.type === 'postgresql') {
        return await this.getPostgreSQLSchema(connection);
      } else if (config.type === 'sqlite') {
        return await this.getSQLiteSchema(connection);
      } else if (config.type === 'mysql') {
        return await this.getMySQLSchema(connection);
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }
    } catch (error) {
      logger.error('Failed to retrieve schema:', error);
      throw new Error(`Failed to retrieve schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all active connections
   */
  async listConnections(): Promise<{ id: string; name: string; type: string; config: any }[]> {
    const connections = [];
    
    for (const [id, config] of this.connectionConfigs.entries()) {
      connections.push({
        id,
        name: config.name,
        type: config.type,
        config: config.config
      });
    }

    return connections;
  }

  /**
   * Close and remove a database connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);

    if (connection) {
      try {
        if (config?.type === 'postgresql') {
          await connection.end();
        } else if (config?.type === 'sqlite') {
          await new Promise((resolve, reject) => {
            connection.close((err: any) => {
              if (err) reject(err);
              else resolve(undefined);
            });
          });
        } else if (config?.type === 'mysql') {
          await connection.end();
        }
      } catch (error) {
        logger.error('Error closing connection:', error);
      }

      this.connections.delete(connectionId);
      this.connectionConfigs.delete(connectionId);
      
      logger.info(`Database connection deleted: ${connectionId}`);
    }
  }

  // Private methods for PostgreSQL
  private async testPostgreSQLConnection(config: ConnectionConfig): Promise<boolean> {
    let tunnel: TunnelConnection | undefined;
    
    try {
      // Create SSH tunnel if needed
      const connectionInfo = await this.createSSHTunnelIfNeeded(config);
      tunnel = connectionInfo.tunnel;

      const client = new Client({
        host: connectionInfo.host,
        port: connectionInfo.port,
        database: config.config.database,
        user: config.config.username,
        password: config.config.password,
        connectionTimeoutMillis: config.config.connectionTimeout || DATABASE_CONFIG.connection.testTimeoutMs,
        // Use new SSL configuration helper
        ssl: this.getSSLConfig(config)
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (error) {
      logger.error('PostgreSQL test connection failed:', error);
      return false;
    } finally {
      // Clean up tunnel if created for test
      if (tunnel) {
        tunnel.close();
      }
    }
  }

  private async createPostgreSQLConnection(config: ConnectionConfig): Promise<Pool> {
    // Create SSH tunnel if needed
    const connectionInfo = await this.createSSHTunnelIfNeeded(config);

    const pool = new Pool({
      host: connectionInfo.host,
      port: connectionInfo.port,
      database: config.config.database,
      user: config.config.username,
      password: config.config.password,
      max: DATABASE_CONFIG.connection.poolMaxConnections, // Maximum number of connections
      idleTimeoutMillis: DATABASE_CONFIG.connection.poolIdleTimeoutMs,
      connectionTimeoutMillis: config.config.connectionTimeout || DATABASE_CONFIG.connection.poolConnectionTimeoutMs,
      // Use new SSL configuration helper
      ssl: this.getSSLConfig(config)
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    return pool;
  }

  private async executePostgreSQLQuery(pool: Pool, sql: string, params: any[]): Promise<QueryResult> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        fields: result.fields || [],
        rowCount: result.rowCount || 0,
        executionTime: 0 // Will be set by caller
      };
    } finally {
      client.release();
    }
  }

  private async getPostgreSQLSchema(pool: Pool): Promise<DatabaseSchema> {
    const client = await pool.connect();
    
    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const tables: SchemaTable[] = [];

      for (const table of tablesResult.rows) {
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await client.query(columnsQuery, [table.table_name]);
        
        // Get primary key information
        const pkQuery = `
          SELECT column_name
          FROM information_schema.key_column_usage k
          JOIN information_schema.table_constraints t
            ON t.constraint_name = k.constraint_name
          WHERE t.table_name = $1 AND t.constraint_type = 'PRIMARY KEY'
        `;
        
        const pkResult = await client.query(pkQuery, [table.table_name]);
        const primaryKeys = new Set(pkResult.rows.map(row => row.column_name));

        const columns = columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          primaryKey: primaryKeys.has(col.column_name)
        }));

        tables.push({
          name: table.table_name,
          columns
        });
      }

      return { tables };
    } finally {
      client.release();
    }
  }

  // Private methods for SQLite
  private async testSQLiteConnection(config: ConnectionConfig): Promise<boolean> {
    if (!config.config.filename) {
      throw new Error('SQLite filename is required');
    }

    // Check if the directory exists and is writable
    const path = require('path');
    const fs = require('fs');
    
    // Convert relative paths to absolute paths from the backend directory
    let filename = config.config.filename;
    if (!path.isAbsolute(filename)) {
      filename = path.resolve(process.cwd(), filename);
      logger.info(`Converting relative path to absolute: ${config.config.filename} -> ${filename}`);
    }
    
    const dirname = path.dirname(filename);
    
    try {
      // Check if directory exists
      if (!fs.existsSync(dirname)) {
        throw new Error(`Directory does not exist: ${dirname}`);
      }
      
      // Check if directory is writable
      fs.accessSync(dirname, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Directory access error for ${dirname}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return new Promise((resolve, reject) => {
      // Use OPEN_READWRITE | OPEN_CREATE to allow creating new databases and testing existing ones
      const db = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          logger.error(`SQLite connection test failed for ${filename}:`, err);
          reject(new Error(`SQLite connection failed: ${err.message}`));
        } else {
          // Test with a simple query to ensure the database is working
          db.get('SELECT 1 as test', (queryErr) => {
            db.close((closeErr) => {
              if (queryErr || closeErr) {
                const error = queryErr || closeErr;
                logger.error('SQLite test query failed:', error);
                reject(new Error(`SQLite test query failed: ${error instanceof Error ? error.message : String(error)}`));
              } else {
                logger.info(`SQLite connection test successful for ${filename}`);
                resolve(true);
              }
            });
          });
        }
      });
    });
  }

  private async createSQLiteConnection(config: ConnectionConfig): Promise<sqlite3.Database> {
    if (!config.config.filename) {
      throw new Error('SQLite filename is required');
    }

    return new Promise((resolve, reject) => {
      // Use OPEN_READWRITE | OPEN_CREATE to allow creating new databases
      const db = new sqlite3.Database(config.config.filename!, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          logger.error('SQLite connection creation failed:', err);
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  private async executeSQLiteQuery(db: sqlite3.Database, sql: string, params: any[]): Promise<QueryResult> {
    
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        if (params && params.length > 0) {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        } else {
          db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }
      });
      
      // Get column information from the first row
      const fields = rows.length > 0 ? 
        Object.keys(rows[0]).map(name => ({ name, type: 'unknown' })) : 
        [];

      return {
        rows,
        fields,
        rowCount: rows.length,
        executionTime: 0 // Will be set by caller
      };
    } catch (error) {
      throw error;
    }
  }

  private async getSQLiteSchema(db: sqlite3.Database): Promise<DatabaseSchema> {
    const allAsync = promisify(db.all.bind(db));
    
    try {
      const tablesResult = await allAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `) as any[];

      const tables: SchemaTable[] = [];

      for (const table of tablesResult) {
        const columnsResult = await allAsync(`PRAGMA table_info(${table.name})`) as any[];
        
        const columns = columnsResult.map(col => ({
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          primaryKey: !!col.pk
        }));

        tables.push({
          name: table.name,
          columns
        });
      }

      return { tables };
    } catch (error) {
      throw error;
    }
  }

  // Get table metadata (row count, size, created date)
  async getTableMetadata(connectionId: string, tableName: string): Promise<any> {
    const connection = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);
    
    if (!connection || !config) {
      throw new Error('Connection not found');
    }

    try {
      if (config.type === 'postgresql') {
        return await this.getPostgreSQLTableMetadata(connection, tableName);
      } else if (config.type === 'sqlite') {
        return await this.getSQLiteTableMetadata(connection, tableName);
      } else if (config.type === 'mysql') {
        return await this.getMySQLTableMetadata(connection, tableName);
      } else {
        throw new Error('Unsupported database type');
      }
    } catch (error) {
      throw error;
    }
  }

  // Get detailed table column information
  async getTableColumns(connectionId: string, tableName: string): Promise<any[]> {
    const connection = this.connections.get(connectionId);
    const config = this.connectionConfigs.get(connectionId);
    
    if (!connection || !config) {
      throw new Error('Connection not found');
    }

    try {
      if (config.type === 'postgresql') {
        return await this.getPostgreSQLTableColumns(connection, tableName);
      } else if (config.type === 'sqlite') {
        return await this.getSQLiteTableColumns(connection, tableName);
      } else if (config.type === 'mysql') {
        return await this.getMySQLTableColumns(connection, tableName);
      } else {
        throw new Error('Unsupported database type');
      }
    } catch (error) {
      throw error;
    }
  }

  // Preview table data (first N rows)
  async getTablePreview(connectionId: string, tableName: string, limit: number = DATABASE_CONFIG.query.defaultPreviewLimit): Promise<QueryResult> {
    const config = this.connectionConfigs.get(connectionId);
    if (!config) {
      throw new Error('Connection not found');
    }

    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Use database-specific identifier quoting
    let quotedTableName: string;
    switch (config.type) {
      case 'mysql':
        quotedTableName = `\`${sanitizedTableName}\``;  // MySQL uses backticks
        break;
      case 'postgresql':
      case 'sqlite':
      default:
        quotedTableName = `"${sanitizedTableName}"`; // PostgreSQL and SQLite use double quotes
        break;
    }
    
    const sql = `SELECT * FROM ${quotedTableName} LIMIT ${Math.min(limit, DATABASE_CONFIG.query.maxPreviewLimit)}`;
    
    return await this.executeQuery(connectionId, sql);
  }

  // PostgreSQL-specific table metadata
  private async getPostgreSQLTableMetadata(connection: any, tableName: string): Promise<any> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    const queries = [
      // Row count
      `SELECT COUNT(*) as row_count FROM "${sanitizedTableName}"`,
      // Table size
      `SELECT 
         pg_size_pretty(pg_total_relation_size('${sanitizedTableName}')) as table_size,
         pg_size_pretty(pg_relation_size('${sanitizedTableName}')) as data_size,
         pg_size_pretty(pg_total_relation_size('${sanitizedTableName}') - pg_relation_size('${sanitizedTableName}')) as index_size`,
      // Table info
      `SELECT 
         schemaname, tablename, tableowner, 
         hasindexes, hasrules, hastriggers
       FROM pg_tables 
       WHERE tablename = '${sanitizedTableName}'`
    ];

    const results = await Promise.all(
      queries.map(async (query) => {
        const result = await connection.query(query);
        return result.rows[0] || {};
      })
    );

    return {
      tableName: sanitizedTableName,
      rowCount: parseInt(results[0].row_count) || 0,
      tableSize: results[1].table_size || 'Unknown',
      dataSize: results[1].data_size || 'Unknown',
      indexSize: results[1].index_size || 'Unknown',
      schema: results[2].schemaname || 'public',
      owner: results[2].tableowner || 'Unknown',
      hasIndexes: results[2].hasindexes || false,
      hasRules: results[2].hasrules || false,
      hasTriggers: results[2].hastriggers || false,
    };
  }

  // SQLite-specific table metadata
  private async getSQLiteTableMetadata(connection: any, tableName: string): Promise<any> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    return new Promise((resolve, reject) => {
      // Get row count
      connection.get(`SELECT COUNT(*) as row_count FROM "${sanitizedTableName}"`, (err: any, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          tableName: sanitizedTableName,
          rowCount: row?.row_count || 0,
          tableSize: 'N/A (SQLite)',
          dataSize: 'N/A (SQLite)', 
          indexSize: 'N/A (SQLite)',
          schema: 'main',
          owner: 'N/A (SQLite)',
          hasIndexes: false, // Could be enhanced
          hasRules: false,
          hasTriggers: false,
        });
      });
    });
  }

  // PostgreSQL-specific table columns
  private async getPostgreSQLTableColumns(connection: any, tableName: string): Promise<any[]> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `;

    const result = await connection.query(query, [sanitizedTableName]);
    
    return result.rows.map((col: any) => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
      maxLength: col.character_maximum_length,
      precision: col.numeric_precision,
      scale: col.numeric_scale,
      position: col.ordinal_position
    }));
  }

  // SQLite-specific table columns
  private async getSQLiteTableColumns(connection: any, tableName: string): Promise<any[]> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    return new Promise((resolve, reject) => {
      connection.all(`PRAGMA table_info("${sanitizedTableName}")`, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const columns = rows.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1,
          position: col.cid
        }));

        resolve(columns);
      });
    });
  }

  // Private methods for MySQL
  private async testMySQLConnection(config: ConnectionConfig): Promise<boolean> {
    let tunnel: TunnelConnection | undefined;
    
    try {
      // Create SSH tunnel if needed
      const connectionInfo = await this.createSSHTunnelIfNeeded(config);
      tunnel = connectionInfo.tunnel;

      const connection = await mysql.createConnection({
        host: connectionInfo.host,
        port: connectionInfo.port,
        database: config.config.database,
        user: config.config.username,
        password: config.config.password,
        connectTimeout: config.config.connectionTimeout || DATABASE_CONFIG.connection.testTimeoutMs,
        // Use new SSL configuration helper
        ssl: this.getSSLConfig(config) || undefined
      });

      await connection.execute('SELECT 1');
      await connection.end();
      return true;
    } catch (error) {
      const context = {
        host: config.config.host,
        port: config.config.port,
        database: config.config.database,
        username: config.config.username
      };
      
      const dbError = handleMySQLError(error as MySQLError, context);
      logger.error('MySQL connection test failed:', {
        code: dbError.code,
        message: dbError.message,
        context
      });
      
      return false;
    } finally {
      // Clean up tunnel if created for test
      if (tunnel) {
        tunnel.close();
      }
    }
  }

  private async createMySQLConnection(config: ConnectionConfig): Promise<mysql.Pool> {
    // Create SSH tunnel if needed
    const connectionInfo = await this.createSSHTunnelIfNeeded(config);

    const pool = mysql.createPool({
      host: connectionInfo.host,
      port: connectionInfo.port,
      database: config.config.database,
      user: config.config.username,
      password: config.config.password,
      
      // Core Pool Settings
      connectionLimit: DATABASE_CONFIG.connection.poolMaxConnections,
      queueLimit: DATABASE_CONFIG.mysql.queueLimit,
      
      // MySQL-specific Performance Settings
      dateStrings: false, // Return dates as Date objects
      supportBigNumbers: true, // Handle large numbers properly
      bigNumberStrings: false, // Return big numbers as numbers
      multipleStatements: false, // Security: prevent multiple statements
      
      // Use new SSL configuration helper
      ssl: this.getSSLConfig(config) || undefined
    });

    // Test the connection with enhanced retry logic
    let retries = 3;
    let lastError: MySQLError | null = null;
    
    while (retries > 0) {
      try {
        const connection = await pool.getConnection();
        await connection.execute('SELECT 1');
        connection.release();
        break;
      } catch (error) {
        lastError = error as MySQLError;
        retries--;
        
        const context = {
          host: config.config.host,
          port: config.config.port,
          database: config.config.database,
          username: config.config.username,
          attempt: 4 - retries
        };
        
        if (retries === 0) {
          const dbError = handleMySQLError(lastError, context);
          logger.error('MySQL connection creation failed after all retries:', {
            code: dbError.code,
            message: dbError.message,
            context
          });
          throw dbError;
        }
        
        logger.warn(`MySQL connection test failed, retrying... (${retries} attempts left)`, {
          error: lastError.message,
          code: lastError.code
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return pool;
  }

  private async executeMySQLQuery(pool: mysql.Pool, sql: string, params: any[]): Promise<QueryResult> {
    try {
      // Validate and sanitize parameters to prevent undefined binding errors
      const validatedParams = validateMySQLParameters(params);
      
      const [rows, fields] = await pool.execute(sql, validatedParams);
      
      return {
        rows: rows as any[],
        fields: (fields as any[]).map(field => ({
          name: field.name,
          type: field.type
        })),
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime: 0 // Will be set by caller
      };
    } catch (error) {
      const context = {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params.length,
        hasUndefinedParams: params.some(p => p === undefined)
      };
      
      const dbError = handleMySQLError(error as MySQLError, context);
      logger.error('MySQL query execution failed:', {
        code: dbError.code,
        message: dbError.message,
        context
      });
      
      throw dbError;
    }
  }

  private async getMySQLSchema(pool: mysql.Pool): Promise<DatabaseSchema> {
    try {
      // Get tables using validated approach
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        ORDER BY table_name
      `;
      
      const [tablesResult] = await pool.execute(tablesQuery);
      const tables: SchemaTable[] = [];

      for (const tableRow of tablesResult as any[]) {
        const tableName = tableRow.table_name || tableRow.TABLE_NAME;
        
        if (!tableName) {
          logger.warn('Skipping table with undefined name:', tableRow);
          continue;
        }
        
        try {
          // Get columns for this table with proper error handling
          const columnsQuery = `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              column_key
            FROM information_schema.columns 
            WHERE table_name = ? AND table_schema = DATABASE()
            ORDER BY ordinal_position
          `;
          
          const [columnsResult] = await pool.execute(columnsQuery, [tableName]);

          const columns = (columnsResult as any[]).map((col: any) => ({
            name: col.column_name || col.COLUMN_NAME,
            type: col.data_type || col.DATA_TYPE,
            nullable: (col.is_nullable || col.IS_NULLABLE) === 'YES',
            primaryKey: (col.column_key || col.COLUMN_KEY) === 'PRI'
          }));

          tables.push({
            name: tableName,
            columns
          });
        } catch (columnError) {
          const context = { table: tableName };
          const dbError = handleMySQLError(columnError as MySQLError, context);
          logger.error(`Failed to get columns for table ${tableName}:`, {
            code: dbError.code,
            message: dbError.message,
            context
          });
          
          // Continue with other tables instead of failing completely
          continue;
        }
      }

      return { tables };
    } catch (error) {
      const context = { operation: 'schema_retrieval' };
      const dbError = handleMySQLError(error as MySQLError, context);
      logger.error('MySQL schema retrieval failed:', {
        code: dbError.code,
        message: dbError.message,
        context
      });
      
      throw dbError;
    }
  }

  // MySQL-specific table metadata
  private async getMySQLTableMetadata(pool: mysql.Pool, tableName: string): Promise<any> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    try {
      // Row count with error handling
      const [rowCountResult] = await pool.execute(
        `SELECT COUNT(*) as row_count FROM \`${sanitizedTableName}\``
      );
      
      // Table size information with error handling
      const [sizeResult] = await pool.execute(`
        SELECT 
          ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'size_mb',
          ROUND((data_length / 1024 / 1024), 2) AS 'data_size_mb',
          ROUND((index_length / 1024 / 1024), 2) AS 'index_size_mb'
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = ?
      `, [sanitizedTableName]);

      const rowCount = (rowCountResult as any[])[0]?.row_count || 0;
      const sizeInfo = (sizeResult as any[])[0] || {};

      return {
        tableName: sanitizedTableName,
        rowCount: parseInt(rowCount) || 0,
        tableSize: sizeInfo.size_mb ? `${sizeInfo.size_mb} MB` : 'Unknown',
        dataSize: sizeInfo.data_size_mb ? `${sizeInfo.data_size_mb} MB` : 'Unknown',
        indexSize: sizeInfo.index_size_mb ? `${sizeInfo.index_size_mb} MB` : 'Unknown',
        schema: 'mysql',
        owner: 'MySQL',
        hasIndexes: (sizeInfo.index_size_mb || 0) > 0,
        hasRules: false,
        hasTriggers: false,
      };
    } catch (error) {
      const context = { 
        table: sanitizedTableName,
        operation: 'table_metadata'
      };
      
      const dbError = handleMySQLError(error as MySQLError, context);
      logger.error('MySQL table metadata retrieval failed:', {
        code: dbError.code,
        message: dbError.message,
        context
      });
      
      throw dbError;
    }
  }

  // MySQL-specific table columns
  private async getMySQLTableColumns(pool: mysql.Pool, tableName: string): Promise<any[]> {
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    
    try {
      const [result] = await pool.execute(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          ordinal_position,
          column_key
        FROM information_schema.columns 
        WHERE table_name = ? AND table_schema = DATABASE()
        ORDER BY ordinal_position
      `, [sanitizedTableName]);

      return (result as any[]).map((col: any) => ({
        name: col.column_name || col.COLUMN_NAME,
        type: col.data_type || col.DATA_TYPE,
        nullable: (col.is_nullable || col.IS_NULLABLE) === 'YES',
        defaultValue: col.column_default || col.COLUMN_DEFAULT,
        maxLength: col.character_maximum_length || col.CHARACTER_MAXIMUM_LENGTH,
        precision: col.numeric_precision || col.NUMERIC_PRECISION,
        scale: col.numeric_scale || col.NUMERIC_SCALE,
        position: col.ordinal_position || col.ORDINAL_POSITION,
        primaryKey: (col.column_key || col.COLUMN_KEY) === 'PRI'
      }));
    } catch (error) {
      const context = { 
        table: sanitizedTableName,
        operation: 'table_columns'
      };
      
      const dbError = handleMySQLError(error as MySQLError, context);
      logger.error('MySQL table columns retrieval failed:', {
        code: dbError.code,
        message: dbError.message,
        context
      });
      
      throw dbError;
    }
  }
}

export { DatabaseManager, ConnectionConfig, QueryResult, DatabaseSchema, SchemaTable }; 