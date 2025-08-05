import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DataFrameManager } from '../utils/dataFrameManager';
import { PandasExecutor } from '../utils/pandasExecutor';
import {
  handleZodError,
  sendBadRequest,
  sendServerError
} from '../utils/errors';

const router = express.Router();

// Execute pandas code on a DataFrame
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = z.object({
      code: z.string().min(1).max(1000)
    }).parse(req.body);

    const dfManager = DataFrameManager.getInstance();
    const df = dfManager.getDataFrame(id);
    
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }

    // Execute the pandas code
    const executor = new PandasExecutor(df);
    const result = await executor.execute(code);

    res.json({
      success: true,
      result: {
        data: result.data,
        columns: result.columns,
        rowCount: result.rowCount,
        executionTime: result.executionTime
      }
    });

  } catch (error) {
    logger.error('Failed to execute pandas code:', error);
    
    if (error instanceof z.ZodError) {
      return handleZodError(res, error, 'Invalid request');
    }
    
    // Return user-friendly error message
    if (error.message.includes('Execution error:')) {
      return res.status(400).json({ 
        error: error.message,
        suggestion: 'Please check your pandas code syntax'
      });
    }
    
    return sendServerError(res, error, 'Failed to execute code');
  }
});

// Get DataFrame statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const dfManager = DataFrameManager.getInstance();
    
    const df = dfManager.getDataFrame(id);
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const stats = dfManager.getDataFrameStats(id);
    
    res.json({
      stats
    });
  } catch (error) {
    logger.error('Failed to get dataframe stats:', error);
    return sendServerError(res, error, 'Failed to get statistics');
  }
});

// Get DataFrame info
router.get('/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const dfManager = DataFrameManager.getInstance();
    
    const df = dfManager.getDataFrame(id);
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const info = dfManager.getDataFrameInfo(id);
    
    res.json({
      info
    });
  } catch (error) {
    logger.error('Failed to get dataframe info:', error);
    return sendServerError(res, error, 'Failed to get info');
  }
});

// Get DataFrame sample
router.get('/:id/sample', async (req, res) => {
  try {
    const { id } = req.params;
    const n = parseInt(req.query.n as string) || 10;
    
    const dfManager = DataFrameManager.getInstance();
    const df = dfManager.getDataFrame(id);
    
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const sample = dfManager.getDataFrameSample(id, n);
    
    res.json({
      data: sample.data,
      columns: sample.columns
    });
  } catch (error) {
    logger.error('Failed to get dataframe sample:', error);
    return sendServerError(res, error, 'Failed to get sample');
  }
});

// Get DataFrame profile
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const dfManager = DataFrameManager.getInstance();
    
    const df = dfManager.getDataFrame(id);
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const profile = dfManager.getDataFrameProfile(id);
    
    res.json({
      profile
    });
  } catch (error) {
    logger.error('Failed to get dataframe profile:', error);
    return sendServerError(res, error, 'Failed to get profile');
  }
});

export default router;