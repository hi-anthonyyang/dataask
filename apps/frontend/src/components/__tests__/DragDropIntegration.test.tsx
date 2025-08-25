import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import DataToken from '../DataToken';

// Mock DragEvent for testing environment
global.DragEvent = class DragEvent extends Event {
  dataTransfer: any;
  
  constructor(type: string, eventInitDict?: DragEventInit) {
    super(type, eventInitDict);
    this.dataTransfer = null;
  }
} as any;

describe('Drag and Drop Integration', () => {
  describe('Drag and Drop Event Handling', () => {
    test('should create proper drag events', () => {
      // Test drag event creation and data transfer
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
      const mockDataTransfer = {
        setData: vi.fn(),
        getData: vi.fn(),
        effectAllowed: '',
        setDragImage: vi.fn()
      };
      
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });

      expect(dragStartEvent.type).toBe('dragstart');
      expect(dragStartEvent.bubbles).toBe(true);
      expect(dragStartEvent.dataTransfer).toBeDefined();
    });

    test('should handle drop events with proper data format', () => {
      const dropEvent = new DragEvent('drop', { bubbles: true });
      const testTokenData = {
        columnName: 'sales',
        dataframeName: 'test_data.csv',
        columnType: 'float64'
      };

      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify(testTokenData))
      };

      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });

      const retrievedData = JSON.parse(dropEvent.dataTransfer!.getData('application/json'));
      
      expect(retrievedData).toEqual(testTokenData);
      expect(retrievedData.columnName).toBe('sales');
      expect(retrievedData.dataframeName).toBe('test_data.csv');
      expect(retrievedData.columnType).toBe('float64');
    });

    test('should handle invalid JSON data gracefully', () => {
      const dropEvent = new DragEvent('drop', { bubbles: true });
      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue('invalid json data')
      };

      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: false
      });

      expect(() => {
        try {
          JSON.parse(dropEvent.dataTransfer!.getData('application/json'));
        } catch (error) {
          // This should throw - we're testing that we can catch it
          expect(error).toBeInstanceOf(SyntaxError);
          throw error;
        }
      }).toThrow();
    });
  });

  describe('DataToken Component', () => {
    test('should render data token with column name', () => {
      const tokenData = {
        columnName: 'sales',
        dataframeName: 'test_data.csv',
        columnType: 'float64'
      };

      render(<DataToken data={tokenData} />);

      expect(screen.getByText('sales')).toBeInTheDocument();
    });

    test('should display only column name, not full dataframe.column', () => {
      const tokenData = {
        columnName: 'revenue',
        dataframeName: 'financial_data.csv',
        columnType: 'float64'
      };

      render(<DataToken data={tokenData} />);

      // Should show only column name
      expect(screen.getByText('revenue')).toBeInTheDocument();
      // Should not show full dataframe.column format
      expect(screen.queryByText('financial_data.csv.revenue')).not.toBeInTheDocument();
    });

    test('should handle different column types appropriately', () => {
      const textTokenData = {
        columnName: 'category',
        dataframeName: 'test_data.csv',
        columnType: 'object'
      };

      const { rerender } = render(<DataToken data={textTokenData} />);
      expect(screen.getByText('category')).toBeInTheDocument();

      const dateTokenData = {
        columnName: 'created_at',
        dataframeName: 'test_data.csv',
        columnType: 'datetime64[ns]'
      };

      rerender(<DataToken data={dateTokenData} />);
      expect(screen.getByText('created_at')).toBeInTheDocument();
    });

    test('should handle empty token data gracefully', () => {
      const emptyTokenData = {
        columnName: '',
        dataframeName: '',
        columnType: ''
      };

      render(<DataToken data={emptyTokenData} />);

      // Should render without crashing, even with empty data
      const tokenElement = screen.getByTitle('.'); // The token has a title attribute
      expect(tokenElement).toBeInTheDocument();
    });

    test('should handle special characters in column names', () => {
      const specialTokenData = {
        columnName: 'sales_$_amount_#_2023',
        dataframeName: 'test_data.csv',
        columnType: 'float64'
      };

      render(<DataToken data={specialTokenData} />);

      expect(screen.getByText('sales_$_amount_#_2023')).toBeInTheDocument();
    });
  });

  describe('Token Data Structure', () => {
    test('should validate token data format', () => {
      const validTokenData = {
        columnName: 'sales',
        dataframeName: 'test_data.csv',
        columnType: 'float64'
      };

      // Test that all required properties exist
      expect(validTokenData).toHaveProperty('columnName');
      expect(validTokenData).toHaveProperty('dataframeName');
      expect(validTokenData).toHaveProperty('columnType');

      // Test data types
      expect(typeof validTokenData.columnName).toBe('string');
      expect(typeof validTokenData.dataframeName).toBe('string');
      expect(typeof validTokenData.columnType).toBe('string');
    });

    test('should handle various column types', () => {
      const columnTypes = [
        'int64',
        'float64',
        'object',
        'datetime64[ns]',
        'bool',
        'category'
      ];

      columnTypes.forEach((type, index) => {
        const tokenData = {
          columnName: `test_column_${index}`, // Make column names unique
          dataframeName: 'test.csv',
          columnType: type
        };

        const { container } = render(<DataToken data={tokenData} />);
        expect(screen.getByText(`test_column_${index}`)).toBeInTheDocument();
        
        // Clean up the rendered component
        container.remove();
      });
    });
  });
});
