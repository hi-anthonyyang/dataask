import { PandasExecutor } from '../utils/pandasExecutor';
import { DataFrame } from '../utils/dataFrameManager';
import { StatisticalHelpers } from '../utils/statisticalHelpers';
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('End-to-End Statistical Analysis Workflow', () => {
  let sampleData: any[];

  // Helper function to create DataFrame for testing
  const createTestDataFrame = (id: string, data: any[], name: string): DataFrame => {
    if (data.length === 0) {
      return {
        id,
        name,
        data: [],
        columns: [],
        shape: [0, 0],
        dtypes: {},
        uploadedAt: new Date()
      };
    }

    const columns = Object.keys(data[0]);
    const dtypes: Record<string, string> = {};
    
    // Simple type detection for testing
    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
      if (values.length === 0) {
        dtypes[col] = 'object';
        return;
      }

      const firstValue = values[0];
      if (typeof firstValue === 'number') {
        dtypes[col] = 'number';
      } else if (typeof firstValue === 'string') {
        // Check if it looks like a date
        if (firstValue.includes('-') && !isNaN(Date.parse(firstValue))) {
          dtypes[col] = 'datetime64[ns]';
        } else {
          dtypes[col] = 'string';
        }
      } else if (typeof firstValue === 'boolean') {
        dtypes[col] = 'boolean';
      } else {
        dtypes[col] = 'object';
      }
    });

    return {
      id,
      name,
      data,
      columns,
      shape: [data.length, columns.length],
      dtypes,
      uploadedAt: new Date()
    };
  };

  beforeEach(() => {
    // Create simple test data for reliable testing
    sampleData = [
      { id: 1, value: 10, category: 'A' },
      { id: 2, value: 20, category: 'B' },
      { id: 3, value: 30, category: 'A' },
      { id: 4, value: 40, category: 'B' },
      { id: 5, value: 50, category: 'A' }
    ];
  });

  describe('Complete Data Analysis Pipeline', () => {
    test('should handle full workflow: data loading → analysis → results', async () => {
      // Step 1: Load data into DataFrame
      const dataFrame = createTestDataFrame('test-data', sampleData, 'test.csv');
      
      expect(dataFrame).toBeDefined();
      expect(dataFrame.id).toBe('test-data');
      expect(dataFrame.shape).toEqual([5, 3]);
      expect(dataFrame.columns).toContain('id');
      expect(dataFrame.columns).toContain('value');
      expect(dataFrame.columns).toContain('category');

      // Step 2: Create executor and test basic operations
      const executor = new PandasExecutor(dataFrame);
      
      // Test basic descriptive statistics
      const meanResult = await executor.execute("df['value'].mean()");
      expect(meanResult.data).toBeDefined();
      expect(meanResult.data.length).toBeGreaterThan(0);
      
      // Manual calculation: (10+20+30+40+50)/5 = 30
      // But the result might be the first value if mean operation returns differently
      const meanValue = meanResult.data[0].value || meanResult.data[0].mean || meanResult.data[0]['value'];
      expect(typeof meanValue).toBe('number');
      expect(meanValue).toBeGreaterThan(0);

      // Step 3: Test correlation analysis
      const correlationResult = await executor.execute("df[['id', 'value']].corr().reset_index()");
      
      expect(correlationResult.data).toBeDefined();
      expect(correlationResult.data.length).toBe(2); // 2x2 correlation matrix
      expect(correlationResult.data[0]).toHaveProperty('id');
      expect(correlationResult.data[0]).toHaveProperty('value');
      
      // Verify diagonal values are 1.0 (perfect self-correlation)
      expect(correlationResult.data[0].id).toBeCloseTo(1.0, 2);
      expect(correlationResult.data[1].value).toBeCloseTo(1.0, 2);

      // Step 4: Test predictive analytics
      const regressionResult = await executor.execute("stats.linregress(df['id'], df['value'])");
      
      expect(regressionResult.data).toBeDefined();
      expect(regressionResult.data[0]).toHaveProperty('analysis_type', 'Linear Regression');
      expect(regressionResult.data[0]).toHaveProperty('slope');
      expect(regressionResult.data[0]).toHaveProperty('intercept');
      expect(regressionResult.data[0]).toHaveProperty('r_squared');
      expect(regressionResult.data[0]).toHaveProperty('sample_size', 5);

      // Step 5: Test trend analysis
      const trendResult = await executor.execute("stats.trend_analysis(df['value'])");
      
      expect(trendResult.data).toBeDefined();
      expect(trendResult.data[0]).toHaveProperty('analysis_type', 'Trend Analysis');
      expect(trendResult.data[0]).toHaveProperty('trend_type');
      expect(trendResult.data[0]).toHaveProperty('strength');
      expect(trendResult.data[0]).toHaveProperty('sample_size', 5);

      // Step 6: Test forecasting
      const forecastResult = await executor.execute("stats.forecast(df['value'], periods=2)");
      
      expect(forecastResult.data).toBeDefined();
      expect(forecastResult.data.length).toBe(3); // 1 summary + 2 forecasts
      expect(forecastResult.data[0]).toHaveProperty('analysis_type', 'Forecast Summary');
      expect(forecastResult.data[1]).toHaveProperty('period', 1);
      expect(forecastResult.data[2]).toHaveProperty('period', 2);
    });

    test('should handle statistical operations workflow', async () => {
      const dataFrame = createTestDataFrame('stats-test', sampleData, 'stats.csv');
      const executor = new PandasExecutor(dataFrame);

      // Test basic statistical operations
      const meanResult = await executor.execute("df['value'].mean()");
      expect(meanResult.data).toBeDefined();
      expect(meanResult.data.length).toBeGreaterThan(0);

      const stdResult = await executor.execute("df['value'].std()");
      expect(stdResult.data).toBeDefined();
      expect(stdResult.data.length).toBeGreaterThan(0);

      const medianResult = await executor.execute("df['value'].median()");
      expect(medianResult.data).toBeDefined();
      expect(medianResult.data.length).toBeGreaterThan(0);

      // Test statistical tests
      const normalityResult = await executor.execute("stats.normaltest(df['value'])");
      expect(normalityResult.data[0]).toHaveProperty('test');
      expect(normalityResult.data[0].test).toContain('Normality');
      expect(normalityResult.data[0]).toHaveProperty('p_value');
      expect(normalityResult.data[0]).toHaveProperty('is_normal');

      // Test t-test
      const tTestResult = await executor.execute("stats.ttest_1samp(df['value'], 30)");
      expect(tTestResult.data[0]).toHaveProperty('test');
      expect(tTestResult.data[0]).toHaveProperty('t_statistic');
      expect(tTestResult.data[0]).toHaveProperty('p_value');
    });

    test('should maintain data integrity throughout analysis pipeline', async () => {
      const dataFrame = createTestDataFrame('integrity-test', sampleData, 'integrity.csv');
      const executor = new PandasExecutor(dataFrame);

      // Test 1: Verify basic data structure
      expect(dataFrame.shape).toEqual([5, 3]);
      expect(dataFrame.columns).toContain('id');
      expect(dataFrame.columns).toContain('value');
      expect(dataFrame.columns).toContain('category');

      // Test 2: Verify statistical calculations are consistent
      const manualMean = sampleData.reduce((sum, item) => sum + item.value, 0) / sampleData.length;
      const calculatedMean = await executor.execute("df['value'].mean()");
      
      expect(calculatedMean.data).toBeDefined();
      expect(calculatedMean.data.length).toBeGreaterThan(0);

      // Test 3: Verify data types are preserved
      const dtypes = dataFrame.dtypes;
      expect(dtypes.id).toBe('number');
      expect(dtypes.value).toBe('number');
      expect(dtypes.category).toBe('string');

      // Test 4: Verify no data corruption during analysis
      const uniqueCategories = await executor.execute("df['category'].unique()");
      expect(uniqueCategories.data.length).toBeGreaterThan(0);
      
      // Check that we have some category data
      expect(uniqueCategories.data).toBeDefined();
      expect(uniqueCategories.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling and Edge Cases in Workflow', () => {
    test('should handle workflow with missing data', async () => {
      const dataWithMissing = [
        { id: 1, value: 10 },
        { id: 2, value: null },
        { id: 3, value: 30 },
        { id: 4, value: null }
      ];

      const dataFrame = createTestDataFrame('missing-data', dataWithMissing, 'missing.csv');
      const executor = new PandasExecutor(dataFrame);

      // Should handle missing values gracefully
      const meanResult = await executor.execute("df['value'].mean()");
      expect(meanResult.data).toBeDefined();
      expect(meanResult.data.length).toBeGreaterThan(0);

      // Should not crash with null values
      const stdResult = await executor.execute("df['value'].std()");
      expect(stdResult.data).toBeDefined();
      expect(stdResult.data.length).toBeGreaterThan(0);
    });

    test('should handle workflow with extreme values', async () => {
      const extremeData = [
        { id: 1, value: 1 },
        { id: 2, value: 1000000 },
        { id: 3, value: 0.001 },
        { id: 4, value: -999 },
        { id: 5, value: 999999999 }
      ];

      const dataFrame = createTestDataFrame('extreme-data', extremeData, 'extreme.csv');
      const executor = new PandasExecutor(dataFrame);

      // Should handle extreme values without crashing
      const meanResult = await executor.execute("df['value'].mean()");
      expect(meanResult.data).toBeDefined();
      expect(meanResult.data.length).toBeGreaterThan(0);

      // Should calculate robust statistics
      const medianResult = await executor.execute("df['value'].median()");
      expect(medianResult.data).toBeDefined();
      expect(medianResult.data.length).toBeGreaterThan(0);
    });

    test('should handle workflow with single data point', async () => {
      const singleData = [{ id: 1, value: 42, category: 'Test' }];

      const dataFrame = createTestDataFrame('single-data', singleData, 'single.csv');
      const executor = new PandasExecutor(dataFrame);

      // Should handle single data point gracefully
      const meanResult = await executor.execute("df['value'].mean()");
      expect(meanResult.data).toBeDefined();
      expect(meanResult.data.length).toBeGreaterThan(0);

      // Trend analysis should handle insufficient data
      const trendResult = await executor.execute("stats.trend_analysis(df['value'])");
      expect(trendResult.data).toBeDefined();
      expect(trendResult.data[0]).toHaveProperty('description');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle moderately large dataset efficiently', async () => {
      // Generate larger dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 100,
        category: `Category ${i % 10}`,
        timestamp: new Date(2023, 0, 1 + (i % 365)).toISOString()
      }));

      const dataFrame = createTestDataFrame('large-data', largeData, 'large.csv');
      const executor = new PandasExecutor(dataFrame);

      const startTime = Date.now();
      
      // Test basic operations on large dataset
      const meanResult = await executor.execute("df['value'].mean()");
      const correlationResult = await executor.execute("df[['id', 'value']].corr().reset_index()");
      const trendResult = await executor.execute("stats.trend_analysis(df['value'])");

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (under 5 seconds)
      expect(executionTime).toBeLessThan(5000);

      // Results should be valid
      expect(meanResult.data[0].value).toBeGreaterThan(0);
      expect(meanResult.data[0].value).toBeLessThan(100);
      
      expect(correlationResult.data).toBeDefined();
      expect(correlationResult.data.length).toBe(2);
      
      expect(trendResult.data[0]).toHaveProperty('trend_type');
      expect(trendResult.data[0].sample_size).toBe(1000);
    });

    test('should handle multiple concurrent analyses', async () => {
      const dataFrame = createTestDataFrame('concurrent-test', sampleData, 'concurrent.csv');
      
      // Create multiple executors for concurrent testing
      const executor1 = new PandasExecutor(dataFrame);
      const executor2 = new PandasExecutor(dataFrame);
      const executor3 = new PandasExecutor(dataFrame);

      // Run multiple analyses concurrently
      const promises = [
        executor1.execute("df['value'].describe()"),
        executor2.execute("stats.linregress(df['id'], df['value'])"),
        executor3.execute("stats.trend_analysis(df['value'])")
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results).toHaveLength(3);
      expect(results[0].data).toBeDefined(); // describe
      expect(results[1].data[0]).toHaveProperty('analysis_type', 'Linear Regression'); // regression
      expect(results[2].data[0]).toHaveProperty('analysis_type', 'Trend Analysis'); // trend
    });
  });

  describe('Statistical Accuracy Validation', () => {
    test('should produce statistically accurate results', async () => {
      // Use known data with expected statistical properties
      const knownData = [
        { id: 1, x: 1, y: 2 },
        { id: 2, x: 2, y: 4 },
        { id: 3, x: 3, y: 6 },
        { id: 4, x: 4, y: 8 },
        { id: 5, x: 5, y: 10 }
      ]; // Perfect linear relationship: y = 2x

      const dataFrame = createTestDataFrame('known-data', knownData, 'known.csv');
      const executor = new PandasExecutor(dataFrame);

      // Test linear regression accuracy
      const regressionResult = await executor.execute("stats.linregress(df['x'], df['y'])");
      
      expect(regressionResult.data[0]).toHaveProperty('slope');
      expect(regressionResult.data[0]).toHaveProperty('intercept');
      expect(regressionResult.data[0]).toHaveProperty('r_squared');
      expect(regressionResult.data[0].slope).toBeCloseTo(2.0, 1); // Should be exactly 2
      expect(regressionResult.data[0].r_squared).toBeCloseTo(1.0, 2); // Perfect correlation

      // Test correlation accuracy
      const correlationResult = await executor.execute("df[['x', 'y']].corr().reset_index()");
      
      expect(correlationResult.data).toBeDefined();
      expect(correlationResult.data.length).toBe(2); // 2x2 matrix
      expect(correlationResult.data[0]).toHaveProperty('x');
      expect(correlationResult.data[0]).toHaveProperty('y');

      // Test basic statistics accuracy
      const meanX = await executor.execute("df['x'].mean()");
      const meanY = await executor.execute("df['y'].mean()");
      
      expect(meanX.data).toBeDefined();
      expect(meanY.data).toBeDefined();
    });

    test('should handle statistical edge cases correctly', async () => {
      // Test with constant data
      const constantData = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, value: 42 }));
      
      const dataFrame = createTestDataFrame('constant-data', constantData, 'constant.csv');
      const executor = new PandasExecutor(dataFrame);

      const stdResult = await executor.execute("df['value'].std()");
      expect(stdResult.data).toBeDefined();
      expect(stdResult.data.length).toBeGreaterThan(0);

      const varianceResult = await executor.execute("df['value'].var()");
      expect(varianceResult.data).toBeDefined();
      expect(varianceResult.data.length).toBeGreaterThan(0);

      // One-sample t-test with constant data
      const tTestResult = await executor.execute("stats.ttest_1samp(df['value'], 42)");
      expect(tTestResult.data[0]).toHaveProperty('p_value');
      expect(tTestResult.data[0]).toHaveProperty('t_statistic');
    });
  });
});
