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

  const firstRow = data[0]
  const fieldNames = fields.map(f => f.name)
  
  // Analyze column types
  const numericFields = fieldNames.filter(field => {
    const value = firstRow[field]
    return typeof value === 'number' && field !== 'id'
  })
  
  const textFields = fieldNames.filter(field => {
    const value = firstRow[field]
    return typeof value === 'string' || value === null
  })
  
  const dateFields = fieldNames.filter(field => {
    const value = firstRow[field]
    if (typeof value === 'string') {
      return /^\d{4}-\d{2}-\d{2}/.test(value) || field.toLowerCase().includes('date') || field.toLowerCase().includes('time')
    }
    return false
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

  // Time series (date + numeric)
  if (dateFields.length > 0 && numericFields.length > 0) {
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
    const isDescendingSorted = data.length > 1 && 
      data.slice(0, Math.min(3, data.length - 1))
        .every((row, i) => row[numericFields[0]] >= data[i + 1][numericFields[0]])
    
    if (isDescendingSorted) {
      return {
        type: 'bar',
        title: 'Ranking Analysis',
        description: `${textFields[0]} ranked by ${numericFields[0]}`,
        reason: 'Categorical data sorted by numeric values'
      }
    }

    // Few categories - pie chart
    if (data.length <= 8) {
      return {
        type: 'pie',
        title: 'Distribution Analysis',
        description: `${textFields[0]} distribution by ${numericFields[0]}`,
        reason: 'Small number of categories suitable for pie chart'
      }
    }

    // Many categories - bar chart
    return {
      type: 'bar',
      title: 'Category Comparison',
      description: `${textFields[0]} by ${numericFields[0]}`,
      reason: 'Categorical data with numeric values'
    }
  }

  // Multiple numeric fields - could be bar chart
  if (numericFields.length >= 2) {
    return {
      type: 'bar',
      title: 'Multi-Metric Comparison',
      description: `Comparison of ${numericFields.slice(0, 2).join(' and ')}`,
      reason: 'Multiple numeric columns available'
    }
  }

  // No suitable visualization
  return {
    type: 'none',
    title: 'Not Visualizable',
    description: 'This data works best as a table',
    reason: 'No clear patterns for visualization'
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

  let chartData = limitedData
  let xField = textFields[0] || fieldNames[0]
  let yField = numericFields[0] || fieldNames[1]

  // Process based on chart type
  if (config.type === 'pie') {
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
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={CHART_COLORS[0]} 
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS[0] }}
                />
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
                  fill="#8884d8"
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