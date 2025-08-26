import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import DataVisualizer from '../DataVisualizer';

// Mock recharts components to avoid rendering issues in tests
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Legend: () => <div data-testid="legend" />,
}));

// Mock copy service
vi.mock('../services/copy', () => ({
  copyChartAsImage: vi.fn(),
}));

describe('DataVisualizer', () => {
  const mockFields = [
    { name: 'id', type: 'numeric' },
    { name: 'category', type: 'text' },
    { name: 'value', type: 'numeric' },
  ];

  describe('Correlation Matrix Detection', () => {
    test('should detect and display correlation matrix correctly', () => {
      const correlationData = [
        { index: 'marketing_spend', marketing_spend: 1.0, sales: 0.85, revenue: 0.78 },
        { index: 'sales', marketing_spend: 0.85, sales: 1.0, revenue: 0.92 },
        { index: 'revenue', marketing_spend: 0.78, sales: 0.92, revenue: 1.0 }
      ];

      const correlationFields = [
        { name: 'index', type: 'text' },
        { name: 'marketing_spend', type: 'numeric' },
        { name: 'sales', type: 'numeric' },
        { name: 'revenue', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={correlationData}
          fields={correlationFields}
          currentQuery="correlation analysis"
        />
      );

      // Should display correlation matrix message
      expect(screen.getByText('Correlation Matrix')).toBeInTheDocument();
      expect(screen.getByText('Correlation coefficients between variables')).toBeInTheDocument();
      expect(screen.getByText('Correlation matrix detected - best displayed as a table')).toBeInTheDocument();
    });

    test('should not detect correlation matrix for regular data', () => {
      const regularData = [
        { category: 'A', value: 10, count: 5 },
        { category: 'B', value: 20, count: 8 },
        { category: 'C', value: 15, count: 6 }
      ];

      render(
        <DataVisualizer
          data={regularData}
          fields={mockFields}
          currentQuery="regular data visualization"
        />
      );

      // Should not display correlation matrix message
      expect(screen.queryByText('Correlation Matrix')).not.toBeInTheDocument();
      
      // Should render a chart instead
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should handle correlation matrix with different column orders', () => {
      const correlationData = [
        { variable: 'price', price: 1.0, sales: -0.65, profit: 0.23 },
        { variable: 'sales', price: -0.65, sales: 1.0, profit: 0.88 },
        { variable: 'profit', price: 0.23, sales: 0.88, profit: 1.0 }
      ];

      const correlationFields = [
        { name: 'variable', type: 'text' },
        { name: 'price', type: 'numeric' },
        { name: 'sales', type: 'numeric' },
        { name: 'profit', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={correlationData}
          fields={correlationFields}
          currentQuery="price correlation analysis"
        />
      );

      expect(screen.getByText('Correlation Matrix')).toBeInTheDocument();
      expect(screen.getByText('Correlation coefficients between variables')).toBeInTheDocument();
    });

    test('should not detect correlation matrix with insufficient data', () => {
      const insufficientData = [
        { index: 'sales', sales: 1.0 }
      ];

      const insufficientFields = [
        { name: 'index', type: 'text' },
        { name: 'sales', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={insufficientData}
          fields={insufficientFields}
          currentQuery="insufficient correlation data"
        />
      );

      expect(screen.queryByText('Correlation Matrix')).not.toBeInTheDocument();
    });

    test('should not detect correlation matrix without diagonal values of 1', () => {
      const nonCorrelationData = [
        { index: 'marketing_spend', marketing_spend: 0.8, sales: 0.85, revenue: 0.78 },
        { index: 'sales', marketing_spend: 0.85, sales: 0.9, revenue: 0.92 },
        { index: 'revenue', marketing_spend: 0.78, sales: 0.92, revenue: 0.95 }
      ];

      const nonCorrelationFields = [
        { name: 'index', type: 'text' },
        { name: 'marketing_spend', type: 'numeric' },
        { name: 'sales', type: 'numeric' },
        { name: 'revenue', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={nonCorrelationData}
          fields={nonCorrelationFields}
          currentQuery="non-correlation data"
        />
      );

      expect(screen.queryByText('Correlation Matrix')).not.toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Chart Type Detection', () => {
    test('should render chart for categorical data', () => {
      const categoricalData = [
        { category: 'Product A', sales: 100 },
        { category: 'Product B', sales: 150 },
        { category: 'Product C', sales: 80 }
      ];

      const categoricalFields = [
        { name: 'category', type: 'text' },
        { name: 'sales', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={categoricalData}
          fields={categoricalFields}
          currentQuery="product sales"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      // Component may choose different chart types based on data analysis
      expect(screen.queryByTestId('bar-chart') || screen.queryByTestId('line-chart')).toBeTruthy();
    });

    test('should render line chart for time series data', () => {
      const timeSeriesData = [
        { date: '2023-01-01', value: 100 },
        { date: '2023-02-01', value: 120 },
        { date: '2023-03-01', value: 110 }
      ];

      const timeSeriesFields = [
        { name: 'date', type: 'date' },
        { name: 'value', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={timeSeriesData}
          fields={timeSeriesFields}
          currentQuery="time series analysis"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should render chart for distribution data', () => {
      const distributionData = [
        { category: 'A', percentage: 40 },
        { category: 'B', percentage: 35 },
        { category: 'C', percentage: 25 }
      ];

      const distributionFields = [
        { name: 'category', type: 'text' },
        { name: 'percentage', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={distributionData}
          fields={distributionFields}
          currentQuery="market share distribution"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      // Component may choose different chart types based on data analysis
      expect(screen.queryByTestId('pie-chart') || screen.queryByTestId('line-chart')).toBeTruthy();
    });

    test('should handle single KPI value', () => {
      const kpiData = [
        { total_revenue: 1250000 }
      ];

      const kpiFields = [
        { name: 'total_revenue', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={kpiData}
          fields={kpiFields}
          currentQuery="total revenue KPI"
        />
      );

      // Should display the KPI value prominently
      expect(screen.getByText('1,250,000')).toBeInTheDocument();
      expect(screen.getByText('total_revenue')).toBeInTheDocument();
      expect(screen.getByText('Single metric value')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty data gracefully', () => {
      render(
        <DataVisualizer
          data={[]}
          fields={[]}
          currentQuery="empty data"
        />
      );

      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.getByText('No data available to visualize')).toBeInTheDocument();
    });

    test('should handle data with missing values', () => {
      const dataWithNulls = [
        { category: 'A', value: 10 },
        { category: 'B', value: null },
        { category: 'C', value: 15 }
      ];

      render(
        <DataVisualizer
          data={dataWithNulls}
          fields={mockFields}
          currentQuery="data with nulls"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should handle data with all text fields', () => {
      const textOnlyData = [
        { name: 'John', department: 'Sales' },
        { name: 'Jane', department: 'Marketing' },
        { name: 'Bob', department: 'Engineering' }
      ];

      const textOnlyFields = [
        { name: 'name', type: 'text' },
        { name: 'department', type: 'text' }
      ];

      render(
        <DataVisualizer
          data={textOnlyData}
          fields={textOnlyFields}
          currentQuery="text only data"
        />
      );

      // Should handle gracefully without crashing - text-only data shows "Not Visualizable"
      expect(screen.getByText('Not Visualizable')).toBeInTheDocument();
      expect(screen.getByText('This data works best as a table')).toBeInTheDocument();
    });

    test('should handle very large datasets', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
        category: `Category ${i % 10}`
      }));

      const largeDataFields = [
        { name: 'id', type: 'numeric' },
        { name: 'value', type: 'numeric' },
        { name: 'category', type: 'text' }
      ];

      render(
        <DataVisualizer
          data={largeData}
          fields={largeDataFields}
          currentQuery="large dataset"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    test('should format dates correctly', () => {
      const dateData = [
        { date: '2023-01-15T10:30:00Z', value: 100 },
        { date: '2023-02-15T11:45:00Z', value: 120 }
      ];

      const dateFields = [
        { name: 'date', type: 'date' },
        { name: 'value', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={dateData}
          fields={dateFields}
          currentQuery="date formatting test"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    test('should handle numeric formatting', () => {
      const numericData = [
        { category: 'A', revenue: 1234567.89, count: 1000 },
        { category: 'B', revenue: 2345678.12, count: 1500 }
      ];

      const numericFields = [
        { name: 'category', type: 'text' },
        { name: 'revenue', type: 'numeric' },
        { name: 'count', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={numericData}
          fields={numericFields}
          currentQuery="numeric formatting"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('Multi-series Data', () => {
    test('should handle multi-series time series data', () => {
      const multiSeriesData = [
        { date: '2023-01', category: 'Product A', value: 100 },
        { date: '2023-01', category: 'Product B', value: 120 },
        { date: '2023-02', category: 'Product A', value: 110 },
        { date: '2023-02', category: 'Product B', value: 130 }
      ];

      const multiSeriesFields = [
        { name: 'date', type: 'date' },
        { name: 'category', type: 'text' },
        { name: 'value', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={multiSeriesData}
          fields={multiSeriesFields}
          currentQuery="multi-series time series"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      // Phase 1 improvement: categorical data with few categories now uses bar chart
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('value by category and date')).toBeInTheDocument();
    });

    test('should handle grouped bar chart data', () => {
      const groupedData = [
        { category: 'Q1', sales: 100, marketing: 50 },
        { category: 'Q2', sales: 120, marketing: 60 },
        { category: 'Q3', sales: 110, marketing: 55 }
      ];

      const groupedFields = [
        { name: 'category', type: 'text' },
        { name: 'sales', type: 'numeric' },
        { name: 'marketing', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={groupedData}
          fields={groupedFields}
          currentQuery="quarterly comparison"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      // Component may choose different chart types based on data analysis
      expect(screen.queryByTestId('bar-chart') || screen.queryByTestId('line-chart')).toBeTruthy();
    });
  });

  describe('Accessibility and UX', () => {
    test('should provide meaningful alt text and labels', () => {
      const accessibilityData = [
        { category: 'Accessible', value: 85 },
        { category: 'Needs Improvement', value: 15 }
      ];

      render(
        <DataVisualizer
          data={accessibilityData}
          fields={mockFields}
          currentQuery="accessibility metrics"
        />
      );

      // Chart should be wrapped in responsive container
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should handle loading states gracefully', () => {
      render(
        <DataVisualizer
          data={[]}
          fields={[]}
          currentQuery="loading data"
        />
      );

      // Should not crash with empty data
      expect(screen.getByText('No Data')).toBeInTheDocument();
    });
  });

  describe('Query Context Integration', () => {
    test('should adapt visualization based on query context', () => {
      const salesData = [
        { month: 'Jan', sales: 1000 },
        { month: 'Feb', sales: 1200 },
        { month: 'Mar', sales: 1100 }
      ];

      const salesFields = [
        { name: 'month', type: 'text' },
        { name: 'sales', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={salesData}
          fields={salesFields}
          currentQuery="monthly sales trend"
        />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should handle correlation query context', () => {
      const correlationData = [
        { index: 'var1', var1: 1.0, var2: 0.75 },
        { index: 'var2', var1: 0.75, var2: 1.0 }
      ];

      const correlationFields = [
        { name: 'index', type: 'text' },
        { name: 'var1', type: 'numeric' },
        { name: 'var2', type: 'numeric' }
      ];

      render(
        <DataVisualizer
          data={correlationData}
          fields={correlationFields}
          currentQuery="correlation between variables"
        />
      );

      expect(screen.getByText('Correlation Matrix')).toBeInTheDocument();
    });
  });
});
