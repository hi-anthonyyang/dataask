import { useState, useEffect } from 'react'
import { X, Database, TestTube, Loader2 } from 'lucide-react'
import { Connection } from '../types'

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (connectionId: string) => void
  editingConnection?: Connection | null
  onConnectionUpdated?: (connectionId: string) => void
}

interface ConnectionFormData {
  type: 'postgresql' | 'sqlite' | 'mysql'
  name: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  filename?: string
}

export default function ConnectionModal({ isOpen, onClose, onConnectionAdded, editingConnection, onConnectionUpdated }: ConnectionModalProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    type: 'postgresql',
    name: '',
    host: 'localhost',
    port: 5432,
    database: 'dataask_dev',
    username: 'dataask_user',
    password: 'dataask_dev_password'
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isCreatingConnection, setIsCreatingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Initialize form data when editing
  useEffect(() => {
    if (editingConnection) {
      setFormData({
        type: editingConnection.type as 'postgresql' | 'sqlite' | 'mysql',
        name: editingConnection.name,
        host: editingConnection.config?.host || 'localhost',
        port: editingConnection.config?.port || (editingConnection.type === 'postgresql' ? 5432 : 3306),
        database: editingConnection.config?.database || 'dataask_dev',
        username: editingConnection.config?.username || 'dataask_user',
        password: editingConnection.config?.password || 'dataask_dev_password',
        filename: editingConnection.config?.filename || '/path/to/database.sqlite'
      })
    } else {
      // Reset to defaults for new connection
      setFormData({
        type: 'postgresql',
        name: '',
        host: 'localhost',
        port: 5432,
        database: 'dataask_dev',
        username: 'dataask_user',
        password: 'dataask_dev_password'
      })
    }
    setTestResult(null)
  }, [editingConnection])

  if (!isOpen) return null

  const handleInputChange = (field: keyof ConnectionFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setTestResult(null) // Clear test result when form changes
  }

  const handleTypeChange = (type: 'postgresql' | 'sqlite' | 'mysql') => {
    // Don't allow type changes when editing
    if (editingConnection) return
    
    setFormData({
      type,
      name: type === 'postgresql' ? 'PostgreSQL Connection' : 
            type === 'mysql' ? 'MySQL Connection' : 'SQLite Connection',
      ...(type === 'postgresql' ? {
        host: 'localhost',
        port: 5432,
        database: 'dataask_dev',
        username: 'dataask_user',
        password: 'dataask_dev_password'
      } : type === 'mysql' ? {
        host: 'localhost',
        port: 3306,
        database: 'dataask_dev',
        username: 'dataask_user',
        password: 'dataask_dev_password'
      } : {
        filename: '/path/to/database.sqlite'
      })
    })
    setTestResult(null)
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/db/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          config: {
            ...(formData.type === 'postgresql' || formData.type === 'mysql' ? {
              host: formData.host,
              port: formData.port,
              database: formData.database,
              username: formData.username,
              password: formData.password
            } : {
              filename: formData.filename
            })
          }
        })
      })

      const result = await response.json()
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed')
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test connection. Please check your backend is running.'
      })
    }

    setIsTestingConnection(false)
  }

  const createConnection = async () => {
    setIsCreatingConnection(true)

    try {
      const response = await fetch('/api/db/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          config: {
            ...(formData.type === 'postgresql' || formData.type === 'mysql' ? {
              host: formData.host,
              port: formData.port,
              database: formData.database,
              username: formData.username,
              password: formData.password
            } : {
              filename: formData.filename
            })
          }
        })
      })

      const result = await response.json()
      if (response.ok) {
        onConnectionAdded(result.connectionId)
        onClose()
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to create connection'
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to create connection. Please check your backend is running.'
      })
    }

    setIsCreatingConnection(false)
  }

  const updateConnection = async () => {
    if (!editingConnection) return
    
    setIsCreatingConnection(true)

    try {
      const response = await fetch(`/api/db/connections/${editingConnection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          config: {
            ...(formData.type === 'postgresql' || formData.type === 'mysql' ? {
              host: formData.host,
              port: formData.port,
              database: formData.database,
              username: formData.username,
              password: formData.password
            } : {
              filename: formData.filename
            })
          }
        })
      })

      const result = await response.json()
      if (response.ok) {
        if (onConnectionUpdated) {
          onConnectionUpdated(editingConnection.id)
        }
        onClose()
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to update connection'
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to update connection. Please check your backend is running.'
      })
    }

    setIsCreatingConnection(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            {editingConnection ? 'Edit Database Connection' : 'Add Database Connection'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Connection Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Database Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleTypeChange('postgresql')}
                disabled={!!editingConnection}
                className={`flex-1 p-2 text-sm border rounded transition-colors ${
                  formData.type === 'postgresql'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                } ${editingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                PostgreSQL
              </button>
              <button
                onClick={() => handleTypeChange('mysql')}
                disabled={!!editingConnection}
                className={`flex-1 p-2 text-sm border rounded transition-colors ${
                  formData.type === 'mysql'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                } ${editingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                MySQL
              </button>
              <button
                onClick={() => handleTypeChange('sqlite')}
                disabled={!!editingConnection}
                className={`flex-1 p-2 text-sm border rounded transition-colors ${
                  formData.type === 'sqlite'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                } ${editingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                SQLite
              </button>
            </div>
          </div>

          {/* Connection Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Connection Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="My Database"
            />
          </div>

          {/* PostgreSQL & MySQL Fields */}
          {(formData.type === 'postgresql' || formData.type === 'mysql') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Host</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => handleInputChange('host', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Database</label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => handleInputChange('database', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          {/* SQLite Fields */}
          {formData.type === 'sqlite' && (
            <div>
              <label className="block text-sm font-medium mb-1">Database File Path</label>
              <input
                type="text"
                value={formData.filename}
                onChange={(e) => handleInputChange('filename', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="/path/to/database.sqlite"
              />
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-md text-sm ${
              testResult.success 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {testResult.message}
            </div>
          )}

          {/* Sample Data Info */}
          {((formData.type === 'postgresql' && formData.host === 'localhost' && formData.port === 5432) ||
            (formData.type === 'mysql' && formData.host === 'localhost' && formData.port === 3306)) && (
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
              <p className="font-medium">📊 Sample Data Available</p>
              <p>This connection includes sample customers, products, and orders for testing DataAsk features.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-border">
          <button
            onClick={testConnection}
            disabled={isTestingConnection || !formData.name}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test Connection
          </button>
          <button
            onClick={editingConnection ? updateConnection : createConnection}
            disabled={isCreatingConnection || !formData.name || (testResult !== null && !testResult.success)}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreatingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {isCreatingConnection ? (editingConnection ? 'Updating...' : 'Creating...') : (editingConnection ? 'Update Connection' : 'Add Connection')}
          </button>
        </div>
      </div>
    </div>
  )
} 