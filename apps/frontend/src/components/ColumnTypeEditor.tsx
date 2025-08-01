import { FileColumn } from '../types'

interface ColumnTypeEditorProps {
  columns: FileColumn[]
  onColumnsChange: (columns: FileColumn[]) => void
  className?: string
}

const COLUMN_TYPES = [
  { value: 'TEXT', label: 'Text', description: 'String values' },
  { value: 'INTEGER', label: 'Integer', description: 'Whole numbers' },
  { value: 'REAL', label: 'Number', description: 'Decimal numbers' },
  { value: 'DATE', label: 'Date', description: 'Date/time values' }
] as const

export default function ColumnTypeEditor({ columns, onColumnsChange, className = '' }: ColumnTypeEditorProps) {
  const updateColumn = (index: number, updates: Partial<FileColumn>) => {
    const newColumns = [...columns]
    newColumns[index] = { ...newColumns[index], ...updates }
    onColumnsChange(newColumns)
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
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium">Column Configuration</h5>
        <p className="text-xs text-muted-foreground">
          Review and adjust column types as needed
        </p>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {columns.map((column, index) => (
          <div key={index} className="grid grid-cols-12 gap-3 items-center p-3 bg-background border rounded-lg">
            {/* Column Name */}
            <div className="col-span-4">
              <input
                type="text"
                value={column.name}
                onChange={(e) => updateColumn(index, { name: e.target.value })}
                className="w-full text-sm px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Column name"
              />
            </div>

            {/* Column Type */}
            <div className="col-span-3">
              <select
                value={column.type}
                onChange={(e) => updateColumn(index, { type: e.target.value as FileColumn['type'] })}
                className="w-full text-sm px-2 py-1 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {COLUMN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Indicator */}
            <div className="col-span-2">
              <span className={`px-2 py-1 rounded border text-xs font-medium ${getTypeColor(column.type)}`}>
                {column.type}
              </span>
            </div>

            {/* Sample Values */}
            <div className="col-span-3">
              <div className="text-xs text-muted-foreground">
                {column.sampleValues && column.sampleValues.length > 0 ? (
                  <div className="space-y-0.5">
                    {column.sampleValues.slice(0, 2).map((value, i) => (
                      <div key={i} className="truncate max-w-full" title={String(value)}>
                        {value != null ? String(value) : '(empty)'}
                      </div>
                    ))}
                    {column.sampleValues.length > 2 && (
                      <div className="text-muted-foreground/70">
                        +{column.sampleValues.length - 2} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground/50">No samples</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Type Descriptions */}
      <div className="bg-muted/30 rounded-lg p-3">
        <h6 className="text-xs font-medium mb-2">Column Types:</h6>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {COLUMN_TYPES.map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(type.value)}`}>
                {type.label}
              </span>
              <span className="text-muted-foreground">{type.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}