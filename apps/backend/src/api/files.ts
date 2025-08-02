import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';
import {
  FileImportColumn,
  FileImportConfig,
  FileImportProgress,
  FileImportResponse,
  ColumnType
} from '../types';
import {
  handleZodError,
  sendBadRequest,
  sendServerError
} from '../utils/errors';
import {
  detectColumnType,
  convertValueToType,
  isValidDate,
  sanitizeTableName
} from '../utils/validation';

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      const detectedExt = fileExtension || 'unknown';
      cb(new Error(`Invalid file type '${detectedExt}'. Please use CSV, XLS, or XLSX files.`));
    }
  }
});

// Validation schemas
const ColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['TEXT', 'INTEGER', 'REAL', 'DATE']),
  nullable: z.boolean().optional().default(true)
});

const ImportRequestSchema = z.object({
  filename: z.string(),
  tableName: z.string().min(1).max(50),
  columns: z.array(ColumnSchema)
});

// Error handling middleware for multer
const handleMulterError = (err: Error & { code?: string }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = Math.round((50 * 1024 * 1024) / (1024 * 1024)); // Convert to MB
      return sendBadRequest(res, `File too large. Maximum size is ${maxSize}MB. Please compress your file or split it into smaller parts.`);
    }
    if (err.message.includes('Invalid file type')) {
      return sendBadRequest(res, err.message);
    }
          return sendBadRequest(res, err.message || 'File upload failed');
  }
  next();
};

// File upload and preview endpoint (DEPRECATED - use /import instead)
router.post('/upload', upload.single('file'), handleMulterError, async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, 'No file uploaded. Please select a file and try again.');
    }

    const filePath = req.file.path;
    const originalFilename = req.file.originalname;
    const fileExtension = path.extname(originalFilename).toLowerCase();

    let workbook: XLSX.WorkBook;
    
    try {
      if (fileExtension === '.csv') {
        const csvContent = fs.readFileSync(filePath, 'utf8');
        workbook = XLSX.read(csvContent, { type: 'string' });
      } else {
        workbook = XLSX.readFile(filePath);
      }
    } catch (error) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      logger.error('File parsing failed:', error);
      return res.status(400).json({ 
        error: 'File appears to be corrupted or in an unsupported format. Please try re-saving and uploading again, or ensure it\'s a valid CSV or Excel file.' 
      });
    }

    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No data found in file. Please ensure your file contains data in the first worksheet.' });
    }

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        error: `File contains only ${jsonData.length} row(s). Please ensure your file has a header row and at least one data row.` 
      });
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);
    
    // Performance warning for very large files
    if (dataRows.length > 100000) {
      logger.warn(`Large file detected: ${dataRows.length} rows. Consider splitting into smaller files for better performance.`);
    }
    
    if (!headers || headers.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'No column headers found. Please ensure your file has column headers in the first row.' });
    }

    // Auto-detect column types
    const columns = headers.map((header, index) => {
      const columnData = dataRows.map(row => (row as unknown[])[index]).filter(val => val != null && val !== '');
      const detectedType = detectColumnType(columnData);
      
      return {
        name: String(header).trim() || `Column_${index + 1}`,
        type: detectedType,
        originalType: detectedType,
        nullable: true,
        sampleValues: columnData.slice(0, 5) // First 5 non-null values
      };
    });

    // Prepare preview data (first 10 rows)
    const sampleData = dataRows.slice(0, 10);

    const preview = {
      filename: originalFilename,
      rowCount: dataRows.length,
      columns,
      sampleData,
      headers,
      tempFilePath: filePath // Keep for import
    };

    res.json(preview);

  } catch (error) {
    logger.error('File upload failed:', error);
    
    // Clean up file if it exists
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to clean up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'File upload failed. Please try again or contact support if the problem persists.' });
  }
});

// Combined upload and import endpoint
router.post('/import', upload.single('file'), handleMulterError, async (req: express.Request, res: express.Response) => {
  let tempFilePath: string | undefined;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { tableName } = req.body;
    if (!tableName || typeof tableName !== 'string') {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Validate table name
    const cleanTableName = tableName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanTableName) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    tempFilePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!['.csv', '.xlsx', '.xls'].includes(fileExtension)) {
      return res.status(400).json({ error: 'Unsupported file format. Please upload a CSV, XLS, or XLSX file.' });
    }

    // Read and parse file
    let workbook: XLSX.WorkBook;
    if (fileExtension === '.csv') {
      const csvContent = fs.readFileSync(tempFilePath, 'utf8');
      workbook = XLSX.read(csvContent, { type: 'string' });
    } else {
      workbook = XLSX.readFile(tempFilePath);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!jsonData || jsonData.length < 2) {
      return res.status(400).json({ error: 'File is empty or contains no data rows' });
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);

    logger.info(`Starting import: ${dataRows.length} rows to import into table "${cleanTableName}"`);

    // Auto-detect column types
    const columns = headers.map((header, index) => {
              const columnData = dataRows.slice(0, 100).map(row => (row as unknown[])[index]);
      return {
        name: header,
        type: detectColumnType(columnData),
        nullable: true,
        primaryKey: false
      };
    });

    // Create SQLite database file for this import
    const dbFilename = `import_${uuidv4()}.sqlite`;
    const dbPath = path.join(process.cwd(), 'data', dbFilename);
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create the database connection
    const dbManager = DatabaseManager.getInstance();
    const connectionId = await dbManager.createConnection({
      type: 'sqlite',
      name: cleanTableName,
      config: { filename: dbPath }
    });

    logger.info(`Created connection ${connectionId} with database at ${dbPath}`);

    // Create table with proper column types
    const columnDefinitions = columns.map(col => 
      `"${col.name}" ${col.type}${col.nullable ? '' : ' NOT NULL'}`
    ).join(', ');
    
    const createTableSQL = `CREATE TABLE "${cleanTableName}" (${columnDefinitions})`;
    await dbManager.executeQuery(connectionId, createTableSQL, []);
    
    logger.info(`Created table "${cleanTableName}" with ${columns.length} columns`);

    // Insert data using batch insertion
    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${cleanTableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES (${placeholders})`;
    
    // Process data in batches
    const batchSize = 1000;
    const totalRows = dataRows.length;
    let insertedRows = 0;
    
    // Begin transaction
    await dbManager.executeQuery(connectionId, 'BEGIN TRANSACTION', []);
    
    try {
      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const values = columns.map((col, index) => {
            const value = (row as unknown[])[index];
            return convertValueToType(value, col.type);
          });
          
          await dbManager.executeQuery(connectionId, insertSQL, values);
          insertedRows++;
        }
        
        logger.info(`Inserted batch: ${insertedRows}/${totalRows} rows`);
      }
      
      // Commit transaction
      await dbManager.executeQuery(connectionId, 'COMMIT', []);
      
      logger.info(`Import completed: ${insertedRows} rows inserted into "${cleanTableName}"`);
      
      // Verify the data was inserted
      const countResult = await dbManager.executeQuery(connectionId, `SELECT COUNT(*) as count FROM "${cleanTableName}"`, []);
      const actualCount = countResult.rows[0]?.count || 0;
      logger.info(`Verification: Table "${cleanTableName}" contains ${actualCount} rows`);
    } catch (error) {
      // Rollback on error
      await dbManager.executeQuery(connectionId, 'ROLLBACK', []);
      throw error;
    }

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      connectionId,
      tableName: cleanTableName,
      rowCount: totalRows,
      columns: columns.length
    });
    
    // Log the successful import
    logger.info(`Import response sent: connectionId=${connectionId}, table=${cleanTableName}, rows=${totalRows}`);

  } catch (error) {
    logger.error('File import failed:', error);
    
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        logger.error('Failed to clean up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'File import failed. Please try again.' 
    });
  }
});

// Import file as table endpoint (OLD - keeping for backward compatibility)
router.post('/import-old', async (req, res) => {
  try {
    const { filename, tableName, columns, tempFilePath } = ImportRequestSchema.extend({
      tempFilePath: z.string()
    }).parse(req.body);

    if (!fs.existsSync(tempFilePath)) {
      return res.status(400).json({ error: 'Temporary file not found. Please upload your file again.' });
    }

    const fileExtension = path.extname(filename).toLowerCase();
    let workbook: XLSX.WorkBook;
    
    if (fileExtension === '.csv') {
      const csvContent = fs.readFileSync(tempFilePath, 'utf8');
      workbook = XLSX.read(csvContent, { type: 'string' });
    } else {
      workbook = XLSX.readFile(tempFilePath);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);

    // Create SQLite database file for this import
    const dbFilename = `import_${uuidv4()}.sqlite`;
    const dbPath = path.join(process.cwd(), 'data', dbFilename);
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create connection config for the imported file
    const connectionConfig = {
      type: 'file-import' as const,
      name: tableName,
      config: {
        filename: dbPath,
        originalFilename: filename,
        fileSize: fs.statSync(tempFilePath).size,
        uploadedAt: new Date().toISOString(),
        rowCount: dataRows.length,
        columns: columns
      }
    };

    // Create the database connection and table
    const dbManager = DatabaseManager.getInstance();
    const connectionId = await dbManager.createConnection({
      type: 'sqlite',
      name: tableName,
      config: { filename: dbPath }
    });

    // Create table with proper column types
    const columnDefinitions = columns.map(col => 
      `"${col.name}" ${col.type}${col.nullable ? '' : ' NOT NULL'}`
    ).join(', ');
    
    const createTableSQL = `CREATE TABLE "${tableName}" (${columnDefinitions})`;
    await dbManager.executeQuery(connectionId, createTableSQL, []);

    // Insert data using optimized bulk insertion for better performance
    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES (${placeholders})`;
    
    // Prepare data rows for bulk insert
    const preparedRows = dataRows.map(row => {
      return columns.map((col, index) => {
        const value = (row as unknown[])[index];
        return convertValueToType(value, col.type);
      });
    });
    
    // Use optimized bulk insert with progress tracking
    logger.info(`Starting bulk import of ${preparedRows.length} rows into ${tableName}`);
    
    await dbManager.executeSQLiteBulkInsert(
      connectionId, 
      insertSQL, 
      preparedRows,
      (progress) => {
        logger.info(`Import progress: ${progress}%`);
      }
    );

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);

    logger.info(`File imported successfully: ${filename} -> ${tableName} (${dataRows.length} rows)`);

    res.json({ 
      success: true, 
      connectionId,
      message: `Successfully imported ${dataRows.length} rows into ${tableName}`,
      rowCount: dataRows.length
    });

  } catch (error) {
    logger.error('File import failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid import parameters',
        details: error.errors 
      });
    }

    res.status(500).json({ error: 'File import failed. Please try again or contact support if the problem persists.' });
  }
});





export default router;