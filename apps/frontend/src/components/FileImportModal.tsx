import { useState } from 'react'
import { X, FileText, Loader2, Upload } from 'lucide-react'
import { dataframeService } from '../services/dataframe'

interface FileImportModalProps {
  isOpen: boolean
  onClose: () => void
  onConnectionAdded: (dataframeId: string) => void
}

export default function FileImportModal({ isOpen, onClose, onConnectionAdded }: FileImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null)
      setError(null)
      onClose()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!['csv', 'xls', 'xlsx'].includes(fileExtension || '')) {
        setError('Please select a CSV or Excel file')
        return
      }
      setSelectedFile(file)
      setError(null)
      // Auto-upload when file is selected
      handleUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!['csv', 'xls', 'xlsx'].includes(fileExtension || '')) {
        setError('Please select a CSV or Excel file')
        return
      }
      setSelectedFile(file)
      setError(null)
      // Auto-upload when file is dropped
      handleUpload(file)
    }
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      const response = await dataframeService.uploadFile(file)
      onConnectionAdded(response.dataframeId)
      handleClose()
    } catch (error) {
      console.error('Upload failed:', error)
      setError(error.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload Data File</h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border border-dashed border-blue-300 bg-blue-50/50 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm text-gray-600">Uploading and processing...</p>
              </div>
            ) : selectedFile ? (
              <div className="space-y-3">
                <FileText className="w-10 h-10 text-blue-600 mx-auto" />
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                <div>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <span className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                      Upload
                    </span>
                  </label>
                  <span className="text-sm text-gray-600">
                    {" "}or drag and drop your file here
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Supports CSV and Excel files (max 50MB)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}