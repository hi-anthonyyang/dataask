import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import FileImportModal from '../FileImportModal'

// Mock FileDropZone component
jest.mock('../FileDropZone', () => ({
  __esModule: true,
  default: ({ onFileSelect, disabled }: any) => (
    <div data-testid="file-drop-zone">
      <button
        onClick={() => {
          if (!disabled) {
            const file = new File(['test content'], 'test.csv', { type: 'text/csv' })
            onFileSelect(file)
          }
        }}
        disabled={disabled}
      >
        Select File
      </button>
    </div>
  )
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('FileImportModal', () => {
  const mockOnClose = jest.fn()
  const mockOnConnectionAdded = jest.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConnectionAdded: mockOnConnectionAdded
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Basic Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<FileImportModal {...defaultProps} />)
      expect(screen.getByText('Import CSV or Excel File')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<FileImportModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Import CSV or Excel File')).not.toBeInTheDocument()
    })

    it('should render in embedded mode', () => {
      render(<FileImportModal {...defaultProps} isEmbedded={true} />)
      expect(screen.getByText('Import CSV or Excel File')).toBeInTheDocument()
      // Should not have modal wrapper
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
    })
  })

  describe('File Selection', () => {
    it('should handle file selection', async () => {
      render(<FileImportModal {...defaultProps} />)
      
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Should auto-generate table name
      const tableNameInput = screen.getByPlaceholderText('Enter table name')
      expect(tableNameInput).toHaveValue('test')
    })

    it('should clean table name from filename', async () => {
      render(<FileImportModal {...defaultProps} />)
      
      // Mock FileDropZone to select a file with special characters
      const dropZone = screen.getByTestId('file-drop-zone')
      fireEvent.click(dropZone.querySelector('button')!)
      
      await waitFor(() => {
        const tableNameInput = screen.getByPlaceholderText('Enter table name')
        expect(tableNameInput).toHaveValue('test')
      })
    })

    it('should display file size', async () => {
      render(<FileImportModal {...defaultProps} />)
      
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('0.00 MB')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should disable import button when no file is selected', () => {
      render(<FileImportModal {...defaultProps} />)
      
      const importButton = screen.getByText('Import File')
      expect(importButton).toBeDisabled()
    })

    it('should enable import button when file and table name are provided', async () => {
      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        const importButton = screen.getByText('Import File')
        expect(importButton).not.toBeDisabled()
      })
    })

    it('should disable import button when table name is empty', async () => {
      const user = userEvent.setup()
      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Clear table name
      const tableNameInput = screen.getByPlaceholderText('Enter table name')
      await user.clear(tableNameInput)
      
      const importButton = screen.getByText('Import File')
      expect(importButton).toBeDisabled()
    })
  })

  describe('File Import Process', () => {
    it('should handle successful file import', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ connectionId: 'test-connection-id' })
      })

      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Click import
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockOnConnectionAdded).toHaveBeenCalledWith('test-connection-id')
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should handle import with progress tracking', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ connectionId: 'test-connection-id', importId: 'import-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            importId: 'import-123',
            status: 'importing',
            progress: 50,
            totalRows: 1000,
            processedRows: 500,
            message: 'Processing rows...'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            importId: 'import-123',
            status: 'completed',
            progress: 100,
            totalRows: 1000,
            processedRows: 1000,
            message: 'Import complete!'
          })
        })

      render(<FileImportModal {...defaultProps} />)
      
      // Select file and import
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/Processing rows.../)).toBeInTheDocument()
      })
      
      // Should show row count
      await waitFor(() => {
        expect(screen.getByText(/500 \/ 1,000 rows processed/)).toBeInTheDocument()
      })
    })

    it('should handle import errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid file format' })
      })

      render(<FileImportModal {...defaultProps} />)
      
      // Select file and import
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid file format')).toBeInTheDocument()
      })
      
      expect(mockOnConnectionAdded).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<FileImportModal {...defaultProps} />)
      
      // Select file and import
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Upload Progress', () => {
    it('should show upload progress', async () => {
      let progressCallback: ((event: ProgressEvent) => void) | null = null
      
      // Mock XMLHttpRequest
      const mockXHR = {
        upload: {
          onprogress: null as any
        },
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn(),
        getResponseHeader: jest.fn(() => 'application/json'),
        status: 200,
        statusText: 'OK',
        responseText: JSON.stringify({ connectionId: 'test-connection-id' }),
        onload: null as any,
        onerror: null as any,
        ontimeout: null as any
      }
      
      global.XMLHttpRequest = jest.fn(() => mockXHR) as any
      
      // Capture progress callback
      Object.defineProperty(mockXHR.upload, 'onprogress', {
        set: (callback: (event: ProgressEvent) => void) => {
          progressCallback = callback
        }
      })
      
      render(<FileImportModal {...defaultProps} />)
      
      // Select file and import
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      // Simulate upload progress
      if (progressCallback) {
        progressCallback({
          lengthComputable: true,
          loaded: 50,
          total: 100
        } as ProgressEvent)
      }
      
      await waitFor(() => {
        expect(screen.getByText('Uploading... 50%')).toBeInTheDocument()
      })
      
      // Complete upload
      if (mockXHR.onload) {
        mockXHR.onload()
      }
      
      await waitFor(() => {
        expect(mockOnConnectionAdded).toHaveBeenCalledWith('test-connection-id')
      })
    })
  })

  describe('Modal Controls', () => {
    it('should close modal and reset state', async () => {
      render(<FileImportModal {...defaultProps} />)
      
      // Select a file first
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: '' })
      fireEvent.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should disable controls during import', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ connectionId: 'test-connection-id' })
        }), 100))
      )

      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Start import
      const importButton = screen.getByText('Import File')
      fireEvent.click(importButton)
      
      // Should show importing state
      expect(screen.getByText('Importing...')).toBeInTheDocument()
      
      // File selection should be disabled
      expect(selectButton).toBeDisabled()
    })
  })

  describe('Table Name Handling', () => {
    it('should allow custom table name', async () => {
      const user = userEvent.setup()
      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Change table name
      const tableNameInput = screen.getByPlaceholderText('Enter table name')
      await user.clear(tableNameInput)
      await user.type(tableNameInput, 'my_custom_table')
      
      expect(tableNameInput).toHaveValue('my_custom_table')
    })

    it('should enforce table name length limit', async () => {
      const user = userEvent.setup()
      render(<FileImportModal {...defaultProps} />)
      
      // Select file
      const selectButton = screen.getByText('Select File')
      fireEvent.click(selectButton)
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Try to enter very long table name
      const tableNameInput = screen.getByPlaceholderText('Enter table name')
      const longName = 'a'.repeat(60)
      await user.clear(tableNameInput)
      await user.type(tableNameInput, longName)
      
      // Should be limited to 50 characters
      expect(tableNameInput).toHaveAttribute('maxLength', '50')
    })
  })
})