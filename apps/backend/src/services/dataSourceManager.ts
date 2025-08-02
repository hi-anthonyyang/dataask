import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import sqlite3 from 'sqlite3';

export interface DataSource {
  id: string;
  name: string;
  type: 'sqlite' | 'parquet' | 'live-import';
  metadata: {
    path: string;
    size: number;
    created: Date;
    lastAccessed: Date;
    tableCount?: number;
    rowCount?: number;
    originalFileName?: string;
  };
  status: 'ready' | 'importing' | 'error';
  error?: string;
}

export interface DataSourceMetadata {
  sources: DataSource[];
  version: string;
}

export class DataSourceManager {
  private static instance: DataSourceManager;
  private sources: Map<string, DataSource> = new Map();
  private dataDir: string;
  private metadataPath: string;
  private initialized = false;

  private constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.metadataPath = path.join(this.dataDir, 'sources.json');
  }

  static getInstance(): DataSourceManager {
    if (!DataSourceManager.instance) {
      DataSourceManager.instance = new DataSourceManager();
    }
    return DataSourceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'sqlite'), { recursive: true });
      await fs.mkdir(path.join(this.dataDir, 'imports'), { recursive: true });

      // Load existing sources
      await this.loadSources();
      this.initialized = true;
      
      logger.info(`DataSourceManager initialized with ${this.sources.size} sources`);
    } catch (error) {
      logger.error('Failed to initialize DataSourceManager:', error);
      throw error;
    }
  }

  private async loadSources(): Promise<void> {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      const metadata: DataSourceMetadata = JSON.parse(data);
      
      for (const source of metadata.sources) {
        // Convert date strings back to Date objects
        source.metadata.created = new Date(source.metadata.created);
        source.metadata.lastAccessed = new Date(source.metadata.lastAccessed);
        this.sources.set(source.id, source);
      }
    } catch (error) {
      // File doesn't exist yet, that's okay
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to load sources:', error);
      }
    }
  }

  private async persistSources(): Promise<void> {
    const metadata: DataSourceMetadata = {
      sources: Array.from(this.sources.values()),
      version: '1.0.0'
    };

    await fs.writeFile(
      this.metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
  }

  async registerSQLite(filePath: string, name?: string): Promise<DataSource> {
    await this.initialize();

    const id = uuidv4();
    const stats = await fs.stat(filePath);
    
    // Get table count from SQLite
    let tableCount = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.get(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            (err, row: any) => {
              if (err) {
                logger.error('Failed to read SQLite metadata:', err);
              } else if (row) {
                tableCount = row.count;
              }
              
              db.close((closeErr) => {
                if (closeErr) logger.error('Error closing db:', closeErr);
                resolve();
              });
            }
          );
        });
      });
    } catch (error) {
      logger.error('Failed to read SQLite metadata:', error);
    }

    const source: DataSource = {
      id,
      name: name || path.basename(filePath, '.db'),
      type: 'sqlite',
      metadata: {
        path: filePath,
        size: stats.size,
        created: new Date(),
        lastAccessed: new Date(),
        tableCount
      },
      status: 'ready'
    };

    this.sources.set(id, source);
    await this.persistSources();
    
    logger.info(`Registered SQLite source: ${source.name} (${id})`);
    return source;
  }

  async importFile(
    originalPath: string,
    parquetPath: string,
    metadata: {
      originalFileName: string;
      rowCount: number;
      tableCount: number;
    }
  ): Promise<DataSource> {
    await this.initialize();

    const id = uuidv4();
    const stats = await fs.stat(parquetPath);

    const source: DataSource = {
      id,
      name: path.basename(metadata.originalFileName, path.extname(metadata.originalFileName)),
      type: 'parquet',
      metadata: {
        path: parquetPath,
        size: stats.size,
        created: new Date(),
        lastAccessed: new Date(),
        tableCount: metadata.tableCount,
        rowCount: metadata.rowCount,
        originalFileName: metadata.originalFileName
      },
      status: 'ready'
    };

    this.sources.set(id, source);
    await this.persistSources();
    
    logger.info(`Imported file as data source: ${source.name} (${id})`);
    return source;
  }

  async listSources(): Promise<DataSource[]> {
    await this.initialize();
    return Array.from(this.sources.values());
  }

  async getSource(id: string): Promise<DataSource | undefined> {
    await this.initialize();
    const source = this.sources.get(id);
    
    if (source) {
      // Update last accessed time
      source.metadata.lastAccessed = new Date();
      await this.persistSources();
    }
    
    return source;
  }

  async deleteSource(id: string): Promise<void> {
    await this.initialize();
    const source = this.sources.get(id);
    
    if (!source) {
      throw new Error(`Source ${id} not found`);
    }

    // Delete the actual file if it's an import
    if (source.type === 'parquet') {
      try {
        await fs.unlink(source.metadata.path);
        // Also try to remove the directory if empty
        const dir = path.dirname(source.metadata.path);
        await fs.rmdir(dir).catch(() => {}); // Ignore if not empty
      } catch (error) {
        logger.error(`Failed to delete file for source ${id}:`, error);
      }
    }

    this.sources.delete(id);
    await this.persistSources();
    
    logger.info(`Deleted data source: ${source.name} (${id})`);
  }

  async updateSourceStatus(id: string, status: DataSource['status'], error?: string): Promise<void> {
    const source = this.sources.get(id);
    if (source) {
      source.status = status;
      source.error = error;
      await this.persistSources();
    }
  }

  // Migration helper: Convert existing SQLite connections to data sources
  async migrateFromConnections(connections: any[]): Promise<void> {
    await this.initialize();
    
    for (const conn of connections) {
      if (conn.type === 'sqlite' && conn.config?.filename) {
        try {
          // Check if already migrated
          const existing = Array.from(this.sources.values()).find(
            s => s.metadata.path === conn.config.filename
          );
          
          if (!existing) {
            await this.registerSQLite(conn.config.filename, conn.name);
            logger.info(`Migrated connection ${conn.name} to data source`);
          }
        } catch (error) {
          logger.error(`Failed to migrate connection ${conn.name}:`, error);
        }
      }
    }
  }
}