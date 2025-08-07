import React from 'react'
import { Database } from 'lucide-react'

export interface DataTokenData {
  dataframeId: string
  dataframeName: string
  columnName: string
  columnType?: string
}

interface DataTokenProps {
  data: DataTokenData
  onRemove?: () => void
  className?: string
}

export default function DataToken({ data, onRemove, className = '' }: DataTokenProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 
        rounded text-xs font-mono border border-blue-200
        ${onRemove ? 'cursor-pointer hover:bg-blue-200' : ''}
        ${className}
      `}
      onClick={onRemove}
      title={`${data.dataframeName}.${data.columnName}${data.columnType ? ` (${data.columnType})` : ''}`}
    >
      <Database className="w-3 h-3" />
      <span className="truncate max-w-[120px]">
        {data.columnName}
      </span>
      {onRemove && (
        <span className="text-blue-600 hover:text-blue-800 ml-1">×</span>
      )}
    </span>
  )
}
