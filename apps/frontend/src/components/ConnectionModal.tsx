import React, { useState, useEffect, useRef } from 'react'
import { X, Database, AlertCircle, CheckCircle, Upload } from 'lucide-react'
import { testConnection, createConnection, updateConnection } from '../services/database'
import { Connection } from '../types/database'

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (connectionId: string) => void
  editingConnection?: Connection | null
  onConnectionUpdated?: (connectionId: string) => void
  isEmbedded?: boolean
}

interface ConnectionFormData {
  type: 'sqlite'
  name: string
  filename?: string
}

export default function ConnectionModal({ 
  isOpen, 
  onClose, 
  onConnectionAdded, 
  editingConnection, 
  onConnectionUpdated, 
  isEmbedded = false 
}: ConnectionModalProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    type: 'sqlite',
    name: '',
    filename: ''
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingConnection) {
      setFormData({
        type: 'sqlite',
        name: editingConnection.name,
        filename: editingConnection.config?.filename || ''
      })
    } else {
      // Reset to defaults for new connection
      setFormData({
        type: 'sqlite',
        name: 'SQLite Database',
        filename: ''
      })
    }
    setTestStatus('idle')
    setTestMessage('')
  }, [editingConnection, isOpen])

  const handleInputChange = (field: keyof ConnectionFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setTestStatus('idle')
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // In a real implementation, this would handle file upload
      // For now, we'll just use the file path
      handleInputChange('filename', file.name)
      handleInputChange('name', file.name.replace(/\.(db|sqlite|sqlite3)$/i, ''))
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setTestStatus('idle')
    setTestMessage('')

    try {
      const config = {
        type: 'sqlite' as const,
        name: formData.name,
        filename: formData.filename
      }

      const result = await testConnection(config)
      
      if (result.success) {
        setTestStatus('success')
        setTestMessage('Connection successful!')
      } else {
        setTestStatus('error')
        setTestMessage(result.error || 'Connection failed')
      }
    } catch (error) {
      setTestStatus('error')
      setTestMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.filename) {
      setTestStatus('error')
      setTestMessage('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    
    try {
      const config = {
        type: 'sqlite' as const,
        name: formData.name,
        filename: formData.filename
      }

      if (editingConnection) {
        const result = await updateConnection(editingConnection.id, config)
        if (result.success && onConnectionUpdated) {
          onConnectionUpdated(editingConnection.id)
          onClose()
        } else {
          throw new Error(result.error || 'Failed to update connection')
        }
      } else {
        const result = await createConnection(config)
        if (result.success && result.connectionId) {
          onConnectionAdded(result.connectionId)
          onClose()
        } else {
          throw new Error(result.error || 'Failed to create connection')
        }
      }
    } catch (error) {
      setTestStatus('error')
      setTestMessage(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl ${isEmbedded ? 'w-full h-full' : 'w-[600px] max-h-[90vh]'} overflow-hidden`}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingConnection ? 'Edit SQLite Connection' : 'Add SQLite Connection'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Connection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Type
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center">
              <Database className="h-5 w-5 text-blue-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">SQLite</p>
                <p className="text-sm text-gray-600">Local file-based database</p>
              </div>
            </div>
          </div>

          {/* Connection Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Connection Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My SQLite Database"
              required
            />
          </div>

          {/* SQLite File Path */}
          <div>
            <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-1">
              Database File
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="filename"
                value={formData.filename}
                onChange={(e) => handleInputChange('filename', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="/path/to/database.sqlite"
                required
              />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".db,.sqlite,.sqlite3"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleFileSelect}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Browse
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Select a SQLite database file (.db, .sqlite, or .sqlite3)
            </p>
          </div>

          {/* Test Status Message */}
          {testStatus !== 'idle' && (
            <div className={`p-4 rounded-md flex items-start ${
              testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testStatus === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">{testMessage}</p>
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isTestingConnection || isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            className="px-4 py-2 text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
            disabled={isTestingConnection || isSaving || !formData.filename}
          >
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isSaving || !formData.name || !formData.filename}
          >
            {isSaving ? 'Saving...' : editingConnection ? 'Update' : 'Add Connection'}
          </button>
        </div>
      </div>
    </div>
  )
} 