import { DataFrame, DataFrameQueryResult } from './dataFrameManager';
import { logger } from './logger';

/**
 * Safely executes pandas-like operations on DataFrames
 * This simulates pandas operations in JavaScript
 */
export class PandasExecutor {
  private df: DataFrame;
  private result: any;

  constructor(dataframe: DataFrame) {
    this.df = dataframe;
    this.result = null;
  }

  /**
   * Execute pandas-like code and return results
   */
  async execute(code: string): Promise<DataFrameQueryResult> {
    const startTime = Date.now();
    
    try {
      // Parse and execute the pandas-like code
      this.result = await this.interpretPandasCode(code);
      
      // Format the result as a query result
      const queryResult = this.formatResult(this.result);
      queryResult.executionTime = Date.now() - startTime;
      
      logger.info(`Executed pandas code in ${queryResult.executionTime}ms`);
      return queryResult;
    } catch (error) {
      logger.error('Failed to execute pandas code:', error);
      throw new Error(`Execution error: ${error.message}`);
    }
  }

  /**
   * Interpret pandas-like code
   * This is a simplified interpreter for common pandas operations
   */
  private async interpretPandasCode(code: string): Promise<any> {
    // Remove df variable references (we'll use this.df)
    const cleanCode = code.replace(/\bdf\b/g, 'this.df.data');
    
    // Handle common pandas operations
    if (code.includes('.head(')) {
      const match = code.match(/\.head\((\d+)?\)/);
      const n = match && match[1] ? parseInt(match[1]) : 5;
      return this.df.data.slice(0, n);
    }
    
    if (code.includes('.tail(')) {
      const match = code.match(/\.tail\((\d+)?\)/);
      const n = match && match[1] ? parseInt(match[1]) : 5;
      return this.df.data.slice(-n);
    }
    
    if (code.includes('.shape')) {
      return { rows: this.df.shape[0], columns: this.df.shape[1] };
    }
    
    if (code.includes('.columns')) {
      return this.df.columns;
    }
    
    if (code.includes('.dtypes')) {
      return this.df.dtypes;
    }
    
    if (code.includes('.describe()')) {
      return this.describe();
    }
    
    if (code.includes('.info()')) {
      return this.info();
    }
    
    if (code.includes('.value_counts(')) {
      const match = code.match(/\['([^']+)'\]\.value_counts\(\)/);
      if (match && match[1]) {
        return this.valueCounts(match[1]);
      }
    }
    
    if (code.includes('.groupby(')) {
      return this.handleGroupBy(code);
    }
    
    if (code.includes('.sort_values(')) {
      return this.handleSortValues(code);
    }
    
    if (code.includes('[') && code.includes(']')) {
      return this.handleSelection(code);
    }
    
    // Default: return the full data
    return this.df.data;
  }

  /**
   * Format the result for output
   */
  private formatResult(result: any): DataFrameQueryResult {
    // If result is already an array of objects (rows)
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
      return {
        data: result,
        columns: Object.keys(result[0]),
        rowCount: result.length,
        executionTime: 0
      };
    }
    
    // If result is a single value or object
    if (!Array.isArray(result)) {
      const data = [{ result: result }];
      return {
        data,
        columns: ['result'],
        rowCount: 1,
        executionTime: 0
      };
    }
    
    // If result is an array of primitives
    if (Array.isArray(result) && (result.length === 0 || typeof result[0] !== 'object')) {
      const data = result.map((value, index) => ({ index, value }));
      return {
        data,
        columns: ['index', 'value'],
        rowCount: data.length,
        executionTime: 0
      };
    }
    
    // Default case
    return {
      data: [],
      columns: [],
      rowCount: 0,
      executionTime: 0
    };
  }

  /**
   * Implement pandas describe() function
   */
  private describe(): any[] {
    const stats: any[] = [];
    const numericColumns = this.df.columns.filter(col => this.df.dtypes[col] === 'number');
    
    const metrics = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
    
    metrics.forEach(metric => {
      const row: any = { statistic: metric };
      
      numericColumns.forEach(col => {
        const values = this.df.data.map(row => row[col]).filter(v => v !== null && v !== undefined);
        
        switch (metric) {
          case 'count':
            row[col] = values.length;
            break;
          case 'mean':
            row[col] = this.mean(values);
            break;
          case 'std':
            row[col] = this.std(values);
            break;
          case 'min':
            row[col] = Math.min(...values);
            break;
          case 'max':
            row[col] = Math.max(...values);
            break;
          case '25%':
            row[col] = this.percentile(values, 0.25);
            break;
          case '50%':
            row[col] = this.percentile(values, 0.50);
            break;
          case '75%':
            row[col] = this.percentile(values, 0.75);
            break;
        }
      });
      
      stats.push(row);
    });
    
    return stats;
  }

  /**
   * Implement pandas info() function
   */
  private info(): any[] {
    return this.df.columns.map(col => ({
      Column: col,
      'Non-Null Count': this.df.data.filter(row => row[col] !== null && row[col] !== undefined).length,
      Dtype: this.df.dtypes[col]
    }));
  }

  /**
   * Implement value_counts for a column
   */
  private valueCounts(column: string): any[] {
    const counts: Record<string, number> = {};
    
    this.df.data.forEach(row => {
      const value = row[column];
      if (value !== null && value !== undefined) {
        const key = String(value);
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ [column]: value, count }));
  }

  /**
   * Handle groupby operations
   */
  private handleGroupBy(code: string): any[] {
    const groupByMatch = code.match(/\.groupby\(\['([^']+)'\]\)/);
    const aggMatch = code.match(/\.(sum|mean|count|min|max)\(\)/);
    
    if (!groupByMatch || !aggMatch) {
      throw new Error('Invalid groupby syntax');
    }
    
    const groupColumn = groupByMatch[1];
    const aggFunction = aggMatch[1];
    
    const groups: Record<string, any[]> = {};
    
    // Group the data
    this.df.data.forEach(row => {
      const key = row[groupColumn];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    
    // Apply aggregation
    const result: any[] = [];
    const numericColumns = this.df.columns.filter(col => 
      col !== groupColumn && this.df.dtypes[col] === 'number'
    );
    
    Object.entries(groups).forEach(([key, rows]) => {
      const aggRow: any = { [groupColumn]: key };
      
      numericColumns.forEach(col => {
        const values = rows.map(row => row[col]).filter(v => v !== null && v !== undefined);
        
        switch (aggFunction) {
          case 'sum':
            aggRow[col] = values.reduce((a, b) => a + b, 0);
            break;
          case 'mean':
            aggRow[col] = this.mean(values);
            break;
          case 'count':
            aggRow[col] = values.length;
            break;
          case 'min':
            aggRow[col] = Math.min(...values);
            break;
          case 'max':
            aggRow[col] = Math.max(...values);
            break;
        }
      });
      
      result.push(aggRow);
    });
    
    return result;
  }

  /**
   * Handle sort_values operations
   */
  private handleSortValues(code: string): any[] {
    const match = code.match(/\.sort_values\(\['([^']+)'\](?:,\s*ascending=(True|False))?\)/);
    
    if (!match) {
      throw new Error('Invalid sort_values syntax');
    }
    
    const column = match[1];
    const ascending = match[2] !== 'False';
    
    return [...this.df.data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (ascending) {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }

  /**
   * Handle column selection
   */
  private handleSelection(code: string): any[] {
    // Handle multiple column selection: df[['col1', 'col2']]
    const multiColMatch = code.match(/\[\[([^\]]+)\]\]/);
    if (multiColMatch) {
      const columns = multiColMatch[1]
        .split(',')
        .map(col => col.trim().replace(/['"]/g, ''));
      
      return this.df.data.map(row => {
        const newRow: any = {};
        columns.forEach(col => {
          if (col in row) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      });
    }
    
    // Handle single column selection: df['col']
    const singleColMatch = code.match(/\['([^']+)'\]/);
    if (singleColMatch) {
      const column = singleColMatch[1];
      return this.df.data.map(row => ({ [column]: row[column] }));
    }
    
    // Handle boolean indexing: df[df['col'] > value]
    const boolMatch = code.match(/\[df\['([^']+)'\]\s*([><=!]+)\s*([^\]]+)\]/);
    if (boolMatch) {
      const column = boolMatch[1];
      const operator = boolMatch[2];
      const value = this.parseValue(boolMatch[3].trim());
      
      return this.df.data.filter(row => {
        const rowValue = row[column];
        switch (operator) {
          case '>': return rowValue > value;
          case '<': return rowValue < value;
          case '>=': return rowValue >= value;
          case '<=': return rowValue <= value;
          case '==': return rowValue == value;
          case '!=': return rowValue != value;
          default: return true;
        }
      });
    }
    
    return this.df.data;
  }

  /**
   * Parse a value from string
   */
  private parseValue(str: string): any {
    // Remove quotes if present
    if ((str.startsWith("'") && str.endsWith("'")) || 
        (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }
    
    // Try to parse as number
    const num = Number(str);
    if (!isNaN(num)) {
      return num;
    }
    
    // Check for boolean
    if (str === 'True' || str === 'true') return true;
    if (str === 'False' || str === 'false') return false;
    
    return str;
  }

  // Statistical helper functions
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private std(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
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