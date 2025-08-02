import { useState } from 'react'
import { X, Upload, Database } from 'lucide-react'
import FileImportModal from './FileImportModal'
import ConnectionModal from './ConnectionModal'
import { Connection } from '../types'

interface AddDataModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (connectionId: string) => void
  editingConnection?: Connection | null
  onConnectionUpdated?: (connectionId: string) => void
}

type TabType = 'file' | 'database'

export default function AddDataModal({ 
  isOpen, 
  onClose, 
  onConnectionAdded,
  editingConnection,
  onConnectionUpdated 
}: AddDataModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('file')

  if (!isOpen) return null

  const handleClose = () => {
    setActiveTab('file') // Reset to default tab
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Data</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'file'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="h-4 w-4" />
            Import File
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'database'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="h-4 w-4" />
            Connect Database
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'file' ? (
            <FileImportModal
              isOpen={true}
              onClose={handleClose}
              onConnectionAdded={(connectionId) => {
                onConnectionAdded(connectionId)
                handleClose()
              }}
              isEmbedded={true}
            />
          ) : (
            <ConnectionModal
              isOpen={true}
              onClose={handleClose}
              onConnectionAdded={(connectionId) => {
                onConnectionAdded(connectionId)
                handleClose()
              }}
              editingConnection={editingConnection}
              onConnectionUpdated={(connectionId) => {
                onConnectionUpdated?.(connectionId)
                handleClose()
              }}
              isEmbedded={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}