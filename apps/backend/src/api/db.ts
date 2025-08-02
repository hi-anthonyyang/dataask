import { Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../utils/database';
import { validateSQLQuery } from '../utils/validation';
import { logger } from '../utils/logger';
import { API_MESSAGES, QUERY_LIMITS } from '../utils/constants';
import { 
  handleZodError, 
  handleDatabaseError, 
  handleGenericError,
  createErrorResponse,
  getConnectionErrorGuidance 
} from '../utils/errors';
import {
  DatabaseType,
  ConnectionConfig,
  TestConnectionResponse,
  CreateConnectionResponse,
  SchemaResponse,
  QueryResponse,
  ConnectionListResponse,
  TableMetadata,
  TableColumn,
  TablePreviewResponse
} from '../types';

const router = Router();

// Database types enum for validation
const DATABASE_TYPES: DatabaseType[] = ['postgresql', 'sqlite', 'mysql'];

// Connection schema validation
const ConnectionSchema = z.object({
  type: z.enum(DATABASE_TYPES),
  name: z.string().min(1),
  config: z.object({
    // PostgreSQL and MySQL config
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
  sql: z.string().min(QUERY_LIMITS.MIN_QUERY_LENGTH),
  params: z.array(z.unknown()).optional()
});

const TableMetadataSchema = z.object({
  connectionId: z.string(),
  tableName: z.string().min(1)
});

const TablePreviewSchema = z.object({
  connectionId: z.string(),
  tableName: z.string().min(1),
  limit: z.number().min(1).max(QUERY_LIMITS.MAX_PREVIEW_ROWS).optional()
});

// Test database connection
router.post('/test-connection', async (req, res) => {
  try {
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const isValid = await dbManager.testConnection(connection);
    
    res.json({ 
      success: isValid,
      message: isValid ? API_MESSAGES.CONNECTION_SUCCESS : API_MESSAGES.CONNECTION_FAILED
    });
  } catch (error) {
    logger.error('Connection test failed:', error);
    
    if (error instanceof z.ZodError) {
      return handleZodError(res, error, API_MESSAGES.INVALID_PARAMS);
    }
    
    // Return specific error message for database connection issues
    const errorResponse = createErrorResponse(error, 'Connection test failed', true);
    
    res.json({ 
      success: false,
      message: errorResponse.error,
      error: errorResponse.error,
      type: errorResponse.type || 'connection_test_error',
      guidance: errorResponse.guidance
    });
  }
});

// Create new database connection
router.post('/connections', async (req, res) => {
  try {
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const connectionId = await dbManager.createConnection(connection);
    
    return res.json({ 
      connectionId,
      message: 'Connection created successfully'
    });
  } catch (error) {
    logger.error('Failed to create connection:', error);
    
    if (error instanceof z.ZodError) {
      return handleZodError(res, error, 'Invalid connection parameters');
    }
    
    // Return enhanced error information for database connection errors
    const errorResponse = createErrorResponse(error, 'Failed to create connection');
    return res.status(400).json({ 
      error: errorResponse.error,
      code: errorResponse.code,
      type: errorResponse.type || 'connection_error',
      details: 'Check server logs for more information'
    });
  }
});

// Get database schema information
router.get('/connections/:connectionId/schema', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    logger.info(`Getting schema for connection: ${connectionId}`);
    
    const dbManager = DatabaseManager.getInstance();
    const schema = await dbManager.getSchema(connectionId);
    
    logger.info(`Schema retrieved for ${connectionId}: ${schema.tables.length} tables found`);
    
    return res.json({ schema });
  } catch (error) {
    return handleDatabaseError(res, error, 'schema retrieval');
  }
});

// Execute SQL query
router.post('/query', async (req, res) => {
  try {
    const queryRequest = QuerySchema.parse(req.body);
    
    // Security validation - ensure read-only queries
    const validationResult = validateSQLQuery(queryRequest.sql);
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
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    
    return handleDatabaseError(res, error, 'query execution');
  }
});

// Get list of connections
router.get('/connections', async (req, res) => {
  try {
    const dbManager = DatabaseManager.getInstance();
    const connections = await dbManager.listConnections();

    logger.info(`Listing connections: found ${connections.length} connections`);
    connections.forEach(conn => {
      logger.info(`Connection: ${conn.id} - ${conn.name} (${conn.type})`);
    });

    res.json({ connections });
  } catch (error) {
    return handleGenericError(res, error, 'Failed to retrieve connections');
  }
});

// Update connection
router.put('/connections/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const connection = ConnectionSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    
    // Delete the old connection
    await dbManager.deleteConnection(connectionId);
    
    // Create the new connection
    const newConnectionId = await dbManager.createConnection(connection);
    
    return res.json({ 
      connectionId: newConnectionId,
      message: 'Connection updated successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(res, error, 'Invalid connection parameters');
    }
    
    return handleGenericError(res, error, 'Failed to update connection');
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
    return handleGenericError(res, error, 'Failed to delete connection');
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
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    
    return handleGenericError(res, error, 'Failed to get table metadata');
  }
});

// Get table column details
router.post('/table-columns', async (req, res) => {
  try {
    const { connectionId, tableName } = TableMetadataSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const columns = await dbManager.getTableColumns(connectionId, tableName);
    
    return res.json({ columns });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    
    return handleDatabaseError(res, error, 'table columns retrieval');
  }
});

// Preview table data (first 100 rows)
router.post('/table-preview', async (req, res) => {
  try {
    const { connectionId, tableName, limit = 100 } = TablePreviewSchema.parse(req.body);
    
    const dbManager = DatabaseManager.getInstance();
    const preview = await dbManager.getTablePreview(connectionId, tableName, limit);
    
    return res.json(preview);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(res, error);
    }
    
    return handleDatabaseError(res, error, 'table preview');
  }
});

export { router as dbRouter }; 