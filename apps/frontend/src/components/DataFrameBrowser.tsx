import { useState, useEffect } from 'react'
import { FileSpreadsheet, Trash2, Plus, ChevronLeft, Info } from 'lucide-react'
import { dataframeService, DataFrame } from '../services/dataframe'

interface DataFrameBrowserProps {
  selectedDataFrame: string | null
  onDataFrameSelect: (id: string | null) => void
  onFileUpload: () => void
  onTogglePanel?: () => void
  isPanelMinimized?: boolean
  refreshTrigger?: number // Add this to trigger refreshes
}

export default function DataFrameBrowser({
  selectedDataFrame,
  onDataFrameSelect,
  onFileUpload,
  onTogglePanel,
  isPanelMinimized,
  refreshTrigger
}: DataFrameBrowserProps) {
  const [dataframes, setDataframes] = useState<DataFrame[]>([])
  const [loading, setLoading] = useState(true)

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
          <div className="space-y-2">
            {dataframes.map((df) => (
              <div
                key={df.id}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${selectedDataFrame === df.id 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => onDataFrameSelect(df.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{df.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {df.shape[0].toLocaleString()} rows × {df.shape[1]} columns
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(df.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(df.id)
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Delete DataFrame"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
                
                {selectedDataFrame === df.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-600">
                      <div className="font-medium mb-1">Columns:</div>
                      <div className="flex flex-wrap gap-1">
                        {df.columns.slice(0, 5).map((col) => (
                          <span key={col} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {col}
                          </span>
                        ))}
                        {df.columns.length > 5 && (
                          <span className="text-gray-400">+{df.columns.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>Upload CSV or Excel files to analyze</span>
        </div>
      </div>
    </div>
  )
}