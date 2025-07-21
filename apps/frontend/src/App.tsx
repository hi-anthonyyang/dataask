import { useState } from 'react'
import SchemaBrowser from './components/SchemaBrowser'
import AnalysisPanel from './components/AnalysisPanel'
import ChatPanel from './components/ChatPanel'
import { Database } from 'lucide-react'

function App() {
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [currentQuery, setCurrentQuery] = useState<string>('')
  const [queryResults, setQueryResults] = useState<any>(null)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">DataAsk</h1>
          <span className="text-sm text-muted-foreground">AI-Powered SQL Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedConnection && (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-muted-foreground">Connected</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Schema Browser (25%) */}
        <div className="w-1/4 border-r border-border bg-card">
          <SchemaBrowser 
            selectedConnection={selectedConnection}
            onConnectionSelect={setSelectedConnection}
          />
        </div>

        {/* Center Panel - Analysis & Results (50%) */}
        <div className="flex-1 bg-background">
          <AnalysisPanel 
            queryResults={queryResults}
            currentQuery={currentQuery}
          />
        </div>

        {/* Right Panel - Chat & SQL (25%) */}
        <div className="w-1/4 border-l border-border bg-card">
          <ChatPanel 
            selectedConnection={selectedConnection}
            onQueryUpdate={setCurrentQuery}
            onQueryExecute={setQueryResults}
          />
        </div>
      </div>
    </div>
  )
}

export default App 