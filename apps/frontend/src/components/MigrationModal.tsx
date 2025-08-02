import { useState, useEffect } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { userConnectionsService, MigrationResult } from '../services/user-connections';
import StorageService from '../services/storage';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: MigrationResult) => void;
}

interface LocalConnection {
  id: string;
  name: string;
  type: string;
  config: any;
  lastConnected?: Date;
}

export default function MigrationModal({ isOpen, onClose, onComplete }: MigrationModalProps) {
  const [localConnections, setLocalConnections] = useState<LocalConnection[]>([]);
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [step, setStep] = useState<'select' | 'migrating' | 'complete'>('select');

  const loadLocalConnections = () => {
    const connections = StorageService.getConnections();
    setLocalConnections(connections);
    // Select all by default
    setSelectedConnections(new Set(connections.map((c: any) => c.id)));
  };

  const handleConnectionToggle = (connectionId: string) => {
    const newSelected = new Set(selectedConnections);
    if (newSelected.has(connectionId)) {
      newSelected.delete(connectionId);
    } else {
      newSelected.add(connectionId);
    }
    setSelectedConnections(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedConnections.size === localConnections.length) {
      setSelectedConnections(new Set());
    } else {
      setSelectedConnections(new Set(localConnections.map(c => c.id)));
    }
  };

  const handleMigrate = async () => {
    setLoading(true);
    setStep('migrating');

    try {
      const connectionsToMigrate = localConnections
        .filter(conn => selectedConnections.has(conn.id))
        .map(conn => userConnectionsService.convertLocalStorageConnection(conn));

      const result = await userConnectionsService.migrateConnections(connectionsToMigrate);
      setMigrationResult(result);
      setStep('complete');
      onComplete?.(result);
    } catch (error) {
      console.error('Migration failed:', error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setMigrationResult(null);
    setSelectedConnections(new Set());
    onClose();
  };

  const handleOpen = () => {
    if (isOpen && step === 'select') {
      loadLocalConnections();
    }
  };

  // Load connections when modal opens
  useEffect(() => {
    handleOpen();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'select' && 'Import Local Connections'}
            {step === 'migrating' && 'Importing Connections...'}
            {step === 'complete' && 'Import Complete'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-thin max-h-[60vh]">
          {step === 'select' && (
            <>
              {localConnections.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No local connections found to import.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-gray-600 mb-4">
                      We found {localConnections.length} connection(s) saved locally. 
                      Select which ones you'd like to import to your account:
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedConnections.size === localConnections.length}
                          onChange={handleSelectAll}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">
                          Select All ({selectedConnections.size}/{localConnections.length})
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {localConnections.map((connection) => (
                      <div
                        key={connection.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedConnections.has(connection.id)
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleConnectionToggle(connection.id)}
                      >
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedConnections.has(connection.id)}
                            onChange={() => handleConnectionToggle(connection.id)}
                            className="mr-3 mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-gray-900">{connection.name}</h3>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {connection.type}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {connection.type === 'sqlite' ? (
                                <span>File: {connection.config.filename}</span>
                              ) : (
                                <span>
                                  {connection.config.host}:{connection.config.port}/{connection.config.database}
                                </span>
                              )}
                            </div>
                            {connection.lastConnected && (
                              <div className="mt-1 text-xs text-gray-500">
                                Last used: {connection.lastConnected.toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 'migrating' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Importing your connections...</p>
            </div>
          )}

          {step === 'complete' && migrationResult && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Import Complete!</h3>
                <p className="text-gray-600">
                  {migrationResult.summary.successful} of {migrationResult.summary.total} connections imported successfully.
                </p>
              </div>

              {migrationResult.results.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Successfully Imported:</h4>
                  <div className="space-y-2">
                    {migrationResult.results.map((result, index) => (
                      <div key={index} className="flex items-center text-sm text-green-600">
                        <Check className="w-4 h-4 mr-2" />
                        {result.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {migrationResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2">Failed to Import:</h4>
                  <div className="space-y-2">
                    {migrationResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600">
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {error.name}
                        </div>
                        <div className="ml-6 text-xs text-red-500">
                          {error.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
          {step === 'select' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Skip Import
              </button>
              <button
                onClick={handleMigrate}
                disabled={selectedConnections.size === 0 || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Selected ({selectedConnections.size})
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}