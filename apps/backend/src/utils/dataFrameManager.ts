import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

export interface DataFrame {
  id: string;
  name: string;
  data: any[];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  uploadedAt: Date;
}

export interface DataFrameQueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

/**
 * Manages in-memory DataFrames for uploaded CSV/Excel files
 * This replaces the DatabaseManager for a pandas-like experience
 */
class DataFrameManager {
  private static instance: DataFrameManager;
  private dataframes: Map<string, DataFrame> = new Map();

  private constructor() {}

  static getInstance(): DataFrameManager {
    if (!DataFrameManager.instance) {
      DataFrameManager.instance = new DataFrameManager();
    }
    return DataFrameManager.instance;
  }

  /**
   * Load a CSV file into a DataFrame
   */
  async loadCSV(filePath: string, name: string): Promise<string> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: true
      });

      if (records.length === 0) {
        throw new Error('CSV file is empty');
      }

      const columns = Object.keys(records[0]);
      const id = uuidv4();
      
      // Detect column types
      const dtypes = this.detectColumnTypes(records, columns);

      const dataframe: DataFrame = {
        id,
        name,
        data: records,
        columns,
        shape: [records.length, columns.length],
        dtypes,
        uploadedAt: new Date()
      };

      this.dataframes.set(id, dataframe);
      logger.info(`Loaded CSV file ${name} with shape ${dataframe.shape}`);
      
      return id;
    } catch (error) {
      logger.error('Failed to load CSV file:', error);
      throw error;
    }
  }

  /**
   * Load an Excel file into a DataFrame
   */
  async loadExcel(filePath: string, name: string, sheetName?: string): Promise<string> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheet = sheetName || workbook.SheetNames[0];
      
      if (!workbook.Sheets[sheet]) {
        throw new Error(`Sheet ${sheet} not found in Excel file`);
      }

      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);
      
      if (data.length === 0) {
        throw new Error('Excel sheet is empty');
      }

      const columns = Object.keys(data[0]);
      const id = uuidv4();
      
      // Detect column types
      const dtypes = this.detectColumnTypes(data, columns);

      const dataframe: DataFrame = {
        id,
        name,
        data,
        columns,
        shape: [data.length, columns.length],
        dtypes,
        uploadedAt: new Date()
      };

      this.dataframes.set(id, dataframe);
      logger.info(`Loaded Excel file ${name} with shape ${dataframe.shape}`);
      
      return id;
    } catch (error) {
      logger.error('Failed to load Excel file:', error);
      throw error;
    }
  }

  /**
   * Get a DataFrame by ID
   */
  getDataFrame(id: string): DataFrame | undefined {
    return this.dataframes.get(id);
  }

  /**
   * List all DataFrames
   */
  listDataFrames(): DataFrame[] {
    return Array.from(this.dataframes.values()).map(df => ({
      ...df,
      data: [] // Don't send actual data in list response
    }));
  }

  /**
   * Delete a DataFrame
   */
  deleteDataFrame(id: string): boolean {
    const result = this.dataframes.delete(id);
    if (result) {
      logger.info(`Deleted DataFrame ${id}`);
    }
    return result;
  }

  /**
   * Get DataFrame info (similar to pandas df.info())
   */
  getDataFrameInfo(id: string): any {
    const df = this.dataframes.get(id);
    if (!df) {
      throw new Error(`DataFrame ${id} not found`);
    }

    return {
      name: df.name,
      shape: df.shape,
      columns: df.columns,
      dtypes: df.dtypes,
      memory_usage: this.estimateMemoryUsage(df),
      non_null_counts: this.getNonNullCounts(df),
      uploadedAt: df.uploadedAt
    };
  }

  /**
   * Get DataFrame head (first n rows)
   */
  getDataFrameHead(id: string, n: number = 5): DataFrameQueryResult {
    const df = this.dataframes.get(id);
    if (!df) {
      throw new Error(`DataFrame ${id} not found`);
    }

    const startTime = Date.now();
    const data = df.data.slice(0, n);
    
    return {
      data,
      columns: df.columns,
      rowCount: data.length,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get DataFrame sample
   */
  getDataFrameSample(id: string, n: number = 10): DataFrameQueryResult {
    const df = this.dataframes.get(id);
    if (!df) {
      throw new Error(`DataFrame ${id} not found`);
    }

    const startTime = Date.now();
    
    // Simple random sampling
    const indices = [];
    for (let i = 0; i < Math.min(n, df.data.length); i++) {
      indices.push(Math.floor(Math.random() * df.data.length));
    }
    
    const data = indices.map(i => df.data[i]);
    
    return {
      data,
      columns: df.columns,
      rowCount: data.length,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Get DataFrame statistics (similar to pandas df.describe())
   */
  getDataFrameStats(id: string): any {
    const df = this.dataframes.get(id);
    if (!df) {
      throw new Error(`DataFrame ${id} not found`);
    }

    const stats: any = {};
    
    df.columns.forEach(col => {
      if (df.dtypes[col] === 'number') {
        const values = df.data.map(row => row[col]).filter(v => v !== null && v !== undefined);
        stats[col] = {
          count: values.length,
          mean: this.mean(values),
          std: this.std(values),
          min: Math.min(...values),
          max: Math.max(...values),
          '25%': this.percentile(values, 0.25),
          '50%': this.percentile(values, 0.50),
          '75%': this.percentile(values, 0.75)
        };
      }
    });

    return stats;
  }

  /**
   * Detect column types from data
   */
  private detectColumnTypes(data: any[], columns: string[]): Record<string, string> {
    const dtypes: Record<string, string> = {};
    
    columns.forEach(col => {
      const sampleValues = data.slice(0, 100).map(row => row[col]).filter(v => v !== null && v !== undefined);
      
      if (sampleValues.length === 0) {
        dtypes[col] = 'object';
        return;
      }

      // Check if all values are numbers
      if (sampleValues.every(v => typeof v === 'number')) {
        dtypes[col] = 'number';
      }
      // Check if all values are booleans
      else if (sampleValues.every(v => typeof v === 'boolean')) {
        dtypes[col] = 'bool';
      }
      // Check if values look like dates
      else if (sampleValues.every(v => this.isDateLike(v))) {
        dtypes[col] = 'datetime';
      }
      // Default to object (string)
      else {
        dtypes[col] = 'object';
      }
    });

    return dtypes;
  }

  private isDateLike(value: any): boolean {
    if (value instanceof Date) return true;
    if (typeof value !== 'string') return false;
    
    // Simple date pattern matching
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/
    ];
    
    return datePatterns.some(pattern => pattern.test(value));
  }

  private estimateMemoryUsage(df: DataFrame): string {
    // Rough estimation of memory usage
    const jsonSize = JSON.stringify(df.data).length;
    const mb = jsonSize / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  private getNonNullCounts(df: DataFrame): Record<string, number> {
    const counts: Record<string, number> = {};
    
    df.columns.forEach(col => {
      counts[col] = df.data.filter(row => row[col] !== null && row[col] !== undefined).length;
    });
    
    return counts;
  }

  // Statistical helper functions
  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private std(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

export { DataFrameManager };