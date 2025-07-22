import { useState, useRef, useEffect } from 'react'
import { Send, Play, Bot, User, Code, MessageCircle } from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  sql?: string
  timestamp: Date
}

interface ChatPanelProps {
  selectedConnection: string | null
  onQueryUpdate: (query: string) => void
  onQueryExecute: (results: any) => void
}

// Helper function to render text with styled inline code
const renderTextWithInlineCode = (text: string) => {
  const parts = text.split(/(\[\[(?:table|column):[^\]]+\]\])/g)
  
  return parts.map((part, index) => {
    const tableMatch = part.match(/^\[\[table:([^\]]+)\]\]$/)
    const columnMatch = part.match(/^\[\[column:([^\]]+)\]\]$/)
    
    if (tableMatch) {
      return (
        <span key={index} className="cursor-inline-code">
          {tableMatch[1]}
        </span>
      )
    } else if (columnMatch) {
      return (
        <span key={index} className="cursor-inline-code">
          {columnMatch[1]}
        </span>
      )
    }
    
    return part
  })
}

export default function ChatPanel({ selectedConnection, onQueryUpdate, onQueryExecute }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I can help you analyze your data. Try asking questions like:\n\n• "What are the top selling products?"\n• "Show me sales trends by month"\n• "Which customers placed the most orders?"',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [currentSql, setCurrentSql] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'sql'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedConnection) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Get current database schema first
      const schemaResponse = await fetch(`/api/db/connections/${selectedConnection}/schema`)
      let schema = { tables: [] }
      
      if (schemaResponse.ok) {
        const result = await schemaResponse.json()
        schema = result.schema || { tables: [] }
      }

      // Convert natural language to SQL with real schema context
      const response = await fetch('/api/llm/nl-to-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          schema: schema,
          connectionType: 'postgresql'
        })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `I've generated this SQL query for you:\n\n\`\`\`sql\n${data.sql}\n\`\`\`\n\nWould you like me to run it?`,
          sql: data.sql,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
        setCurrentSql(data.sql)
        onQueryUpdate(data.sql)
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error generating the SQL query. Please try again or write the SQL manually.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setIsLoading(false)
  }

  const handleExecuteQuery = async () => {
    if (!currentSql || !selectedConnection) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          sql: currentSql
        })
      })

      if (response.ok) {
        const results = await response.json()
        onQueryExecute(results)
        
        const successMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `✅ Query executed successfully! Found ${results.rowCount} records. Check the analysis panel for detailed results and insights.`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, successMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '❌ Failed to execute query. Please check your SQL syntax and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setIsLoading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    // Try to get structured data first
    const jsonData = e.dataTransfer.getData('application/json')
    const plainText = e.dataTransfer.getData('text/plain')
    
    let formattedText = plainText
    
    try {
      if (jsonData) {
        const parsed = JSON.parse(jsonData)
        if (parsed.type === 'table') {
          // Format table names with special marker for custom styling
          formattedText = `[[table:${parsed.item}]]`
        } else if (parsed.type === 'column') {
          // Format column references with special marker for custom styling
          formattedText = `[[column:${parsed.item}]]`
        }
      }
    } catch (error) {
      // Fall back to plain text if JSON parsing fails
      formattedText = plainText
    }
    
    setInput(prev => prev + (prev ? ' ' : '') + formattedText)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="border-b border-border bg-card">
        <div className="p-4 pb-0">
          <h2 className="font-semibold text-foreground mb-2">Chat & Query</h2>
        </div>
        
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="h-4 w-4" />
            SQL
          </button>
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                
                <div className={`max-w-[70%] ${message.type === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-lg p-2 text-xs ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.sql && (
                      <button
                        onClick={handleExecuteQuery}
                        className="mt-2 px-2 py-1 bg-primary/10 text-primary rounded text-xs flex items-center gap-1 hover:bg-primary/20"
                      >
                        <Play className="h-3 w-3" />
                        Run Query
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted text-muted-foreground rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="animate-pulse">Thinking...</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            <div
              className="flex gap-2"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex-1 relative">
                {/* Styled overlay for table/column references only */}
                {/\[\[(?:table|column):[^\]]+\]\]/.test(input) && (
                  <div
                    className="absolute inset-0 px-3 py-2 text-xs pointer-events-none z-10 whitespace-pre-wrap flex items-center"
                    style={{
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: '6px',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      lineHeight: 'inherit'
                    }}
                  >
                    {input.split(/(\[\[(?:table|column):[^\]]+\]\])/g).map((part, index) => {
                      const tableMatch = part.match(/^\[\[table:([^\]]+)\]\]$/)
                      const columnMatch = part.match(/^\[\[column:([^\]]+)\]\]$/)
                      
                      if (tableMatch) {
                        return (
                          <span key={index} className="cursor-inline-code">
                            {tableMatch[1]}
                          </span>
                        )
                      } else if (columnMatch) {
                        return (
                          <span key={index} className="cursor-inline-code">
                          {columnMatch[1]}
                        </span>
                      )
                    }
                    
                    // Render regular text as invisible to maintain exact spacing
                    return (
                      <span key={index} style={{ 
                        visibility: 'hidden',
                        fontFamily: 'inherit',
                        fontSize: 'inherit' 
                      }}>
                        {part}
                      </span>
                    )
                  })}
                </div>
              )}
                
                {/* Actual input field */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    selectedConnection
                      ? "Ask a question about your data..."
                      : "Select a database connection first"
                  }
                  disabled={!selectedConnection || isLoading}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 text-xs relative z-0"
                  style={{
                    color: /\[\[(?:table|column):[^\]]+\]\]/.test(input) 
                      ? 'rgba(107, 114, 128, 0.8)' // More visible gray
                      : 'inherit',
                    caretColor: 'rgb(59 130 246)' // Always show blue cursor
                  }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || !selectedConnection || isLoading}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Drag tables or columns from the schema browser into the input field
            </p>
          </div>
        </>
      )}

      {/* SQL Tab */}
      {activeTab === 'sql' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <textarea
              value={currentSql}
              onChange={(e) => {
                setCurrentSql(e.target.value)
                onQueryUpdate(e.target.value)
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleExecuteQuery()
                }
              }}
              placeholder="SELECT * FROM customers LIMIT 10;"
                              className="w-full h-full resize-none border border-border rounded-md p-3 bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="border-t border-border p-4">
            <button
              onClick={handleExecuteQuery}
              disabled={!currentSql.trim() || !selectedConnection || isLoading}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isLoading ? 'Executing...' : 'Run Query'}
            </button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              ⌘+Enter or Ctrl+Enter
            </p>
          </div>
        </div>
      )}
    </div>
  )
} 