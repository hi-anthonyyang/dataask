import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
// import * as parquet from 'parquetjs'; // Commented out - not used in SQLite-only version

export interface ImportOptions {
  name?: string;
  format?: 'csv' | 'excel' | 'auto';
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
}

export interface ImportProgress {
  phase: 'parsing' | 'analyzing' | 'converting' | 'writing' | 'complete' | 'error';
  progress: number;
  rowsProcessed?: number;
  totalRows?: number;
  message?: string;
  error?: string;
}

export interface ColumnSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  nullable: boolean;
}

export interface ImportResult {
  sourceId: string;
  parquetPath: string;
  rowCount: number;
  columns: ColumnSchema[];
}

export class ImportPipeline extends EventEmitter {
  private dataDir: string;

  constructor() {
    super();
    this.dataDir = path.join(process.cwd(), 'data', 'imports');
  }

  async importFile(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const importId = uuidv4();
    const importDir = path.join(this.dataDir, importId);
    await fs.mkdir(importDir, { recursive: true });

    try {
      this.emit('progress', {
        phase: 'parsing',
        progress: 0,
        message: 'Reading file...'
      } as ImportProgress);

      // Detect format if not specified
      const format = options.format || this.detectFormat(filePath);
      
      let data: any[];
      let columns: ColumnSchema[];

      if (format === 'csv') {
        const result = await this.parseCSV(filePath, options);
        data = result.data;
        columns = result.columns;
      } else {
        const result = await this.parseExcel(filePath, options);
        data = result.data;
        columns = result.columns;
      }

      this.emit('progress', {
        phase: 'converting',
        progress: 50,
        rowsProcessed: 0,
        totalRows: data.length,
        message: 'Converting to Parquet format...'
      } as ImportProgress);

      // Write to Parquet
      const parquetPath = path.join(importDir, 'data.parquet');
      await this.writeParquet(parquetPath, data, columns);

      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        rowsProcessed: data.length,
        totalRows: data.length,
        message: 'Import complete!'
      } as ImportProgress);

      return {
        sourceId: importId,
        parquetPath,
        rowCount: data.length,
        columns
      };
    } catch (error) {
      this.emit('progress', {
        phase: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ImportProgress);
      
      // Clean up on error
      await fs.rm(importDir, { recursive: true, force: true });
      throw error;
    }
  }

  private detectFormat(filePath: string): 'csv' | 'excel' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') return 'csv';
    if (['.xlsx', '.xls'].includes(ext)) return 'excel';
    
    // Default to CSV
    return 'csv';
  }

  private async parseCSV(
    filePath: string,
    options: ImportOptions
  ): Promise<{ data: any[]; columns: ColumnSchema[] }> {
    const records: any[] = [];
    const delimiter = options.delimiter || ',';
    const hasHeader = options.hasHeader !== false;

    return new Promise((resolve, reject) => {
      const parser = parse({
        delimiter,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: true
      });

      let columns: ColumnSchema[] = [];
      let rowCount = 0;

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          records.push(record);
          rowCount++;

          // Infer columns from first row if we have headers
          if (rowCount === 1 && hasHeader) {
            columns = this.inferColumns(record);
          }

          // Emit progress every 1000 rows
          if (rowCount % 1000 === 0) {
            this.emit('progress', {
              phase: 'parsing',
              progress: 25,
              rowsProcessed: rowCount,
              message: `Reading rows... (${rowCount})`
            } as ImportProgress);
          }
        }
      });

      parser.on('error', reject);
      parser.on('end', () => {
        // If no header, create generic column names
        if (!hasHeader && records.length > 0) {
          const firstRow = records[0];
          columns = Object.keys(firstRow).map((_, i) => ({
            name: `column_${i + 1}`,
            type: this.inferType(firstRow[i]),
            nullable: true
          }));
        }

        resolve({ data: records, columns });
      });

      createReadStream(filePath).pipe(parser);
    });
  }

  private async parseExcel(
    filePath: string,
    options: ImportOptions
  ): Promise<{ data: any[]; columns: ColumnSchema[] }> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: options.hasHeader !== false ? undefined : 1,
      defval: null,
      dateNF: 'yyyy-mm-dd'
    });

    // Infer columns
    let columns: ColumnSchema[] = [];
    if (data.length > 0) {
      const firstRow = data[0];
      if (firstRow && typeof firstRow === 'object') {
        columns = Object.keys(firstRow as Record<string, unknown>).map(key => ({
          name: key,
          type: this.inferType((firstRow as Record<string, unknown>)[key]),
          nullable: true
        }));
      }
    }

    return { data, columns };
  }

  private inferColumns(record: any): ColumnSchema[] {
    return Object.keys(record).map(key => ({
      name: key,
      type: this.inferType(record[key]),
      nullable: true
    }));
  }

  private inferType(value: any): 'string' | 'number' | 'boolean' | 'date' {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    
    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num)) return 'number';
    
    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.match(/\d{4}-\d{2}-\d{2}/)) return 'date';
    
    return 'string';
  }

  private async writeParquet(
    filePath: string,
    data: any[],
    columns: ColumnSchema[]
  ): Promise<void> {
    // Parquet writing is not implemented in SQLite-only version
    // This method is kept for interface compatibility but throws an error
    throw new Error('Parquet export is not supported in SQLite-only version');
  }

  // For backwards compatibility with existing file import
  async importToSQLite(
    filePath: string,
    tableName: string,
    connectionId: string
  ): Promise<{ rowCount: number }> {
    // This method maintains compatibility with the existing file import
    // It will be used during the transition period
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(':memory:');
    
    try {
      const format = this.detectFormat(filePath);
      let data: any[];
      let columns: ColumnSchema[];

      if (format === 'csv') {
        const result = await this.parseCSV(filePath, {});
        data = result.data;
        columns = result.columns;
      } else {
        const result = await this.parseExcel(filePath, {});
        data = result.data;
        columns = result.columns;
      }

      // Create table
      const columnDefs = columns.map(col => {
        let sqlType = 'TEXT';
        if (col.type === 'number') sqlType = 'REAL';
        else if (col.type === 'boolean') sqlType = 'INTEGER';
        return `"${col.name}" ${sqlType}`;
      }).join(', ');

      await new Promise<void>((resolve, reject) => {
        db.run(`CREATE TABLE "${tableName}" (${columnDefs})`, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Insert data
      const placeholders = columns.map(() => '?').join(', ');
      const insertSQL = `INSERT INTO "${tableName}" VALUES (${placeholders})`;
      
      // Use serialize to ensure operations run sequentially
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          const stmt = db.prepare(insertSQL);
          for (const row of data) {
            const values = columns.map(col => row[col.name]);
            stmt.run(values);
          }
          
          stmt.finalize((err: Error | null) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
            } else {
              db.run('COMMIT', (err: Error | null) => {
                if (err) reject(err);
                else resolve();
              });
            }
          });
        });
      });

      return { rowCount: data.length };
    } finally {
      db.close();
    }
  }
}