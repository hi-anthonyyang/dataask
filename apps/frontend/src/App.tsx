import { useState, useRef, useEffect } from 'react'
import SchemaBrowser from './components/SchemaBrowser'
import AnalysisPanel from './components/AnalysisPanel'
import ChatPanel from './components/ChatPanel'
import TableDetails from './components/TableDetails'
import ConnectionModal from './components/ConnectionModal'
import { Database, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

interface Connection {
  id: string
  name: string
  type: string
  config?: {
    host?: string
    port?: number
    database?: string
    username?: string
    password?: string
    filename?: string
  }
}

function App() {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [currentQuery, setCurrentQuery] = useState<string>('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320) // 25% of ~1280px
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(400) // ~30% of ~1280px
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const leftDragRef = useRef<HTMLDivElement>(null)
  const rightDragRef = useRef<HTMLDivElement>(null)

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [])

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

  const handleLeftMouseDown = (e: React.MouseEvent) => {
    setIsDraggingLeft(true)
    e.preventDefault()
  }

  const handleRightMouseDown = (e: React.MouseEvent) => {
    setIsDraggingRight(true)
    e.preventDefault()
  }

  const handleLeftMouseMove = (e: MouseEvent) => {
    if (!isDraggingLeft) return
    const newWidth = Math.max(200, Math.min(600, e.clientX))
    setLeftPanelWidth(newWidth)
  }

  const handleRightMouseMove = (e: MouseEvent) => {
    if (!isDraggingRight) return
    const windowWidth = window.innerWidth
    const newWidth = Math.max(300, Math.min(700, windowWidth - e.clientX))
    setRightPanelWidth(newWidth)
  }

  const handleLeftMouseUp = () => {
    setIsDraggingLeft(false)
  }

  const handleRightMouseUp = () => {
    setIsDraggingRight(false)
  }

  // Add global mouse event listeners for left panel
  useEffect(() => {
    if (isDraggingLeft) {
      document.addEventListener('mousemove', handleLeftMouseMove)
      document.addEventListener('mouseup', handleLeftMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleLeftMouseMove)
        document.removeEventListener('mouseup', handleLeftMouseUp)
      }
    }
  }, [isDraggingLeft])

  // Add global mouse event listeners for right panel
  useEffect(() => {
    if (isDraggingRight) {
      document.addEventListener('mousemove', handleRightMouseMove)
      document.addEventListener('mouseup', handleRightMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleRightMouseMove)
        document.removeEventListener('mouseup', handleRightMouseUp)
      }
    }
  }, [isDraggingRight])

  const toggleLeftPanel = () => {
    setIsLeftPanelMinimized(!isLeftPanelMinimized)
  }

  const handleConnectionSelect = (connectionId: string | null) => {
    setSelectedConnection(connectionId === selectedConnection ? null : connectionId)
  }

  const handleConnectionAdded = (connectionId: string) => {
    loadConnections() // Refresh connections when a new one is added
    setSelectedConnection(connectionId) // Auto-select the new connection
    setShowConnectionModal(false) // Close the modal
    setEditingConnection(null) // Clear editing state
  }

  const handleConnectionUpdated = (connectionId: string) => {
    loadConnections() // Refresh connections when one is updated
    setShowConnectionModal(false) // Close the modal
    setEditingConnection(null) // Clear editing state
  }

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection(connection)
    setShowConnectionModal(true)
  }

  const getSelectedConnectionType = (): string | null => {
    if (!selectedConnection) return null
    const connection = connections.find(c => c.id === selectedConnection)
    return connection?.type || null
  }

  const getSelectedConnectionDetails = (): { name: string; type: string } | null => {
    if (!selectedConnection) return null
    const connection = connections.find(c => c.id === selectedConnection)
    return connection ? { name: connection.name, type: connection.type } : null
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">DataAsk</h1>
          <span className="text-sm text-muted-foreground"># Just ask your data</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedConnection && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">
                Connected to {getSelectedConnectionDetails()?.name} ({getSelectedConnectionDetails()?.type})
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Schema Browser (Resizable) */}
        <div 
          className={`border-r border-border bg-card relative transition-all duration-200 ${
            isLeftPanelMinimized ? 'w-12' : ''
          }`}
          style={{ 
            width: isLeftPanelMinimized ? '48px' : `${leftPanelWidth}px` 
          }}
        >
          {/* Minimize/Expand Button */}
          <button
            onClick={toggleLeftPanel}
            className="absolute top-4 right-3 z-10 p-1.5 hover:bg-muted rounded-md transition-colors"
            title={isLeftPanelMinimized ? "Expand panel" : "Minimize panel"}
          >
            {isLeftPanelMinimized ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {!isLeftPanelMinimized ? (
            <SchemaBrowser 
              selectedConnection={selectedConnection}
              onConnectionSelect={setSelectedConnection}
              selectedTable={selectedTable}
              onTableSelect={setSelectedTable}
              showConnectionModal={showConnectionModal}
              setShowConnectionModal={setShowConnectionModal}
              connections={connections}
              onConnectionsChange={loadConnections}
              onEditConnection={handleEditConnection}
            />
          ) : (
            <div className="flex flex-col items-center p-2 gap-2 mt-16 h-full">
              {/* Add Connection Button - Top */}
              <button
                onClick={() => setShowConnectionModal(true)}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                title="Add database connection"
              >
                <Plus className="h-4 w-4" />
              </button>
              
              {/* Connection Icons - Middle (scrollable if many) */}
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {connections.map((connection) => (
                  <button
                    key={connection.id}
                    onClick={() => handleConnectionSelect(connection.id)}
                    className={`p-2 hover:bg-muted rounded-md transition-colors ${
                      selectedConnection === connection.id ? 'bg-primary/10' : ''
                    }`}
                    title={`${connection.name} (${connection.type})`}
                  >
                    <Database 
                      className={`h-4 w-4 ${
                        selectedConnection === connection.id ? 'text-primary' : 'text-muted-foreground'
                      }`} 
                    />
                  </button>
                ))}
              </div>
              

            </div>
          )}

          {/* Drag Handle */}
          {!isLeftPanelMinimized && (
            <div
              ref={leftDragRef}
              onMouseDown={handleLeftMouseDown}
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors group"
              title="Drag to resize panel"
            >
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-border group-hover:bg-primary transition-colors" />
            </div>
          )}
        </div>

        {/* Center Panel - Analysis & Results (Flexible) */}
        <div className="flex-1 bg-background min-w-0 overflow-hidden">
          {selectedTable ? (
            <TableDetails 
              selectedConnection={selectedConnection}
              selectedTable={selectedTable}
              onClose={() => setSelectedTable(null)}
            />
          ) : (
            <AnalysisPanel 
              queryResults={queryResults}
              currentQuery={currentQuery}
            />
          )}
        </div>

        {/* Right Panel - Chat & SQL (Resizable) */}
        <div 
          className="border-l border-border bg-card relative"
          style={{ width: `${rightPanelWidth}px` }}
        >
          {/* Left Drag Handle for Right Panel */}
          <div
            ref={rightDragRef}
            onMouseDown={handleRightMouseDown}
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors group"
            title="Drag to resize panel"
          >
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-border group-hover:bg-primary transition-colors" />
          </div>
          
          <ChatPanel 
            selectedConnection={selectedConnection}
            connectionType={getSelectedConnectionType()}
            onQueryUpdate={setCurrentQuery}
            onQueryExecute={setQueryResults}
          />
        </div>
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => {
          setShowConnectionModal(false)
          setEditingConnection(null)
        }}
        onConnectionAdded={handleConnectionAdded}
        editingConnection={editingConnection}
        onConnectionUpdated={handleConnectionUpdated}
      />
    </div>
  )
}

export default App 