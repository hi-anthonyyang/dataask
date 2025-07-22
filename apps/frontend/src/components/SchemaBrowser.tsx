import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Database, Table, Columns, Plus, Settings } from 'lucide-react'
import ConnectionModal from './ConnectionModal'

interface Connection {
  id: string
  name: string
  type: string
}

interface SchemaTable {
  name: string
  columns: Array<{
    name: string
    type: string
    nullable: boolean
    primaryKey: boolean
  }>
}

interface SchemaBrowserProps {
  selectedConnection: string | null
  onConnectionSelect: (connectionId: string | null) => void
}

export default function SchemaBrowser({ selectedConnection, onConnectionSelect }: SchemaBrowserProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [schema, setSchema] = useState<{ tables: SchemaTable[] } | null>(null)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [])

  // Load schema when connection is selected
  useEffect(() => {
    if (selectedConnection) {
      loadSchema(selectedConnection)
    } else {
      setSchema(null)
    }
  }, [selectedConnection])

  const loadConnections = async () => {
    try {
      const response = await fetch('/api/db/connections')
      if (response.ok) {
        const data = await response.json()
        setConnections(data.connections)
      }
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const loadSchema = async (connectionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/db/connections/${connectionId}/schema`)
      if (response.ok) {
        const data = await response.json()
        setSchema(data.schema)
      }
    } catch (error) {
      console.error('Failed to load schema:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const handleDragStart = (e: React.DragEvent, item: string, type: 'table' | 'column') => {
    e.dataTransfer.setData('text/plain', item)
    e.dataTransfer.setData('application/json', JSON.stringify({ item, type }))
  }

  const handleConnectionAdded = (connectionId: string) => {
    loadConnections() // Refresh the connections list
    onConnectionSelect(connectionId) // Auto-select the new connection
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Database Explorer</h2>
          <button 
            onClick={() => setShowConnectionModal(true)}
            className="p-1 hover:bg-muted rounded"
            title="Add database connection"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Connections List */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {connections.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No database connections</p>
            <button 
              onClick={() => setShowConnectionModal(true)}
              className="mt-2 text-primary hover:underline text-xs"
            >
              Add Connection
            </button>
          </div>
        ) : (
          <div className="p-2">
            {connections.map((connection) => (
              <div key={connection.id} className="mb-2">
                <button
                  onClick={() => onConnectionSelect(
                    selectedConnection === connection.id ? null : connection.id
                  )}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 hover:bg-muted text-sm ${
                    selectedConnection === connection.id ? 'bg-muted' : ''
                  }`}
                >
                  <Database className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{connection.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {connection.type}
                  </span>
                </button>

                {/* Schema Tree */}
                {selectedConnection === connection.id && schema && (
                  <div className="ml-4 mt-2 space-y-1">
                    {isLoading ? (
                      <div className="text-xs text-muted-foreground p-2">
                        Loading schema...
                      </div>
                    ) : (
                      schema.tables.map((table) => (
                        <div key={table.name} className="text-sm">
                          <button
                            onClick={() => toggleTable(table.name)}
                            onDragStart={(e) => handleDragStart(e, table.name, 'table')}
                            draggable
                            className="w-full text-left p-1 rounded hover:bg-muted flex items-center gap-1"
                          >
                            {expandedTables.has(table.name) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            <Table className="h-3 w-3 text-blue-500" />
                            <span className="truncate">{table.name}</span>
                          </button>

                          {/* Columns */}
                          {expandedTables.has(table.name) && (
                            <div className="ml-6 space-y-0.5">
                              {table.columns.map((column) => (
                                <div
                                  key={column.name}
                                  onDragStart={(e) => 
                                    handleDragStart(e, `${table.name}.${column.name}`, 'column')
                                  }
                                  draggable
                                  className="flex items-center gap-1 p-1 rounded hover:bg-muted text-xs cursor-grab"
                                >
                                  <Columns className="h-3 w-3 text-gray-500" />
                                  <span className="truncate">{column.name}</span>
                                  <span className="text-muted-foreground text-xs ml-auto">
                                    {column.type}
                                  </span>
                                  {column.primaryKey && (
                                    <span className="text-yellow-500 text-xs">PK</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <button className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2 text-sm text-muted-foreground">
          <Settings className="h-4 w-4" />
          <span>Connection Settings</span>
        </button>
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        onConnectionAdded={handleConnectionAdded}
      />
    </div>
  )
} 