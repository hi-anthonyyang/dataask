import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as parquet from 'parquetjs';

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
      columns = Object.keys(firstRow).map(key => ({
        name: key,
        type: this.inferType(firstRow[key]),
        nullable: true
      }));
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
    // For now, we'll use a simple approach
    // In production, we'd use a proper Parquet writer like parquetjs or arrow
    
    // Create schema
    const schema = new parquet.ParquetSchema(
      columns.reduce((acc, col) => {
        let type;
        switch (col.type) {
          case 'number':
            type = { type: 'DOUBLE', optional: col.nullable };
            break;
          case 'boolean':
            type = { type: 'BOOLEAN', optional: col.nullable };
            break;
          case 'date':
            type = { type: 'TIMESTAMP_MILLIS', optional: col.nullable };
            break;
          default:
            type = { type: 'UTF8', optional: col.nullable };
        }
        acc[col.name] = type;
        return acc;
      }, {} as any)
    );

    // Write the file
    const writer = await parquet.ParquetWriter.openFile(schema, filePath);
    
    let written = 0;
    for (const row of data) {
      // Convert row data types
      const convertedRow: any = {};
      for (const col of columns) {
        const value = row[col.name];
        if (value === null || value === undefined) {
          convertedRow[col.name] = null;
        } else if (col.type === 'date' && !(value instanceof Date)) {
          convertedRow[col.name] = new Date(value);
        } else {
          convertedRow[col.name] = value;
        }
      }
      
      await writer.appendRow(convertedRow);
      written++;
      
      // Emit progress every 1000 rows
      if (written % 1000 === 0) {
        this.emit('progress', {
          phase: 'writing',
          progress: 50 + (written / data.length) * 40,
          rowsProcessed: written,
          totalRows: data.length,
          message: `Writing to Parquet... (${written}/${data.length})`
        } as ImportProgress);
      }
    }
    
    await writer.close();
  }

  // For backwards compatibility with existing file import
  async importToSQLite(
    filePath: string,
    tableName: string,
    connectionId: string
  ): Promise<{ rowCount: number }> {
    // This method maintains compatibility with the existing file import
    // It will be used during the transition period
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    
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

      db.exec(`CREATE TABLE "${tableName}" (${columnDefs})`);

      // Insert data
      const placeholders = columns.map(() => '?').join(', ');
      const insertStmt = db.prepare(
        `INSERT INTO "${tableName}" VALUES (${placeholders})`
      );

      const insertMany = db.transaction((rows: any[]) => {
        for (const row of rows) {
          const values = columns.map(col => row[col.name]);
          insertStmt.run(values);
        }
      });

      insertMany(data);

      return { rowCount: data.length };
    } finally {
      db.close();
    }
  }
}