import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { limitQueryResult, validateQueryResult } from '../security/sanitize';
import { sanitizeParameters, sanitizeTableName, quoteTableName } from './validation';
import { 
  DatabaseType, 
  ConnectionConfig, 
  QueryResult as IQueryResult,
  DatabaseField,
  TableInfo,
  TableColumn,
  TableMetadata,
  DatabaseSchema,
  SavedConnection
} from '../types';
import path from 'path';
import fs from 'fs';

/**
 * Simplified Database Manager for SQLite only
 * 
 * Features:
 * - SQLite database connections
 * - Query execution with parameter sanitization
 * - Schema introspection
 * - Connection persistence
 */

interface DatabaseConnectionConfig extends ConnectionConfig {
  id: string;
}

interface QueryResult extends IQueryResult {
  rows: any[];
  fields: DatabaseField[];
  rowCount: number;
  executionTime: number;
}

// Configuration constants
const DATABASE_CONFIG = {
  connection: {
    busyTimeout: 5000,
    testTimeoutMs: 5000
  },
  query: {
    defaultLimit: 1000,
    maxLimit: 10000
  }
};

class DatabaseManager {
  private static instance: DatabaseManager;
  private connections: Map<string, sqlite3.Database> = new Map();
  private connectionConfigs: Map<string, DatabaseConnectionConfig> = new Map();

  private constructor() {
    // Load persisted connections on startup
    this.loadPersistedConnections();
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Load persisted SQLite connections from disk
   */
  private async loadPersistedConnections() {
    try {
      const persistedConnectionsPath = path.join(process.cwd(), 'data', 'connections.json');
      
      if (fs.existsSync(persistedConnectionsPath)) {
        const data = fs.readFileSync(persistedConnectionsPath, 'utf-8');
        const connections: DatabaseConnectionConfig[] = JSON.parse(data);
        
        for (const config of connections) {
          if (config.type === 'sqlite' && config.filename) {
            try {
              // Verify file exists
              if (fs.existsSync(config.filename)) {
                this.connectionConfigs.set(config.id, config);
                logger.info(`Loaded persisted SQLite connection: ${config.name}`);
              } else {
                logger.warn(`SQLite file not found for connection ${config.name}: ${config.filename}`);
              }
            } catch (error) {
              logger.error(`Failed to load connection ${config.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load persisted connections:', error);
    }
  }

  /**
   * Persist SQLite connections to disk
   */
  private async persistConnections() {
    try {
      const connections: DatabaseConnectionConfig[] = [];
      
      for (const [id, config] of this.connectionConfigs.entries()) {
        // Only persist SQLite connections
        if (config.type === 'sqlite') {
          connections.push({
            ...config,
            id
          });
        }
      }
      
      const persistedConnectionsPath = path.join(process.cwd(), 'data', 'connections.json');
      const dataDir = path.dirname(persistedConnectionsPath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(persistedConnectionsPath, JSON.stringify(connections, null, 2));
      logger.info(`Persisted ${connections.length} SQLite connections`);
    } catch (error) {
      logger.error('Failed to persist connections:', error);
    }
  }

  /**
   * Test a database connection
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    if (config.type !== 'sqlite') {
      throw new Error('Only SQLite connections are supported');
    }

    return this.testSQLiteConnection(config);
  }

  /**
   * Create a new database connection
   */
  async createConnection(config: ConnectionConfig): Promise<string> {
    if (config.type !== 'sqlite') {
      throw new Error('Only SQLite connections are supported');
    }

    const connectionId = config.id || uuidv4();
    const connectionConfig: DatabaseConnectionConfig = {
      ...config,
      id: connectionId
    };

    // Test connection first
    const isValid = await this.testConnection(config);
    if (!isValid) {
      throw new Error('Failed to establish database connection');
    }

    // Store configuration
    this.connectionConfigs.set(connectionId, connectionConfig);
    
    // Persist SQLite connections
    if (config.type === 'sqlite') {
      await this.persistConnections();
    }

    logger.info(`Created ${config.type} connection: ${connectionId}`);
    return connectionId;
  }

  /**
   * Get or create a SQLite connection
   */
  private async getOrCreateSQLiteConnection(connectionId: string): Promise<sqlite3.Database> {
    const existing = this.connections.get(connectionId);
    if (existing) {
      return existing;
    }

    const config = this.connectionConfigs.get(connectionId);
    if (!config || config.type !== 'sqlite') {
      throw new Error(`Connection ${connectionId} not found or not SQLite`);
    }

    const db = await this.createSQLiteConnection(config);
    this.connections.set(connectionId, db);
    return db;
  }

  /**
   * Execute a query
   */
  async executeQuery(
    connectionId: string, 
    sql: string, 
    params: unknown[] = []
  ): Promise<QueryResult> {
    const config = this.connectionConfigs.get(connectionId);
    if (!config) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const startTime = Date.now();
    const connection = await this.getOrCreateSQLiteConnection(connectionId);

    try {
      logger.info(`Executing query on connection ${connectionId}: ${sql.substring(0, 100)}...`);
      
      // Sanitize parameters
      const sanitizedParams = sanitizeParameters(params);
      
      // Execute query based on type
      const result = await this.executeSQLiteQuery(connection, sql, sanitizedParams);
      
      // Validate and limit results
      validateQueryResult(result);
      const limitedResult = limitQueryResult(result, DATABASE_CONFIG.query.maxLimit);
      
      const executionTime = Date.now() - startTime;
      logger.info(`Query executed successfully in ${executionTime}ms, returned ${result.rowCount} rows`);
      
      return {
        ...limitedResult,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`Query failed after ${executionTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Get database schema
   */
  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const config = this.connectionConfigs.get(connectionId);
    if (!config) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const connection = await this.getOrCreateSQLiteConnection(connectionId);
    return await this.getSQLiteSchema(connection);
  }

  /**
   * List all active connections
   */
  async listConnections(): Promise<SavedConnection[]> {
    const connections = [];
    
    for (const [id, config] of this.connectionConfigs.entries()) {
      connections.push({
        id,
        name: config.name,
        type: config.type,
        config: {
          filename: config.filename
        }
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

    if (connection && config?.type === 'sqlite') {
      await new Promise((resolve, reject) => {
        connection.close((err: Error | null) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });
    }

    this.connections.delete(connectionId);
    this.connectionConfigs.delete(connectionId);
    
    logger.info(`Database connection deleted: ${connectionId}`);
    
    // Update persisted connections
    if (config?.type === 'sqlite') {
      await this.persistConnections();
    }
  }

  // SQLite-specific methods

  private async testSQLiteConnection(config: ConnectionConfig): Promise<boolean> {
    if (!config.filename) {
      throw new Error('SQLite filename is required');
    }

    // Check if file exists
    if (!fs.existsSync(config.filename)) {
      throw new Error(`SQLite file not found: ${config.filename}`);
    }

    return new Promise((resolve) => {
      const db = new sqlite3.Database(config.filename!, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          logger.error('SQLite connection test failed:', err);
          resolve(false);
        } else {
          db.close((closeErr) => {
            if (closeErr) {
              logger.error('Error closing test connection:', closeErr);
            }
            resolve(true);
          });
        }
      });
    });
  }

  private async createSQLiteConnection(config: DatabaseConnectionConfig): Promise<sqlite3.Database> {
    if (!config.filename) {
      throw new Error('SQLite filename is required');
    }

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(config.filename!, (err) => {
        if (err) {
          reject(err);
        } else {
          // Configure database
          db.configure('busyTimeout', DATABASE_CONFIG.connection.busyTimeout);
          
          // Enable foreign keys
          db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
              logger.warn('Failed to enable foreign keys:', err);
            }
          });

          resolve(db);
        }
      });
    });
  }

  private async executeSQLiteQuery(
    db: sqlite3.Database, 
    sql: string, 
    params: unknown[]
  ): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // For SELECT queries
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            // Get column info from the first row
            const fields: DatabaseField[] = rows.length > 0
              ? Object.keys(rows[0] as any).map(name => ({ name, type: 'TEXT' }))
              : [];

            resolve({
              rows,
              fields,
              rowCount: rows.length,
              executionTime: Date.now() - startTime
            });
          }
        });
      } else {
        // For INSERT, UPDATE, DELETE
        db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              rows: [],
              fields: [],
              rowCount: this.changes,
              executionTime: Date.now() - startTime
            });
          }
        });
      }
    });
  }

  private async getSQLiteSchema(db: sqlite3.Database): Promise<DatabaseSchema> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          name,
          type
        FROM sqlite_master
        WHERE type IN ('table', 'view')
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;

      db.all(sql, [], async (err, tables: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const tableInfos: TableInfo[] = [];

        for (const table of tables) {
          try {
            const columns = await this.getSQLiteTableColumns(db, table.name);
            tableInfos.push({
              name: table.name,
              type: table.type,
              columns
            });
          } catch (error) {
            logger.error(`Failed to get columns for table ${table.name}:`, error);
            tableInfos.push({
              name: table.name,
              type: table.type,
              columns: []
            });
          }
        }

        resolve({ tables: tableInfos });
      });
    });
  }

  private getSQLiteTableColumns(db: sqlite3.Database, tableName: string): Promise<TableColumn[]> {
    return new Promise((resolve, reject) => {
      const quotedTableName = quoteTableName(tableName, 'sqlite');
      const sql = `PRAGMA table_info(${quotedTableName})`;

      db.all(sql, [], (err, columns: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const tableColumns: TableColumn[] = columns.map(col => ({
          name: col.name,
          type: col.type || 'TEXT',
          nullable: col.notnull === 0,
          default_value: col.dflt_value,
          primary_key: col.pk === 1
        }));

        resolve(tableColumns);
      });
    });
  }

  /**
   * Get table metadata (row count, size)
   */
  async getTableMetadata(connectionId: string, tableName: string): Promise<TableMetadata> {
    const connection = await this.getOrCreateSQLiteConnection(connectionId);
    
    // Get row count
    const countResult = await this.executeSQLiteQuery(
      connection,
      `SELECT COUNT(*) as count FROM ${quoteTableName(tableName, 'sqlite')}`,
      []
    );
    const rowCount = countResult.rows[0]?.count || 0;

    // Get columns
    const columns = await this.getSQLiteTableColumns(connection, tableName);

    // For SQLite, we can't easily get table size, so we'll estimate
    const tableSize = 'N/A';

    return {
      row_count: rowCount,
      table_size: tableSize,
      columns
    };
  }

  /**
   * Get table preview data
   */
  async getTablePreview(
    connectionId: string, 
    tableName: string, 
    limit: number = 100
  ): Promise<QueryResult> {
    const quotedTableName = quoteTableName(tableName, 'sqlite');
    const sql = `SELECT * FROM ${quotedTableName} LIMIT ?`;
    
    return this.executeQuery(connectionId, sql, [limit]);
  }
}

export { 
  DatabaseManager, 
  ConnectionConfig, 
  QueryResult, 
  DatabaseSchema,
  TableInfo as SchemaTable 
}; 