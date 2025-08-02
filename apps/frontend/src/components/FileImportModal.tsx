import { useState } from 'react'
import { X, FileText, Loader2 } from 'lucide-react'
import FileDropZone from './FileDropZone'

interface FileImportModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (connectionId: string) => void
  isEmbedded?: boolean
}

export default function FileImportModal({ isOpen, onClose, onConnectionAdded, isEmbedded = false }: FileImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tableName, setTableName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen && !isEmbedded) return null

  const resetModal = () => {
    setSelectedFile(null)
    setTableName('')
    setError(null)
    setIsUploading(false)
    setUploadProgress(0)
    setIsImporting(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setError(null)
    
    // Auto-generate table name from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
    setTableName(cleanName || 'imported_data')
  }

  const handleImport = async () => {
    if (!selectedFile || !tableName.trim()) {
      setError('Please select a file and provide a table name')
      return
    }

    setIsImporting(true)
    setError(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('tableName', tableName.trim())

      // Use XMLHttpRequest for progress tracking
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(progress)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers({
                'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json'
              })
            }))
          } else {
            reject(new Error(`Import failed (${xhr.status})`))
          }
        }

        xhr.onerror = () => reject(new Error('Network error during import'))
        xhr.ontimeout = () => reject(new Error('Import timed out'))

        xhr.open('POST', '/api/files/import')
        xhr.send(formData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(errorData.error || `Import failed (${response.status})`)
      }

      const result = await response.json()
      
      if (result.connectionId) {
        onConnectionAdded(result.connectionId)
        resetModal()
      } else {
        throw new Error('No connection ID returned')
      }
    } catch (error) {
      console.error('Import error:', error)
      setError(error instanceof Error ? error.message : 'Failed to import file')
    } finally {
      setIsImporting(false)
    }
  }

  const content = (
    <>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="text-center space-y-2 mb-6">
            <h3 className="text-lg font-medium">Import CSV or Excel File</h3>
            <p className="text-sm text-muted-foreground">
              Upload your data file to create a queryable table. Supports CSV, XLS, and XLSX formats.
            </p>
          </div>

          <FileDropZone
            onFileSelect={handleFileSelect}
            disabled={isUploading || isImporting}
          />

          {selectedFile && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Table Name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Table Name</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter table name"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  This will be the name of your queryable table.
                </p>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-3 py-4">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing file...'}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <button
          onClick={handleImport}
          disabled={!selectedFile || !tableName.trim() || isImporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            'Import File'
          )}
        </button>
      </div>
    </>
  )

  if (isEmbedded) {
    return content
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Import File</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}