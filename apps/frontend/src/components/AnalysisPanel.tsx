import { useState, useEffect } from 'react'
import { TrendingUp, Download, BarChart3, Copy, Check, Table } from 'lucide-react'
import DataVisualizer from './DataVisualizer'
import { DataFrameQueryResult } from '../services/dataframe'
import { dataframeService } from '../services/dataframe'

interface AnalysisPanelProps {
  queryResults: DataFrameQueryResult | null
  currentCode: string
  selectedDataFrame?: string | null
}

export default function AnalysisPanel({ queryResults, currentCode, selectedDataFrame }: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'data' | 'visualize'>('data')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Generate AI analysis when query results change
  useEffect(() => {
    if (queryResults && queryResults.data && queryResults.data.length > 0) {
      generateAIAnalysis()
    } else {
      setAiAnalysis(null)
    }
  }, [queryResults])

  const generateAIAnalysis = async () => {
    if (!queryResults || queryResults.data.length === 0) return

    setIsAnalyzing(true)
    try {
      const response = await dataframeService.analyzeResults(
        queryResults.data.slice(0, 100), // Send sample of data
        currentCode || 'Data analysis'
      )

      if (response.insights) {
        setAiAnalysis(response.insights)
      }
    } catch (error) {
      console.error('Failed to generate AI analysis:', error)
      setAiAnalysis('Unable to generate analysis. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const exportAsCSV = () => {
    if (!queryResults || !queryResults.data || queryResults.data.length === 0) return

    const headers = queryResults.columns.join(',')
    const rows = queryResults.data.map(row => 
      queryResults.columns.map(col => {
        const value = row[col]
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
    
    const csv = [headers, ...rows].join('\n')
    copyToClipboard(csv)
  }

  if (!queryResults || !queryResults.data || queryResults.data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
          <p className="text-gray-500">Run a query to see analysis and visualizations</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Analysis Results</h2>
          <div className="text-xs text-gray-500">
            {queryResults.rowCount.toLocaleString()} rows • {queryResults.executionTime}ms
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <Table className="w-4 h-4 inline-block mr-1" />
            Data
          </button>
          <button
            onClick={() => setActiveTab('visualize')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'visualize'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-1" />
            Visualize
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'insights'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline-block mr-1" />
            Insights
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Showing {Math.min(100, queryResults.rowCount)} of {queryResults.rowCount.toLocaleString()} rows
              </span>
              <button
                onClick={exportAsCSV}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy as CSV
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {queryResults.columns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-2 text-left font-medium text-gray-700 border-b border-gray-200"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResults.data.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {queryResults.columns.map((column) => (
                        <td
                          key={column}
                          className="px-4 py-2 border-b border-gray-100"
                        >
                          {row[column] !== null && row[column] !== undefined
                            ? String(row[column])
                            : <span className="text-gray-400">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Visualize Tab */}
        {activeTab === 'visualize' && (
          <div className="h-full p-4 overflow-auto">
            <DataVisualizer
              data={queryResults.data}
              columns={queryResults.columns}
            />
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="h-full p-4 overflow-auto">
            {isAnalyzing ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Analyzing your data...</p>
                </div>
              </div>
            ) : aiAnalysis ? (
              <div className="prose prose-sm max-w-none">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    AI Analysis
                  </h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{aiAnalysis}</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>No insights available. Try running a different query.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 