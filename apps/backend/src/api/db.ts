import { Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../utils/database';
import { validateQuery } from '../security/sanitize';
import { logger } from '../utils/logger';

const router = Router();

// Connection schema validation
const ConnectionSchema = z.object({
  type: z.enum(['postgresql', 'sqlite']),
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

// Test database connection
router.post('/test-connection', async (req, res) => {
  try {
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = new DatabaseManager();
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
    
    const dbManager = new DatabaseManager();
    const connectionId = await dbManager.createConnection(connection);
    
    res.json({ 
      connectionId,
      message: 'Connection created successfully'
    });
  } catch (error) {
    logger.error('Failed to create connection:', error);
    res.status(400).json({ 
      error: error instanceof z.ZodError ? 'Invalid connection parameters' : 'Failed to create connection'
    });
  }
});

// Get database schema information
router.get('/connections/:connectionId/schema', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const dbManager = new DatabaseManager();
    const schema = await dbManager.getSchema(connectionId);
    
    res.json({ schema });
  } catch (error) {
    logger.error('Failed to get schema:', error);
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
    
    const dbManager = new DatabaseManager();
    const result = await dbManager.executeQuery(
      queryRequest.connectionId,
      queryRequest.sql,
      queryRequest.params
    );
    
    logger.info(`Query executed successfully: ${queryRequest.sql.substring(0, 100)}...`);
    
    res.json({
      data: result.rows,
      rowCount: result.rowCount,
      fields: result.fields,
      executionTime: result.executionTime
    });
  } catch (error) {
    logger.error('Query execution failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Query execution failed'
    });
  }
});

// Get list of connections
router.get('/connections', async (req, res) => {
  try {
    const dbManager = new DatabaseManager();
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
    
    const dbManager = new DatabaseManager();
    await dbManager.deleteConnection(connectionId);
    
    res.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

export { router as dbRouter }; 