import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, Database, Table, Columns, Plus, Trash2, Edit, User, LogOut } from 'lucide-react'
import { Connection } from '../types'
import { databaseService } from '../services/database'

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
  selectedTable: string | null
  onTableSelect: (tableName: string | null) => void
  showAddDataModal: boolean
  setShowAddDataModal: (show: boolean) => void
  connections?: Connection[]
  onConnectionsChange?: () => void
  onEditConnection?: (connection: Connection) => void
  onTogglePanel?: () => void
  isPanelMinimized?: boolean
  userEmail?: string
  onLogout?: () => void
}

export default function SchemaBrowser({ selectedConnection, onConnectionSelect, selectedTable, onTableSelect, setShowAddDataModal, connections: propConnections, onConnectionsChange, onEditConnection, onTogglePanel, isPanelMinimized, userEmail, onLogout }: SchemaBrowserProps) {
  const [internalConnections, setInternalConnections] = useState<Connection[]>([])
  const [schema, setSchema] = useState<{ tables: SchemaTable[] } | null>(null)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)

  // Use connections from props if available, otherwise use internal state
  const connections = propConnections || internalConnections

  // Load connections on mount only if not provided via props
  useEffect(() => {
    if (!propConnections) {
      loadConnections()
    }
  }, [propConnections])

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
      const data = await databaseService.listConnections()
      setInternalConnections(data.connections)
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const loadSchema = async (connectionId: string) => {
    setIsLoading(true)
    try {
      console.log('Loading schema for connection:', connectionId)
      const data = await databaseService.getSchema(connectionId)
      console.log('Schema data received:', data)
      if (data.schema) {
        console.log('Setting schema with tables:', data.schema.tables.map(t => t.name))
        setSchema(data.schema)
      } else {
        console.warn('No schema data received for connection:', connectionId)
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

  const deleteConnection = async (connectionId: string) => {
    // Add confirmation dialog with better UX
    const connection = connections.find(c => c.id === connectionId)
    if (!connection) return
    
    const confirmed = window.confirm(`Are you sure you want to delete "${connection.name}"?`)
    if (!confirmed) {
      return
    }

    try {
      const result = await databaseService.deleteConnection(connectionId)
      
      if (!result.error) {
        // If the deleted connection was selected, clear all related state safely
        if (selectedConnection === connectionId) {
          onConnectionSelect(null)
          // Only clear table selection if it's from the same connection
          if (selectedTable) {
            onTableSelect(null)
          }
          setSchema(null)
          setExpandedTables(new Set())
        }
        // Notify parent component to refresh connections
        if (onConnectionsChange) {
          onConnectionsChange()
        } else if (!propConnections) {
          // Fallback to internal reload if no parent callback
          loadConnections()
        }
      } else {
        // Show error feedback
        console.error('Failed to delete connection:', result.error)
      }
    } catch (error) {
      console.error('Failed to delete connection:', error)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Database</h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowAddDataModal(true)}
              className="p-1.5 hover:bg-muted rounded flex items-center gap-1"
              title="Add connection or import file"
            >
              <Plus className="h-4 w-4" />
            </button>
            {onTogglePanel && (
              <button
                onClick={onTogglePanel}
                className="p-1.5 hover:bg-muted rounded"
                title="Minimize panel"
              >
                {isPanelMinimized ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connections List */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {connections.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No database connections</p>
            <div className="mt-3">
              <button 
                onClick={() => setShowAddDataModal(true)}
                className="block w-full text-primary hover:underline text-sm"
              >
                Add database or import data file
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {connections.map((connection) => (
              <div key={connection.id} className="mb-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onConnectionSelect(
                      selectedConnection === connection.id ? null : connection.id
                    )}
                    className={`flex-1 text-left p-2 rounded flex items-center gap-2 hover:bg-muted text-sm ${
                      selectedConnection === connection.id ? 'bg-muted' : ''
                    }`}
                  >
                    <Database className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{connection.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {connection.type}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onEditConnection) {
                        onEditConnection(connection)
                      }
                    }}
                    className="p-1 text-muted-foreground hover:text-blue-500 rounded transition-colors"
                    title="Edit connection"
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConnection(connection.id)
                    }}
                    className="p-1 text-muted-foreground hover:text-red-500 rounded transition-colors"
                    title="Delete connection"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

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
                            onClick={() => {
                              toggleTable(table.name)
                              onTableSelect(table.name === selectedTable ? null : table.name)
                            }}
                            onDragStart={(e) => handleDragStart(e, table.name, 'table')}
                            draggable
                            className={`w-full text-left p-1 rounded hover:bg-muted flex items-center gap-1 ${
                              selectedTable === table.name ? 'bg-primary/10 border border-primary/20' : ''
                            }`}
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

      {/* User Profile Section */}
      {userEmail && onLogout && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="truncate">{userEmail}</span>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-muted rounded"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 