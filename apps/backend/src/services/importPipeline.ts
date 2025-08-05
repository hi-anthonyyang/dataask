import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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
  processedPath: string;
  rowCount: number;
  columns: ColumnSchema[];
  fileType: 'csv' | 'excel';
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
        message: 'Processing data...'
      } as ImportProgress);

      // Copy the original file to processed location
      const processedPath = path.join(importDir, path.basename(filePath));
      await fs.copyFile(filePath, processedPath);

      this.emit('progress', {
        phase: 'complete',
        progress: 100,
        rowsProcessed: data.length,
        totalRows: data.length,
        message: 'Import complete!'
      } as ImportProgress);

      return {
        sourceId: importId,
        processedPath,
        rowCount: data.length,
        columns,
        fileType: format
      };
    } catch (error) {
      this.emit('progress', {
        phase: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ImportProgress);
      throw error;
    }
  }

  private detectFormat(filePath: string): 'csv' | 'excel' {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') return 'csv';
    if (['.xlsx', '.xls'].includes(ext)) return 'excel';
    throw new Error(`Unsupported file format: ${ext}`);
  }

  private async parseCSV(
    filePath: string,
    options: ImportOptions
  ): Promise<{ data: any[]; columns: ColumnSchema[] }> {
    return new Promise((resolve, reject) => {
      const data: any[] = [];
      let columns: ColumnSchema[] = [];
      let isFirstRow = true;

      const parser = parse({
        delimiter: options.delimiter || ',',
        columns: options.hasHeader !== false,
        skip_empty_lines: true,
        encoding: options.encoding || 'utf-8'
      });

      const stream = createReadStream(filePath);

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          if (isFirstRow && options.hasHeader !== false) {
            columns = this.inferColumns(record);
            isFirstRow = false;
          } else {
            data.push(record);
          }
        }
      });

      parser.on('error', reject);
      parser.on('end', () => {
        if (columns.length === 0) {
          // No header row, infer from first data row
          columns = data.length > 0 ? this.inferColumns(data[0]) : [];
        }
        resolve({ data, columns });
      });

      stream.pipe(parser);
    });
  }

  private async parseExcel(
    filePath: string,
    options: ImportOptions
  ): Promise<{ data: any[]; columns: ColumnSchema[] }> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];

    const data = dataRows.map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    const columns = headers.map(header => ({
      name: header,
      type: 'string' as const,
      nullable: true
    }));

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
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }
}