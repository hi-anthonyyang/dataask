// No React import needed with automatic JSX runtime
import { Connection } from '../types'

interface ConnectionStatusProps {
  selectedConnection: string | null
  connections: Connection[]
}

// Status indicator styles
const STATUS_INDICATOR = {
  CONNECTED: 'w-2 h-2 bg-green-500 rounded-full animate-pulse',
  DISCONNECTED: 'w-2 h-2 bg-gray-400 rounded-full',
} as const

// Status messages
const STATUS_MESSAGES = {
  NO_CONNECTION: 'No database connected',
  CONNECTED_TO: 'Connected to',
} as const

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  selectedConnection, 
  connections 
}) => {
  const currentConnection = connections.find(c => c.id === selectedConnection)
  
  if (!currentConnection) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className={STATUS_INDICATOR.DISCONNECTED}></div>
        <span>{STATUS_MESSAGES.NO_CONNECTION}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-700">
      <div className={STATUS_INDICATOR.CONNECTED}></div>
      <span>
        {STATUS_MESSAGES.CONNECTED_TO} <span className="font-medium">{currentConnection.name}</span>
      </span>
    </div>
  )
}

export default ConnectionStatus