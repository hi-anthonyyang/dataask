import { useState } from 'react'
import { X, FileText, Loader2, Upload } from 'lucide-react'
import { FilePreview, FileColumn } from '../types'
import FileDropZone from './FileDropZone'
import DataPreview from './DataPreview'
import ColumnTypeEditor from './ColumnTypeEditor'

interface FileImportModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (connectionId: string) => void
}

type ImportStep = 'upload' | 'preview' | 'configure' | 'importing'

export default function FileImportModal({ isOpen, onClose, onConnectionAdded }: FileImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [columns, setColumns] = useState<FileColumn[]>([])
  const [tableName, setTableName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempFilePath, setTempFilePath] = useState<string | null>(null)

  if (!isOpen) return null

  const resetModal = () => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setPreview(null)
    setColumns([])
    setTableName('')
    setError(null)
    setTempFilePath(null)
    setIsUploading(false)
    setIsImporting(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(errorData.error || `Upload failed (${response.status})`)
      }

      const previewData = await response.json()
      setPreview(previewData)
      setColumns(previewData.columns)
      setTempFilePath(previewData.tempFilePath)
      
      // Generate default table name from filename
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '')
      const sanitizedName = nameWithoutExtension
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[^a-zA-Z_]/, '_')
        .substring(0, 50)
      setTableName(sanitizedName || 'imported_data')
      
      setCurrentStep('preview')
    } catch (error) {
      console.error('File upload failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImport = async () => {
    if (!preview || !tempFilePath || !tableName.trim()) return

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/files/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: preview.filename,
          tableName: tableName.trim(),
          columns,
          tempFilePath
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(errorData.error || `Import failed (${response.status})`)
      }

      const result = await response.json()
      onConnectionAdded(result.connectionId)
      handleClose()
    } catch (error) {
      console.error('File import failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to import file')
    } finally {
      setIsImporting(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return selectedFile && preview && !isUploading
      case 'preview':
        return true
      case 'configure':
        return tableName.trim().length > 0 && columns.length > 0
      default:
        return false
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload':
        return 'Import File'
      case 'preview':
        return 'Preview Data'
      case 'configure':
        return 'Configure Import'
      case 'importing':
        return 'Importing...'
      default:
        return 'Import File'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {getStepTitle()}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded transition-colors"
            disabled={isImporting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            {[
              { step: 'upload', label: 'Upload', icon: Upload },
              { step: 'preview', label: 'Preview', icon: FileText },
              { step: 'configure', label: 'Configure', icon: FileText }
            ].map(({ step, label, icon: Icon }, index) => {
              const isActive = currentStep === step
              const isCompleted = ['upload', 'preview', 'configure'].indexOf(currentStep) > index
              const isClickable = isCompleted || (index === 1 && currentStep === 'preview')

              return (
                <button
                  key={step}
                  onClick={() => isClickable && setCurrentStep(step as ImportStep)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                      : 'text-muted-foreground'
                  } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <h3 className="text-lg font-medium">Import CSV or Excel File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your data file to create a queryable table. Supports CSV, XLS, and XLSX formats.
                </p>
              </div>

              <FileDropZone
                onFileSelect={handleFileSelect}
                disabled={isUploading}
              />

              {isUploading && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processing file...</span>
                </div>
              )}

              {selectedFile && (
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
              )}
            </div>
          )}

          {currentStep === 'preview' && preview && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <h3 className="text-lg font-medium">Data Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Review your data and the automatically detected column types.
                </p>
              </div>

              <DataPreview preview={preview} />
            </div>
          )}

          {currentStep === 'configure' && (
            <div className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <h3 className="text-lg font-medium">Configure Import</h3>
                <p className="text-sm text-muted-foreground">
                  Customize the table name and column types before importing.
                </p>
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

              <ColumnTypeEditor
                columns={columns}
                onColumnsChange={setColumns}
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
          {currentStep !== 'upload' && (
            <button
              onClick={() => {
                if (currentStep === 'preview') setCurrentStep('upload')
                else if (currentStep === 'configure') setCurrentStep('preview')
              }}
              disabled={isImporting}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          )}
          
          <div className="flex-1" />
          
          {currentStep === 'preview' && (
            <button
              onClick={() => setCurrentStep('configure')}
              disabled={!canProceed()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Configure Import
            </button>
          )}

          {currentStep === 'configure' && (
            <button
              onClick={handleImport}
              disabled={!canProceed() || isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Data'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}