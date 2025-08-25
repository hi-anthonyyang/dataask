import { DataFrame, DataFrameQueryResult } from './dataFrameManager';
import { logger } from './logger';
import { StatisticalHelpers } from './statisticalHelpers';

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
      throw new Error(`Execution error: ${error instanceof Error ? error.message : String(error)}`);
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
    
    if (code.includes('.corr()')) {
      return this.handleCorrelation(code);
    }
    
    if (code.includes('.cov()')) {
      return this.handleCovariance(code);
    }
    
    // Handle individual statistical methods
    if (code.includes('.median()') || code.includes('.var()') || code.includes('.skew()') || code.includes('.kurt()') || code.includes('.mode()')) {
      return this.handleStatisticalMethods(code);
    }
    
    // Handle inferential statistics
    if (code.includes('ttest_1samp') || code.includes('ttest_ind') || code.includes('chi2_contingency') || code.includes('normaltest')) {
      return this.handleInferentialStatistics(code);
    }
    
    // Handle predictive analytics
    if (code.includes('linregress') || code.includes('trend_analysis') || code.includes('forecast')) {
      return this.handlePredictiveAnalytics(code);
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
    // Handle both ['column'] and 'column' syntax
    const groupByMatch = code.match(/\.groupby\(\['([^']+)'\]\)/) || code.match(/\.groupby\('([^']+)'\)/);
    
    // Handle column selection: df.groupby('column')['other_column'].mean()
    const columnSelectMatch = code.match(/\[['"]([^'"]+)['"]\]\.(sum|mean|count|min|max)\(\)/);
    const aggMatch = code.match(/\.(sum|mean|count|min|max)\(\)/);
    
    if (!groupByMatch) {
      throw new Error('Invalid groupby syntax');
    }
    
    const groupColumn = groupByMatch[1];
    const aggFunction = columnSelectMatch ? columnSelectMatch[2] : (aggMatch ? aggMatch[1] : 'mean');
    const targetColumn = columnSelectMatch ? columnSelectMatch[1] : null;
    
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
    
    Object.entries(groups).forEach(([key, rows]) => {
      const aggRow: any = { [groupColumn]: key };
      
      if (targetColumn) {
        // Single column aggregation
        const values = rows.map(row => row[targetColumn]).filter(v => v !== null && v !== undefined);
        
        switch (aggFunction) {
          case 'sum':
            aggRow[targetColumn] = values.reduce((a, b) => a + b, 0);
            break;
          case 'mean':
            aggRow[targetColumn] = this.mean(values);
            break;
          case 'count':
            aggRow[targetColumn] = values.length;
            break;
          case 'min':
            aggRow[targetColumn] = Math.min(...values);
            break;
          case 'max':
            aggRow[targetColumn] = Math.max(...values);
            break;
        }
      } else {
        // Multi-column aggregation
        const numericColumns = this.df.columns.filter(col => 
          col !== groupColumn && this.df.dtypes[col] === 'number'
        );
        
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
      }
      
      result.push(aggRow);
    });
    
    return result;
  }

  /**
   * Handle sort_values operations
   */
  private handleSortValues(code: string): any[] {
    // Handle both ['column'] and by='column' syntax
    const match = code.match(/\.sort_values\(\['([^']+)'\](?:,\s*ascending=(True|False))?\)/) || 
                 code.match(/\.sort_values\(by='([^']+)'\)/);
    
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

  /**
   * Handle correlation operations
   */
  private handleCorrelation(code: string): any[] {
    // Extract column selection from code like: df[['col1', 'col2']].corr()
    const columnMatch = code.match(/\[\[(.*?)\]\]/);
    if (!columnMatch) {
      // If no specific columns, use all numeric columns
      const numericColumns = this.df.columns.filter(col => {
        const firstValue = this.df.data[0]?.[col];
        return typeof firstValue === 'number';
      });
      return this.calculateCorrelationMatrix(numericColumns);
    }

    // Parse column names from the match
    const columnStr = columnMatch[1];
    const columns = columnStr
      .split(',')
      .map(col => col.trim().replace(/['"]/g, ''))
      .filter(col => this.df.columns.includes(col));

    if (columns.length < 2) {
      throw new Error('Correlation requires at least 2 numeric columns');
    }

    return this.calculateCorrelationMatrix(columns);
  }

  /**
   * Calculate correlation matrix for given columns
   */
  private calculateCorrelationMatrix(columns: string[]): any[] {
    const result: any[] = [];
    
    for (const col1 of columns) {
      const row: any = { index: col1 };
      
      for (const col2 of columns) {
        if (col1 === col2) {
          row[col2] = 1.0; // Perfect correlation with itself
        } else {
          const correlation = this.calculatePearsonCorrelation(col1, col2);
          row[col2] = Number(correlation.toFixed(4));
        }
      }
      
      result.push(row);
    }
    
    return result;
  }

  /**
   * Calculate Pearson correlation coefficient between two columns
   */
  private calculatePearsonCorrelation(col1: string, col2: string): number {
    const values1 = StatisticalHelpers.getNumericValues(this.df.data, col1);
    const values2 = StatisticalHelpers.getNumericValues(this.df.data, col2);
    
    // Ensure both arrays have same length by filtering paired values
    const pairedValues = this.getPairedValues(col1, col2);
    
    return StatisticalHelpers.pearsonCorrelation(pairedValues.values1, pairedValues.values2);
  }

  /**
   * Handle covariance operations
   */
  private handleCovariance(code: string): any[] {
    // Extract column selection from code like: df[['col1', 'col2']].cov()
    const columnMatch = code.match(/\[\[(.*?)\]\]/);
    if (!columnMatch) {
      // If no specific columns, use all numeric columns
      const numericColumns = this.df.columns.filter(col => {
        const firstValue = this.df.data[0]?.[col];
        return typeof firstValue === 'number';
      });
      return this.calculateCovarianceMatrix(numericColumns);
    }

    // Parse column names from the match
    const columnStr = columnMatch[1];
    const columns = columnStr
      .split(',')
      .map(col => col.trim().replace(/['"]/g, ''))
      .filter(col => this.df.columns.includes(col));

    if (columns.length < 2) {
      throw new Error('Covariance requires at least 2 numeric columns');
    }

    return this.calculateCovarianceMatrix(columns);
  }

  /**
   * Calculate covariance matrix for given columns
   */
  private calculateCovarianceMatrix(columns: string[]): any[] {
    const result: any[] = [];
    
    for (const col1 of columns) {
      const row: any = { index: col1 };
      
      for (const col2 of columns) {
        if (col1 === col2) {
          const values = this.getNumericValues(col1);
          row[col2] = Number(this.variance(values).toFixed(6));
        } else {
          const covariance = this.calculateCovariance(col1, col2);
          row[col2] = Number(covariance.toFixed(6));
        }
      }
      
      result.push(row);
    }
    
    return result;
  }

  /**
   * Calculate covariance between two columns
   */
  private calculateCovariance(col1: string, col2: string): number {
    const pairedValues = this.getPairedValues(col1, col2);
    return StatisticalHelpers.covariance(pairedValues.values1, pairedValues.values2);
  }

  /**
   * Get paired numeric values from two columns (filters out rows with NaN in either column)
   */
  private getPairedValues(col1: string, col2: string): { values1: number[]; values2: number[] } {
    const values1: number[] = [];
    const values2: number[] = [];
    
    for (const row of this.df.data) {
      const val1 = Number(row[col1]);
      const val2 = Number(row[col2]);
      
      if (!isNaN(val1) && !isNaN(val2)) {
        values1.push(val1);
        values2.push(val2);
      }
    }
    
    return { values1, values2 };
  }

  /**
   * Handle individual statistical methods like .median(), .var(), .skew(), .kurt(), .mode()
   */
  private handleStatisticalMethods(code: string): any[] {
    // Extract column and method: df['column'].median() or df.column.var()
    const columnMatch = code.match(/(?:\['([^']+)'\]|\.([a-zA-Z_][a-zA-Z0-9_]*))\.([a-z]+)\(\)/);
    
    if (!columnMatch) {
      throw new Error('Invalid statistical method syntax');
    }
    
    const column = columnMatch[1] || columnMatch[2];
    const method = columnMatch[3];
    
    if (!this.df.columns.includes(column)) {
      throw new Error(`Column '${column}' not found`);
    }
    
    const values = this.getNumericValues(column);
    let result: number | number[];
    
    switch (method) {
      case 'median':
        result = this.median(values);
        break;
      case 'var':
        result = this.variance(values);
        break;
      case 'skew':
        result = this.skewness(values);
        break;
      case 'kurt':
        result = this.kurtosis(values);
        break;
      case 'mode':
        result = this.mode(values);
        break;
      default:
        throw new Error(`Unsupported statistical method: ${method}`);
    }
    
    // Return as a single-row result
    return [{ [column]: result, method: method }];
  }

  /**
   * Get numeric values from a column, filtering out NaN values
   */
  private getNumericValues(column: string): number[] {
    return StatisticalHelpers.getNumericValues(this.df.data, column);
  }

  /**
   * Handle inferential statistical tests
   */
  private handleInferentialStatistics(code: string): any[] {
    // One-sample t-test: stats.ttest_1samp(df['column'], population_mean)
    if (code.includes('ttest_1samp')) {
      const match = code.match(/ttest_1samp\(df\['([^']+)'\],\s*([0-9.-]+)\)/);
      if (!match) {
        throw new Error('Invalid ttest_1samp syntax. Use: stats.ttest_1samp(df[\'column\'], population_mean)');
      }
      
      const column = match[1];
      const populationMean = parseFloat(match[2]);
      
      if (!this.df.columns.includes(column)) {
        throw new Error(`Column '${column}' not found`);
      }
      
      const values = this.getNumericValues(column);
      const result = StatisticalHelpers.oneSampleTTest(values, populationMean);
      
      return [{
        test: 'One-Sample T-Test',
        column: column,
        population_mean: populationMean,
        sample_mean: StatisticalHelpers.mean(values),
        t_statistic: result.tStatistic,
        p_value: result.pValue,
        degrees_of_freedom: result.degreesOfFreedom,
        significant: result.significant,
        interpretation: result.significant ? 
          'Reject null hypothesis - sample mean differs significantly from population mean' :
          'Fail to reject null hypothesis - no significant difference'
      }];
    }
    
    // Two-sample t-test: stats.ttest_ind(df[df['group']=='A']['value'], df[df['group']=='B']['value'])
    if (code.includes('ttest_ind')) {
      const match = code.match(/ttest_ind\(df\[df\['([^']+)'\]=='([^']+)'\]\['([^']+)'\],\s*df\[df\['([^']+)'\]=='([^']+)'\]\['([^']+)'\]\)/);
      if (!match) {
        throw new Error('Invalid ttest_ind syntax. Use: stats.ttest_ind(df[df[\'group\']==\'A\'][\'value\'], df[df[\'group\']==\'B\'][\'value\'])');
      }
      
      const groupCol = match[1];
      const group1Val = match[2];
      const valueCol1 = match[3];
      const group2Val = match[5];
      const valueCol2 = match[6];
      
      if (groupCol !== match[4] || valueCol1 !== valueCol2) {
        throw new Error('Group column and value column must be consistent in both groups');
      }
      
      const group1Data = this.df.data
        .filter(row => row[groupCol] === group1Val)
        .map(row => Number(row[valueCol1]))
        .filter(val => !isNaN(val));
        
      const group2Data = this.df.data
        .filter(row => row[groupCol] === group2Val)
        .map(row => Number(row[valueCol2]))
        .filter(val => !isNaN(val));
      
      const result = StatisticalHelpers.twoSampleTTest(group1Data, group2Data);
      
      return [{
        test: 'Two-Sample T-Test',
        group_column: groupCol,
        value_column: valueCol1,
        group1: group1Val,
        group2: group2Val,
        group1_mean: StatisticalHelpers.mean(group1Data),
        group2_mean: StatisticalHelpers.mean(group2Data),
        group1_size: group1Data.length,
        group2_size: group2Data.length,
        t_statistic: result.tStatistic,
        p_value: result.pValue,
        degrees_of_freedom: result.degreesOfFreedom,
        significant: result.significant,
        interpretation: result.significant ? 
          'Reject null hypothesis - groups have significantly different means' :
          'Fail to reject null hypothesis - no significant difference between groups'
      }];
    }
    
    // Normality test: stats.normaltest(df['column'])
    if (code.includes('normaltest')) {
      const match = code.match(/normaltest\(df\['([^']+)'\]/);
      if (!match) {
        throw new Error('Invalid normaltest syntax. Use: stats.normaltest(df[\'column\'])');
      }
      
      const column = match[1];
      
      if (!this.df.columns.includes(column)) {
        throw new Error(`Column '${column}' not found`);
      }
      
      const values = this.getNumericValues(column);
      const result = StatisticalHelpers.normalityTest(values);
      
      return [{
        test: 'Shapiro-Wilk Normality Test',
        column: column,
        sample_size: values.length,
        w_statistic: result.wStatistic,
        p_value: result.pValue,
        is_normal: result.isNormal,
        interpretation: result.isNormal ? 
          'Data appears to be normally distributed' :
          'Data does not appear to be normally distributed'
      }];
    }
    
    throw new Error('Unsupported inferential statistics operation');
  }

  /**
   * Handle predictive analytics operations
   */
  private handlePredictiveAnalytics(code: string): any[] {
    // Linear regression: stats.linregress(df['x'], df['y'])
    if (code.includes('linregress')) {
      const match = code.match(/linregress\(df\['([^']+)'\],\s*df\['([^']+)'\]\)/);
      if (!match) {
        throw new Error('Invalid linregress syntax. Use: stats.linregress(df[\'x_column\'], df[\'y_column\'])');
      }
      
      const xColumn = match[1];
      const yColumn = match[2];
      
      if (!this.df.columns.includes(xColumn) || !this.df.columns.includes(yColumn)) {
        throw new Error(`Column(s) not found: ${xColumn}, ${yColumn}`);
      }
      
      const pairedValues = this.getPairedValues(xColumn, yColumn);
      const regression = StatisticalHelpers.linearRegression(pairedValues.values1, pairedValues.values2);
      
      return [{
        analysis_type: 'Linear Regression',
        x_variable: xColumn,
        y_variable: yColumn,
        equation: `${yColumn} = ${regression.slope.toFixed(6)} * ${xColumn} + ${regression.intercept.toFixed(6)}`,
        slope: regression.slope,
        intercept: regression.intercept,
        r_squared: regression.rSquared,
        standard_error: regression.standardError,
        sample_size: pairedValues.values1.length,
        interpretation: this.interpretRegressionResults(regression.rSquared, regression.slope)
      }];
    }
    
    // Trend analysis: stats.trend_analysis(df['column'])
    if (code.includes('trend_analysis')) {
      const match = code.match(/trend_analysis\(df\['([^']+)'\]/);
      if (!match) {
        throw new Error('Invalid trend_analysis syntax. Use: stats.trend_analysis(df[\'column\'])');
      }
      
      const column = match[1];
      
      if (!this.df.columns.includes(column)) {
        throw new Error(`Column '${column}' not found`);
      }
      
      const values = this.getNumericValues(column);
      const trendResult = StatisticalHelpers.trendAnalysis(values);
      
      return [{
        analysis_type: 'Trend Analysis',
        column: column,
        trend_type: trendResult.trendType,
        strength: trendResult.strength,
        slope: trendResult.slope,
        r_squared: trendResult.rSquared,
        sample_size: values.length,
        description: trendResult.description,
        interpretation: this.interpretTrendResults(trendResult)
      }];
    }
    
    // Forecasting: stats.forecast(df['column'], periods=5)
    if (code.includes('forecast')) {
      const match = code.match(/forecast\(df\['([^']+)'\],\s*periods=(\d+)\)/);
      if (!match) {
        throw new Error('Invalid forecast syntax. Use: stats.forecast(df[\'column\'], periods=N)');
      }
      
      const column = match[1];
      const periods = parseInt(match[2]);
      
      if (!this.df.columns.includes(column)) {
        throw new Error(`Column '${column}' not found`);
      }
      
      if (periods <= 0 || periods > 20) {
        throw new Error('Forecast periods must be between 1 and 20');
      }
      
      const values = this.getNumericValues(column);
      const forecastResult = StatisticalHelpers.forecast(values, periods);
      
      // Format forecast results as rows
      const results: any[] = [];
      for (let i = 0; i < forecastResult.forecasts.length; i++) {
        results.push({
          period: i + 1,
          forecast: forecastResult.forecasts[i],
          lower_bound: forecastResult.confidenceInterval.lower[i],
          upper_bound: forecastResult.confidenceInterval.upper[i],
          method: forecastResult.method
        });
      }
      
      // Add summary row
      results.unshift({
        analysis_type: 'Forecast Summary',
        column: column,
        historical_periods: values.length,
        forecast_periods: periods,
        method: forecastResult.method,
        interpretation: `Generated ${periods} period forecast using ${forecastResult.method}`
      });
      
      return results;
    }
    
    throw new Error('Unsupported predictive analytics operation');
  }

  /**
   * Interpret regression results for user understanding
   */
  private interpretRegressionResults(rSquared: number, slope: number): string {
    let strength = '';
    if (rSquared >= 0.7) strength = 'strong';
    else if (rSquared >= 0.3) strength = 'moderate';
    else strength = 'weak';
    
    const direction = slope > 0 ? 'positive' : 'negative';
    const percentage = (rSquared * 100).toFixed(1);
    
    return `${strength} ${direction} relationship (R² = ${rSquared.toFixed(3)}). ${percentage}% of variance explained.`;
  }

  /**
   * Interpret trend analysis results
   */
  private interpretTrendResults(trend: any): string {
    const { trendType, strength, rSquared } = trend;
    
    const strengthDesc = strength === 'strong' ? 'Strong' : 
                        strength === 'moderate' ? 'Moderate' : 'Weak';
    
    switch (trendType) {
      case 'increasing':
        return `${strengthDesc} upward trend detected. Values are consistently increasing over time.`;
      case 'decreasing':
        return `${strengthDesc} downward trend detected. Values are consistently decreasing over time.`;
      case 'quadratic':
        return `Curved (non-linear) trend detected. Linear model may not be appropriate.`;
      default:
        return 'No significant trend detected. Values appear relatively stable over time.';
    }
  }

  // Use shared statistical helper functions
  private mean = StatisticalHelpers.mean;
  private std = StatisticalHelpers.std;
  private percentile = StatisticalHelpers.percentile;
  private median = StatisticalHelpers.median;
  private variance = StatisticalHelpers.variance;
  private skewness = StatisticalHelpers.skewness;
  private kurtosis = StatisticalHelpers.kurtosis;
  private mode = StatisticalHelpers.mode;
}