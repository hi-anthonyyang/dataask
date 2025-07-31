import React from 'react'
import { Connection } from '../types'

interface ConnectionStatusProps {
  selectedConnection: string | null
  connections: Connection[]
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  selectedConnection, 
  connections 
}) => {
  const currentConnection = connections.find(c => c.id === selectedConnection)
  
  if (!currentConnection) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span>No database connected</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-700">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span>Connected to <span className="font-medium">{currentConnection.name}</span></span>
    </div>
  )
}

export default ConnectionStatus