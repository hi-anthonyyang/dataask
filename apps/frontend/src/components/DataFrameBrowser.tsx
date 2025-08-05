import { useState, useEffect } from 'react'
import { FileSpreadsheet, Trash2, Plus, ChevronLeft, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { dataframeService, DataFrame } from '../services/dataframe'

interface DataFrameBrowserProps {
  selectedDataFrame: string | null
  onDataFrameSelect: (id: string | null) => void
  onFileUpload: () => void
  onTogglePanel?: () => void
  isPanelMinimized?: boolean
  refreshTrigger?: number // Add this to trigger refreshes
}

// Minimized DataFrame Browser Component
function MinimizedDataFrameBrowser({
  selectedDataFrame,
  onDataFrameSelect,
  onFileUpload,
  onTogglePanel,
  refreshTrigger
}: DataFrameBrowserProps) {
  const [dataframes, setDataframes] = useState<DataFrame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDataFrames()
  }, [refreshTrigger])

  const loadDataFrames = async () => {
    try {
      setLoading(true)
      const response = await dataframeService.listDataFrames()
      setDataframes(response.dataframes)
    } catch (error) {
      console.error('Failed to load dataframes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this DataFrame?')) {
      return
    }

    try {
      await dataframeService.deleteDataFrame(id)
      await loadDataFrames()
      if (selectedDataFrame === id) {
        onDataFrameSelect(null)
      }
    } catch (error) {
      console.error('Failed to delete dataframe:', error)
      alert('Failed to delete DataFrame')
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-2 flex justify-center">
        <button
          onClick={onTogglePanel}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          title="Expand panel"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Upload Button */}
      <div className="p-2 flex justify-center">
        <button
          onClick={onFileUpload}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          title="Upload file"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Data File Icons */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mx-auto"></div>
          </div>
        ) : dataframes.length === 0 ? (
          <div className="text-center py-4">
            <FileSpreadsheet className="w-6 h-6 text-gray-300 mx-auto" />
          </div>
        ) : (
          <div className="space-y-2">
            {dataframes.map((df) => {
              const isSelected = selectedDataFrame === df.id
              
              return (
                <div key={df.id} className="relative flex justify-center">
                  <button
                    className={`
                      p-1.5 rounded-md transition-colors relative group
                      ${isSelected ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}
                    `}
                    onClick={() => {
                      // Toggle selection: if already selected, deselect it
                      if (isSelected) {
                        onDataFrameSelect(null)
                      } else {
                        onDataFrameSelect(df.id)
                      }
                    }}
                    title={`${df.name} (${df.shape[0].toLocaleString()} rows × ${df.shape[1]} columns)`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                    
                    {/* Delete button - only show on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(df.id)
                      }}
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete DataFrame"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DataFrameBrowser({
  selectedDataFrame,
  onDataFrameSelect,
  onFileUpload,
  onTogglePanel,
  isPanelMinimized,
  refreshTrigger
}: DataFrameBrowserProps) {
  // If panel is minimized, render the minimized version
  if (isPanelMinimized) {
    return (
      <MinimizedDataFrameBrowser
        selectedDataFrame={selectedDataFrame}
        onDataFrameSelect={onDataFrameSelect}
        onFileUpload={onFileUpload}
        onTogglePanel={onTogglePanel}
        isPanelMinimized={isPanelMinimized}
        refreshTrigger={refreshTrigger}
      />
    )
  }

  const [dataframes, setDataframes] = useState<DataFrame[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadDataFrames()
  }, [refreshTrigger]) // Add refreshTrigger to dependency array

  const loadDataFrames = async () => {
    try {
      setLoading(true)
      const response = await dataframeService.listDataFrames()
      setDataframes(response.dataframes)
    } catch (error) {
      console.error('Failed to load dataframes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this DataFrame?')) {
      return
    }

    try {
      await dataframeService.deleteDataFrame(id)
      await loadDataFrames()
      if (selectedDataFrame === id) {
        onDataFrameSelect(null)
      }
    } catch (error) {
      console.error('Failed to delete dataframe:', error)
      alert('Failed to delete DataFrame')
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Data Files</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onFileUpload}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="Upload file"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
            {onTogglePanel && (
              <button
                onClick={onTogglePanel}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                title="Minimize panel"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DataFrame List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            Loading data files...
          </div>
        ) : dataframes.length === 0 ? (
          <div className="text-center py-8">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">No data files uploaded yet</p>
            <button
              onClick={onFileUpload}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Upload CSV or Excel
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {dataframes.map((df) => {
              const isExpanded = expandedFiles.has(df.id)
              const isSelected = selectedDataFrame === df.id
              
              return (
                <div key={df.id} className="bg-white border border-gray-200 rounded-md">
                  {/* File Header */}
                  <div
                    className={`
                      flex items-center justify-between p-2 cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => {
                      // Toggle selection: if already selected, deselect it
                      if (isSelected) {
                        onDataFrameSelect(null)
                      } else {
                        onDataFrameSelect(df.id)
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(df.id)
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                      <FileSpreadsheet className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{df.name}</h3>
                        <p className="text-xs text-gray-500 truncate">
                          {df.shape[0].toLocaleString()} rows × {df.shape[1]} columns
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(df.id)
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors ml-2"
                      title="Delete DataFrame"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                  
                  {/* Columns List */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50">
                      <div className="px-4 py-2">
                        <div className="space-y-1">
                          {df.columns.map((column, index) => (
                            <div
                              key={column}
                              className="flex items-center space-x-2 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                              <span className="truncate">{column}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}