import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

interface Migration {
  id: number;
  filename: string;
  executed_at?: Date;
}

export class MigrationRunner {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async init(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  async getExecutedMigrations(): Promise<Migration[]> {
    const result = await this.pool.query(
      'SELECT id, filename, executed_at FROM migrations ORDER BY id'
    );
    return result.rows;
  }

  async executeMigration(id: number, filename: string): Promise<void> {
    const migrationPath = join(__dirname, '../../migrations', filename);
    
    try {
      const sql = readFileSync(migrationPath, 'utf8');
      
      // Execute migration in a transaction
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
          [id, filename]
        );
        await client.query('COMMIT');
        
        logger.info(`Migration ${filename} executed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Failed to execute migration ${filename}:`, error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    await this.init();
    
    const executed = await this.getExecutedMigrations();
    const executedIds = new Set(executed.map(m => m.id));
    
    // Define available migrations
    const availableMigrations = [
      { id: 1, filename: '001_create_users_table.sql' },
      { id: 2, filename: '002_create_user_connections.sql' }
    ];
    
    for (const migration of availableMigrations) {
      if (!executedIds.has(migration.id)) {
        logger.info(`Running migration: ${migration.filename}`);
        await this.executeMigration(migration.id, migration.filename);
      }
    }
    
    logger.info('All migrations completed');
  }
}