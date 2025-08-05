import { useState, useEffect } from 'react'
import { BarChart3, Table, TrendingUp, Copy, Check, Eye, Info } from 'lucide-react'
import { DataFrameQueryResult } from '../services/dataframe'
import { dataframeService } from '../services/dataframe'

interface AnalysisPanelProps {
  queryResults: DataFrameQueryResult | null
  currentCode: string
  selectedDataFrame?: string | null
}

export default function AnalysisPanel({ queryResults, currentCode, selectedDataFrame }: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'data' | 'visualize' | 'insights'>('data')
  const [previewTab, setPreviewTab] = useState<'overview' | 'preview'>('overview')
  const [copySuccess, setCopySuccess] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const [previewData, setPreviewData] = useState<DataFrameQueryResult | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [dataframeInfo, setDataframeInfo] = useState<any>(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(false)
  const [dataframeProfile, setDataframeProfile] = useState<any[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Generate AI analysis when query results change
  useEffect(() => {
    if (queryResults && queryResults.data && queryResults.data.length > 0) {
      generateAIAnalysis()
    } else {
      setAiAnalysis('')
    }
  }, [queryResults])

  // Load preview data when a data file is selected
  useEffect(() => {
    if (selectedDataFrame && !queryResults) {
      loadPreviewData()
      loadDataframeInfo()
      loadDataframeProfile()
    } else if (!selectedDataFrame) {
      setPreviewData(null)
      setDataframeInfo(null)
      setDataframeProfile([])
    }
  }, [selectedDataFrame])

  const loadPreviewData = async () => {
    if (!selectedDataFrame) return
    
    setIsLoadingPreview(true)
    try {
      const preview = await dataframeService.getDataFramePreview(selectedDataFrame, 50)
      setPreviewData(preview)
    } catch (error) {
      console.error('Failed to load preview data:', error)
      setPreviewData(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const loadDataframeInfo = async () => {
    if (!selectedDataFrame) return
    
    setIsLoadingInfo(true)
    try {
      const response = await dataframeService.getDataFrameInfo(selectedDataFrame)
      setDataframeInfo(response.info)
    } catch (error) {
      console.error('Failed to load dataframe info:', error)
      setDataframeInfo(null)
    } finally {
      setIsLoadingInfo(false)
    }
  }

  const loadDataframeProfile = async () => {
    if (!selectedDataFrame) return
    
    setIsLoadingProfile(true)
    try {
      const response = await dataframeService.getDataFrameProfile(selectedDataFrame)
      setDataframeProfile(response.profile)
    } catch (error) {
      console.error('Failed to load dataframe profile:', error)
      setDataframeProfile([])
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const getDataTypeDescription = (dtype: string): string => {
    const dtypeLower = dtype.toLowerCase()
    if (dtypeLower.includes('int')) return 'Integer'
    if (dtypeLower.includes('float')) return 'Continuous'
    if (dtypeLower.includes('object') || dtypeLower.includes('string')) return 'Categorical'
    if (dtypeLower.includes('bool')) return 'Boolean'
    if (dtypeLower.includes('datetime')) return 'Date/Time'
    return 'Other'
  }

  const generateAIAnalysis = async () => {
    if (!queryResults || queryResults.data.length === 0) return

    setIsGeneratingAnalysis(true)
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
      setIsGeneratingAnalysis(false)
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

  // Show preview data if available
  if (previewData && previewData.data && previewData.data.length > 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Preview Tabs */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setPreviewTab('overview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                previewTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Info className="w-4 h-4 inline-block mr-1" />
              Data Overview
            </button>
            <button
              onClick={() => setPreviewTab('preview')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                previewTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Eye className="w-4 h-4 inline-block mr-1" />
              Data Preview
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          {/* Data Overview Tab */}
          {previewTab === 'overview' && (
            <div className="h-full p-4 overflow-auto">
              {isLoadingInfo || isLoadingProfile ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading dataset info...</p>
                  </div>
                </div>
              ) : dataframeInfo && dataframeProfile.length > 0 ? (
                <div className="space-y-6">
                  {/* Dataset Statistics */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Dataset Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{dataframeInfo.shape[0].toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Total Rows</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{dataframeInfo.shape[1]}</div>
                        <div className="text-xs text-gray-500">Total Columns</div>
                      </div>
                    </div>
                  </div>

                  {/* Variable Profiles */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Variable Profiles</h3>
                    <div className="space-y-3">
                      {dataframeProfile.map((variable) => (
                        <div key={variable.name} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-900">{variable.name}</h4>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                variable.type === 'numerical' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {variable.type}
                              </span>
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                                {variable.subtype}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500">Sample Size:</span>
                              <span className="ml-1 font-medium">{variable.sample_size.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Unique Values:</span>
                              <span className="ml-1 font-medium">{variable.unique_values.toLocaleString()}</span>
                            </div>
                            {variable.distribution && (
                              <div>
                                <span className="text-gray-500">Distribution:</span>
                                <span className={`ml-1 font-medium ${
                                  variable.distribution === 'normal' ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {variable.distribution}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-500">Outliers:</span>
                              <span className={`ml-1 font-medium ${
                                variable.outliers ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {variable.outliers ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm">Select a data file to view overview</p>
                </div>
              )}
            </div>
          )}

          {/* Data Preview Tab */}
          {previewTab === 'preview' && (
            <div className="h-full flex flex-col">
              {/* Preview Data */}
              <div className="flex-1 overflow-auto">
                <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Showing first {previewData.data.length} of {previewData.rowCount?.toLocaleString() || '0'} rows
                  </span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {previewData.columns.map((column) => (
                          <th
                            key={column}
                            className="px-3 py-1.5 text-left font-medium text-gray-700 border-b border-gray-200"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {previewData.columns.map((column) => (
                            <td
                              key={column}
                              className="px-3 py-1.5 border-b border-gray-100"
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
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show analysis results when query results are available
  if (queryResults && queryResults.data && queryResults.data.length > 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Analysis Results</h2>
            <div className="text-xs text-gray-500">
              {queryResults.rowCount?.toLocaleString() || '0'} rows • {queryResults.executionTime || 0}ms
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
                  Showing {Math.min(100, queryResults.rowCount || 0)} of {queryResults.rowCount?.toLocaleString() || '0'} rows
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
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm">Visualization features coming soon</p>
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div className="h-full p-4 overflow-auto">
              {isGeneratingAnalysis ? (
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

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
        <p className="text-sm text-gray-500 mb-3">
          {isLoadingPreview ? 'Loading preview...' : 
           selectedDataFrame ? 'Run a query to see analysis and visualizations' : 'Select a data file to preview'}
        </p>
      </div>
    </div>
  )
} 