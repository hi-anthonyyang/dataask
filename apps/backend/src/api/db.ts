import { Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../utils/database';
import { validateQuery } from '../security/sanitize';
import { logger } from '../utils/logger';

const router = Router();

// Connection schema validation
const ConnectionSchema = z.object({
  type: z.enum(['postgresql', 'sqlite', 'mysql']),
  name: z.string().min(1),
  config: z.object({
    // PostgreSQL config
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    // SQLite config
    filename: z.string().optional(),
  })
});

const QuerySchema = z.object({
  connectionId: z.string(),
  sql: z.string().min(1),
  params: z.array(z.any()).optional()
});

const TableMetadataSchema = z.object({
  connectionId: z.string(),
  tableName: z.string().min(1)
});

const TablePreviewSchema = z.object({
  connectionId: z.string(),
  tableName: z.string().min(1),
  limit: z.number().min(1).max(1000).optional()
});

// Test database connection
router.post('/test-connection', async (req, res) => {
  try {
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const isValid = await dbManager.testConnection(connection);
    
    res.json({ 
      success: isValid,
      message: isValid ? 'Connection successful' : 'Connection failed'
    });
  } catch (error) {
    logger.error('Connection test failed:', error);
    res.status(400).json({ 
      error: error instanceof z.ZodError ? 'Invalid connection parameters' : 'Connection test failed'
    });
  }
});

// Create new database connection
router.post('/connections', async (req, res) => {
  try {
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const connectionId = await dbManager.createConnection(connection);
    
    res.json({ 
      connectionId,
      message: 'Connection created successfully'
    });
  } catch (error) {
    logger.error('Failed to create connection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid connection parameters' });
    }
    
    // Return enhanced error information for database connection errors
    if (error instanceof Error && 'code' in error) {
      const dbError = error as any;
      return res.status(400).json({ 
        error: dbError.message,
        code: dbError.code,
        type: 'connection_error'
      });
    }
    
    res.status(400).json({ error: 'Failed to create connection' });
  }
});

// Get database schema information
router.get('/connections/:connectionId/schema', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const dbManager = DatabaseManager.getInstance();
    const schema = await dbManager.getSchema(connectionId);
    
    res.json({ schema });
  } catch (error) {
    logger.error('Failed to get schema:', error);
    
    // Return user-friendly error messages for database errors
    if (error instanceof Error && 'code' in error) {
      const dbError = error as any;
      return res.status(500).json({ 
        error: 'Failed to retrieve schema',
        details: dbError.message,
        code: dbError.code
      });
    }
    
    res.status(500).json({ error: 'Failed to retrieve schema' });
  }
});

// Execute SQL query
router.post('/query', async (req, res) => {
  try {
    const queryRequest = QuerySchema.parse(req.body);
    
    // Security validation - ensure read-only queries
    const validationResult = validateQuery(queryRequest.sql);
    if (!validationResult.isValid) {
      return res.status(400).json({ 
        error: 'Query validation failed',
        details: validationResult.errors
      });
    }
    
    const dbManager = DatabaseManager.getInstance();
    const result = await dbManager.executeQuery(
      queryRequest.connectionId,
      queryRequest.sql,
      queryRequest.params
    );
    
    logger.info(`Query executed successfully: ${queryRequest.sql.substring(0, 100)}...`);
    
    return res.json({
      data: result.rows,
      rowCount: result.rowCount,
      fields: result.fields,
      executionTime: result.executionTime
    });
  } catch (error) {
    logger.error('Query execution failed:', error);
    
    // Return enhanced error information for database errors
    if (error instanceof Error && 'code' in error) {
      const dbError = error as any;
      return res.status(500).json({ 
        error: dbError.message,
        code: dbError.code,
        type: 'database_error'
      });
    }
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Query execution failed'
    });
  }
});

// Get list of connections
router.get('/connections', async (req, res) => {
  try {
        const dbManager = DatabaseManager.getInstance();
    const connections = await dbManager.listConnections();

    res.json({ connections });
  } catch (error) {
    logger.error('Failed to list connections:', error);
    res.status(500).json({ error: 'Failed to retrieve connections' });
  }
});

// Delete connection
router.delete('/connections/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const dbManager = DatabaseManager.getInstance();
    await dbManager.deleteConnection(connectionId);
    
    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Get table metadata (row count, size, created date)
router.post('/table-metadata', async (req, res) => {
  try {
    const { connectionId, tableName } = TableMetadataSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const metadata = await dbManager.getTableMetadata(connectionId, tableName);
    
    res.json(metadata);
  } catch (error) {
    logger.error('Failed to get table metadata:', error);
    res.status(500).json({ error: 'Failed to get table metadata' });
  }
});

// Get table column details
router.post('/table-columns', async (req, res) => {
  try {
    const { connectionId, tableName } = TableMetadataSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const columns = await dbManager.getTableColumns(connectionId, tableName);
    
    res.json({ columns });
  } catch (error) {
    logger.error('Failed to get table columns:', error);
    res.status(500).json({ error: 'Failed to get table columns' });
  }
});

// Preview table data (first 100 rows)
router.post('/table-preview', async (req, res) => {
  try {
    const { connectionId, tableName, limit = 100 } = TablePreviewSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const preview = await dbManager.getTablePreview(connectionId, tableName, limit);
    
    res.json(preview);
  } catch (error) {
    logger.error('Failed to get table preview:', error);
    res.status(500).json({ error: 'Failed to get table preview' });
  }
});

export { router as dbRouter }; 