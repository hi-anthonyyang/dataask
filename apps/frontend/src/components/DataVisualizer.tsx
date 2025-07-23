import { useMemo } from 'react'
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
import { BarChart3, TrendingUp, PieChart as PieChartIcon, AlertCircle } from 'lucide-react'

interface DataVisualizerProps {
  data: any[]
  fields: any[]
  currentQuery: string
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'kpi' | 'none'
  title: string
  description: string
  reason: string
}

interface ProcessedData {
  chartData: any[]
  config: ChartConfig
  xField: string
  yField: string
  limitExceeded: boolean
}

// Smart chart detection logic
const analyzeDataForVisualization = (data: any[], fields: any[]): ChartConfig => {
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

  const firstRow = data[0]
  const fieldNames = fields.map(f => f.name)
  
  // Analyze column types - be more flexible with numeric detection
  const numericFields = fieldNames.filter(field => {
    const value = firstRow[field]
    // Check for actual numbers, or strings that represent numbers
    const isNumeric = typeof value === 'number' || 
                     (typeof value === 'string' && !isNaN(Number(value)) && Number(value) !== 0) ||
                     (typeof value === 'string' && /^\d+$/.test(value))
    return isNumeric && field !== 'id' && !field.toLowerCase().includes('id')
  })
  
  const textFields = fieldNames.filter(field => {
    const value = firstRow[field]
    const isText = (typeof value === 'string' || value === null) && 
                   !numericFields.includes(field) && 
                   !field.toLowerCase().includes('id')
    return isText
  })
  
  // Expanded date field detection
  const dateFields = fieldNames.filter(field => {
    const value = firstRow[field]
    const fieldLower = field.toLowerCase()
    
    // Check field name patterns
    const hasDateName = fieldLower.includes('date') || 
                       fieldLower.includes('time') || 
                       fieldLower.includes('month') || 
                       fieldLower.includes('year') || 
                       fieldLower.includes('quarter') ||
                       fieldLower.includes('week')
                       
    // Check value patterns if it's a string
    let hasDateValue = false
    if (typeof value === 'string') {
      hasDateValue = /^\d{4}-\d{2}-\d{2}/.test(value) || // YYYY-MM-DD
                     /^\d{4}-\d{2}$/.test(value) ||      // YYYY-MM
                     /^\d{4}$/.test(value) ||            // YYYY
                     /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(value) || // Month names
                     /^(January|February|March|April|May|June|July|August|September|October|November|December)/.test(value)
    }
    
    return hasDateName || hasDateValue
  })

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
      description: `${numericFields[0]}: ${firstRow[numericFields[0]]}`,
      reason: 'Single metric value'
    }
  }

  // Multi-series time series (date + text + numeric)
  if (dateFields.length > 0 && textFields.length > 0 && numericFields.length > 0) {
    // Check if we have multiple rows with the same date (indicating multiple series)
    const dateField = dateFields[0]
    const uniqueDates = new Set(data.map(row => row[dateField]))
    const hasMultipleSeries = data.length > uniqueDates.size
    
    if (hasMultipleSeries) {
      console.log('✅ Detected multi-series time series data')
      return {
        type: 'line',
        title: 'Multi-Series Time Analysis',
        description: `${textFields[0]} trends over time`,
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
    // Check if data appears to be sorted by checking first few rows
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

    // Few categories - pie chart
    if (data.length <= 8) {
      console.log('✅ Detected small category data (pie chart)')
      return {
        type: 'pie',
        title: 'Distribution Analysis',
        description: `${textFields[0]} distribution by ${numericFields[0]}`,
        reason: 'Small number of categories suitable for pie chart'
      }
    }

    // Many categories - bar chart
    console.log('✅ Detected category comparison data')
    return {
      type: 'bar',
      title: 'Category Comparison',
      description: `${textFields[0]} by ${numericFields[0]}`,
      reason: 'Categorical data with numeric values'
    }
  }

  // Multiple numeric fields - could be bar chart
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
  // No suitable visualization
  return {
    type: 'none',
    title: 'Not Visualizable',
    description: 'This data works best as a table',
    reason: `Found ${textFields.length} text fields, ${numericFields.length} numeric fields, ${dateFields.length} date fields`
  }
}

// Process data for chart rendering
const processDataForChart = (data: any[], fields: any[], config: ChartConfig): ProcessedData => {
  const limit = 25
  const limitExceeded = data.length > limit
  const limitedData = data.slice(0, limit)
  
  const fieldNames = fields.map(f => f.name)
  const numericFields = fieldNames.filter(field => {
    const value = data[0]?.[field]
    return typeof value === 'number' && field !== 'id'
  })
  
  const textFields = fieldNames.filter(field => {
    const value = data[0]?.[field]
    return typeof value === 'string' || value === null
  })

  const dateFields = fieldNames.filter(field => {
    const value = data[0]?.[field]
    const fieldLower = field.toLowerCase()
    const hasDateName = fieldLower.includes('date') || 
                       fieldLower.includes('time') || 
                       fieldLower.includes('month') || 
                       fieldLower.includes('year') || 
                       fieldLower.includes('quarter') ||
                       fieldLower.includes('week')
    let hasDateValue = false
    if (typeof value === 'string') {
      hasDateValue = /^\d{4}-\d{2}-\d{2}/.test(value) || 
                     /^\d{4}-\d{2}$/.test(value) ||      
                     /^\d{4}$/.test(value) ||            
                     /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(value) || 
                     /^(January|February|March|April|May|June|July|August|September|October|November|December)/.test(value)
    }
    return hasDateName || hasDateValue
  })

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
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { name: date })
      }
      
      dateMap.get(date)[category] = value
    })
    
    // Convert to array and sort by date
    chartData = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.name).getTime() - new Date(b.name).getTime()
    )
    
    // Get all unique categories for the chart
    const categories = [...new Set(limitedData.map(row => row[categoryField]))]
    
    console.log('✅ Transformed data:', { 
      originalRows: limitedData.length, 
      chartPoints: chartData.length,
      categories: categories.slice(0, 5) + (categories.length > 5 ? '...' : '')
    })
    
    xField = 'name' // Date field
    yField = categories[0] // Will be handled differently in rendering
  }
  // Process based on chart type for other types
  else if (config.type === 'pie') {
    chartData = limitedData.map(row => ({
      name: row[xField] || 'Unknown',
      value: row[yField] || 0
    }))
  } else if (config.type === 'bar' || config.type === 'line') {
    chartData = limitedData.map(row => ({
      name: row[xField] || 'Unknown',
      value: row[yField] || 0,
      ...row // Include all original fields for tooltip
    }))
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

export default function DataVisualizer({ data, fields, currentQuery }: DataVisualizerProps) {
  const processedData = useMemo(() => {
    const config = analyzeDataForVisualization(data, fields)
    return processDataForChart(data, fields, config)
  }, [data, fields])

  const { chartData, config, xField, yField, limitExceeded } = processedData

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
        </div>
        <div className="text-xs text-muted-foreground">
          {config.reason}
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {config.type === 'bar' && (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                />
                <Bar dataKey="value" fill={CHART_COLORS[0]} />
              </BarChart>
            )}

            {config.type === 'line' && (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                />
                {config.title === 'Multi-Series Time Analysis' ? (
                  // Multi-series: Create a line for each category
                  (() => {
                    const categories: string[] = []
                    if (chartData.length > 0) {
                      const samplePoint = chartData[0]
                      Object.keys(samplePoint).forEach(key => {
                        if (key !== 'name') {
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
            )}

            {config.type === 'pie' && (
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Limitation Notice */}
      {limitExceeded && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Showing first 25 rows of {data.length} total rows for optimal performance
          </p>
        </div>
      )}
    </div>
  )
} 