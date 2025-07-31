import { useMemo, useState, useRef } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { BarChart3, TrendingUp, PieChart as PieChartIcon, AlertCircle, Copy, Check } from 'lucide-react'
import { copyChartAsImage } from '../services/copyService'

// Universal date formatting utilities (works with any database)
const formatDateForDisplay = (dateValue: any): string => {
  if (!dateValue) return 'Unknown'
  
  try {
    let date: Date
    
    // Handle different date formats from different databases
    if (dateValue instanceof Date) {
      date = dateValue
    } else if (typeof dateValue === 'string') {
      // Handle ISO strings, MySQL dates, etc.
      date = new Date(dateValue)
    } else if (typeof dateValue === 'number') {
      // Handle timestamps
      date = new Date(dateValue)
    } else {
      return String(dateValue)
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return String(dateValue)
    }
    
    // Format based on the precision/type
    const dateStr = dateValue.toString()
    
    // Time series data (has time component)
    if (dateStr.includes('T') || dateStr.includes(':')) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
    
    // Date-only data
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    return String(dateValue)
  }
}

const formatDateForTooltip = (dateValue: any): string => {
  if (!dateValue) return 'Unknown'
  
  try {
    let date: Date
    
    if (dateValue instanceof Date) {
      date = dateValue
    } else {
      date = new Date(dateValue)
    }
    
    if (isNaN(date.getTime())) {
      return String(dateValue)
    }
    
    const dateStr = dateValue.toString()
    
    // Full date with time if available
    if (dateStr.includes('T') || dateStr.includes(':')) {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // Date only
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch (error) {
    return String(dateValue)
  }
}

// Detect if a value looks like a date (universal across databases)
const isDateValue = (value: any): boolean => {
  if (!value) return false
  
  const str = String(value)
  
  // Strict pattern matching for reliable date detection
  // ISO date patterns
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true
  
  // Other common date patterns
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return true
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return true
  
  // Monthly patterns
  if (/^\d{4}-\d{2}$/.test(str)) return true
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(str)) return true
  
  // Quarter patterns
  if (/^Q[1-4]\s+\d{4}$/i.test(str)) return true
  
  // Only try Date parsing for numeric-looking strings to avoid false positives with city names
  if (/^\d/.test(str)) {
    const date = new Date(value)
    return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100
  }
  
  return false
}

// Type definitions for better type safety
interface DataField {
  name: string;
  type?: string;
}

interface DataRow {
  [key: string]: string | number;
}

interface DataVisualizerProps {
  data: DataRow[]
  fields: DataField[]
  currentQuery: string
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'kpi' | 'none'
  title: string
  description: string
  reason: string
  scaleAnalysis?: {
    categoryStats: Map<string, any>
    scaleRatio: number
    hasScaleIssues: boolean
    dominantCategory: string
  }
}

interface ProcessedData {
  chartData: DataRow[]
  config: ChartConfig
  xField: string
  yField: string
  limitExceeded: boolean
}

// Configuration for scalability
const VISUALIZATION_CONFIG = {
  maxRows: 50,           // Configurable row limit
  maxSeries: 12,         // Configurable series limit  
  piechartThreshold: 10, // Configurable pie chart threshold
  
  // Expandable field patterns
  datePatterns: [
    'date', 'time', 'month', 'year', 'quarter', 'week', 'period',
    'created', 'updated', 'modified', 'timestamp', 'fiscal'
  ],
  
  numericExclusions: [
    'id', 'key', 'index', 'position', 'rank', 'order'  
  ],
  
  // Value pattern recognition
  dateValuePatterns: [
    /^\d{4}-\d{2}-\d{2}/,     // YYYY-MM-DD
    /^\d{4}-\d{2}$/,          // YYYY-MM  
    /^\d{4}$/,                // YYYY
    /^Q[1-4]/,                // Q1, Q2, etc.
    /^\d{1,2}\/\d{4}$/,       // MM/YYYY
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
    /^(January|February|March|April|May|June|July|August|September|October|November|December)/i
  ]
}

// Enhanced field detection with broader patterns
const detectFieldTypes = (data: DataRow[], fields: DataField[]) => {
  const firstRow = data[0]
  const fieldNames = fields.map(f => f.name)
  
  // More flexible numeric detection
  const numericFields = fieldNames.filter(field => {
    const value = firstRow[field]
    const fieldLower = field.toLowerCase()
    
    // Exclude known non-numeric identifiers
    const isExcluded = VISUALIZATION_CONFIG.numericExclusions.some(pattern => 
      fieldLower.includes(pattern)
    )
    if (isExcluded) return false
    
    // Check for numeric values (numbers or numeric strings)
    const isNumeric = typeof value === 'number' || 
                     (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')
    
    return isNumeric
  })
  
  // Universal date detection (works with any database)
  const dateFields = fieldNames.filter(field => {
    const value = firstRow[field]
    const fieldLower = field.toLowerCase()
    
    // Check field name patterns
    const hasDateName = VISUALIZATION_CONFIG.datePatterns.some(pattern => 
      fieldLower.includes(pattern)
    )
    
    // Use our universal date detection
    const hasDateValue = isDateValue(value)
    
    return hasDateName || hasDateValue
  })
  
  // Text fields (excluding numeric and date fields)
  const textFields = fieldNames.filter(field => {
    const value = firstRow[field] 
    const isText = (typeof value === 'string' || value === null) && 
                   !numericFields.includes(field) && 
                   !dateFields.includes(field)
    return isText
  })
  
  return { numericFields, dateFields, textFields, fieldNames }
}

// Analyze value scales to detect multi-scale issues
const analyzeValueScales = (data: DataRow[], categoryField: string, valueField: string) => {
  const categoryStats = new Map()
  
  data.forEach(row => {
    const category = row[categoryField]
    const value = Number(row[valueField]) || 0
    
    if (!categoryStats.has(category)) {
      categoryStats.set(category, { values: [], min: Infinity, max: -Infinity, avg: 0 })
    }
    
    const stats = categoryStats.get(category)
    stats.values.push(value)
    stats.min = Math.min(stats.min, value)
    stats.max = Math.max(stats.max, value)
  })
  
  // Calculate averages and detect scale differences
  const allMaxValues: number[] = []
  categoryStats.forEach((stats, _category) => {
    stats.avg = stats.values.reduce((a: number, b: number) => a + b, 0) / stats.values.length
    allMaxValues.push(stats.max)
  })
  
  const globalMax = Math.max(...allMaxValues)
  const globalMin = Math.min(...allMaxValues)
  const scaleRatio = globalMax / (globalMin || 1)
  
  return { 
    categoryStats, 
    scaleRatio, 
    hasScaleIssues: scaleRatio > 10, // 10x difference indicates scale issues
    dominantCategory: [...categoryStats.entries()].reduce((a, b) => a[1].max > b[1].max ? a : b)[0]
  }
}

// Smart chart detection logic with enhanced flexibility
const analyzeDataForVisualization = (data: DataRow[], fields: DataField[]): ChartConfig => {
  if (!data || data.length === 0) {
    return {
      type: 'none',
      title: 'No Data',
      description: 'No data available to visualize',
      reason: 'Empty dataset'
    }
  }

  console.log('🔍 DataVisualizer Debug:', {
    rowCount: data.length,
    sampleRow: data[0],
    fields: fields.map(f => ({ name: f.name, type: typeof data[0]?.[f.name], value: data[0]?.[f.name] }))
  })

  const { numericFields, dateFields, textFields, fieldNames } = detectFieldTypes(data, fields)

  console.log('🔍 Field Classification:', {
    numericFields,
    textFields, 
    dateFields,
    fieldNames
  })

  // Single KPI (one row, one numeric value)
  if (data.length === 1 && numericFields.length === 1) {
    return {
      type: 'kpi',
      title: 'Key Performance Indicator',
      description: `${numericFields[0]}: ${data[0][numericFields[0]]}`,
      reason: 'Single metric value'
    }
  }

  // Multi-series time series (date + text + numeric)
  if (dateFields.length > 0 && textFields.length > 0 && numericFields.length > 0) {
    const dateField = dateFields[0]
    const categoryField = textFields[0]
    const valueField = numericFields[0]
    const uniqueDates = new Set(data.map(row => row[dateField]))
    const hasMultipleSeries = data.length > uniqueDates.size
    
    if (hasMultipleSeries) {
      // Analyze scales to determine best visualization approach
      const scaleAnalysis = analyzeValueScales(data, categoryField, valueField)
      
      console.log('🔍 Scale Analysis:', scaleAnalysis)
      
      if (scaleAnalysis.hasScaleIssues) {
        return {
          type: 'line',
          title: 'Multi-Scale Time Analysis',
          description: `${categoryField} trends over time (mixed scales detected)`,
          reason: 'Multiple series with different scales detected',
          scaleAnalysis
        }
      }
      
      console.log('✅ Detected multi-series time series data')
      return {
        type: 'line',
        title: 'Multi-Series Time Analysis',
        description: `${categoryField} trends over time`,
        reason: 'Multiple series over time detected'
      }
    }
    
    console.log('✅ Detected single time series data')
    return {
      type: 'line',
      title: 'Time Series Analysis',
      description: `${numericFields[0]} over time`,
      reason: 'Date column detected with numeric data'
    }
  }

  // Simple time series (date + numeric, no categories)
  if (dateFields.length > 0 && numericFields.length > 0) {
    console.log('✅ Detected simple time series data')
    return {
      type: 'line',
      title: 'Time Series Analysis',
      description: `${numericFields[0]} over time`,
      reason: 'Date column detected with numeric data'
    }
  }

  // Category ranking (text + numeric, sorted data)
  if (textFields.length > 0 && numericFields.length > 0) {
    const numericFieldName = numericFields[0]
    const isDescendingSorted = data.length > 1 && 
      data.slice(0, Math.min(3, data.length - 1))
        .every((row, i) => {
          const currentVal = Number(row[numericFieldName]) || 0
          const nextVal = Number(data[i + 1][numericFieldName]) || 0
          return currentVal >= nextVal
        })
    
    if (isDescendingSorted) {
      console.log('✅ Detected ranking data (sorted)')
      return {
        type: 'bar',
        title: 'Ranking Analysis',
        description: `${textFields[0]} ranked by ${numericFields[0]}`,
        reason: 'Categorical data sorted by numeric values'
      }
    }

    // Use configurable threshold for pie vs bar decision
    if (data.length <= VISUALIZATION_CONFIG.piechartThreshold) {
      console.log('✅ Detected small category data (pie chart)')
      return {
        type: 'pie',
        title: 'Distribution Analysis',
        description: `${textFields[0]} distribution by ${numericFields[0]}`,
        reason: `Small number of categories (≤${VISUALIZATION_CONFIG.piechartThreshold}) suitable for pie chart`
      }
    }

    console.log('✅ Detected category comparison data')
    return {
      type: 'bar',
      title: 'Category Comparison',
      description: `${textFields[0]} by ${numericFields[0]}`,
      reason: 'Categorical data with numeric values'
    }
  }

  // Multiple numeric fields
  if (numericFields.length >= 2) {
    console.log('✅ Detected multi-metric data')
    return {
      type: 'bar',
      title: 'Multi-Metric Comparison',
      description: `Comparison of ${numericFields.slice(0, 2).join(' and ')}`,
      reason: 'Multiple numeric columns available'
    }
  }

  console.log('❌ No suitable visualization pattern found')
  return {
    type: 'none',
    title: 'Not Visualizable',
    description: 'This data works best as a table',
    reason: `Found ${textFields.length} text fields, ${numericFields.length} numeric fields, ${dateFields.length} date fields`
  }
}

// Process data for chart rendering
const processDataForChart = (data: DataRow[], fields: DataField[], config: ChartConfig): ProcessedData => {
  const limit = VISUALIZATION_CONFIG.maxRows
  const limitExceeded = data.length > limit
  const limitedData = data.slice(0, limit)
  
  const { numericFields, dateFields, textFields, fieldNames } = detectFieldTypes(data, fields)

  let chartData = limitedData
  let xField = textFields[0] || fieldNames[0]
  let yField = numericFields[0] || fieldNames[1]

  // Handle multi-series time series data
  if (config.type === 'line' && config.title === 'Multi-Series Time Analysis') {
    const dateField = dateFields[0]
    const categoryField = textFields[0]
    const valueField = numericFields[0]
    
    console.log('🔄 Transforming multi-series data:', { dateField, categoryField, valueField })
    
    // Create a map of dates to data points
    const dateMap = new Map()
    
    limitedData.forEach(row => {
      const date = row[dateField]
      const category = row[categoryField]
      const value = Number(row[valueField]) || 0
      
      // Format date for display but keep original for sorting
      const formattedDate = formatDateForDisplay(date)
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { 
          name: formattedDate, 
          originalDate: String(date) // Keep for sorting and tooltip
        })
      }
      
      dateMap.get(date)[category] = value
    })
    
    // Convert to array and sort by original date
    chartData = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime()
    )
    
    // Keep originalDate for tooltip formatting but don't interfere with chart rendering
    // (Recharts will ignore unknown properties)
    
    // Get all unique categories, limit to prevent overcrowding
    const allCategories = [...new Set(limitedData.map(row => row[categoryField]))]
    const categories = allCategories.slice(0, VISUALIZATION_CONFIG.maxSeries)
    
    if (allCategories.length > VISUALIZATION_CONFIG.maxSeries) {
      console.warn(`⚠️ Limited to ${VISUALIZATION_CONFIG.maxSeries} series out of ${allCategories.length} available`)
    }
    
    console.log('✅ Transformed data:', { 
      originalRows: limitedData.length, 
      chartPoints: chartData.length,
      seriesShown: categories.length,
      totalSeries: allCategories.length
    })
    
    xField = 'name' // Date field
    yField = String(categories[0]) // Will be handled differently in rendering
  }
  // Process based on chart type for other types
  else if (config.type === 'pie') {
    chartData = limitedData.map(row => {
      const nameValue = row[xField]
      return {
        name: isDateValue(nameValue) ? formatDateForDisplay(nameValue) : String(nameValue || 'Unknown'),
        value: Number(row[yField]) || 0
      }
    })
  } else if (config.type === 'bar' || config.type === 'line') {
    chartData = limitedData.map(row => {
      const nameValue = row[xField]
      return {
        name: isDateValue(nameValue) ? formatDateForDisplay(nameValue) : String(nameValue || 'Unknown'),
        value: Number(row[yField]) || 0,
        originalDate: isDateValue(nameValue) ? String(nameValue) : '', // Keep for tooltip
        ...row // Include all original fields for tooltip
      }
    })
    
    // Sort by date if x-axis contains dates
    if (isDateValue(limitedData[0]?.[xField])) {
      chartData.sort((a, b) => {
        const dateA = new Date(a.originalDate || a[xField])
        const dateB = new Date(b.originalDate || b[xField])
        return dateA.getTime() - dateB.getTime()
      })
    }
  }

  return {
    chartData,
    config,
    xField,
    yField,
    limitExceeded
  }
}

// Theme colors matching the app
const CHART_COLORS = [
  '#3b82f6', // Primary blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
]

export default function DataVisualizer({ data, fields }: DataVisualizerProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())
  // const [_useLogScale, _setUseLogScale] = useState(false) // TODO: Implement log scale feature
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartCopied, setChartCopied] = useState(false)

  const handleChartCopy = async () => {
    if (!chartRef.current) return
    const result = await copyChartAsImage(chartRef.current)
    if (result.success) {
      setChartCopied(true)
      setTimeout(() => {
        setChartCopied(false)
      }, 2000)
    }
  }
  
  const processedData = useMemo(() => {
    const config = analyzeDataForVisualization(data, fields)
    return processDataForChart(data, fields, config)
  }, [data, fields])

  const { chartData, config, yField, limitExceeded } = processedData
  
  // Get all series names for multi-series charts
  const allSeries = useMemo(() => {
    if (config.title?.includes('Multi-') && chartData.length > 0) {
      return Object.keys(chartData[0]).filter(key => key !== 'name')
    }
    return []
  }, [chartData, config.title])
  
  // Filter chart data based on hidden series
  const filteredChartData = useMemo(() => {
    if (hiddenSeries.size === 0) return chartData
    
    return chartData.map(point => {
      const filtered = { ...point }
      hiddenSeries.forEach((series: string) => {
        delete filtered[series]
      })
      return filtered
    })
  }, [chartData, hiddenSeries])
  
  const toggleSeries = (seriesName: string) => {
    setHiddenSeries((prev: Set<string>) => {
      const newHidden = new Set(prev)
      if (newHidden.has(seriesName)) {
        newHidden.delete(seriesName)
      } else {
        newHidden.add(seriesName)
      }
      return newHidden
    })
  }

  // KPI Display
  if (config.type === 'kpi') {
    const value = data[0]?.[yField] || 0
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-primary mb-2">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-sm text-muted-foreground">{yField}</div>
          <div className="text-xs text-muted-foreground mt-1">{config.reason}</div>
        </div>
      </div>
    )
  }

  // No visualization available
  if (config.type === 'none') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
        <div className="text-center">
          <h3 className="font-medium text-foreground mb-1">{config.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{config.description}</p>
          <p className="text-xs text-muted-foreground">{config.reason}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground flex items-center gap-2">
            {config.type === 'bar' && <BarChart3 className="h-4 w-4" />}
            {config.type === 'line' && <TrendingUp className="h-4 w-4" />}
            {config.type === 'pie' && <PieChartIcon className="h-4 w-4" />}
            {config.title}
          </h3>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          
          {/* Scale Analysis Warning */}
          {config.scaleAnalysis?.hasScaleIssues && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
              ⚠️ Mixed scales detected ({Math.round(config.scaleAnalysis.scaleRatio)}x difference). 
              Use controls below to focus on specific categories.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {config.reason}
          </div>
          <button
            onClick={handleChartCopy}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            title="Copy chart as image"
            type="button"
          >
            {chartCopied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Series Visibility Controls */}
      {allSeries.length > 1 && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground">Categories:</p>
          <div className="flex flex-wrap gap-2">
            {allSeries.map((series, index) => (
              <button
                key={series}
                onClick={() => toggleSeries(series)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  hiddenSeries.has(series)
                    ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                    : 'bg-white text-foreground border-gray-300 hover:bg-gray-50'
                }`}
                style={{
                  borderColor: hiddenSeries.has(series) ? undefined : CHART_COLORS[index % CHART_COLORS.length],
                  color: hiddenSeries.has(series) ? undefined : CHART_COLORS[index % CHART_COLORS.length]
                }}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" 
                      style={{ 
                        backgroundColor: hiddenSeries.has(series) 
                          ? '#ccc' 
                          : CHART_COLORS[index % CHART_COLORS.length] 
                      }} />
                {series}
              </button>
            ))}
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setHiddenSeries(new Set())}
              className="text-blue-600 hover:text-blue-800"
            >
              Show All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => setHiddenSeries(new Set(allSeries))}
              className="text-blue-600 hover:text-blue-800"
            >
              Hide All
            </button>
            {config.scaleAnalysis?.dominantCategory && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setHiddenSeries(new Set([config.scaleAnalysis!.dominantCategory]))}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Hide {config.scaleAnalysis.dominantCategory}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartRef} className="bg-card border border-border rounded-lg p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {(() => {
              if (config.type === 'bar') {
                return (
                  <BarChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload
                          if (data.originalDate) {
                            return formatDateForTooltip(data.originalDate)
                          }
                        }
                        return label
                      }}
                    />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} />
                  </BarChart>
                )
              }

              if (config.type === 'line') {
                return (
                  <LineChart data={filteredChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      labelFormatter={(label, payload) => {
                        // For all time charts, try to get original date for better formatting
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload
                          if (data.originalDate) {
                            return formatDateForTooltip(data.originalDate)
                          }
                        }
                        // Fallback: if label looks like a date, format it
                        if (isDateValue(label)) {
                          return formatDateForTooltip(label)
                        }
                        return label
                      }}
                    />
                    {config.title === 'Multi-Series Time Analysis' ? (
                      // Multi-series: Create a line for each visible category
                      (() => {
                        const categories: string[] = []
                        if (filteredChartData.length > 0) {
                          const samplePoint = filteredChartData[0]
                          Object.keys(samplePoint).forEach(key => {
                            if (key !== 'name' && !hiddenSeries.has(key)) {
                              categories.push(key)
                            }
                          })
                        }
                        
                        return categories.slice(0, 8).map((category: string, index: number) => (
                          <Line 
                            key={category}
                            type="monotone" 
                            dataKey={category}
                            stroke={CHART_COLORS[index % CHART_COLORS.length]} 
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], r: 3 }}
                            connectNulls={false}
                          />
                        ))
                      })()
                    ) : (
                      // Single series: Use the value field
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={CHART_COLORS[0]} 
                        strokeWidth={2}
                        dot={{ fill: CHART_COLORS[0] }}
                      />
                    )}
                    <Legend />
                  </LineChart>
                )
              }

              if (config.type === 'pie') {
                return (
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                )
              }

              return <div>No chart available</div>
            })()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Limitation Notice */}
      {limitExceeded && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Showing first {VISUALIZATION_CONFIG.maxRows} rows of {data.length} total rows for optimal performance
          </p>
        </div>
      )}
    </div>
  )
} 