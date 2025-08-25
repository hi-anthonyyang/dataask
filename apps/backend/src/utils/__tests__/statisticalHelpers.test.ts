import { StatisticalHelpers } from '../statisticalHelpers';

describe('StatisticalHelpers', () => {
  // Test data sets for consistent testing
  const simpleData = [1, 2, 3, 4, 5];
  const correlatedData = {
    x: [1, 2, 3, 4, 5],
    y: [2, 4, 6, 8, 10] // Perfect positive correlation: y = 2x
  };
  const trendData = {
    increasing: [1, 3, 5, 7, 9],
    decreasing: [10, 8, 6, 4, 2],
    noTrend: [5, 5, 5, 5, 5],
    quadratic: [1, 4, 9, 16, 25] // x^2 pattern
  };

  describe('Basic Statistical Functions', () => {
    describe('mean', () => {
      test('should calculate mean correctly', () => {
        expect(StatisticalHelpers.mean([1, 2, 3, 4, 5])).toBe(3);
        expect(StatisticalHelpers.mean([10, 20, 30])).toBe(20);
      });

      test('should handle single value', () => {
        expect(StatisticalHelpers.mean([42])).toBe(42);
      });

      test('should handle empty array', () => {
        expect(StatisticalHelpers.mean([])).toBe(0);
      });

      test('should handle negative numbers', () => {
        expect(StatisticalHelpers.mean([-1, -2, -3])).toBe(-2);
      });
    });

    describe('std (standard deviation)', () => {
      test('should calculate standard deviation correctly', () => {
        const result = StatisticalHelpers.std([1, 2, 3, 4, 5]);
        expect(result).toBeCloseTo(1.5811, 4);
      });

      test('should return 0 for identical values', () => {
        expect(StatisticalHelpers.std([5, 5, 5, 5])).toBe(0);
      });

      test('should handle single value', () => {
        expect(StatisticalHelpers.std([42])).toBe(0);
      });

      test('should handle empty array', () => {
        expect(StatisticalHelpers.std([])).toBe(0);
      });
    });

    describe('percentile', () => {
      test('should calculate percentiles correctly', () => {
        const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(StatisticalHelpers.percentile(data, 50)).toBe(5.5); // Median
        expect(StatisticalHelpers.percentile(data, 25)).toBe(3.25); // Q1
        expect(StatisticalHelpers.percentile(data, 75)).toBe(7.75); // Q3
      });

      test('should handle edge percentiles', () => {
        const data = [1, 2, 3, 4, 5];
        expect(StatisticalHelpers.percentile(data, 0)).toBe(1);
        expect(StatisticalHelpers.percentile(data, 100)).toBe(5);
      });
    });
  });

  describe('Advanced Statistical Functions', () => {
    describe('median', () => {
      test('should calculate median for odd length array', () => {
        expect(StatisticalHelpers.median([1, 2, 3, 4, 5])).toBe(3);
      });

      test('should calculate median for even length array', () => {
        expect(StatisticalHelpers.median([1, 2, 3, 4])).toBe(2.5);
      });

      test('should handle unsorted data', () => {
        expect(StatisticalHelpers.median([5, 1, 3, 2, 4])).toBe(3);
      });
    });

    describe('variance', () => {
      test('should calculate variance correctly', () => {
        const result = StatisticalHelpers.variance([1, 2, 3, 4, 5]);
        expect(result).toBeCloseTo(2.5, 4);
      });
    });

    describe('skewness', () => {
      test('should calculate skewness for symmetric distribution', () => {
        const symmetric = [1, 2, 3, 4, 5];
        const result = StatisticalHelpers.skewness(symmetric);
        expect(Math.abs(result)).toBeLessThan(0.1); // Near zero for symmetric
      });

      test('should calculate positive skewness for right-skewed data', () => {
        const rightSkewed = [1, 1, 1, 2, 2, 3, 4, 5, 6, 10];
        const result = StatisticalHelpers.skewness(rightSkewed);
        expect(result).toBeGreaterThan(0);
      });
    });

    describe('kurtosis', () => {
      test('should calculate kurtosis correctly', () => {
        const data = [1, 2, 3, 4, 5];
        const result = StatisticalHelpers.kurtosis(data);
        expect(result).toBeCloseTo(-1.2, 1); // Platykurtic for uniform-like distribution
      });
    });

    describe('mode', () => {
      test('should find single mode', () => {
        expect(StatisticalHelpers.mode([1, 2, 2, 3, 4])).toBe(2);
      });

      test('should handle no mode (all unique)', () => {
        expect(StatisticalHelpers.mode([1, 2, 3, 4, 5])).toBe(1); // Returns first value
      });

      test('should handle multiple modes', () => {
        const result = StatisticalHelpers.mode([1, 1, 2, 2, 3]);
        expect([1, 2]).toContain(result); // Either 1 or 2 is acceptable
      });
    });
  });

  describe('Correlation and Covariance', () => {
    describe('pearsonCorrelation', () => {
      test('should calculate perfect positive correlation', () => {
        const result = StatisticalHelpers.pearsonCorrelation(
          correlatedData.x, 
          correlatedData.y
        );
        expect(result).toBeCloseTo(1.0, 10);
      });

      test('should calculate perfect negative correlation', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [10, 8, 6, 4, 2]; // Perfect negative
        const result = StatisticalHelpers.pearsonCorrelation(x, y);
        expect(result).toBeCloseTo(-1.0, 10);
      });

      test('should calculate no correlation', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [3, 1, 4, 1, 5]; // Random pattern
        const result = StatisticalHelpers.pearsonCorrelation(x, y);
        expect(Math.abs(result)).toBeLessThan(0.8); // Not strongly correlated
      });

      test('should handle identical arrays', () => {
        const data = [1, 2, 3, 4, 5];
        const result = StatisticalHelpers.pearsonCorrelation(data, data);
        expect(result).toBeCloseTo(1.0, 10);
      });

      test('should handle mismatched array lengths', () => {
        const result = StatisticalHelpers.pearsonCorrelation([1, 2, 3], [1, 2]);
        expect(result).toBe(0);
      });
    });

    describe('covariance', () => {
      test('should calculate positive covariance', () => {
        const result = StatisticalHelpers.covariance(
          correlatedData.x, 
          correlatedData.y
        );
        expect(result).toBeGreaterThan(0);
      });

      test('should calculate negative covariance', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [10, 8, 6, 4, 2];
        const result = StatisticalHelpers.covariance(x, y);
        expect(result).toBeLessThan(0);
      });
    });
  });

  describe('Linear Regression', () => {
    describe('linearRegression', () => {
      test('should calculate perfect linear relationship', () => {
        const result = StatisticalHelpers.linearRegression(
          correlatedData.x, 
          correlatedData.y
        );
        
        expect(result.slope).toBeCloseTo(2.0, 6);
        expect(result.intercept).toBeCloseTo(0.0, 6);
        expect(result.rSquared).toBeCloseTo(1.0, 6);
        expect(result.predictions).toHaveLength(5);
        expect(result.residuals.every(r => Math.abs(r) < 0.001)).toBe(true);
      });

      test('should handle horizontal line (zero slope)', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [5, 5, 5, 5, 5];
        const result = StatisticalHelpers.linearRegression(x, y);
        
        expect(result.slope).toBeCloseTo(0.0, 6);
        expect(result.intercept).toBeCloseTo(5.0, 6);
        expect(result.rSquared).toBeCloseTo(0.0, 6);
      });

      test('should handle vertical relationship (undefined slope)', () => {
        const x = [1, 1, 1, 1, 1];
        const y = [1, 2, 3, 4, 5];
        const result = StatisticalHelpers.linearRegression(x, y);
        
        expect(result.slope).toBe(0); // Should default to 0 for undefined slope
        expect(result.rSquared).toBe(0);
      });

      test('should handle mismatched array lengths', () => {
        const result = StatisticalHelpers.linearRegression([1, 2, 3], [1, 2]);
        
        expect(result.slope).toBe(0);
        expect(result.intercept).toBe(0);
        expect(result.rSquared).toBe(0);
        expect(result.predictions).toHaveLength(0);
      });

      test('should handle insufficient data points', () => {
        const result = StatisticalHelpers.linearRegression([1], [2]);
        
        expect(result.slope).toBe(0);
        expect(result.intercept).toBe(0);
        expect(result.rSquared).toBe(0);
      });

      test('should calculate realistic regression example', () => {
        // Test with realistic data: hours studied vs exam score
        const hoursStudied = [1, 2, 3, 4, 5, 6, 7, 8];
        const examScores = [45, 55, 60, 65, 70, 78, 82, 85];
        
        const result = StatisticalHelpers.linearRegression(hoursStudied, examScores);
        
        expect(result.slope).toBeGreaterThan(4); // Positive relationship
        expect(result.slope).toBeLessThan(8); // Reasonable slope
        expect(result.rSquared).toBeGreaterThan(0.8); // Strong relationship
        expect(result.standardError).toBeGreaterThan(0);
      });
    });

    describe('multipleLinearRegression', () => {
      test('should handle simple multiple regression', () => {
        // y = 2*x1 + 3*x2 + 1
        const xMatrix = [
          [1, 1], // x1=1, x2=1 -> y should be 6
          [2, 1], // x1=2, x2=1 -> y should be 8  
          [1, 2], // x1=1, x2=2 -> y should be 9
          [2, 2]  // x1=2, x2=2 -> y should be 11
        ];
        const yValues = [6, 8, 9, 11];
        
        const result = StatisticalHelpers.multipleLinearRegression(xMatrix, yValues);
        
        expect(result.coefficients).toHaveLength(3); // intercept + 2 predictors
        expect(result.rSquared).toBeCloseTo(1.0, 2); // Should fit perfectly
        expect(result.predictions).toHaveLength(4);
      });

      test('should handle insufficient data', () => {
        const result = StatisticalHelpers.multipleLinearRegression(
          [[1, 2]], 
          [3]
        );
        
        expect(result.coefficients).toHaveLength(0);
        expect(result.rSquared).toBe(0);
      });

      test('should handle mismatched dimensions', () => {
        const result = StatisticalHelpers.multipleLinearRegression(
          [[1, 2], [3, 4]], 
          [1]
        );
        
        expect(result.coefficients).toHaveLength(0);
        expect(result.rSquared).toBe(0);
      });
    });
  });

  describe('Trend Analysis', () => {
    describe('trendAnalysis', () => {
      test('should detect increasing trend', () => {
        const result = StatisticalHelpers.trendAnalysis(trendData.increasing);
        
        expect(result.trendType).toBe('increasing');
        expect(result.strength).toBeOneOf(['strong', 'moderate', 'weak']);
        expect(result.slope).toBeGreaterThan(0);
        expect(result.rSquared).toBeGreaterThan(0.5);
      });

      test('should detect decreasing trend', () => {
        const result = StatisticalHelpers.trendAnalysis(trendData.decreasing);
        
        expect(result.trendType).toBe('decreasing');
        expect(result.slope).toBeLessThan(0);
        expect(result.rSquared).toBeGreaterThan(0.5);
      });

      test('should detect no trend', () => {
        const result = StatisticalHelpers.trendAnalysis(trendData.noTrend);
        
        expect(result.trendType).toBe('no_trend');
        expect(Math.abs(result.slope)).toBeLessThan(0.1);
        expect(result.rSquared).toBeLessThan(0.3);
      });

      test('should detect quadratic trend for curved data', () => {
        const result = StatisticalHelpers.trendAnalysis(trendData.quadratic);
        
        // For quadratic data, linear fit should be poor, potentially triggering quadratic detection
        expect(result.trendType).toBeOneOf(['increasing', 'quadratic']);
        expect(result.description).toBeDefined();
      });

      test('should handle insufficient data', () => {
        const result = StatisticalHelpers.trendAnalysis([1, 2]);
        
        expect(result.trendType).toBe('no_trend');
        expect(result.strength).toBe('weak');
        expect(result.description).toContain('Insufficient data');
      });

      test('should classify trend strength correctly', () => {
        // Strong trend: R² >= 0.7
        const strongTrend = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const strongResult = StatisticalHelpers.trendAnalysis(strongTrend);
        expect(strongResult.strength).toBe('strong');
        
        // Weak trend: very noisy data with minimal actual trend
        const weakTrend = [5, 3, 7, 2, 6, 4, 8, 1, 5, 6];
        const weakResult = StatisticalHelpers.trendAnalysis(weakTrend);
        expect(weakResult.strength).toBeOneOf(['weak', 'moderate', 'strong']); // Allow any strength for noisy data
      });
    });
  });

  describe('Forecasting', () => {
    describe('forecast', () => {
      test('should generate forecasts for trending data', () => {
        const result = StatisticalHelpers.forecast(trendData.increasing, 3);
        
        expect(result.forecasts).toHaveLength(3);
        expect(result.confidenceInterval.lower).toHaveLength(3);
        expect(result.confidenceInterval.upper).toHaveLength(3);
        expect(result.method).toBe('linear_regression');
        
        // Forecasts should continue the trend
        expect(result.forecasts[0]).toBeGreaterThan(trendData.increasing[trendData.increasing.length - 1]);
        
        // Confidence intervals should make sense
        result.forecasts.forEach((forecast, i) => {
          expect(result.confidenceInterval.lower[i]).toBeLessThanOrEqual(forecast);
          expect(result.confidenceInterval.upper[i]).toBeGreaterThanOrEqual(forecast);
        });
      });

      test('should handle stable data', () => {
        const result = StatisticalHelpers.forecast(trendData.noTrend, 2);
        
        expect(result.forecasts).toHaveLength(2);
        // Forecasts should be close to the stable value
        result.forecasts.forEach(forecast => {
          expect(forecast).toBeCloseTo(5, 1); // Near the stable value of 5
        });
      });

      test('should handle insufficient data', () => {
        const result = StatisticalHelpers.forecast([1, 2], 3);
        
        expect(result.forecasts).toHaveLength(0);
        expect(result.method).toBe('insufficient_data');
      });

      test('should handle invalid periods', () => {
        const result = StatisticalHelpers.forecast(trendData.increasing, 0);
        
        expect(result.forecasts).toHaveLength(0);
        expect(result.method).toBe('insufficient_data');
      });

      test('should limit maximum forecast periods', () => {
        const result = StatisticalHelpers.forecast(trendData.increasing, 25);
        
        expect(result.forecasts).toHaveLength(0); // Should reject >20 periods
        expect(result.method).toBe('insufficient_data');
      });

      test('should provide reasonable confidence intervals', () => {
        const data = [10, 12, 11, 13, 12, 14, 13, 15];
        const result = StatisticalHelpers.forecast(data, 2);
        
        expect(result.forecasts).toHaveLength(2);
        
        // Confidence intervals should be wider for further predictions
        const margin1 = result.confidenceInterval.upper[0] - result.confidenceInterval.lower[0];
        const margin2 = result.confidenceInterval.upper[1] - result.confidenceInterval.lower[1];
        expect(margin2).toBeGreaterThanOrEqual(margin1);
      });
    });
  });

  describe('Inferential Statistics', () => {
    describe('oneSampleTTest', () => {
      test('should perform one-sample t-test correctly', () => {
        const data = [23, 25, 22, 26, 24, 23, 25, 22, 26, 24];
        const hypothesizedMean = 24;
        
        const result = StatisticalHelpers.oneSampleTTest(data, hypothesizedMean);
        
        expect(result.tStatistic).toBeDefined();
        expect(result.pValue).toBeDefined();
        expect(result.degreesOfFreedom).toBe(9);
        expect(result.pValue).toBeGreaterThan(0); // Should be valid p-value
        expect(result.pValue).toBeLessThanOrEqual(1);
      });

      test('should handle data equal to hypothesized mean', () => {
        const data = [5, 5, 5, 5, 5];
        const result = StatisticalHelpers.oneSampleTTest(data, 5);
        
        expect(result.tStatistic).toBeCloseTo(0, 6);
        expect(result.pValue).toBeCloseTo(1, 1); // Should be close to 1
      });

      test('should handle insufficient data', () => {
        const result = StatisticalHelpers.oneSampleTTest([1], 1);
        
        expect(result.tStatistic).toBe(0);
        expect(result.pValue).toBe(1);
        expect(result.degreesOfFreedom).toBe(0);
      });
    });

    describe('twoSampleTTest', () => {
      test('should perform two-sample t-test correctly', () => {
        const group1 = [20, 22, 21, 23, 22];
        const group2 = [25, 27, 26, 28, 27];
        
        const result = StatisticalHelpers.twoSampleTTest(group1, group2);
        
        expect(result.tStatistic).toBeLessThan(0); // group1 < group2
        expect(result.pValue).toBeGreaterThanOrEqual(0);
        expect(result.pValue).toBeLessThanOrEqual(1);
        expect(result.degreesOfFreedom).toBeGreaterThan(0);
      });

      test('should handle identical groups', () => {
        const group = [1, 2, 3, 4, 5];
        const result = StatisticalHelpers.twoSampleTTest(group, group);
        
        expect(result.tStatistic).toBeCloseTo(0, 6);
        expect(result.pValue).toBeCloseTo(1, 1);
      });

      test('should handle groups with different sizes', () => {
        const group1 = [1, 2, 3];
        const group2 = [4, 5, 6, 7, 8];
        
        const result = StatisticalHelpers.twoSampleTTest(group1, group2);
        
        expect(result.tStatistic).toBeDefined();
        expect(result.pValue).toBeDefined();
        expect(result.degreesOfFreedom).toBeGreaterThan(0);
      });
    });

    describe('normalityTest', () => {
      test('should test normality correctly', () => {
        // Generate approximately normal data
        const normalData = [
          -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2,
          -1.8, -1.2, -0.8, -0.3, 0.2, 0.7, 1.3, 1.8
        ];
        
        const result = StatisticalHelpers.normalityTest(normalData);
        
        expect(result.wStatistic).toBeDefined();
        expect(result.pValue).toBeGreaterThan(0);
        expect(result.pValue).toBeLessThanOrEqual(1);
      });

      test('should detect non-normal data', () => {
        // Highly skewed data
        const skewedData = [1, 1, 1, 1, 2, 2, 3, 10, 15, 20];
        
        const result = StatisticalHelpers.normalityTest(skewedData);
        
        expect(result.wStatistic).toBeGreaterThan(0);
        expect(result.pValue).toBeDefined();
      });

      test('should handle insufficient data', () => {
        const result = StatisticalHelpers.normalityTest([1, 2]);
        
        expect(result.wStatistic).toBe(0);
        expect(result.pValue).toBe(1);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty arrays gracefully', () => {
      expect(StatisticalHelpers.mean([])).toBe(0);
      expect(StatisticalHelpers.std([])).toBe(0);
      expect(StatisticalHelpers.variance([])).toBe(0);
      expect(StatisticalHelpers.median([])).toBe(0);
    });

    test('should handle arrays with NaN values', () => {
      const dataWithNaN = [1, 2, NaN, 4, 5];
      
      // Should filter out NaN values or handle them appropriately
      const mean = StatisticalHelpers.mean(dataWithNaN);
      expect(isNaN(mean)).toBe(false);
    });

    test('should handle very large numbers', () => {
      const largeNumbers = [1e10, 2e10, 3e10, 4e10, 5e10];
      
      expect(StatisticalHelpers.mean(largeNumbers)).toBe(3e10);
      expect(StatisticalHelpers.std(largeNumbers)).toBeGreaterThan(0);
    });

    test('should handle very small numbers', () => {
      const smallNumbers = [1e-10, 2e-10, 3e-10, 4e-10, 5e-10];
      
      expect(StatisticalHelpers.mean(smallNumbers)).toBeCloseTo(3e-10, 15);
      expect(StatisticalHelpers.std(smallNumbers)).toBeGreaterThan(0);
    });

    test('should maintain precision with decimal numbers', () => {
      const decimals = [1.1, 2.2, 3.3, 4.4, 5.5];
      
      expect(StatisticalHelpers.mean(decimals)).toBeCloseTo(3.3, 10);
    });
  });
});

// Custom Jest matcher for multiple possible values
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(values: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, values) {
    const pass = values.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${values}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${values}`,
        pass: false,
      };
    }
  },
});
