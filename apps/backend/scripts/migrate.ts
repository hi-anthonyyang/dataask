#!/usr/bin/env tsx

import { Pool } from 'pg';
import { MigrationRunner } from '../src/utils/migrations';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigrations() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'dataask_dev',
    user: process.env.POSTGRES_USER || 'dataask_user',
    password: process.env.POSTGRES_PASSWORD || 'dataask_dev_password',
  });

  try {
    logger.info('Starting database migrations...');
    
    const migrationRunner = new MigrationRunner(pool);
    await migrationRunner.runMigrations();
    
    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}