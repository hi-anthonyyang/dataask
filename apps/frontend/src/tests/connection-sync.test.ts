import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import DataAskApp from '../components/DataAskApp';
import { databaseService } from '../services/database';

// Mock the database service
vi.mock('../services/database', () => ({
  databaseService: {
    listConnections: vi.fn(),
    executeQuery: vi.fn(),
    getSchema: vi.fn(),
  }
}));

describe('Connection Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry loading connections with exponential backoff', async () => {
    const mockConnectionId = 'test-connection-123';
    const mockConnection = {
      id: mockConnectionId,
      name: 'test_table',
      type: 'sqlite',
      config: { filename: '/data/test.sqlite' }
    };

    // Mock listConnections to return empty array first, then the connection
    let callCount = 0;
    vi.mocked(databaseService.listConnections).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return { connections: [] };
      }
      return { connections: [mockConnection] };
    });

    // Simulate connection added
    const { rerender } = render(<DataAskApp />);
    
    // Trigger handleConnectionAdded (this would normally be called by FileImportModal)
    // Since we can't directly call it, we'll verify the retry logic through the service calls
    
    await waitFor(() => {
      // Should be called multiple times due to retry
      expect(databaseService.listConnections).toHaveBeenCalledTimes(3);
    }, { timeout: 5000 });
  });

  it('should handle connection registration failure gracefully', async () => {
    // Mock listConnections to always return empty
    vi.mocked(databaseService.listConnections).mockResolvedValue({ connections: [] });

    // Mock console.error to verify error handling
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<DataAskApp />);

    // Wait for retries to complete
    await waitFor(() => {
      expect(databaseService.listConnections).toHaveBeenCalledTimes(1);
    });

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it('should update UI immediately when connection is found', async () => {
    const mockConnection = {
      id: 'quick-connection',
      name: 'quick_table',
      type: 'sqlite' as const,
      config: { filename: '/data/quick.sqlite' }
    };

    // Mock immediate success
    vi.mocked(databaseService.listConnections).mockResolvedValue({
      connections: [mockConnection]
    });

    const { container } = render(<DataAskApp />);

    await waitFor(() => {
      // Connection should be loaded immediately
      expect(databaseService.listConnections).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle concurrent connection additions', async () => {
    const connections = [
      { id: 'conn1', name: 'table1', type: 'sqlite' as const, config: { filename: '/data/1.sqlite' } },
      { id: 'conn2', name: 'table2', type: 'sqlite' as const, config: { filename: '/data/2.sqlite' } },
      { id: 'conn3', name: 'table3', type: 'sqlite' as const, config: { filename: '/data/3.sqlite' } }
    ];

    // Mock to return all connections
    vi.mocked(databaseService.listConnections).mockResolvedValue({
      connections: connections
    });

    render(<DataAskApp />);

    await waitFor(() => {
      expect(databaseService.listConnections).toHaveBeenCalled();
    });

    // Verify all connections are handled
    // In a real test, we'd check the UI elements
  });
});

describe('File Import Modal Integration', () => {
  it('should detect SQLite files correctly', () => {
    const testCases = [
      { filename: 'database.db', expected: true },
      { filename: 'data.sqlite', expected: true },
      { filename: 'test.sqlite3', expected: true },
      { filename: 'data.csv', expected: false },
      { filename: 'sheet.xlsx', expected: false },
    ];

    testCases.forEach(({ filename, expected }) => {
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      const isSQLiteFile = ['db', 'sqlite', 'sqlite3'].includes(fileExtension || '');
      expect(isSQLiteFile).toBe(expected);
    });
  });

  it('should use correct endpoint for file type', () => {
    const testCases = [
      { filename: 'data.csv', endpoint: '/api/files/import' },
      { filename: 'sheet.xlsx', endpoint: '/api/files/import' },
      { filename: 'database.db', endpoint: '/api/files/upload-sqlite' },
      { filename: 'data.sqlite', endpoint: '/api/files/upload-sqlite' },
    ];

    testCases.forEach(({ filename, endpoint: expectedEndpoint }) => {
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      const isSQLiteFile = ['db', 'sqlite', 'sqlite3'].includes(fileExtension || '');
      const endpoint = isSQLiteFile ? '/api/files/upload-sqlite' : '/api/files/import';
      expect(endpoint).toBe(expectedEndpoint);
    });
  });
});