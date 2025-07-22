import { useState, useEffect } from 'react'
import { Database, Table, BarChart3, Info, RefreshCw, Users, HardDrive, Columns } from 'lucide-react'

interface TableMetadata {
  tableName: string
  rowCount: number
  tableSize: string
  dataSize: string
  indexSize: string
  schema: string
  owner: string
  hasIndexes: boolean
  hasRules: boolean
  hasTriggers: boolean
}

interface TableColumn {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  maxLength?: number
  precision?: number
  scale?: number
  position: number
  primaryKey?: boolean
}

interface TableDetailsProps {
  selectedConnection: string | null
  selectedTable: string | null
  onClose?: () => void
}

export default function TableDetails({ selectedConnection, selectedTable, onClose }: TableDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'preview'>('overview')
  const [metadata, setMetadata] = useState<TableMetadata | null>(null)
  const [columns, setColumns] = useState<TableColumn[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load table metadata
  useEffect(() => {
    if (selectedConnection && selectedTable) {
      loadTableMetadata()
    } else {
      setMetadata(null)
      setColumns([])
      setPreviewData([])
    }
  }, [selectedConnection, selectedTable])

  const loadTableMetadata = async () => {
    if (!selectedConnection || !selectedTable) return

    setIsLoading(true)
    setError(null)

    try {
      // Load metadata
      const metadataResponse = await fetch('/api/db/table-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          tableName: selectedTable
        })
      })

      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json()
        setMetadata(metadataData)
      }

      // Load columns for overview tab
      if (activeTab === 'overview') {
        await loadTableColumns()
      }

      // Load preview if on preview tab
      if (activeTab === 'preview') {
        await loadTablePreview()
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table details')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTableColumns = async () => {
    if (!selectedConnection || !selectedTable) return

    try {
      const response = await fetch('/api/db/table-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          tableName: selectedTable
        })
      })

      if (response.ok) {
        const data = await response.json()
        setColumns(data.columns || [])
      }
    } catch (err) {
      console.error('Failed to load table columns:', err)
    }
  }

  const loadTablePreview = async () => {
    if (!selectedConnection || !selectedTable) return

    try {
      const response = await fetch('/api/db/table-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          tableName: selectedTable,
          limit: 100
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPreviewData(data.rows || [])
      }
    } catch (err) {
      console.error('Failed to load table preview:', err)
    }
  }

  const handleTabChange = async (tab: 'overview' | 'preview') => {
    setActiveTab(tab)
    
    if (tab === 'overview' && columns.length === 0) {
      await loadTableColumns()
    } else if (tab === 'preview' && previewData.length === 0) {
      await loadTablePreview()
    }
  }

  if (!selectedTable) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div className="max-w-md">
          <Table className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Table Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a table from the database explorer to view its details, structure, and data preview.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">{selectedTable}</h2>
            {metadata && (
              <span className="text-sm text-muted-foreground">
                ({metadata.rowCount.toLocaleString()} rows)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTableMetadata}
              disabled={isLoading}
              className="p-1 hover:bg-muted rounded"
              title="Refresh table details"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-muted rounded"
                title="Close table details"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="flex">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Info className="h-4 w-4" />
            Overview
          </button>
          <button
            onClick={() => handleTabChange('preview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Preview
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 border-b border-border bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Overview Tab - Combined Metadata + Columns */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : metadata ? (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Rows</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {metadata.rowCount.toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="bg-muted/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">Size</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{metadata.tableSize}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Table Information</h3>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schema:</span>
                      <span className="text-foreground font-mono">{metadata.schema}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Owner:</span>
                      <span className="text-foreground font-mono">{metadata.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Size:</span>
                      <span className="text-foreground font-mono">{metadata.dataSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Index Size:</span>
                      <span className="text-foreground font-mono">{metadata.indexSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Has Indexes:</span>
                      <span className={`font-mono ${metadata.hasIndexes ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {metadata.hasIndexes ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Has Triggers:</span>
                      <span className={`font-mono ${metadata.hasTriggers ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {metadata.hasTriggers ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Columns Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Column Details</h3>
                  {columns.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Nullable</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Default</th>
                            <th className="text-left p-2 font-medium text-muted-foreground">Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columns.map((col) => (
                            <tr key={col.name} className="border-b border-border/50">
                              <td className="p-2 font-mono text-foreground">{col.name}</td>
                              <td className="p-2 font-mono text-primary">{col.type}</td>
                              <td className="p-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  col.nullable 
                                    ? 'bg-[#FFE7C2] text-[#F7B74A]'
                                    : 'bg-[#D5EEFF] text-[#5AB4F7]'
                                }`}>
                                  {col.nullable ? 'Nullable' : 'Required'}
                                </span>
                              </td>
                              <td className="p-2 font-mono text-muted-foreground">
                                {col.defaultValue || '—'}
                              </td>
                              <td className="p-2">
                                {col.primaryKey && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    PK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm">No column information available</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No metadata available</p>
              </div>
            )}
          </div>
        )}



        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="p-4">
            {previewData.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-muted-foreground">
                  Showing first {previewData.length} rows
                </div>
                <div className="overflow-x-auto max-w-full">
                  <table className="min-w-full text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(previewData[0]).map((key) => (
                          <th key={key} className="text-left p-2 font-medium text-muted-foreground">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/20">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="p-2 font-mono text-foreground">
                              {value === null ? (
                                <span className="text-muted-foreground italic">NULL</span>
                              ) : (
                                String(value).substring(0, 100)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No preview data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 