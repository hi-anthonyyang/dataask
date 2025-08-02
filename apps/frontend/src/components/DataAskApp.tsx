import { useState, useRef, useEffect } from 'react'
import SchemaBrowser from './SchemaBrowser'
import AnalysisPanel from './AnalysisPanel'
import ChatPanel from './ChatPanel'
import AddDataModal from './AddDataModal'
import ConnectionStatus from './ConnectionStatus'
import { Database, ChevronRight, LogOut, User, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Connection, QueryResult } from '../types'
import { databaseService } from '../services/database'
import { StorageService } from '../services/storage'
import { useResizablePanel } from '../hooks/useResizablePanel'

const DataAskApp: React.FC = () => {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [currentQuery, setCurrentQuery] = useState<string>('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [showAddDataModal, setShowAddDataModal] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const leftDragRef = useRef<HTMLDivElement>(null)
  const rightDragRef = useRef<HTMLDivElement>(null)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Use custom hook for resizable panels
  const leftPanel = useResizablePanel({
    initialWidth: 320,
    minWidth: 200,
    maxWidth: 600,
    direction: 'left'
  })

  const rightPanel = useResizablePanel({
    initialWidth: 400,
    minWidth: 300,
    maxWidth: 700,
    direction: 'right'
  })

  // Load connections on mount
  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const data = await databaseService.listConnections()
      setConnections(data.connections)
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  const toggleLeftPanel = () => {
    setIsLeftPanelMinimized(!isLeftPanelMinimized)
  }

  const handleConnectionSelect = (connectionId: string | null) => {
    setSelectedConnection(connectionId)
    setSelectedTable(null)
    setCurrentQuery('')
    setQueryResults(null)
  }

  const handleConnectionAdded = async (connectionId: string) => {
    setShowAddDataModal(false)
    // Load connections first to get the new connection
    await loadConnections()
    setSelectedConnection(connectionId)
    
    // Now save the imported connection to localStorage
    try {
      const data = await databaseService.listConnections()
      const connection = data.connections.find(c => c.id === connectionId)
      if (connection) {
        StorageService.saveConnection(connection)
      }
    } catch (error) {
      console.error('Failed to save imported connection:', error)
    }
  }

  const handleConnectionUpdated = (connectionId: string) => {
    setShowAddDataModal(false)
    setEditingConnection(null)
    loadConnections()
    setSelectedConnection(connectionId)
  }

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection(connection)
    setShowAddDataModal(true)
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
        leftPanel.isDragging || rightPanel.isDragging ? 'cursor-col-resize' : ''
      }`}
      style={{
        ...(leftPanel.isDragging || rightPanel.isDragging ? { userSelect: 'none' } : {})
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
          style={{ width: isLeftPanelMinimized ? '48px' : `${leftPanel.width}px` }}
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
              <div className="p-2">
                <button
                  onClick={() => setShowAddDataModal(true)}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  title="Add data source"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              
              {/* User Menu */}
              <div className="mt-auto p-2 border-t border-gray-200">
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
            <div className="flex-1 overflow-hidden">
              <SchemaBrowser
                selectedConnection={selectedConnection}
                onConnectionSelect={handleConnectionSelect}
                onTableSelect={setSelectedTable}
                selectedTable={selectedTable}
                showAddDataModal={showAddDataModal}
                setShowAddDataModal={setShowAddDataModal}
                connections={connections}
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

        {/* Drag Handle for Left Panel */}
        {!isLeftPanelMinimized && (
          <div
            ref={leftDragRef}
            onMouseDown={leftPanel.handleMouseDown}
            className={`w-1 hover:bg-blue-500 transition-colors cursor-col-resize ${
              leftPanel.isDragging ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        )}

        {/* Center Panel - Chat */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          <ChatPanel
            selectedConnection={selectedConnection}
            connectionType={getSelectedConnectionType()}
            onQueryUpdate={setCurrentQuery}
            onQueryExecute={(results: QueryResult) => {
              setQueryResults(results)
            }}
          />
        </div>

        {/* Drag Handle for Right Panel */}
        <div
          ref={rightDragRef}
          onMouseDown={rightPanel.handleMouseDown}
          className={`w-1 hover:bg-blue-500 transition-colors cursor-col-resize ${
            rightPanel.isDragging ? 'bg-blue-500' : 'bg-gray-200'
          }`}
        />

        {/* Right Panel - Analysis */}
        <div
          className="bg-white border-l border-gray-200 flex flex-col flex-shrink-0"
          style={{ width: `${rightPanel.width}px` }}
        >
          <AnalysisPanel
            queryResults={queryResults}
            currentQuery={currentQuery}
            selectedTable={selectedTable}
            selectedConnection={selectedConnection}
          />
        </div>
      </div>

      {/* Add Data Modal */}
      {showAddDataModal && (
        <AddDataModal
          isOpen={showAddDataModal}
          onClose={() => {
            setShowAddDataModal(false)
            setEditingConnection(null)
          }}
          onConnectionAdded={handleConnectionAdded}
          onConnectionUpdated={handleConnectionUpdated}
          editingConnection={editingConnection}
        />
      )}
    </div>
  )
}

export default DataAskApp 