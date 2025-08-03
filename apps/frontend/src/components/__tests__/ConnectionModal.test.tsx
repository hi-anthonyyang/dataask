import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ConnectionModal from '../ConnectionModal'
import { testConnection, createConnection, updateConnection } from '../../services/database'
import { Connection } from '../../types/database'

// Mock the database service
jest.mock('../../services/database', () => ({
  testConnection: jest.fn(),
  createConnection: jest.fn(),
  updateConnection: jest.fn()
}))

// Mock window.electronAPI for Electron-specific tests
const mockElectronAPI = {
  dialog: {
    openFile: jest.fn()
  }
}

describe('ConnectionModal', () => {
  const mockOnClose = jest.fn()
  const mockOnConnectionAdded = jest.fn()
  const mockOnConnectionUpdated = jest.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConnectionAdded: mockOnConnectionAdded
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset window.electronAPI
    delete (window as any).electronAPI
  })

  describe('Basic Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<ConnectionModal {...defaultProps} />)
      expect(screen.getByText('Add SQLite Connection')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<ConnectionModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Add SQLite Connection')).not.toBeInTheDocument()
    })

    it('should render edit mode when editingConnection is provided', () => {
      const editingConnection: Connection = {
        id: '1',
        name: 'Test DB',
        type: 'sqlite',
        config: { filename: '/path/to/test.db' }
      }
      
      render(
        <ConnectionModal 
          {...defaultProps} 
          editingConnection={editingConnection}
          onConnectionUpdated={mockOnConnectionUpdated}
        />
      )
      
      expect(screen.getByText('Edit SQLite Connection')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test DB')).toBeInTheDocument()
      expect(screen.getByDisplayValue('/path/to/test.db')).toBeInTheDocument()
    })
  })

  describe('Form Interactions', () => {
    it('should update connection name on input', async () => {
      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText('Connection Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'My Database')
      
      expect(nameInput).toHaveValue('My Database')
    })

    it('should update database file path on input', async () => {
      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      const fileInput = screen.getByLabelText('Database File')
      await user.type(fileInput, '/path/to/database.sqlite')
      
      expect(fileInput).toHaveValue('/path/to/database.sqlite')
    })

    it('should disable submit button when required fields are empty', () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const submitButton = screen.getByText('Add Connection')
      const nameInput = screen.getByLabelText('Connection Name')
      const fileInput = screen.getByLabelText('Database File')
      
      // Clear the default name
      fireEvent.change(nameInput, { target: { value: '' } })
      
      expect(submitButton).toBeDisabled()
      
      // Fill in the name but leave file empty
      fireEvent.change(nameInput, { target: { value: 'Test' } })
      expect(submitButton).toBeDisabled()
      
      // Fill in both fields
      fireEvent.change(fileInput, { target: { value: '/path/to/db.sqlite' } })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('File Browser - Web Mode', () => {
    it('should handle file selection via HTML file input', async () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const file = new File([''], 'test-database.sqlite', { type: 'application/x-sqlite3' })
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      
      fireEvent.change(fileInput)
      
      // Should update the filename input
      const filenameInput = screen.getByLabelText('Database File')
      expect(filenameInput).toHaveValue('test-database.sqlite')
      
      // Should update the name if it's still the default
      const nameInput = screen.getByLabelText('Connection Name')
      expect(nameInput).toHaveValue('test-database')
    })

    it('should not override custom connection name when selecting file', async () => {
      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      // Set a custom name first
      const nameInput = screen.getByLabelText('Connection Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'My Custom Name')
      
      // Select a file
      const file = new File([''], 'database.sqlite', { type: 'application/x-sqlite3' })
      const fileInput = screen.getByTestId('file-input') as HTMLInputElement
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      
      fireEvent.change(fileInput)
      
      // Name should remain unchanged
      expect(nameInput).toHaveValue('My Custom Name')
    })
  })

  describe('File Browser - Electron Mode', () => {
    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI
    })

    it('should use Electron file dialog when available', async () => {
      mockElectronAPI.dialog.openFile.mockResolvedValue({
        success: true,
        filePath: '/Users/test/database.sqlite',
        fileName: 'database.sqlite'
      })

      render(<ConnectionModal {...defaultProps} />)
      
      const browseButton = screen.getByText('Browse')
      fireEvent.click(browseButton)
      
      await waitFor(() => {
        expect(mockElectronAPI.dialog.openFile).toHaveBeenCalled()
      })
      
      // Should update the file path
      const fileInput = screen.getByLabelText('Database File')
      expect(fileInput).toHaveValue('/Users/test/database.sqlite')
      
      // Should update the name
      const nameInput = screen.getByLabelText('Connection Name')
      expect(nameInput).toHaveValue('database')
    })

    it('should handle canceled file dialog', async () => {
      mockElectronAPI.dialog.openFile.mockResolvedValue({
        success: false,
        canceled: true
      })

      render(<ConnectionModal {...defaultProps} />)
      
      const browseButton = screen.getByText('Browse')
      const fileInput = screen.getByLabelText('Database File')
      const initialValue = fileInput.getAttribute('value')
      
      fireEvent.click(browseButton)
      
      await waitFor(() => {
        expect(mockElectronAPI.dialog.openFile).toHaveBeenCalled()
      })
      
      // File input should remain unchanged
      expect(fileInput).toHaveValue(initialValue || '')
    })

    it('should fall back to HTML input on Electron dialog error', async () => {
      mockElectronAPI.dialog.openFile.mockRejectedValue(new Error('Dialog error'))
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<ConnectionModal {...defaultProps} />)
      
      const browseButton = screen.getByText('Browse')
      const htmlFileInput = screen.getByTestId('file-input') as HTMLInputElement
      const clickSpy = jest.spyOn(htmlFileInput, 'click')
      
      fireEvent.click(browseButton)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error opening file dialog:', expect.any(Error))
        expect(clickSpy).toHaveBeenCalled()
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      (testConnection as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Connection successful!'
      })

      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      // Fill in the form
      const fileInput = screen.getByLabelText('Database File')
      await user.type(fileInput, '/path/to/test.db')
      
      // Click test button
      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)
      
      // Button should show loading state
      expect(screen.getByText('Testing...')).toBeInTheDocument()
      
      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText('Connection successful!')).toBeInTheDocument()
      })
      
      expect(testConnection).toHaveBeenCalledWith({
        type: 'sqlite',
        name: 'SQLite Database',
        filename: '/path/to/test.db'
      })
    })

    it('should show error when connection test fails', async () => {
      (testConnection as jest.Mock).mockResolvedValue({
        success: false,
        error: 'File not found'
      })

      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      const fileInput = screen.getByLabelText('Database File')
      await user.type(fileInput, '/invalid/path.db')
      
      const testButton = screen.getByText('Test Connection')
      fireEvent.click(testButton)
      
      await waitFor(() => {
        expect(screen.getByText('File not found')).toBeInTheDocument()
      })
    })

    it('should disable test button when filename is empty', () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const testButton = screen.getByText('Test Connection')
      expect(testButton).toBeDisabled()
    })
  })

  describe('Connection Creation', () => {
    it('should create connection successfully', async () => {
      (createConnection as jest.Mock).mockResolvedValue({
        success: true,
        connectionId: 'new-connection-id'
      })

      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      // Fill in the form
      const nameInput = screen.getByLabelText('Connection Name')
      const fileInput = screen.getByLabelText('Database File')
      
      await user.clear(nameInput)
      await user.type(nameInput, 'My Test DB')
      await user.type(fileInput, '/path/to/test.db')
      
      // Submit the form
      const submitButton = screen.getByText('Add Connection')
      fireEvent.click(submitButton)
      
      // Button should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(createConnection).toHaveBeenCalledWith({
          type: 'sqlite',
          name: 'My Test DB',
          filename: '/path/to/test.db'
        })
        expect(mockOnConnectionAdded).toHaveBeenCalledWith('new-connection-id')
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should show error when connection creation fails', async () => {
      (createConnection as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to create connection'
      })

      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText('Connection Name')
      const fileInput = screen.getByLabelText('Database File')
      
      await user.clear(nameInput)
      await user.type(nameInput, 'Test')
      await user.type(fileInput, '/path/to/test.db')
      
      const submitButton = screen.getByText('Add Connection')
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to create connection')).toBeInTheDocument()
        expect(mockOnConnectionAdded).not.toHaveBeenCalled()
        expect(mockOnClose).not.toHaveBeenCalled()
      })
    })
  })

  describe('Connection Update', () => {
    const editingConnection: Connection = {
      id: 'existing-id',
      name: 'Existing DB',
      type: 'sqlite',
      config: { filename: '/existing/path.db' }
    }

    it('should update connection successfully', async () => {
      (updateConnection as jest.Mock).mockResolvedValue({
        success: true
      })

      const user = userEvent.setup()
      render(
        <ConnectionModal 
          {...defaultProps} 
          editingConnection={editingConnection}
          onConnectionUpdated={mockOnConnectionUpdated}
        />
      )
      
      // Update the name
      const nameInput = screen.getByLabelText('Connection Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated DB Name')
      
      // Submit the form
      const submitButton = screen.getByText('Update')
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(updateConnection).toHaveBeenCalledWith('existing-id', {
          type: 'sqlite',
          name: 'Updated DB Name',
          filename: '/existing/path.db'
        })
        expect(mockOnConnectionUpdated).toHaveBeenCalledWith('existing-id')
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Modal Controls', () => {
    it('should close modal when cancel button is clicked', () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close modal when X button is clicked', () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const closeButton = screen.getByRole('button', { name: '' })
      fireEvent.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should disable all buttons during testing', async () => {
      (testConnection as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      const user = userEvent.setup()
      render(<ConnectionModal {...defaultProps} />)
      
      const fileInput = screen.getByLabelText('Database File')
      await user.type(fileInput, '/path/to/test.db')
      
      const testButton = screen.getByText('Test Connection')
      const cancelButton = screen.getByText('Cancel')
      const submitButton = screen.getByText('Add Connection')
      
      fireEvent.click(testButton)
      
      expect(cancelButton).toBeDisabled()
      expect(submitButton).toBeDisabled()
      
      await waitFor(() => {
        expect(cancelButton).not.toBeDisabled()
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('Placeholder Text', () => {
    it('should show Electron-specific placeholder in Electron mode', () => {
      (window as any).electronAPI = mockElectronAPI
      render(<ConnectionModal {...defaultProps} />)
      
      const fileInput = screen.getByLabelText('Database File')
      expect(fileInput).toHaveAttribute('placeholder', '/path/to/database.sqlite')
    })

    it('should show web-specific placeholder in web mode', () => {
      render(<ConnectionModal {...defaultProps} />)
      
      const fileInput = screen.getByLabelText('Database File')
      expect(fileInput).toHaveAttribute('placeholder', 'database.sqlite')
    })
  })
})