import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DataFrameManager } from '../utils/dataFrameManager';
import {
  handleZodError,
  sendBadRequest,
  sendServerError
} from '../utils/errors';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: CSV, Excel'));
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (err: Error & { code?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = Math.round((50 * 1024 * 1024) / (1024 * 1024)); // Convert to MB
      return sendBadRequest(res, `File too large. Maximum size is ${maxSize}MB.`);
    }
    if (err.message.includes('Invalid file type')) {
      return sendBadRequest(res, err.message);
    }
    return sendBadRequest(res, err.message || 'File upload failed');
  }
  next();
};

// Upload and import file endpoint
router.post('/upload', upload.single('file'), handleMulterError, async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, 'No file uploaded. Please select a file and try again.');
    }

    const filePath = req.file.path;
    const originalFilename = req.file.originalname;
    const fileExtension = path.extname(originalFilename).toLowerCase();
    const dataframeName = originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    const dfManager = DataFrameManager.getInstance();
    let dataframeId: string;

    try {
      if (fileExtension === '.csv') {
        dataframeId = await dfManager.loadCSV(filePath, dataframeName);
      } else {
        // Excel files
        dataframeId = await dfManager.loadExcel(filePath, dataframeName);
      }
    } catch (error) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      logger.error('File loading failed:', error);
      return res.status(400).json({ 
        error: 'Failed to load file. Please ensure it\'s a valid CSV or Excel file with data.' 
      });
    }

    // Clean up uploaded file after successful import
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Get DataFrame info
    const info = dfManager.getDataFrameInfo(dataframeId);
    const preview = dfManager.getDataFrameHead(dataframeId, 10);

    res.json({
      dataframeId,
      name: dataframeName,
      info,
      preview: {
        data: preview.data,
        columns: preview.columns,
        rowCount: info.shape[0]
      },
      message: 'File uploaded and loaded successfully'
    });
    
  } catch (error) {
    logger.error('File upload failed:', error);
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return sendServerError(res, error, 'File upload failed');
  }
});

// List all DataFrames
router.get('/dataframes', async (req: express.Request, res: express.Response) => {
  try {
    const dfManager = DataFrameManager.getInstance();
    const dataframes = dfManager.listDataFrames();
    
    res.json({
      dataframes: dataframes.map(df => ({
        id: df.id,
        name: df.name,
        shape: df.shape,
        columns: df.columns,
        uploadedAt: df.uploadedAt
      }))
    });
  } catch (error) {
    logger.error('Failed to list dataframes:', error);
    return sendServerError(res, error, 'Failed to list dataframes');
  }
});

// Get DataFrame info
router.get('/dataframes/:id/info', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const dfManager = DataFrameManager.getInstance();
    
    const df = dfManager.getDataFrame(id);
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const info = dfManager.getDataFrameInfo(id);
    const stats = dfManager.getDataFrameStats(id);
    
    res.json({
      info,
      stats
    });
  } catch (error) {
    logger.error('Failed to get dataframe info:', error);
    return sendServerError(res, error, 'Failed to get dataframe info');
  }
});

// Get DataFrame preview
router.get('/dataframes/:id/preview', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const rows = parseInt(req.query.rows as string) || 10;
    
    const dfManager = DataFrameManager.getInstance();
    const df = dfManager.getDataFrame(id);
    
    if (!df) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    const preview = dfManager.getDataFrameHead(id, rows);
    
    res.json({
      data: preview.data,
      columns: preview.columns,
      rowCount: df.shape[0]
    });
  } catch (error) {
    logger.error('Failed to get dataframe preview:', error);
    return sendServerError(res, error, 'Failed to get dataframe preview');
  }
});

// Delete DataFrame
router.delete('/dataframes/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const dfManager = DataFrameManager.getInstance();
    
    const deleted = dfManager.deleteDataFrame(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'DataFrame not found' });
    }
    
    res.json({ message: 'DataFrame deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete dataframe:', error);
    return sendServerError(res, error, 'Failed to delete dataframe');
  }
});

export default router;