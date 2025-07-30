import { useState, useRef, useEffect } from 'react'
import SchemaBrowser from './SchemaBrowser'
import AnalysisPanel from './AnalysisPanel'
import ChatPanel from './ChatPanel'
import TableDetails from './TableDetails'
import ConnectionModal from './ConnectionModal'
import { Database, ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

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

const DataAskApp: React.FC = () => {
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

  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
    setSelectedConnection(connectionId)
    setSelectedTable(null)
    setCurrentQuery('')
    setQueryResults(null)
  }

  const handleConnectionAdded = (connectionId: string) => {
    setShowConnectionModal(false)
    loadConnections()
    setSelectedConnection(connectionId)
  }

  const handleConnectionUpdated = (connectionId: string) => {
    setShowConnectionModal(false)
    setEditingConnection(null)
    loadConnections()
    setSelectedConnection(connectionId)
  }

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection(connection)
    setShowConnectionModal(true)
  }

  const getSelectedConnectionType = (): string | null => {
    const connection = connections.find(c => c.id === selectedConnection)
    return connection?.type || null
  }



  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">DataAsk</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${
            isLeftPanelMinimized ? 'w-12' : ''
          }`}
          style={{ width: isLeftPanelMinimized ? '48px' : `${leftPanelWidth}px` }}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!isLeftPanelMinimized && (
              <h2 className="text-lg font-medium text-gray-900">Connections</h2>
            )}
            <button
              onClick={toggleLeftPanel}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              {isLeftPanelMinimized ? (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>

          {!isLeftPanelMinimized && (
            <div className="flex-1 overflow-y-auto">
              <SchemaBrowser
                connections={connections}
                selectedConnection={selectedConnection}
                onConnectionSelect={handleConnectionSelect}
                selectedTable={selectedTable}
                onTableSelect={setSelectedTable}
                showConnectionModal={showConnectionModal}
                setShowConnectionModal={setShowConnectionModal}
                onConnectionsChange={loadConnections}
                onEditConnection={handleEditConnection}
              />
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          ref={leftDragRef}
          className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleLeftMouseDown}
        />

        {/* Center Panel */}
        <div className="flex-1 flex flex-col">
          <AnalysisPanel
            queryResults={queryResults}
            currentQuery={currentQuery}
          />
        </div>

        {/* Resize Handle */}
        <div
          ref={rightDragRef}
          className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors"
          onMouseDown={handleRightMouseDown}
        />

        {/* Right Panel */}
        <div
          className="bg-white border-l border-gray-200 flex flex-col"
          style={{ width: `${rightPanelWidth}px` }}
        >
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-lg font-medium text-gray-900">AI Assistant</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatPanel
              selectedConnection={selectedConnection}
              connectionType={getSelectedConnectionType()}
              onQueryUpdate={setCurrentQuery}
              onQueryExecute={setQueryResults}
            />
          </div>
        </div>
      </div>

      {/* Table Details Modal */}
      {selectedTable && (
        <TableDetails
          selectedConnection={selectedConnection}
          selectedTable={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => {
          setShowConnectionModal(false)
          setEditingConnection(null)
        }}
        onConnectionAdded={handleConnectionAdded}
        onConnectionUpdated={handleConnectionUpdated}
        editingConnection={editingConnection}
      />
    </div>
  )
}

export default DataAskApp 