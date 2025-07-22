import { Pool, Client } from 'pg';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { sanitizeParams, limitQueryResult, validateQueryResult } from '../security/sanitize';

interface ConnectionConfig {
  type: 'postgresql' | 'sqlite';
  name: string;
  config: {
    // PostgreSQL
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    // SQLite
    filename?: string;
  };
}

interface QueryResult {
  rows: any[];
  fields: any[];
  rowCount: number;
  executionTime: number;
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
   * Test a database connection without storing it
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      if (config.type === 'postgresql') {
        return await this.testPostgreSQLConnection(config);
      } else if (config.type === 'sqlite') {
        return await this.testSQLiteConnection(config);
      }
      return false;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
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
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.connections.set(connectionId, connection);
      this.connectionConfigs.set(connectionId, config);

      logger.info(`Database connection created: ${config.name} (${config.type})`);
      return connectionId;

    } catch (error) {
      logger.error('Failed to create database connection:', error);
      throw new Error(`Failed to connect to ${config.type} database: ${error.message}`);
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

      if (config.type === 'postgresql') {
        result = await this.executePostgreSQLQuery(connection, sql, sanitizedParams);
      } else if (config.type === 'sqlite') {
        result = await this.executeSQLiteQuery(connection, sql, sanitizedParams);
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }

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
      logger.error('Query execution failed:', { connectionId, error: error.message });
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
      } else {
        throw new Error(`Unsupported database type: ${config.type}`);
      }
    } catch (error) {
      logger.error('Failed to retrieve schema:', error);
      throw new Error(`Failed to retrieve schema: ${error.message}`);
    }
  }

  /**
   * List all active connections
   */
  async listConnections(): Promise<{ id: string; name: string; type: string }[]> {
    const connections = [];
    
    for (const [id, config] of this.connectionConfigs.entries()) {
      connections.push({
        id,
        name: config.name,
        type: config.type
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
    const client = new Client({
      host: config.config.host,
      port: config.config.port,
      database: config.config.database,
      user: config.config.username,
      password: config.config.password,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async createPostgreSQLConnection(config: ConnectionConfig): Promise<Pool> {
    const pool = new Pool({
      host: config.config.host,
      port: config.config.port,
      database: config.config.database,
      user: config.config.username,
      password: config.config.password,
      max: 5, // Maximum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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
      return false;
    }

    return new Promise((resolve) => {
      const db = new sqlite3.Database(config.config.filename!, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          resolve(false);
        } else {
          db.close((closeErr) => {
            resolve(!closeErr);
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
      const db = new sqlite3.Database(config.config.filename!, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  }

  private async executeSQLiteQuery(db: sqlite3.Database, sql: string, params: any[]): Promise<QueryResult> {
    const allAsync = promisify(db.all.bind(db));
    
    try {
      const rows = await allAsync(sql, params) as any[];
      
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
}

export { DatabaseManager, ConnectionConfig, QueryResult, DatabaseSchema, SchemaTable }; 