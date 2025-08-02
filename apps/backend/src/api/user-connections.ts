import { Router } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { UserService, CreateConnectionData } from '../utils/userService';
import { authenticateToken, AuthenticatedRequest } from '../utils/auth';
import { logger } from '../utils/logger';
import {
  handleZodError,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendConflict,
  sendServerError
} from '../utils/errors';

const router = Router();

// Initialize user service (will be set in the factory function)
let userService: UserService;

// Validation schemas
const CreateConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['postgresql', 'mysql', 'sqlite']),
  config: z.object({
    // PostgreSQL & MySQL
    host: z.string().optional(),
    port: z.number().min(1).max(65535).optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    // SQLite
    filename: z.string().optional(),
    // SSL Configuration
    sslEnabled: z.boolean().optional(),
    sslMode: z.enum(['require', 'prefer', 'allow', 'disable']).optional(),
    sslCa: z.string().optional(),
    sslCert: z.string().optional(),
    sslKey: z.string().optional(),
    sslRejectUnauthorized: z.boolean().optional(),
    // Connection Timeouts
    connectionTimeout: z.number().min(1000).max(300000).optional(), // 1s to 5min
    queryTimeout: z.number().min(1000).max(3600000).optional(), // 1s to 1hour
    // SSH Tunnel Configuration
    sshEnabled: z.boolean().optional(),
    sshHost: z.string().optional(),
    sshPort: z.number().min(1).max(65535).optional(),
    sshUsername: z.string().optional(),
    sshPassword: z.string().optional(),
    sshPrivateKey: z.string().optional(),
    sshPassphrase: z.string().optional(),
  })
});

const UpdateConnectionSchema = CreateConnectionSchema;

// Apply authentication to all routes
router.use(authenticateToken);

// Get all user connections
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res, 'User not authenticated');
    }

    const connections = await userService.getUserConnections(req.user.id);

    // Remove sensitive data from response
    const safeConnections = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      type: conn.type,
      created_at: conn.created_at,
      updated_at: conn.updated_at,
      last_used: conn.last_used,
      // Include non-sensitive config for display
      config: {
        host: conn.config.host,
        port: conn.config.port,
        database: conn.config.database,
        username: conn.config.username,
        filename: conn.config.filename,
        // Never send password
      }
    }));

    res.json({ connections: safeConnections });

  } catch (error) {
    logger.error('Failed to get user connections:', error);
    sendServerError(res, error, 'Failed to retrieve connections');
  }
});

// Get a specific user connection
router.get('/:connectionId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return sendUnauthorized(res, 'User not authenticated');
    }

    const { connectionId } = req.params;
    const connection = await userService.getUserConnection(req.user.id, connectionId);

    if (!connection) {
      return sendNotFound(res, 'Connection');
    }

    // Remove sensitive data from response
    const safeConnection = {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
      last_used: connection.last_used,
      config: {
        host: connection.config.host,
        port: connection.config.port,
        database: connection.config.database,
        username: connection.config.username,
        filename: connection.config.filename,
        // Never send password
      }
    };

    res.json({ connection: safeConnection });

  } catch (error) {
    logger.error('Failed to get user connection:', error);
    res.status(500).json({ error: 'Failed to retrieve connection' });
  }
});

// Create a new user connection
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const connectionData = CreateConnectionSchema.parse(req.body);

    // Validate required fields based on connection type
    if (connectionData.type === 'sqlite') {
      if (!connectionData.config.filename) {
        return res.status(400).json({ error: 'SQLite filename is required' });
      }
    } else {
      if (!connectionData.config.host || !connectionData.config.database) {
        return res.status(400).json({ error: 'Host and database are required for PostgreSQL/MySQL connections' });
      }
    }

    const connection = await userService.createConnection(req.user.id, connectionData);

    // Remove sensitive data from response
    const safeConnection = {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
      config: {
        host: connection.config.host,
        port: connection.config.port,
        database: connection.config.database,
        username: connection.config.username,
        filename: connection.config.filename,
        // Never send password
      }
    };

    logger.info(`Connection created: ${connection.name} for user ${req.user.id}`);

    res.status(201).json({ 
      connection: safeConnection,
      message: 'Connection created successfully'
    });

  } catch (error) {
    logger.error('Failed to create user connection:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    }

    if (error instanceof Error && error.message.includes('unique_user_connection_name')) {
      return res.status(409).json({ error: 'A connection with this name already exists' });
    }

    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Update a user connection
router.put('/:connectionId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { connectionId } = req.params;
    const connectionData = UpdateConnectionSchema.parse(req.body);

    // Validate required fields based on connection type
    if (connectionData.type === 'sqlite') {
      if (!connectionData.config.filename) {
        return res.status(400).json({ error: 'SQLite filename is required' });
      }
    } else {
      if (!connectionData.config.host || !connectionData.config.database) {
        return res.status(400).json({ error: 'Host and database are required for PostgreSQL/MySQL connections' });
      }
    }

    const connection = await userService.updateConnection(req.user.id, connectionId, connectionData);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Remove sensitive data from response
    const safeConnection = {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
      config: {
        host: connection.config.host,
        port: connection.config.port,
        database: connection.config.database,
        username: connection.config.username,
        filename: connection.config.filename,
        // Never send password
      }
    };

    logger.info(`Connection updated: ${connection.name} for user ${req.user.id}`);

    res.json({ 
      connection: safeConnection,
      message: 'Connection updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update user connection:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    }

    if (error instanceof Error && error.message.includes('unique_user_connection_name')) {
      return res.status(409).json({ error: 'A connection with this name already exists' });
    }

    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// Delete a user connection
router.delete('/:connectionId', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { connectionId } = req.params;
    const deleted = await userService.deleteConnection(req.user.id, connectionId);

    if (!deleted) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    logger.info(`Connection deleted: ${connectionId} for user ${req.user.id}`);

    res.json({ message: 'Connection deleted successfully' });

  } catch (error) {
    logger.error('Failed to delete user connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Update connection last used timestamp
router.patch('/:connectionId/last-used', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { connectionId } = req.params;
    await userService.updateConnectionLastUsed(req.user.id, connectionId);

    res.json({ message: 'Connection last used updated' });

  } catch (error) {
    logger.error('Failed to update connection last used:', error);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// Migrate connections from localStorage (special endpoint for migration flow)
router.post('/migrate', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { connections } = req.body;

    if (!Array.isArray(connections)) {
      return res.status(400).json({ error: 'Connections must be an array' });
    }

    const results = [];
    const errors = [];

    for (const conn of connections) {
      try {
        const validatedConnection = CreateConnectionSchema.parse(conn);
        const createdConnection = await userService.createConnection(req.user.id, validatedConnection);
        
        results.push({
          name: createdConnection.name,
          status: 'success',
          id: createdConnection.id
        });
      } catch (error) {
        errors.push({
          name: conn.name || 'Unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info(`Migration completed for user ${req.user.id}: ${results.length} success, ${errors.length} errors`);

    res.json({
      message: 'Migration completed',
      results,
      errors,
      summary: {
        total: connections.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    logger.error('Failed to migrate connections:', error);
    res.status(500).json({ error: 'Failed to migrate connections' });
  }
});

// Factory function to create router with dependencies
export const createUserConnectionsRouter = (pool: Pool): Router => {
  userService = new UserService(pool);
  return router;
};

export { router as userConnectionsRouter };