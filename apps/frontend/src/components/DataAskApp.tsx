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
    initialWidth: 400,
    minWidth: 300,
    maxWidth: 700,
    direction: 'right'
  })

  const toggleLeftPanel = () => {
    setIsLeftPanelMinimized(!isLeftPanelMinimized)
  }

  const handleDataFrameSelect = (dataframeId: string | null) => {
    setSelectedDataFrame(dataframeId)
    setCurrentCode('')
    setQueryResults(null)
  }

  const handleFileUploaded = async (dataframeId: string) => {
    setShowUploadModal(false)
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
            <p className="text-xs text-gray-500">AI-powered data analysis for spreadsheets</p>
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
              
              {/* Upload File Button */}
              <div className="p-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                  title="Upload file"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <DataFrameBrowser
                selectedDataFrame={selectedDataFrame}
                onDataFrameSelect={handleDataFrameSelect}
                onFileUpload={() => setShowUploadModal(true)}
                onTogglePanel={toggleLeftPanel}
                isPanelMinimized={isLeftPanelMinimized}
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
            selectedDataFrame={selectedDataFrame}
            onCodeUpdate={setCurrentCode}
            onQueryExecute={(results: DataFrameQueryResult) => {
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