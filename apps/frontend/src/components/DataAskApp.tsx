import { useState, useRef, useEffect } from 'react'
import SchemaBrowser from './SchemaBrowser'
import AnalysisPanel from './AnalysisPanel'
import ChatPanel from './ChatPanel'
import ConnectionModal from './ConnectionModal'
import ConnectionStatus from './ConnectionStatus'
import { Database, ChevronRight, LogOut, User, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Connection } from '../types'

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
    e.stopPropagation()
    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
  }

  const handleRightMouseDown = (e: React.MouseEvent) => {
    setIsDraggingRight(true)
    e.preventDefault()
    e.stopPropagation()
    // Prevent text selection during drag
    document.body.style.userSelect = 'none'
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
    // Restore text selection
    document.body.style.userSelect = ''
  }

  const handleRightMouseUp = () => {
    setIsDraggingRight(false)
    // Restore text selection
    document.body.style.userSelect = ''
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
    <div 
      className={`h-screen bg-gray-50 flex flex-col ${
        isDraggingLeft || isDraggingRight ? 'cursor-col-resize' : ''
      }`}
      style={{
        ...(isDraggingLeft || isDraggingRight ? { userSelect: 'none' } : {})
      }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">DataAsk</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <ConnectionStatus 
            selectedConnection={selectedConnection}
            connections={connections}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className="bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0"
          style={{ width: isLeftPanelMinimized ? '48px' : `${leftPanelWidth}px` }}
        >
          {isLeftPanelMinimized ? (
            <div className="flex flex-col h-full">
              {/* Minimized Header with Expand Button */}
              <div className="p-2 border-b border-gray-200 flex justify-center">
                <button
                  onClick={toggleLeftPanel}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  title="Expand panel"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              {/* Add Connection Button */}
              <div className="p-2 border-b border-gray-200 flex justify-center">
                <button
                  onClick={() => setShowConnectionModal(true)}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  title="Add database connection"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              {/* Database Icons */}
              <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
                {connections.map((connection) => (
                  <button
                    key={connection.id}
                    onClick={() => handleConnectionSelect(
                      selectedConnection === connection.id ? null : connection.id
                    )}
                    className={`w-full p-2 mb-1 flex justify-center hover:bg-gray-100 transition-colors ${
                      selectedConnection === connection.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                    title={connection.name}
                  >
                    <Database className={`w-5 h-5 ${
                      selectedConnection === connection.id ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </button>
                ))}
              </div>
              
              {/* User Profile */}
              <div className="p-2 border-t border-gray-200 flex flex-col items-center space-y-2">
                <button
                  title={user?.email}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <User className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
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
                onTogglePanel={toggleLeftPanel}
                isPanelMinimized={isLeftPanelMinimized}
                userEmail={user?.email}
                onLogout={handleLogout}
              />
            </div>
          )}
        </div>

        {/* Resize Handle for Left Panel */}
        {!isLeftPanelMinimized && (
          <div
            ref={leftDragRef}
            className={`w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0 ${
              isDraggingLeft ? 'bg-blue-500' : ''
            }`}
            onMouseDown={handleLeftMouseDown}
          />
        )}

        {/* Center Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnalysisPanel
            queryResults={queryResults}
            currentQuery={currentQuery}
            selectedConnection={selectedConnection}
            selectedTable={selectedTable}
            onTableClose={() => setSelectedTable(null)}
          />
        </div>

        {/* Resize Handle for Right Panel */}
        <div
          ref={rightDragRef}
          className={`w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors flex-shrink-0 ${
            isDraggingRight ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleRightMouseDown}
        />

        {/* Right Panel */}
        <div
          className="bg-white border-l border-gray-200 flex flex-col flex-shrink-0"
          style={{ width: `${rightPanelWidth}px` }}
        >
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <ChatPanel
              selectedConnection={selectedConnection}
              connectionType={getSelectedConnectionType()}
              onQueryUpdate={setCurrentQuery}
              onQueryExecute={setQueryResults}
              onTableClose={() => setSelectedTable(null)}
            />
          </div>
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
        onConnectionUpdated={handleConnectionUpdated}
        editingConnection={editingConnection}
      />
    </div>
  )
}

export default DataAskApp 