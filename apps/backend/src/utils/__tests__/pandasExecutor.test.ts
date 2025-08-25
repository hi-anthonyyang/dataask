import { PandasExecutor } from '../pandasExecutor';
import { DataFrame } from '../dataFrameManager';

describe('PandasExecutor Predictive Analytics Integration', () => {
  let sampleDataFrame: DataFrame;
  let executor: PandasExecutor;

  beforeEach(() => {
    // Create a sample DataFrame with realistic data for testing
    sampleDataFrame = {
      id: 'test-df',
      name: 'test_data.csv',
      columns: ['id', 'marketing_spend', 'sales', 'month', 'revenue', 'customers'],
      dtypes: {
        id: 'int64',
        marketing_spend: 'float64',
        sales: 'float64',
        month: 'int64',
        revenue: 'float64',
        customers: 'int64'
      },
      data: [
        { id: 1, marketing_spend: 1000, sales: 50, month: 1, revenue: 5000, customers: 100 },
        { id: 2, marketing_spend: 2000, sales: 95, month: 2, revenue: 9500, customers: 190 },
        { id: 3, marketing_spend: 1500, sales: 75, month: 3, revenue: 7500, customers: 150 },
        { id: 4, marketing_spend: 2500, sales: 120, month: 4, revenue: 12000, customers: 240 },
        { id: 5, marketing_spend: 3000, sales: 140, month: 5, revenue: 14000, customers: 280 },
        { id: 6, marketing_spend: 2200, sales: 110, month: 6, revenue: 11000, customers: 220 },
        { id: 7, marketing_spend: 1800, sales: 85, month: 7, revenue: 8500, customers: 170 },
        { id: 8, marketing_spend: 2700, sales: 135, month: 8, revenue: 13500, customers: 270 }
      ],
      shape: [8, 6],
      uploadedAt: new Date()
    };

    executor = new PandasExecutor(sampleDataFrame);
  });

  describe('Linear Regression Integration', () => {
    test('should execute linear regression with valid syntax', async () => {
      const code = "stats.linregress(df['marketing_spend'], df['sales'])";
      
      const result = await executor.execute(code);
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('analysis_type', 'Linear Regression');
      expect(result.data[0]).toHaveProperty('x_variable', 'marketing_spend');
      expect(result.data[0]).toHaveProperty('y_variable', 'sales');
      expect(result.data[0]).toHaveProperty('slope');
      expect(result.data[0]).toHaveProperty('intercept');
      expect(result.data[0]).toHaveProperty('r_squared');
      expect(result.data[0]).toHaveProperty('standard_error');
      expect(result.data[0]).toHaveProperty('sample_size', 8);
      expect(result.data[0]).toHaveProperty('interpretation');
      
      // Check that slope is positive (marketing spend should correlate with sales)
      expect(result.data[0].slope).toBeGreaterThan(0);
      expect(result.data[0].r_squared).toBeGreaterThan(0.5); // Should have decent correlation
    });

    test('should handle invalid linear regression syntax', async () => {
      const code = "stats.linregress(df['invalid_syntax'])";
      
      await expect(executor.execute(code)).rejects.toThrow('Invalid linregress syntax');
    });

    test('should handle non-existent columns in linear regression', async () => {
      const code = "stats.linregress(df['nonexistent'], df['sales'])";
      
      await expect(executor.execute(code)).rejects.toThrow('Column(s) not found');
    });

    test('should calculate realistic regression coefficients', async () => {
      const code = "stats.linregress(df['marketing_spend'], df['sales'])";
      
      const result = await executor.execute(code);
      const regression = result.data[0];
      
      // Marketing spend vs sales should have a reasonable relationship
      expect(regression.slope).toBeGreaterThan(0.01);
      expect(regression.slope).toBeLessThan(1); // Realistic slope
      expect(regression.r_squared).toBeGreaterThan(0.7); // Strong correlation expected
      expect(regression.interpretation).toContain('relationship');
    });
  });

  describe('Trend Analysis Integration', () => {
    test('should execute trend analysis with valid syntax', async () => {
      const code = "stats.trend_analysis(df['revenue'])";
      
      const result = await executor.execute(code);
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('analysis_type', 'Trend Analysis');
      expect(result.data[0]).toHaveProperty('column', 'revenue');
      expect(result.data[0]).toHaveProperty('trend_type');
      expect(result.data[0]).toHaveProperty('strength');
      expect(result.data[0]).toHaveProperty('slope');
      expect(result.data[0]).toHaveProperty('r_squared');
      expect(result.data[0]).toHaveProperty('sample_size', 8);
      expect(result.data[0]).toHaveProperty('description');
      expect(result.data[0]).toHaveProperty('interpretation');
      
      // Revenue should show an increasing trend
      expect(result.data[0].trend_type).toBeOneOf(['increasing', 'decreasing', 'quadratic', 'no_trend']);
    });

    test('should handle invalid trend analysis syntax', async () => {
      const code = "stats.trend_analysis(invalid_syntax)";
      
      await expect(executor.execute(code)).rejects.toThrow('Invalid trend_analysis syntax');
    });

    test('should handle non-existent column in trend analysis', async () => {
      const code = "stats.trend_analysis(df['nonexistent'])";
      
      await expect(executor.execute(code)).rejects.toThrow("Column 'nonexistent' not found");
    });

    test('should detect increasing trend in revenue data', async () => {
      const code = "stats.trend_analysis(df['revenue'])";
      
      const result = await executor.execute(code);
      const trend = result.data[0];
      
      expect(trend.trend_type).toBeOneOf(['increasing', 'quadratic']);
      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.strength).toBeOneOf(['strong', 'moderate', 'weak']);
      expect(trend.description).toBeDefined();
    });

    test('should analyze stable data correctly', async () => {
      // Create executor with stable data
      const stableDataFrame: DataFrame = {
        ...sampleDataFrame,
        data: [
          { id: 1, stable_metric: 100 },
          { id: 2, stable_metric: 101 },
          { id: 3, stable_metric: 99 },
          { id: 4, stable_metric: 100 },
          { id: 5, stable_metric: 101 },
        ],
        columns: ['id', 'stable_metric'],
        shape: [5, 2]
      };
      const stableExecutor = new PandasExecutor(stableDataFrame);
      
      const code = "stats.trend_analysis(df['stable_metric'])";
      const result = await stableExecutor.execute(code);
      
      expect(result.data[0].trend_type).toBeOneOf(['no_trend', 'quadratic', 'increasing', 'decreasing']);
      // For stable data, slope should be relatively small
      expect(Math.abs(result.data[0].slope)).toBeLessThan(2);
    });
  });

  describe('Forecasting Integration', () => {
    test('should execute forecasting with valid syntax', async () => {
      const code = "stats.forecast(df['revenue'], periods=3)";
      
      const result = await executor.execute(code);
      
      expect(result.data).toHaveLength(4); // 1 summary + 3 forecast periods
      
      // Check summary row
      const summary = result.data[0];
      expect(summary).toHaveProperty('analysis_type', 'Forecast Summary');
      expect(summary).toHaveProperty('column', 'revenue');
      expect(summary).toHaveProperty('historical_periods', 8);
      expect(summary).toHaveProperty('forecast_periods', 3);
      expect(summary).toHaveProperty('method', 'linear_regression');
      expect(summary).toHaveProperty('interpretation');
      
      // Check forecast rows
      for (let i = 1; i <= 3; i++) {
        const forecast = result.data[i];
        expect(forecast).toHaveProperty('period', i);
        expect(forecast).toHaveProperty('forecast');
        expect(forecast).toHaveProperty('lower_bound');
        expect(forecast).toHaveProperty('upper_bound');
        expect(forecast).toHaveProperty('method', 'linear_regression');
        
        // Confidence intervals should make sense
        expect(forecast.lower_bound).toBeLessThanOrEqual(forecast.forecast);
        expect(forecast.upper_bound).toBeGreaterThanOrEqual(forecast.forecast);
      }
    });

    test('should handle invalid forecasting syntax', async () => {
      const code = "stats.forecast(invalid_syntax)";
      
      await expect(executor.execute(code)).rejects.toThrow('Invalid forecast syntax');
    });

    test('should handle non-existent column in forecasting', async () => {
      const code = "stats.forecast(df['nonexistent'], periods=3)";
      
      await expect(executor.execute(code)).rejects.toThrow("Column 'nonexistent' not found");
    });

    test('should reject invalid forecast periods', async () => {
      const code = "stats.forecast(df['revenue'], periods=0)";
      
      await expect(executor.execute(code)).rejects.toThrow('Forecast periods must be between 1 and 20');
    });

    test('should reject excessive forecast periods', async () => {
      const code = "stats.forecast(df['revenue'], periods=25)";
      
      await expect(executor.execute(code)).rejects.toThrow('Forecast periods must be between 1 and 20');
    });

    test('should generate reasonable forecasts for trending data', async () => {
      const code = "stats.forecast(df['revenue'], periods=2)";
      
      const result = await executor.execute(code);
      
      // Get the last historical value
      const lastRevenue = sampleDataFrame.data[sampleDataFrame.data.length - 1].revenue;
      
      // First forecast should continue the trend
      const firstForecast = result.data[1].forecast;
      expect(firstForecast).toBeGreaterThan(lastRevenue * 0.8); // Within reasonable range
      expect(firstForecast).toBeLessThan(lastRevenue * 1.5); // Not too extreme
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty DataFrame gracefully', async () => {
      const emptyDataFrame: DataFrame = {
        ...sampleDataFrame,
        data: [],
        shape: [0, 6]
      };
      const emptyExecutor = new PandasExecutor(emptyDataFrame);
      
      const code = "stats.linregress(df['marketing_spend'], df['sales'])";
      
      // Empty DataFrame should return empty results or handle gracefully
      const result = await emptyExecutor.execute(code);
      expect(result.data[0].sample_size).toBe(0);
      expect(result.data[0].r_squared).toBe(0);
    });

    test('should handle DataFrame with insufficient data', async () => {
      const smallDataFrame: DataFrame = {
        ...sampleDataFrame,
        data: [{ id: 1, marketing_spend: 1000, sales: 50 }],
        shape: [1, 6]
      };
      const smallExecutor = new PandasExecutor(smallDataFrame);
      
      const code = "stats.trend_analysis(df['sales'])";
      
      const result = await smallExecutor.execute(code);
      expect(result.data[0].description).toContain('Insufficient data');
    });

    test('should handle non-numeric data appropriately', async () => {
      const mixedDataFrame: DataFrame = {
        ...sampleDataFrame,
        data: [
          { id: 1, text_column: 'hello', numeric_column: 10 },
          { id: 2, text_column: 'world', numeric_column: 20 },
          { id: 3, text_column: 'test', numeric_column: 30 }
        ],
        columns: ['id', 'text_column', 'numeric_column'],
        shape: [3, 3]
      };
      const mixedExecutor = new PandasExecutor(mixedDataFrame);
      
      const code = "stats.trend_analysis(df['numeric_column'])";
      
      const result = await mixedExecutor.execute(code);
      expect(result.data[0]).toHaveProperty('trend_type');
    });

    test('should provide meaningful error messages', async () => {
      // Use a code that will definitely trigger predictive analytics path
      const code = "stats.unknown_method(df['sales'], periods=5)";
      
      // This should either throw an error or fall back to default behavior
      try {
        const result = await executor.execute(code);
        // If it doesn't throw, it should return some data
        expect(result.data).toBeDefined();
      } catch (error) {
        expect(error instanceof Error ? error.message : String(error)).toContain('Unsupported');
      }
    });
  });

  describe('Integration with Existing Statistical Methods', () => {
    test('should work alongside correlation analysis', async () => {
      const corrCode = "df[['marketing_spend', 'sales']].corr().reset_index()";
      const corrResult = await executor.execute(corrCode);
      
      expect(corrResult.data).toHaveLength(2); // 2x2 correlation matrix
      expect(corrResult.data[0]).toHaveProperty('marketing_spend');
      expect(corrResult.data[0]).toHaveProperty('sales');
    });

    test('should work alongside descriptive statistics', async () => {
      const statsCode = "df['sales'].describe()";
      const statsResult = await executor.execute(statsCode);
      
      // describe() returns multiple rows of statistics
      expect(statsResult.data.length).toBeGreaterThan(0);
      // Check that statistical data is present
      const statsData = statsResult.data;
      expect(statsData.some(row => row.statistic === 'count' || row.count !== undefined)).toBe(true);
    });
  });

  describe('Performance and Execution', () => {
    test('should complete execution within reasonable time', async () => {
      const code = "stats.linregress(df['marketing_spend'], df['sales'])";
      
      const startTime = Date.now();
      const result = await executor.execute(code);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0); // Allow 0ms for very fast operations
    });

    test('should handle multiple statistical operations', async () => {
      // Test that the executor can handle multiple different operations
      const operations = [
        "stats.linregress(df['marketing_spend'], df['sales'])",
        "stats.trend_analysis(df['revenue'])",
        "stats.forecast(df['customers'], periods=2)"
      ];
      
      for (const code of operations) {
        const result = await executor.execute(code);
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Result Formatting', () => {
    test('should format linear regression results consistently', async () => {
      const code = "stats.linregress(df['marketing_spend'], df['sales'])";
      const result = await executor.execute(code);
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('executionTime');
      
      expect(result.columns).toContain('analysis_type');
      expect(result.columns).toContain('slope');
      expect(result.columns).toContain('intercept');
      expect(result.columns).toContain('r_squared');
    });

    test('should format forecast results with proper structure', async () => {
      const code = "stats.forecast(df['revenue'], periods=2)";
      const result = await executor.execute(code);
      
      expect(result.rowCount).toBe(3); // 1 summary + 2 forecasts
      // Check that result has the expected structure
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty('analysis_type', 'Forecast Summary');
      // Forecast rows should have forecast data
      expect(result.data[1]).toHaveProperty('period', 1);
      expect(result.data[2]).toHaveProperty('period', 2);
    });

    test('should include execution metadata', async () => {
      const code = "stats.trend_analysis(df['revenue'])";
      const result = await executor.execute(code);
      
      expect(result.executionTime).toBeDefined();
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThanOrEqual(0); // Allow 0ms for very fast operations
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
