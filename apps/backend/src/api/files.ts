import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';

const router = express.Router();

// Import progress tracking
interface ImportProgress {
  importId: string;
  status: 'uploading' | 'processing' | 'importing' | 'completed' | 'failed';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  message?: string;
  error?: string;
}

const importProgressMap = new Map<string, ImportProgress>();

// Clean up old progress entries after 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [id, progress] of importProgressMap.entries()) {
    if (progress.status === 'completed' || progress.status === 'failed') {
      importProgressMap.delete(id);
    }
  }
}, 60 * 1000); // Run every minute

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
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = Math.round((50 * 1024 * 1024) / (1024 * 1024)); // Convert to MB
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${maxSize}MB. Please compress your file or split it into smaller parts.` 
      });
    }
    if (err.message.includes('Invalid file type')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }
  next();
};

// File upload and preview endpoint (DEPRECATED - use /import instead)
router.post('/upload', upload.single('file'), handleMulterError, async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file and try again.' });
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
      const columnData = dataRows.map(row => (row as any[])[index]).filter(val => val != null && val !== '');
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

// Progress tracking endpoint
router.get('/import-progress/:importId', (req, res) => {
  const { importId } = req.params;
  const progress = importProgressMap.get(importId);
  
  if (!progress) {
    return res.status(404).json({ error: 'Import not found' });
  }
  
  res.json(progress);
});

// Combined upload and import endpoint (NEW - single step import)
router.post('/import', upload.single('file'), handleMulterError, async (req: express.Request, res: express.Response) => {
  let tempFilePath: string | undefined;
  const importId = uuidv4();
  
  // Initialize progress tracking
  importProgressMap.set(importId, {
    importId,
    status: 'uploading',
    progress: 0
  });
  
  try {
    if (!req.file) {
      importProgressMap.set(importId, {
        importId,
        status: 'failed',
        progress: 0,
        error: 'No file uploaded'
      });
      return res.status(400).json({ error: 'No file uploaded. Please select a file and try again.' });
    }

    const { tableName } = req.body;
    if (!tableName || typeof tableName !== 'string') {
      importProgressMap.set(importId, {
        importId,
        status: 'failed',
        progress: 0,
        error: 'Table name is required'
      });
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Update progress - file uploaded
    importProgressMap.set(importId, {
      importId,
      status: 'processing',
      progress: 10,
      message: 'File uploaded, parsing data...'
    });

    // Validate table name
    const cleanTableName = tableName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!cleanTableName) {
      importProgressMap.set(importId, {
        importId,
        status: 'failed',
        progress: 0,
        error: 'Invalid table name'
      });
      return res.status(400).json({ error: 'Invalid table name' });
    }

    tempFilePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!['.csv', '.xlsx', '.xls'].includes(fileExtension)) {
      importProgressMap.set(importId, {
        importId,
        status: 'failed',
        progress: 0,
        error: 'Unsupported file format. Please upload a CSV, XLS, or XLSX file.'
      });
      return res.status(400).json({ error: 'Unsupported file format. Please upload a CSV, XLS, or XLSX file.' });
    }

    // Update progress - file parsed
    importProgressMap.set(importId, {
      importId,
      status: 'importing',
      progress: 20,
      message: 'File parsed, preparing for import...'
    });

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
      importProgressMap.set(importId, {
        importId,
        status: 'failed',
        progress: 0,
        error: 'File is empty or contains no data rows'
      });
      return res.status(400).json({ error: 'File is empty or contains no data rows' });
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);

    // Auto-detect column types
    const columns = headers.map((header, index) => {
      const columnData = dataRows.slice(0, 100).map(row => (row as any[])[index]);
      return {
        name: header,
        type: detectColumnType(columnData),
        nullable: true,
        primaryKey: false
      };
    });

    // Update progress - database file created
    importProgressMap.set(importId, {
      importId,
      status: 'importing',
      progress: 30,
      message: 'Database file created, preparing for import...'
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

    // Update progress - table created
    importProgressMap.set(importId, {
      importId,
      status: 'importing',
      progress: 40,
      message: 'Table created, preparing for data insertion...'
    });

    // Create table with proper column types
    const columnDefinitions = columns.map(col => 
      `"${col.name}" ${col.type}${col.nullable ? '' : ' NOT NULL'}`
    ).join(', ');
    
    const createTableSQL = `CREATE TABLE "${cleanTableName}" (${columnDefinitions})`;
    await dbManager.executeQuery(connectionId, createTableSQL, []);

    // Update progress - data insertion started
    importProgressMap.set(importId, {
      importId,
      status: 'importing',
      progress: 50,
      message: 'Data insertion started...'
    });

    // Insert data using batch insertion
    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${cleanTableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES (${placeholders})`;
    
    // Process data in batches
    const batchSize = 1000;
    const totalRows = dataRows.length;
    
    // Begin transaction
    await dbManager.executeQuery(connectionId, 'BEGIN TRANSACTION', []);
    
    try {
      // Use bulk insert for much better performance
      const ROWS_PER_INSERT = 100; // SQLite handles multi-row inserts well up to ~100 rows
      
      for (let i = 0; i < totalRows; i += ROWS_PER_INSERT) {
        const batchRows = dataRows.slice(i, Math.min(i + ROWS_PER_INSERT, totalRows));
        
        if (batchRows.length === 0) continue;
        
        // Build multi-row INSERT statement
        const valuesClauses = batchRows.map(() => `(${placeholders})`).join(', ');
        const bulkInsertSQL = `INSERT INTO "${cleanTableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES ${valuesClauses}`;
        
        // Flatten all values for this batch
        const allValues: any[] = [];
        for (const row of batchRows) {
          const values = columns.map((col, index) => {
            const value = (row as any[])[index];
            return convertValueToType(value, col.type);
          });
          allValues.push(...values);
        }
        
        await dbManager.executeQuery(connectionId, bulkInsertSQL, allValues);
        
        // Update progress tracking
        const processedRows = Math.min(i + ROWS_PER_INSERT, totalRows);
        const percentage = Math.round(processedRows / totalRows * 100);
        const importProgress = 50 + Math.round(percentage * 0.5); // 50-100% range for data insertion
        
        importProgressMap.set(importId, {
          importId,
          status: 'importing',
          progress: importProgress,
          totalRows,
          processedRows,
          message: `Importing data: ${processedRows}/${totalRows} rows (${percentage}%)`
        });
        
        // Log progress for large imports (every 10% or 5000 rows)
        if (totalRows > 1000) {
          if (percentage % 10 === 0 || processedRows % 5000 === 0) {
            logger.info(`Import progress: ${processedRows}/${totalRows} rows (${percentage}%)`);
          }
        }
      }
      
      // Commit transaction
      await dbManager.executeQuery(connectionId, 'COMMIT', []);
    } catch (error) {
      // Rollback on error
      await dbManager.executeQuery(connectionId, 'ROLLBACK', []);
      throw error;
    }

    // Update progress - import completed
    importProgressMap.set(importId, {
      importId,
      status: 'completed',
      progress: 100,
      message: 'Import completed successfully!'
    });

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      connectionId,
      tableName: cleanTableName,
      rowCount: totalRows,
      columns: columns.length,
      importId // Include importId for progress tracking
    });

  } catch (error) {
    logger.error('File import failed:', error);
    
    // Update progress - import failed
    importProgressMap.set(importId, {
      importId,
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'File import failed. Please try again.'
    });

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        logger.error('Failed to clean up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'File import failed. Please try again or contact support if the problem persists.' 
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

    // Insert data using batch insertion for better performance
    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES (${placeholders})`;
    
    // Process data in batches to improve performance and memory usage
    const batchSize = 1000; // Insert 1000 rows at a time
    const totalRows = dataRows.length;
    
    // Begin transaction for better performance
    await dbManager.executeQuery(connectionId, 'BEGIN TRANSACTION', []);
    
    try {
      // Use bulk insert for much better performance
      const ROWS_PER_INSERT = 100; // SQLite handles multi-row inserts well up to ~100 rows
      
      for (let i = 0; i < totalRows; i += ROWS_PER_INSERT) {
        const batchRows = dataRows.slice(i, Math.min(i + ROWS_PER_INSERT, totalRows));
        
        if (batchRows.length === 0) continue;
        
        // Build multi-row INSERT statement
        const valuesClauses = batchRows.map(() => `(${placeholders})`).join(', ');
        const bulkInsertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES ${valuesClauses}`;
        
        // Flatten all values for this batch
        const allValues: any[] = [];
        for (const row of batchRows) {
          const values = columns.map((col, index) => {
            const value = (row as any[])[index];
            return convertValueToType(value, col.type);
          });
          allValues.push(...values);
        }
        
        await dbManager.executeQuery(connectionId, bulkInsertSQL, allValues);
        
        // Log progress for large imports
        if (totalRows > 5000) {
          const progress = Math.min(i + ROWS_PER_INSERT, totalRows);
          const percentage = Math.round(progress / totalRows * 100);
          if (percentage % 10 === 0) {
            logger.info(`Import progress: ${progress}/${totalRows} rows (${percentage}%)`);
          }
        }
      }
      
      // Commit transaction
      await dbManager.executeQuery(connectionId, 'COMMIT', []);
    } catch (error) {
      // Rollback on error
      await dbManager.executeQuery(connectionId, 'ROLLBACK', []);
      throw error;
    }

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

// Utility functions
function detectColumnType(values: any[]): 'TEXT' | 'INTEGER' | 'REAL' | 'DATE' {
  if (values.length === 0) return 'TEXT';

  let integerCount = 0;
  let realCount = 0;
  let dateCount = 0;
  
  for (const value of values) {
    const strValue = String(value).trim();
    
    // Check for integer
    if (/^-?\d+$/.test(strValue)) {
      integerCount++;
    }
    // Check for real number
    else if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(strValue)) {
      realCount++;
    }
    // Check for date
    else if (isValidDate(strValue)) {
      dateCount++;
    }
  }

  const total = values.length;
  // For small datasets, require 100% consistency to prevent edge cases with mixed types
  // This prevents cases like ['1', '2', '3', '4', 'five'] being detected as INTEGER
  const threshold = values.length < 5 ? 1.0 : 0.8;

  if (dateCount / total >= threshold) return 'DATE';
  if (integerCount / total >= threshold) return 'INTEGER';
  if ((integerCount + realCount) / total >= threshold) return 'REAL';
  
  return 'TEXT';
}

function isValidDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value.length > 6; // Avoid matching simple numbers
}

function convertValueToType(value: any, type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE'): any {
  if (value == null || value === '') return null;

  switch (type) {
    case 'INTEGER':
      const intValue = parseInt(String(value));
      return isNaN(intValue) ? null : intValue;
    case 'REAL':
      const realValue = parseFloat(String(value));
      return isNaN(realValue) ? null : realValue;
    case 'DATE':
      const dateValue = new Date(String(value));
      return isNaN(dateValue.getTime()) ? String(value) : dateValue.toISOString();
    case 'TEXT':
    default:
      return String(value);
  }
}

export default router;