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
  // SSL Configuration
  sslEnabled?: boolean
  sslMode?: 'require' | 'prefer' | 'allow' | 'disable'
  sslCa?: string
  sslCert?: string
  sslKey?: string
  sslRejectUnauthorized?: boolean
  // Connection Timeouts
  connectionTimeout?: number
  queryTimeout?: number
  // SSH Tunnel Configuration
  sshEnabled?: boolean
  sshHost?: string
  sshPort?: number
  sshUsername?: string
  sshPassword?: string
  sshPrivateKey?: string
  sshPassphrase?: string
}

export default function ConnectionModal({ isOpen, onClose, onConnectionAdded, editingConnection, onConnectionUpdated }: ConnectionModalProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    type: 'postgresql',
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    // Enable SSL by default for cloud database compatibility
    sslEnabled: true,
    sslMode: 'prefer',
    sslRejectUnauthorized: false
  })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isCreatingConnection, setIsCreatingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showSSLConfig, setShowSSLConfig] = useState(false)
  const [showSSHConfig, setShowSSHConfig] = useState(false)
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false)

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
        filename: editingConnection.config?.filename || '/path/to/database.sqlite',
        // SSL Configuration
        sslEnabled: editingConnection.config?.sslEnabled,
        sslMode: editingConnection.config?.sslMode,
        sslCa: editingConnection.config?.sslCa,
        sslCert: editingConnection.config?.sslCert,
        sslKey: editingConnection.config?.sslKey,
        sslRejectUnauthorized: editingConnection.config?.sslRejectUnauthorized,
        // Connection Timeouts
        connectionTimeout: editingConnection.config?.connectionTimeout,
        queryTimeout: editingConnection.config?.queryTimeout,
        // SSH Tunnel Configuration
        sshEnabled: editingConnection.config?.sshEnabled,
        sshHost: editingConnection.config?.sshHost,
        sshPort: editingConnection.config?.sshPort,
        sshUsername: editingConnection.config?.sshUsername,
        sshPassword: editingConnection.config?.sshPassword,
        sshPrivateKey: editingConnection.config?.sshPrivateKey,
        sshPassphrase: editingConnection.config?.sshPassphrase
      })
    } else {
      // Reset to defaults for new connection
      setFormData({
        type: 'postgresql',
        name: '',
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: '',
        // Enable SSL by default for cloud database compatibility
        sslEnabled: true,
        sslMode: 'prefer',
        sslRejectUnauthorized: false
      })
    }
    setTestResult(null)
  }, [editingConnection])

  if (!isOpen) return null

  const handleInputChange = (field: keyof ConnectionFormData, value: string | number | boolean | undefined) => {
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
        database: '',
        username: '',
        password: '',
        // PostgreSQL defaults optimized for cloud databases
        sslEnabled: true,
        sslMode: 'prefer',
        sslRejectUnauthorized: false
      } : type === 'mysql' ? {
        host: 'localhost',
        port: 3306,
        database: '',
        username: '',
        password: '',
        // MySQL defaults optimized for cloud databases
        sslEnabled: true,
        sslMode: 'prefer',
        sslRejectUnauthorized: false
      } : {
        filename: '/path/to/database.sqlite'
      })
    })
    setTestResult(null)
  }

  const buildConnectionConfig = () => {
    const config: any = {}
    
    // Basic database fields
    if (formData.type === 'postgresql' || formData.type === 'mysql') {
      config.host = formData.host
      config.port = formData.port
      config.database = formData.database
      config.username = formData.username
      config.password = formData.password
    } else {
      config.filename = formData.filename
    }

    // SSL Configuration
    if (formData.sslEnabled) {
      config.sslEnabled = formData.sslEnabled
      config.sslMode = formData.sslMode
      config.sslCa = formData.sslCa
      config.sslCert = formData.sslCert
      config.sslKey = formData.sslKey
      config.sslRejectUnauthorized = formData.sslRejectUnauthorized
    }

    // Connection Timeouts
    if (formData.connectionTimeout) {
      config.connectionTimeout = formData.connectionTimeout
    }
    if (formData.queryTimeout) {
      config.queryTimeout = formData.queryTimeout
    }

    // SSH Tunnel Configuration
    if (formData.sshEnabled) {
      config.sshEnabled = formData.sshEnabled
      config.sshHost = formData.sshHost
      config.sshPort = formData.sshPort
      config.sshUsername = formData.sshUsername
      config.sshPassword = formData.sshPassword
      config.sshPrivateKey = formData.sshPrivateKey
      config.sshPassphrase = formData.sshPassphrase
    }

    return config
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
          config: buildConnectionConfig()
        })
      })

      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ error: 'Unknown error' }))
        setTestResult({
          success: false,
          message: errorResult.error || `Server error (${response.status}): ${response.statusText}`
        })
        return
      }

      const result = await response.json()
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed')
      })
    } catch (error) {
      console.error('Connection test error:', error)
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
          config: buildConnectionConfig()
        })
      })

      const result = await response.json()
      if (response.ok) {
        onConnectionAdded(result.connectionId)
        onClose()
      } else {
        setTestResult({
          success: false,
          message: result.error || `Failed to create connection (${response.status}): ${response.statusText}`
        })
      }
    } catch (error) {
      console.error('Connection creation error:', error)
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
          config: buildConnectionConfig()
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
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
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
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

          {/* SSH Tunnel Configuration */}
          {(formData.type === 'postgresql' || formData.type === 'mysql') && (
            <div className="border border-border rounded-md">
              <button
                type="button"
                onClick={() => setShowSSHConfig(!showSSHConfig)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted rounded-t-md"
              >
                <span className="font-medium">SSH Tunnel</span>
                <span className={`transform transition-transform ${showSSHConfig ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showSSHConfig && (
                <div className="p-3 border-t border-border space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="sshEnabled"
                      checked={formData.sshEnabled || false}
                      onChange={(e) => handleInputChange('sshEnabled', e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="sshEnabled" className="text-sm font-medium">Enable SSH Tunnel</label>
                  </div>
                  {formData.sshEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1">SSH Host</label>
                          <input
                            type="text"
                            value={formData.sshHost || ''}
                            onChange={(e) => handleInputChange('sshHost', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="ssh.example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">SSH Port</label>
                          <input
                            type="number"
                            value={formData.sshPort || 22}
                            onChange={(e) => handleInputChange('sshPort', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">SSH Username</label>
                        <input
                          type="text"
                          value={formData.sshUsername || ''}
                          onChange={(e) => handleInputChange('sshUsername', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1">SSH Password</label>
                          <input
                            type="password"
                            value={formData.sshPassword || ''}
                            onChange={(e) => handleInputChange('sshPassword', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Leave empty if using private key"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Private Key Path</label>
                          <input
                            type="text"
                            value={formData.sshPrivateKey || ''}
                            onChange={(e) => handleInputChange('sshPrivateKey', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="~/.ssh/id_rsa"
                          />
                        </div>
                      </div>
                      {formData.sshPrivateKey && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Private Key Passphrase</label>
                          <input
                            type="password"
                            value={formData.sshPassphrase || ''}
                            onChange={(e) => handleInputChange('sshPassphrase', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Leave empty if key has no passphrase"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SSL Configuration */}
          {(formData.type === 'postgresql' || formData.type === 'mysql') && (
            <div className="border border-border rounded-md">
              <button
                type="button"
                onClick={() => setShowSSLConfig(!showSSLConfig)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted rounded-t-md"
              >
                <span className="font-medium">SSL Configuration</span>
                <span className={`transform transition-transform ${showSSLConfig ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showSSLConfig && (
                <div className="p-3 border-t border-border space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="sslEnabledCheckbox"
                      checked={formData.sslEnabled || false}
                      onChange={(e) => handleInputChange('sslEnabled', e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="sslEnabledCheckbox" className="text-sm font-medium">Enable SSL</label>
                  </div>
                  {formData.sslEnabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">SSL Mode</label>
                        <select
                          value={formData.sslMode || 'prefer'}
                          onChange={(e) => handleInputChange('sslMode', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="disable">Disable</option>
                          <option value="allow">Allow</option>
                          <option value="prefer">Prefer</option>
                          <option value="require">Require</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">CA Certificate Path</label>
                        <input
                          type="text"
                          value={formData.sslCa || ''}
                          onChange={(e) => handleInputChange('sslCa', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="/path/to/ca-certificate.crt"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1">Client Certificate</label>
                          <input
                            type="text"
                            value={formData.sslCert || ''}
                            onChange={(e) => handleInputChange('sslCert', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="/path/to/client.crt"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Client Key</label>
                          <input
                            type="text"
                            value={formData.sslKey || ''}
                            onChange={(e) => handleInputChange('sslKey', e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="/path/to/client.key"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="sslRejectUnauthorized"
                          checked={formData.sslRejectUnauthorized !== false}
                          onChange={(e) => handleInputChange('sslRejectUnauthorized', e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="sslRejectUnauthorized" className="text-sm font-medium">Reject Unauthorized Certificates</label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Advanced Settings */}
          <div className="border border-border rounded-md">
            <button
              type="button"
              onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-muted rounded-t-md"
            >
              <span className="font-medium">Advanced Settings</span>
              <span className={`transform transition-transform ${showAdvancedConfig ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showAdvancedConfig && (
              <div className="p-3 border-t border-border space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Connection Timeout (ms)</label>
                    <input
                      type="number"
                      value={formData.connectionTimeout || ''}
                      onChange={(e) => handleInputChange('connectionTimeout', parseInt(e.target.value) || undefined)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="10000"
                      min="1000"
                      max="300000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Query Timeout (ms)</label>
                    <input
                      type="number"
                      value={formData.queryTimeout || ''}
                      onChange={(e) => handleInputChange('queryTimeout', parseInt(e.target.value) || undefined)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="30000"
                      min="1000"
                      max="3600000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

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
        <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
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
            disabled={isCreatingConnection || !formData.name || (testResult !== null && !testResult.success && formData.type !== 'sqlite')}
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