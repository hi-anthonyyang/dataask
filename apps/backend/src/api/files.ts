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

// File upload and preview endpoint
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

// Import file as table endpoint
router.post('/import', async (req, res) => {
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

    // Insert data
    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES (${placeholders})`;
    
    for (const row of dataRows) {
      const values = columns.map((col, index) => {
        const value = (row as any[])[index];
        return convertValueToType(value, col.type);
      });
      
      await dbManager.executeQuery(connectionId, insertSQL, values);
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