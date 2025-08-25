/**
 * Shared statistical utility functions
 * Used by DataFrameManager and PandasExecutor to avoid duplication
 */

export class StatisticalHelpers {
  /**
   * Calculate mean (average) of numeric values
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  static std(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  /**
   * Calculate percentile value
   */
  static percentile(values: number[], p: number): number {
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

  /**
   * Calculate median value
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calculate variance
   */
  static variance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return this.mean(squareDiffs);
  }

  /**
   * Calculate skewness (measure of asymmetry)
   */
  static skewness(values: number[]): number {
    if (values.length < 3) return 0;
    
    const avg = this.mean(values);
    const stdDev = this.std(values);
    
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const skewSum = values.reduce((sum, value) => {
      return sum + Math.pow((value - avg) / stdDev, 3);
    }, 0);
    
    return (n / ((n - 1) * (n - 2))) * skewSum;
  }

  /**
   * Calculate kurtosis (measure of tail heaviness)
   */
  static kurtosis(values: number[]): number {
    if (values.length < 4) return 0;
    
    const avg = this.mean(values);
    const stdDev = this.std(values);
    
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const kurtSum = values.reduce((sum, value) => {
      return sum + Math.pow((value - avg) / stdDev, 4);
    }, 0);
    
    const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum;
    const correction = 3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3));
    
    return kurtosis - correction; // Excess kurtosis
  }

  /**
   * Calculate mode (most frequent values)
   */
  static mode(values: number[]): number[] {
    if (values.length === 0) return [];
    
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    
    // Count frequencies
    for (const value of values) {
      frequency[value] = (frequency[value] || 0) + 1;
      maxFreq = Math.max(maxFreq, frequency[value]);
    }
    
    // Find all values with maximum frequency
    const modes = Object.keys(frequency)
      .filter(key => frequency[Number(key)] === maxFreq)
      .map(Number);
    
    return modes;
  }

  /**
   * Filter out non-numeric values and return clean numeric array
   */
  static getNumericValues(data: any[], column: string): number[] {
    return data
      .map(row => Number(row[column]))
      .filter(val => !isNaN(val));
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  static pearsonCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length < 2) {
      return 0;
    }
    
    const mean1 = this.mean(values1);
    const mean2 = this.mean(values2);
    
    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    
    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    
    if (denominator === 0) {
      return 0;
    }
    
    return numerator / denominator;
  }

  /**
   * Calculate covariance between two arrays
   */
  static covariance(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length < 2) {
      return 0;
    }
    
    const mean1 = this.mean(values1);
    const mean2 = this.mean(values2);
    
    let covariance = 0;
    for (let i = 0; i < values1.length; i++) {
      covariance += (values1[i] - mean1) * (values2[i] - mean2);
    }
    
    return covariance / (values1.length - 1); // Sample covariance
  }

  // INFERENTIAL STATISTICS

  /**
   * One-sample t-test
   * Tests if sample mean differs significantly from population mean
   */
  static oneSampleTTest(values: number[], populationMean: number): {
    tStatistic: number;
    pValue: number;
    degreesOfFreedom: number;
    significant: boolean;
  } {
    if (values.length < 2) {
      return { tStatistic: 0, pValue: 1, degreesOfFreedom: 0, significant: false };
    }

    const sampleMean = this.mean(values);
    const sampleStd = this.std(values);
    const n = values.length;
    const df = n - 1;
    
    const standardError = sampleStd / Math.sqrt(n);
    const tStatistic = (sampleMean - populationMean) / standardError;
    
    // Approximate p-value using t-distribution (simplified)
    const pValue = this.tDistributionPValue(Math.abs(tStatistic), df);
    
    return {
      tStatistic: Number(tStatistic.toFixed(4)),
      pValue: Number(pValue.toFixed(4)),
      degreesOfFreedom: df,
      significant: pValue < 0.05
    };
  }

  /**
   * Two-sample t-test (assuming equal variances)
   * Tests if two groups have significantly different means
   */
  static twoSampleTTest(group1: number[], group2: number[]): {
    tStatistic: number;
    pValue: number;
    degreesOfFreedom: number;
    significant: boolean;
  } {
    if (group1.length < 2 || group2.length < 2) {
      return { tStatistic: 0, pValue: 1, degreesOfFreedom: 0, significant: false };
    }

    const mean1 = this.mean(group1);
    const mean2 = this.mean(group2);
    const var1 = this.variance(group1);
    const var2 = this.variance(group2);
    const n1 = group1.length;
    const n2 = group2.length;
    const df = n1 + n2 - 2;
    
    // Pooled variance
    const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / df;
    const standardError = Math.sqrt(pooledVariance * (1/n1 + 1/n2));
    
    const tStatistic = (mean1 - mean2) / standardError;
    const pValue = this.tDistributionPValue(Math.abs(tStatistic), df);
    
    return {
      tStatistic: Number(tStatistic.toFixed(4)),
      pValue: Number(pValue.toFixed(4)),
      degreesOfFreedom: df,
      significant: pValue < 0.05
    };
  }

  /**
   * Chi-square test for independence (contingency table)
   * Tests if two categorical variables are independent
   */
  static chiSquareTest(observed: number[][]): {
    chiSquare: number;
    pValue: number;
    degreesOfFreedom: number;
    significant: boolean;
  } {
    const rows = observed.length;
    const cols = observed[0].length;
    const df = (rows - 1) * (cols - 1);
    
    if (df === 0) {
      return { chiSquare: 0, pValue: 1, degreesOfFreedom: 0, significant: false };
    }

    // Calculate row and column totals
    const rowTotals = observed.map(row => row.reduce((sum, val) => sum + val, 0));
    const colTotals = Array(cols).fill(0).map((_, j) => 
      observed.reduce((sum, row) => sum + row[j], 0)
    );
    const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);
    
    // Calculate expected frequencies and chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const expected = (rowTotals[i] * colTotals[j]) / grandTotal;
        if (expected > 0) {
          chiSquare += Math.pow(observed[i][j] - expected, 2) / expected;
        }
      }
    }
    
    const pValue = this.chiSquareDistributionPValue(chiSquare, df);
    
    return {
      chiSquare: Number(chiSquare.toFixed(4)),
      pValue: Number(pValue.toFixed(4)),
      degreesOfFreedom: df,
      significant: pValue < 0.05
    };
  }

  /**
   * Shapiro-Wilk test for normality (simplified version)
   * Tests if data follows normal distribution
   */
  static normalityTest(values: number[]): {
    wStatistic: number;
    pValue: number;
    isNormal: boolean;
  } {
    if (values.length < 3) {
      return { wStatistic: 0, pValue: 1, isNormal: false };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = this.mean(sorted);
    
    // Simplified W statistic calculation
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const expectedNormal = this.normalQuantile((i + 1 - 0.375) / (n + 0.25));
      numerator += expectedNormal * sorted[i];
      denominator += Math.pow(sorted[i] - mean, 2);
    }
    
    const wStatistic = Math.pow(numerator, 2) / denominator;
    
    // Simplified p-value approximation
    const pValue = wStatistic > 0.9 ? Math.max(0.05, 1 - wStatistic) : 0.01;
    
    return {
      wStatistic: Number(wStatistic.toFixed(4)),
      pValue: Number(pValue.toFixed(4)),
      isNormal: pValue > 0.05
    };
  }

  // HELPER FUNCTIONS FOR STATISTICAL DISTRIBUTIONS

  /**
   * Approximate p-value for t-distribution (two-tailed)
   */
  private static tDistributionPValue(t: number, df: number): number {
    // Simplified approximation using normal distribution for large df
    if (df >= 30) {
      return 2 * (1 - this.standardNormalCDF(t));
    }
    
    // Very rough approximation for small df
    const adjustment = 1 + (t * t) / (4 * df);
    return 2 * (1 - this.standardNormalCDF(t / Math.sqrt(adjustment)));
  }

  /**
   * Approximate p-value for chi-square distribution
   */
  private static chiSquareDistributionPValue(chiSquare: number, df: number): number {
    // Simplified approximation using Wilson-Hilferty transformation
    const h = 2 / (9 * df);
    const z = Math.pow(chiSquare / df, 1/3) - 1 + h;
    const normalizedZ = z / Math.sqrt(h);
    
    return 1 - this.standardNormalCDF(normalizedZ);
  }

  /**
   * Standard normal cumulative distribution function
   */
  private static standardNormalCDF(z: number): number {
    // Approximation using error function
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    return z > 0 ? 1 - prob : prob;
  }

  /**
   * Normal quantile function (inverse of normal CDF)
   */
  private static normalQuantile(p: number): number {
    // Beasley-Springer-Moro algorithm approximation
    if (p <= 0 || p >= 1) return 0;
    
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;
    
    let t: number;
    let sign = 1;
    
    if (p > 0.5) {
      t = Math.sqrt(-2 * Math.log(1 - p));
    } else {
      t = Math.sqrt(-2 * Math.log(p));
      sign = -1;
    }
    
    const numerator = c0 + c1 * t + c2 * t * t;
    const denominator = 1 + d1 * t + d2 * t * t + d3 * t * t * t;
    
    return sign * (t - numerator / denominator);
  }

  // PREDICTIVE ANALYTICS

  /**
   * Simple linear regression: y = mx + b
   * Returns slope, intercept, R-squared, and predictions
   */
  static linearRegression(xValues: number[], yValues: number[]): {
    slope: number;
    intercept: number;
    rSquared: number;
    predictions: number[];
    residuals: number[];
    standardError: number;
  } {
    if (xValues.length !== yValues.length || xValues.length < 2) {
      return {
        slope: 0,
        intercept: 0,
        rSquared: 0,
        predictions: [],
        residuals: [],
        standardError: 0
      };
    }

    const n = xValues.length;
    const meanX = this.mean(xValues);
    const meanY = this.mean(yValues);
    
    // Calculate slope and intercept using least squares method
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - meanX;
      const yDiff = yValues[i] - meanY;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;
    
    // Calculate predictions and residuals
    const predictions = xValues.map(x => slope * x + intercept);
    const residuals = yValues.map((y, i) => y - predictions[i]);
    
    // Calculate R-squared
    const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const residualSumSquares = residuals.reduce((sum, r) => sum + r * r, 0);
    const rSquared = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
    
    // Calculate standard error of regression
    const standardError = n <= 2 ? 0 : Math.sqrt(residualSumSquares / (n - 2));
    
    return {
      slope: Number(slope.toFixed(6)),
      intercept: Number(intercept.toFixed(6)),
      rSquared: Number(rSquared.toFixed(6)),
      predictions: predictions.map(p => Number(p.toFixed(6))),
      residuals: residuals.map(r => Number(r.toFixed(6))),
      standardError: Number(standardError.toFixed(6))
    };
  }

  /**
   * Multiple linear regression: y = b0 + b1*x1 + b2*x2 + ... + bn*xn
   * Uses matrix operations for multiple predictors
   */
  static multipleLinearRegression(xMatrix: number[][], yValues: number[]): {
    coefficients: number[];
    rSquared: number;
    predictions: number[];
    residuals: number[];
    standardError: number;
  } {
    const n = yValues.length;
    const p = xMatrix[0]?.length || 0;
    
    if (n < p + 1 || xMatrix.length !== n) {
      return {
        coefficients: [],
        rSquared: 0,
        predictions: [],
        residuals: [],
        standardError: 0
      };
    }

    // Add intercept column (column of 1s) to X matrix
    const X = xMatrix.map(row => [1, ...row]);
    
    // Calculate coefficients using normal equation: β = (X'X)^(-1)X'y
    // Simplified implementation for small matrices
    const coefficients = this.solveNormalEquation(X, yValues);
    
    // Calculate predictions
    const predictions = X.map(row => 
      row.reduce((sum, x, i) => sum + x * coefficients[i], 0)
    );
    
    // Calculate residuals and R-squared
    const residuals = yValues.map((y, i) => y - predictions[i]);
    const meanY = this.mean(yValues);
    const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const residualSumSquares = residuals.reduce((sum, r) => sum + r * r, 0);
    const rSquared = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
    
    const standardError = n <= p + 1 ? 0 : Math.sqrt(residualSumSquares / (n - p - 1));
    
    return {
      coefficients: coefficients.map(c => Number(c.toFixed(6))),
      rSquared: Number(rSquared.toFixed(6)),
      predictions: predictions.map(p => Number(p.toFixed(6))),
      residuals: residuals.map(r => Number(r.toFixed(6))),
      standardError: Number(standardError.toFixed(6))
    };
  }

  /**
   * Trend analysis - detects linear, quadratic, or no trend
   */
  static trendAnalysis(values: number[]): {
    trendType: 'increasing' | 'decreasing' | 'quadratic' | 'no_trend';
    strength: 'strong' | 'moderate' | 'weak';
    slope: number;
    rSquared: number;
    description: string;
  } {
    if (values.length < 3) {
      return {
        trendType: 'no_trend',
        strength: 'weak',
        slope: 0,
        rSquared: 0,
        description: 'Insufficient data for trend analysis'
      };
    }

    // Create x values (time indices)
    const xValues = Array.from({ length: values.length }, (_, i) => i);
    
    // Linear trend analysis
    const linearRegression = this.linearRegression(xValues, values);
    const slope = linearRegression.slope;
    const rSquared = linearRegression.rSquared;
    
    // Determine trend type
    let trendType: 'increasing' | 'decreasing' | 'quadratic' | 'no_trend';
    if (Math.abs(slope) < 0.01 || rSquared < 0.1) {
      trendType = 'no_trend';
    } else if (slope > 0) {
      trendType = 'increasing';
    } else {
      trendType = 'decreasing';
    }
    
    // Check for quadratic trend if linear fit is poor
    if (rSquared < 0.5 && values.length >= 5) {
      const quadraticFit = this.quadraticTrendAnalysis(xValues, values);
      if (quadraticFit.rSquared > rSquared + 0.1) {
        trendType = 'quadratic';
      }
    }
    
    // Determine strength
    let strength: 'strong' | 'moderate' | 'weak';
    if (rSquared >= 0.7) {
      strength = 'strong';
    } else if (rSquared >= 0.3) {
      strength = 'moderate';
    } else {
      strength = 'weak';
    }
    
    // Generate description
    const descriptions = {
      increasing: `Strong upward trend (slope: ${slope.toFixed(3)})`,
      decreasing: `Strong downward trend (slope: ${slope.toFixed(3)})`,
      quadratic: `Curved trend detected (R²: ${rSquared.toFixed(3)})`,
      no_trend: 'No significant trend detected'
    };
    
    return {
      trendType,
      strength,
      slope: Number(slope.toFixed(6)),
      rSquared: Number(rSquared.toFixed(6)),
      description: descriptions[trendType]
    };
  }

  /**
   * Simple forecasting using linear regression
   */
  static forecast(values: number[], periodsAhead: number): {
    forecasts: number[];
    confidenceInterval: { lower: number[]; upper: number[] };
    method: string;
  } {
    if (values.length < 3 || periodsAhead <= 0) {
      return {
        forecasts: [],
        confidenceInterval: { lower: [], upper: [] },
        method: 'insufficient_data'
      };
    }

    const xValues = Array.from({ length: values.length }, (_, i) => i);
    const regression = this.linearRegression(xValues, values);
    
    // Generate forecasts
    const forecasts: number[] = [];
    const lower: number[] = [];
    const upper: number[] = [];
    
    for (let i = 1; i <= periodsAhead; i++) {
      const futureX = values.length - 1 + i;
      const forecast = regression.slope * futureX + regression.intercept;
      
      // Simple confidence interval (±2 standard errors)
      const margin = 2 * regression.standardError;
      
      forecasts.push(Number(forecast.toFixed(6)));
      lower.push(Number((forecast - margin).toFixed(6)));
      upper.push(Number((forecast + margin).toFixed(6)));
    }
    
    return {
      forecasts,
      confidenceInterval: { lower, upper },
      method: 'linear_regression'
    };
  }

  // HELPER METHODS FOR PREDICTIVE ANALYTICS

  /**
   * Simplified normal equation solver for small matrices
   */
  private static solveNormalEquation(X: number[][], y: number[]): number[] {
    const n = X.length;
    const p = X[0].length;
    
    // Calculate X'X
    const XtX: number[][] = Array(p).fill(0).map(() => Array(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < n; k++) {
          XtX[i][j] += X[k][i] * X[k][j];
        }
      }
    }
    
    // Calculate X'y
    const Xty: number[] = Array(p).fill(0);
    for (let i = 0; i < p; i++) {
      for (let k = 0; k < n; k++) {
        Xty[i] += X[k][i] * y[k];
      }
    }
    
    // Solve using Gaussian elimination (simplified for small matrices)
    return this.gaussianElimination(XtX, Xty);
  }

  /**
   * Gaussian elimination for solving linear systems
   */
  private static gaussianElimination(A: number[][], b: number[]): number[] {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j < n + 1; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    const x: number[] = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }

  /**
   * Quadratic trend analysis for curved patterns
   */
  private static quadraticTrendAnalysis(xValues: number[], yValues: number[]): {
    rSquared: number;
    coefficients: number[];
  } {
    // Create X matrix for quadratic regression: [1, x, x²]
    const X = xValues.map(x => [1, x, x * x]);
    const result = this.multipleLinearRegression(X.map(row => row.slice(1)), yValues);
    
    return {
      rSquared: result.rSquared,
      coefficients: result.coefficients
    };
  }
}
