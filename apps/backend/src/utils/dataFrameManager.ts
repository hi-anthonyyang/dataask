import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { StatisticalHelpers } from './statisticalHelpers';

export interface DataFrame {
  id: string;
  name: string;
  data: any[];
  columns: string[];
  shape: [number, number];
  dtypes: Record<string, string>;
  uploadedAt: Date;
  profile?: VariableProfile[]; // Add profiling data
}

export interface DataFrameQueryResult {
  data: any[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export interface VariableProfile {
  name: string;
  type: 'categorical' | 'numerical';
  subtype: 'nominal' | 'ordinal' | 'interval' | 'ratio';
  distribution?: 'normal' | 'non-normal';
  outliers: boolean;
  sample_size: number;
  unique_values: number;
  inferred_role: string;
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

      const columns = Object.keys(data[0] as Record<string, any>);
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
   * Get DataFrame profiling information
   */
  getDataFrameProfile(id: string): VariableProfile[] {
    const df = this.getDataFrame(id);
    if (!df) {
      throw new Error('DataFrame not found');
    }

    // Return cached profile if available
    if (df.profile) {
      return df.profile;
    }

    // Generate profile and cache it
    const profile = this.profileDataFrame(df);
    df.profile = profile;
    
    logger.info(`Generated profile for DataFrame ${id} with ${profile.length} variables`);
    return profile;
  }

  /**
   * Profile all variables in a DataFrame
   */
  private profileDataFrame(df: DataFrame): VariableProfile[] {
    const profiles: VariableProfile[] = [];
    
    for (const column of df.columns) {
      const series = df.data.map(row => row[column]);
      const profile = this.profileVariable(column, series);
      profiles.push(profile);
    }
    
    return profiles;
  }

  /**
   * Profile a single variable
   */
  private profileVariable(name: string, values: any[]): VariableProfile {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    const sample_size = nonNullValues.length;
    const unique_values = new Set(nonNullValues).size;
    
    const type = this.inferType(nonNullValues);
    const subtype = this.inferSubtype(nonNullValues, type);
    
    let distribution: 'normal' | 'non-normal' | undefined;
    let outliers = false;
    
    if (type === 'numerical') {
      const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v));
      if (numericValues.length > 3) {
        distribution = this.detectDistribution(numericValues);
        outliers = this.detectOutliers(numericValues);
      }
    }
    
    return {
      name,
      type,
      subtype,
      distribution,
      outliers,
      sample_size,
      unique_values,
      inferred_role: 'unknown'
    };
  }

  /**
   * Infer variable type (categorical vs numerical)
   */
  private inferType(values: any[]): 'categorical' | 'numerical' {
    if (values.length === 0) return 'categorical';
    
    const numericCount = values.filter(v => {
      const num = Number(v);
      return !isNaN(num) && isFinite(num);
    }).length;
    
    const numericRatio = numericCount / values.length;
    
    // If more than 80% are numeric, consider it numerical
    if (numericRatio > 0.8) {
      return 'numerical';
    }
    
    return 'categorical';
  }

  /**
   * Infer variable subtype
   */
  private inferSubtype(values: any[], type: 'categorical' | 'numerical'): 'nominal' | 'ordinal' | 'interval' | 'ratio' {
    if (type === 'categorical') {
      if (this.isLikertScale(values)) {
        return 'ordinal';
      }
      return 'nominal';
    }
    
    // For numerical variables, assume ratio (can be overridden later)
    return 'ratio';
  }

  /**
   * Detect if distribution is normal using Shapiro-Wilk test
   */
  private detectDistribution(values: number[]): 'normal' | 'non-normal' {
    try {
      if (values.length < 3 || values.length > 5000) {
        return 'non-normal'; // Shapiro-Wilk has limits
      }
      
      // Simplified normality test using skewness and kurtosis
      const mean = this.mean(values);
      const std = this.std(values);
      
      if (std === 0) return 'non-normal';
      
      // Calculate skewness and kurtosis
      const skewness = this.calculateSkewness(values, mean, std);
      const kurtosis = this.calculateKurtosis(values, mean, std);
      
      // Simple normality check: if skewness and kurtosis are close to normal
      const isNormal = Math.abs(skewness) < 1 && Math.abs(kurtosis - 3) < 2;
      
      return isNormal ? 'normal' : 'non-normal';
    } catch (error) {
      logger.warn('Failed to perform normality test:', error);
      return 'non-normal';
    }
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = values.length;
    const skewness = values.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / std, 3);
    }, 0) / n;
    
    return skewness;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    
    const n = values.length;
    const kurtosis = values.reduce((sum, val) => {
      return sum + Math.pow((val - mean) / std, 4);
    }, 0) / n;
    
    return kurtosis;
  }

  /**
   * Detect outliers using Z-score method
   */
  private detectOutliers(values: number[]): boolean {
    if (values.length < 3) return false;
    
    try {
      const mean = this.mean(values);
      const std = this.std(values);
      
      if (std === 0) return false;
      
      const zScores = values.map(v => Math.abs((v - mean) / std));
      return zScores.some(z => z > 3);
    } catch (error) {
      logger.warn('Failed to detect outliers:', error);
      return false;
    }
  }

  /**
   * Detect Likert scale patterns
   */
  private isLikertScale(values: any[]): boolean {
    const uniqueValues = [...new Set(values)].map(String).map(s => s.toLowerCase());
    
    const likertPatterns = [
      ['strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree'],
      ['very poor', 'poor', 'fair', 'good', 'excellent'],
      ['never', 'rarely', 'sometimes', 'often', 'always'],
      ['1', '2', '3', '4', '5'],
      ['1', '2', '3', '4', '5', '6', '7']
    ];
    
    for (const pattern of likertPatterns) {
      if (uniqueValues.length === pattern.length && 
          uniqueValues.every(v => pattern.includes(v))) {
        return true;
      }
    }
    
    return false;
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

  // Use shared statistical helper functions
  private mean = StatisticalHelpers.mean;
  private std = StatisticalHelpers.std;
  private percentile = StatisticalHelpers.percentile;
}

export { DataFrameManager };