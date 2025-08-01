import { FilePreview } from '../types'

interface DataPreviewProps {
  preview: FilePreview
  className?: string
}

export default function DataPreview({ preview, className = '' }: DataPreviewProps) {
  const { filename, rowCount, columns, sampleData, headers } = preview

  const formatValue = (value: any): string => {
    if (value == null || value === '') return '-'
    if (typeof value === 'number') return value.toString()
    return String(value)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INTEGER':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'REAL':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'DATE':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'TEXT':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Info */}
      <div className="bg-muted/50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">{filename}</h4>
            <p className="text-xs text-muted-foreground">
              {rowCount.toLocaleString()} rows • {columns.length} columns
            </p>
          </div>
        </div>
      </div>

      {/* Column Types */}
      <div className="space-y-2">
        <h5 className="text-sm font-medium">Detected Column Types</h5>
        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
          {columns.map((column, index) => (
            <div key={index} className="flex items-center justify-between text-xs p-2 bg-background border rounded">
              <span className="font-medium truncate flex-1 mr-2">{column.name}</span>
              <span className={`px-2 py-1 rounded border text-xs font-medium ${getTypeColor(column.type)}`}>
                {column.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Preview */}
      <div className="space-y-2">
        <h5 className="text-sm font-medium">Data Preview (first 10 rows)</h5>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {headers.map((header, index) => (
                    <th key={index} className="px-3 py-2 text-left font-medium border-r last:border-r-0">
                      <div className="flex flex-col gap-1">
                        <span className="truncate max-w-24" title={header}>{header}</span>
                        <span className={`px-1 py-0.5 rounded text-xs ${getTypeColor(columns[index]?.type || 'TEXT')}`}>
                          {columns[index]?.type || 'TEXT'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t hover:bg-muted/25">
                    {headers.map((_, colIndex) => (
                      <td key={colIndex} className="px-3 py-2 border-r last:border-r-0">
                        <div className="truncate max-w-32" title={formatValue((row as any[])[colIndex])}>
                          {formatValue((row as any[])[colIndex])}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {rowCount > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing first 10 rows of {rowCount.toLocaleString()} total rows
          </p>
        )}
      </div>
    </div>
  )
}