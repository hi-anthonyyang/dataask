import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface DataSource {
  id: string;
  name: string;
  type: 'csv' | 'excel';
  metadata: {
    path: string;
    size: number;
    created: Date;
    lastAccessed: Date;
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

  async importFile(
    originalPath: string,
    processedPath: string,
    metadata: {
      originalFileName: string;
      rowCount: number;
      fileType: 'csv' | 'excel';
    }
  ): Promise<DataSource> {
    await this.initialize();

    const id = uuidv4();
    const stats = await fs.stat(originalPath);
    
    const source: DataSource = {
      id,
      name: metadata.originalFileName,
      type: metadata.fileType,
      metadata: {
        path: processedPath,
        size: stats.size,
        created: new Date(),
        lastAccessed: new Date(),
        rowCount: metadata.rowCount,
        originalFileName: metadata.originalFileName
      },
      status: 'ready'
    };

    this.sources.set(id, source);
    await this.persistSources();
    
    logger.info(`Imported file: ${source.name} (${id})`);
    return source;
  }

  async listSources(): Promise<DataSource[]> {
    await this.initialize();
    return Array.from(this.sources.values());
  }

  async getSource(id: string): Promise<DataSource | undefined> {
    await this.initialize();
    return this.sources.get(id);
  }

  async deleteSource(id: string): Promise<void> {
    await this.initialize();
    
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source not found: ${id}`);
    }

    // Delete the file
    try {
      await fs.unlink(source.metadata.path);
    } catch (error) {
      logger.warn(`Failed to delete file ${source.metadata.path}:`, error);
    }

    // Remove from sources
    this.sources.delete(id);
    await this.persistSources();
    
    logger.info(`Deleted source: ${source.name} (${id})`);
  }

  async updateSourceStatus(id: string, status: DataSource['status'], error?: string): Promise<void> {
    await this.initialize();
    
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source not found: ${id}`);
    }

    source.status = status;
    if (error) {
      source.error = error;
    }
    source.metadata.lastAccessed = new Date();

    await this.persistSources();
  }
}