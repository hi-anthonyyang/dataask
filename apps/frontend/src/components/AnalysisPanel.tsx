import { useState, useEffect } from 'react'
import { TrendingUp, Download, Eye, BarChart3, Copy, Check } from 'lucide-react'
import DataVisualizer from './DataVisualizer'
import { copyInsightsText, copyTableAsCSV, copyTableAsTSV } from '../services/copyService'

interface AnalysisPanelProps {
  queryResults: any
  currentQuery: string
}

export default function AnalysisPanel({ queryResults, currentQuery }: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'data' | 'visualize'>('insights')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastAnalyzedQuery, setLastAnalyzedQuery] = useState<string | null>(null)
  
  // Copy state management
  const [copyStates, setCopyStates] = useState<{
    insights: boolean
    csv: boolean
    tsv: boolean
  }>({
    insights: false,
    csv: false,
    tsv: false
  })

  const handleCopy = async (copyFunction: () => Promise<any>, type: keyof typeof copyStates) => {
    const result = await copyFunction()
    if (result.success) {
      setCopyStates(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [type]: false }))
      }, 2000)
    }
  }

  // Generate AI analysis when query results change (only if query actually changed)
  useEffect(() => {
    if (queryResults && queryResults.data && queryResults.data.length > 0 && currentQuery) {
      // Only analyze if this is a new query or if we don't have analysis yet
      if (currentQuery !== lastAnalyzedQuery || !aiAnalysis) {
        generateAIAnalysis()
      }
    } else {
      setAiAnalysis(null)
      setLastAnalyzedQuery(null)
    }
  }, [queryResults, currentQuery])

  const generateAIAnalysis = async () => {
    if (!queryResults || !currentQuery) return

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/llm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: queryResults.data,
          query: currentQuery,
          context: 'Business data analysis for database exploration'
        })
      })

      if (response.ok) {
        const result = await response.json()
        setAiAnalysis(result.analysis)
        setLastAnalyzedQuery(currentQuery) // Cache this query as analyzed
      } else {
        setAiAnalysis('Failed to generate analysis. Please try again.')
      }
    } catch (error) {
      console.error('AI analysis error:', error)
      setAiAnalysis('Error occurred while generating insights. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Check if data is suitable for visualization
  const isVisualizableData = queryResults?.data && queryResults.data.length > 0 && queryResults.fields

  if (!queryResults) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-card">
          <h2 className="font-semibold text-foreground">Analysis & Results</h2>
          <p className="text-sm text-muted-foreground">Run a query to see results and insights</p>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <div>
              <h3 className="text-lg font-medium text-foreground mb-2">Ready for Analysis</h3>
              <p className="text-muted-foreground max-w-md">
                Ask a question in the chat panel or write SQL to generate insights, 
                visualizations, and detailed analysis of your data.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>Insights</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                <span>Smart Charts</span>
              </div>
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span>Export Data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Header with Tabs */}
      <div className="border-b border-border bg-card">
        <div className="p-4 pb-0">
          <h2 className="font-semibold text-foreground mb-2">Analysis Results</h2>
          {currentQuery && (
            <p className="text-sm text-muted-foreground mb-3 truncate">
              {currentQuery}
            </p>
          )}
        </div>
        
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'insights'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'data'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Data ({queryResults.rowCount} rows)
          </button>
          <button
            onClick={() => setActiveTab('visualize')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'visualize'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Visualize
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {/* AI Insights Tab */}
        {activeTab === 'insights' && (
          <div className="p-4 space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {isAnalyzing ? 'Generating Insights...' : 'Insights'}
                </h3>
                {aiAnalysis && !isAnalyzing && (
                  <button
                    onClick={() => handleCopy(() => copyInsightsText(aiAnalysis), 'insights')}
                    className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    title="Copy insights to clipboard"
                    type="button"
                  >
                    {copyStates.insights ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
              
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Analyzing your data...
                </div>
              ) : aiAnalysis ? (
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No insights available. Try running a query with data to get intelligent analysis.
                </p>
              )}
            </div>
            
            <div className="bg-card border border-border p-4 rounded-lg">
              <h4 className="font-medium text-foreground mb-2">Summary Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Records:</span>
                  <span className="font-medium ml-2">{queryResults.rowCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="font-medium ml-2">{queryResults.fields.length}</span>
                </div>
              </div>
              
              {!isAnalyzing && !aiAnalysis && (
                <button
                  onClick={generateAIAnalysis}
                  className="mt-3 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Generate Analysis
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Table Tab */}
        {activeTab === 'data' && (
          <div className="p-4">
            {/* Copy Options */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Data Table</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(() => copyTableAsCSV(queryResults.data, queryResults.fields), 'csv')}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-muted flex items-center gap-1 transition-colors"
                  title="Copy as CSV (comma-separated)"
                  type="button"
                >
                  {copyStates.csv ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copyStates.csv ? 'Copied!' : 'CSV'}
                </button>
                <button
                  onClick={() => handleCopy(() => copyTableAsTSV(queryResults.data, queryResults.fields), 'tsv')}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-muted flex items-center gap-1 transition-colors"
                  title="Copy as TSV (tab-separated)"
                  type="button"
                >
                  {copyStates.tsv ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copyStates.tsv ? 'Copied!' : 'TSV'}
                </button>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-w-full">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {queryResults.fields.map((field: any) => (
                        <th key={field.name} className="px-4 py-2 text-left font-medium max-w-xs truncate" title={field.name}>
                          {field.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.data.slice(0, 100).map((row: any, index: number) => (
                      <tr key={index} className="border-t border-border hover:bg-muted/50">
                        {queryResults.fields.map((field: any) => (
                          <td key={field.name} className="px-4 py-2 max-w-xs truncate" title={row[field.name]?.toString() || ''}>
                            {row[field.name]?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {queryResults.rowCount > 100 && (
              <p className="text-muted-foreground text-sm mt-2 text-center">
                Showing first 100 rows of {queryResults.rowCount} total
              </p>
            )}
          </div>
        )}

        {/* Visualize Tab */}
        {activeTab === 'visualize' && (
          <div className="p-4">
            {isVisualizableData ? (
              <DataVisualizer
                data={queryResults.data}
                fields={queryResults.fields}
                currentQuery={currentQuery}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50" />
                <div className="text-center">
                  <h3 className="font-medium text-foreground mb-1">No Data to Visualize</h3>
                  <p className="text-sm text-muted-foreground">Run a query that returns data to see visualizations</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Query executed in {queryResults.executionTime}ms
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-border rounded hover:bg-muted flex items-center gap-1">
              <Eye className="h-3 w-3" />
              View SQL
            </button>
            <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1">
              <Download className="h-3 w-3" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 