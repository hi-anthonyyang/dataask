import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Stub implementation - returns empty connections
// This functionality needs to be reimplemented with SQLite

// Get all connections for the authenticated user
router.get('/', async (req, res) => {
  logger.info('User connections requested - returning empty array (auth not implemented)');
  res.json({ connections: [] });
});

// Get a specific connection
router.get('/:id', async (req, res) => {
  res.status(404).json({ error: 'Connection not found' });
});

// Create a new connection
router.post('/', async (req, res) => {
  logger.warn('Create connection attempted - auth not implemented');
  res.status(501).json({ error: 'User connections not yet implemented with new auth system' });
});

// Update a connection
router.put('/:id', async (req, res) => {
  logger.warn('Update connection attempted - auth not implemented');
  res.status(501).json({ error: 'User connections not yet implemented with new auth system' });
});

// Delete a connection
router.delete('/:id', async (req, res) => {
  logger.warn('Delete connection attempted - auth not implemented');
  res.status(501).json({ error: 'User connections not yet implemented with new auth system' });
});

// Test a connection
router.post('/:id/test', async (req, res) => {
  logger.warn('Test connection attempted - auth not implemented');
  res.status(501).json({ error: 'User connections not yet implemented with new auth system' });
});

// Factory function to maintain compatibility
export const createUserConnectionsRouter = (pool: any): Router => {
  // Pool is no longer used but kept for compatibility
  return router;
};

export default router;