import { useState, useRef } from 'react'
import DataFrameBrowser from './DataFrameBrowser'
import AnalysisPanel from './AnalysisPanel'
import ChatPanel from './ChatPanel'
import FileImportModal from './FileImportModal'
import { FileSpreadsheet, ChevronRight, Plus } from 'lucide-react'
import { DataFrameQueryResult } from '../services/dataframe'
import { useResizablePanel } from '../hooks/useResizablePanel'

const DataAskApp: React.FC = () => {
  const [selectedDataFrame, setSelectedDataFrame] = useState<string | null>(null)
  const [currentCode, setCurrentCode] = useState<string>('')
  const [queryResults, setQueryResults] = useState<DataFrameQueryResult | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Add refresh trigger
  const leftDragRef = useRef<HTMLDivElement>(null)
  const rightDragRef = useRef<HTMLDivElement>(null)

  // Use custom hook for resizable panels
  const leftPanel = useResizablePanel({
    initialWidth: 320,
    minWidth: 200,
    maxWidth: 600,
    direction: 'left'
  })

  const rightPanel = useResizablePanel({
    initialWidth: 650, // Increased from 500 to make analysis panel larger
    minWidth: 450,     // Increased from 350 to ensure minimum usable size
    maxWidth: 800,     // Increased from 700 to allow more expansion
    direction: 'right'
  })

  const toggleLeftPanel = () => {
    setIsLeftPanelMinimized(!isLeftPanelMinimized)
  }

  const handleDataFrameSelect = (dataframeId: string | null) => {
    // Only reset queryResults if selecting a different DataFrame
    if (dataframeId !== selectedDataFrame) {
      setQueryResults(null)
    }
    setSelectedDataFrame(dataframeId)
    setCurrentCode('')
  }

  const handleFileUploaded = async (dataframeId: string) => {
    setShowUploadModal(false)
    // Trigger refresh immediately
    setRefreshTrigger(prev => prev + 1)
    // Small delay to ensure the DataFrame list is updated
    setTimeout(() => {
      setSelectedDataFrame(dataframeId)
    }, 500)
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
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">DataAsk</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className="bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0"
          style={{ width: isLeftPanelMinimized ? '48px' : `${leftPanel.width}px` }}
        >
          <DataFrameBrowser
            selectedDataFrame={selectedDataFrame}
            onDataFrameSelect={handleDataFrameSelect}
            onFileUpload={() => setShowUploadModal(true)}
            onTogglePanel={toggleLeftPanel}
            isPanelMinimized={isLeftPanelMinimized}
            refreshTrigger={refreshTrigger}
          />
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
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0" style={{ minWidth: '250px' }}>
          <ChatPanel
            selectedDataFrame={selectedDataFrame}
            onCodeUpdate={setCurrentCode}
            onQueryExecute={(results: DataFrameQueryResult) => {
              console.log('DataAskApp setting queryResults to:', results)
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
            currentCode={currentCode}
            selectedDataFrame={selectedDataFrame}
          />
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <FileImportModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onConnectionAdded={handleFileUploaded}
        />
      )}
    </div>
  )
}

export default DataAskApp 