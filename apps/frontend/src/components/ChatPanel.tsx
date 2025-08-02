import { useState, useRef, useEffect } from 'react'
import { Send, Play, Bot, User, Code, MessageCircle, History, Copy, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { copySQLQuery } from '../services/copy'
import { databaseService } from '../services/database'
import { QueryResult } from '../types'

// Configuration constants
const CHAT_CONFIG = {
  history: {
    maxQueries: parseInt(localStorage.getItem('chat_max_queries') || '25'),
    titleTruncateLength: parseInt(localStorage.getItem('chat_title_truncate') || '50'),
  }
};

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  sql?: string
  suggestions?: string[]
  timestamp: Date
}

interface QueryHistoryItem {
  id: string
  naturalLanguage: string
  summarizedTitle?: string
  sql: string
  connectionId: string
  timestamp: Date
  wasSuccessful: boolean
}

interface ChatPanelProps {
  selectedConnection: string | null
  connectionType: string | null
  onQueryUpdate: (query: string) => void
  onQueryExecute: (results: QueryResult) => void
  onTableClose?: () => void
}

// History management functions
const getHistoryKey = (connectionId: string) => `dataask_history_${connectionId}`

const getQueryHistory = (connectionId: string): QueryHistoryItem[] => {
  if (!connectionId) return []
  try {
    const stored = localStorage.getItem(getHistoryKey(connectionId))
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }))
  } catch (error) {
    console.error('Failed to load query history:', error)
    return []
  }
}

const saveQueryToHistory = async (item: Omit<QueryHistoryItem, 'id' | 'summarizedTitle' | 'timestamp'>) => {
  try {
    const historyKey = getHistoryKey(item.connectionId)
    const existingHistory = getQueryHistory(item.connectionId)
    
    console.log('saveQueryToHistory called:', {
      historyKey,
      existingHistoryLength: existingHistory.length,
      newItem: item
    })
    
    // Generate summarized title using OpenAI API
    let summarizedTitle = item.naturalLanguage
    
    try {
      const response = await fetch('/api/llm/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: item.naturalLanguage
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        summarizedTitle = result.title
      } else {
        // Fallback to truncation if API fails
        summarizedTitle = item.naturalLanguage.length > CHAT_CONFIG.history.titleTruncateLength
          ? item.naturalLanguage.substring(0, CHAT_CONFIG.history.titleTruncateLength).trim() + '...'
          : item.naturalLanguage
      }
    } catch (error) {
      console.error('Failed to generate title:', error)
      // Fallback to truncation
      summarizedTitle = item.naturalLanguage.length > CHAT_CONFIG.history.titleTruncateLength
        ? item.naturalLanguage.substring(0, CHAT_CONFIG.history.titleTruncateLength).trim() + '...'
        : item.naturalLanguage
    }
    
    const newItem: QueryHistoryItem = {
      ...item,
      id: Date.now().toString(),
      summarizedTitle,
      timestamp: new Date()
    }
    
    // Add to beginning of array (most recent first)
    const updatedHistory = [newItem, ...existingHistory]
    
    // Keep only most recent queries (configurable)
    const limitedHistory = updatedHistory.slice(0, CHAT_CONFIG.history.maxQueries)
    
    localStorage.setItem(historyKey, JSON.stringify(limitedHistory))
  } catch (error) {
    console.error('Failed to save query to history:', error)
  }
}

const deleteFromHistory = (connectionId: string, queryId: string) => {
  try {
    const historyKey = getHistoryKey(connectionId)
    const existingHistory = getQueryHistory(connectionId)
    const updatedHistory = existingHistory.filter(item => item.id !== queryId)
    localStorage.setItem(historyKey, JSON.stringify(updatedHistory))
  } catch (error) {
    console.error('Failed to delete from history:', error)
  }
}

export default function ChatPanel({ selectedConnection, connectionType, onQueryUpdate, onQueryExecute, onTableClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I can help you analyze your data. Try asking questions like:\n\n• "What are the top selling products?"\n• "Show me sales trends by month"\n• "Which customers placed the most orders?"',
      timestamp: new Date()
    }
  ])
  const [currentSql, setCurrentSql] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'sql' | 'history'>('chat')
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Set<string>>(new Set())
  const [lastNaturalLanguageQuery, setLastNaturalLanguageQuery] = useState<string>('')
  const [sqlCopied, setSqlCopied] = useState(false)
  const [historyCopyStates, setHistoryCopyStates] = useState<{
    [key: string]: { nl: boolean; sql: boolean }
  }>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)

  const handleSqlCopy = async () => {
    if (!currentSql) return
    const result = await copySQLQuery(currentSql)
    if (result.success) {
      setSqlCopied(true)
      setTimeout(() => {
        setSqlCopied(false)
      }, 2000)
    }
  }

  const handleHistoryCopy = async (text: string, itemId: string, type: 'nl' | 'sql') => {
    const result = await copyToClipboard(text)
    if (result.success) {
      setHistoryCopyStates(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], [type]: true }
      }))
      setTimeout(() => {
        setHistoryCopyStates(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], [type]: false }
        }))
      }, 2000)
    }
  }

  // Load history when selectedConnection changes
  useEffect(() => {
    if (selectedConnection) {
      const history = getQueryHistory(selectedConnection)
      setQueryHistory(history)
    } else {
      setQueryHistory([])
    }
    // Clear any tracked natural language query when switching connections
    setLastNaturalLanguageQuery('')
  }, [selectedConnection])

  // Clear natural language query when switching to SQL tab (direct SQL editing)
  useEffect(() => {
    if (activeTab === 'sql') {
      setLastNaturalLanguageQuery('')
    }
  }, [activeTab])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Extract plain text from contentEditable, converting styled elements back to readable names
  const getInputText = (): string => {
    if (!inputRef.current) return ''
    
    const clonedDiv = inputRef.current.cloneNode(true) as HTMLDivElement
    
    // Convert styled table/column references back to plain text
    const styledElements = clonedDiv.querySelectorAll('[data-type]')
    styledElements.forEach(el => {
      const type = el.getAttribute('data-type')
      const name = el.getAttribute('data-name')
      if (type && name) {
        el.replaceWith(document.createTextNode(name))
      }
    })
    
    return clonedDiv.textContent || ''
  }



  // Clear input
  const clearInput = () => {
    if (!inputRef.current) return
          inputRef.current.textContent = ''
  }

  const handleSendMessage = async () => {
    const inputText = getInputText().trim()
    if (!inputText || !selectedConnection) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    clearInput()
    setIsLoading(true)

    // Store the original natural language query for later use in history
    setLastNaturalLanguageQuery(inputText)

    try {
      // Get current database schema first
      const schemaResult = await databaseService.getSchema(selectedConnection)
      const schema = schemaResult.schema || { tables: [] }

      // Convert natural language to SQL with real schema context
      const response = await fetch('/api/llm/nl-to-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: inputText,
          schema: schema,
          connectionType: connectionType || 'postgresql'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        // Handle vague query suggestions
        if (data.isVague) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.message,
            suggestions: data.suggestions,
            timestamp: new Date()
          }

          setMessages(prev => [...prev, assistantMessage])
        } else {
          // Handle normal SQL generation
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
      } else {
        // Handle vague query response even on 400 status
        if (data.isVague) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.message,
            suggestions: data.suggestions,
            timestamp: new Date()
          }

          setMessages(prev => [...prev, assistantMessage])
        } else {
          // Handle other API errors
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.error || 'Sorry, I encountered an error generating the SQL query. Please try again or write the SQL manually.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
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

    // NOTE: No longer saving to history here - only save when query is actually executed
    setIsLoading(false)
  }

  const handleExecuteQuery = async () => {
    if (!currentSql || !selectedConnection) return

    setIsLoading(true)
    
    try {
      const results = await databaseService.executeQuery(selectedConnection, currentSql)

      if (results.error) {
        const errorMessageObj: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `❌ Query failed: ${results.error}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessageObj])
      } else {
        onQueryExecute(results)
        
        // Close table overview/preview when query is executed
        if (onTableClose) {
          onTableClose()
        }
        
        const successMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `Query executed successfully! Found ${results.rowCount} records. Check the analysis panel for detailed results and insights.`,
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

    // Save to history after query execution
    if (selectedConnection && currentSql.trim()) {
      try {
        // Determine what text to use for history
        let queryText = ''
        if (lastNaturalLanguageQuery) {
          // Use original natural language query if available
          queryText = lastNaturalLanguageQuery
          setLastNaturalLanguageQuery('') // Clear after use
        } else {
          // Use the SQL itself - let OpenAI infer intent
          queryText = currentSql
        }

        console.log('Saving query to history:', {
          naturalLanguage: queryText,
          sql: currentSql,
          connectionId: selectedConnection
        })

        await saveQueryToHistory({
          naturalLanguage: queryText,
          sql: currentSql,
          connectionId: selectedConnection,
          wasSuccessful: true // Assuming successful for history
        })
        
        // Refresh history display
        const updatedHistory = getQueryHistory(selectedConnection)
        setQueryHistory(updatedHistory)
        
        console.log('History updated, total items:', updatedHistory.length)
      } catch (error) {
        console.error('Failed to save to history:', error)
        // Don't fail the whole operation if history fails
      }
    }

    setIsLoading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    
    // Try to get structured data first
    const jsonData = e.dataTransfer.getData('application/json')
    const plainText = e.dataTransfer.getData('text/plain')
    
    try {
      if (jsonData) {
        const parsed = JSON.parse(jsonData)
        if (parsed.type === 'table' || parsed.type === 'column') {
          // Create styled element directly
          const styledElement = document.createElement('span')
          styledElement.className = 'cursor-inline-code'
          styledElement.setAttribute('data-type', parsed.type)
          styledElement.setAttribute('data-name', parsed.item)
          styledElement.textContent = parsed.item
          styledElement.contentEditable = 'false' // Make styled elements non-editable
          
          // Insert at current cursor position or at end
          if (inputRef.current) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0 && inputRef.current.contains(selection.focusNode)) {
              // Insert at cursor
              const range = selection.getRangeAt(0)
              range.deleteContents()
              range.insertNode(document.createTextNode(' '))
              range.insertNode(styledElement)
              range.insertNode(document.createTextNode(' '))
              range.setStartAfter(styledElement)
              range.collapse(true)
              selection.removeAllRanges()
              selection.addRange(range)
            } else {
              // Insert at end
              if (inputRef.current.textContent?.trim()) {
                inputRef.current.appendChild(document.createTextNode(' '))
              }
              inputRef.current.appendChild(styledElement)
              inputRef.current.appendChild(document.createTextNode(' '))
            }
            
            // Focus back on the input
            inputRef.current.focus()
          }
          
          return
        }
      }
    } catch (error) {
      // Fall back to plain text insertion
    }
    
    // Fallback: insert plain text
    if (plainText && inputRef.current) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0 && inputRef.current.contains(selection.focusNode)) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode((inputRef.current.textContent?.trim() ? ' ' : '') + plainText + ' '))
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        inputRef.current.appendChild(document.createTextNode((inputRef.current.textContent?.trim() ? ' ' : '') + plainText + ' '))
      }
      inputRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // History helper functions
  const toggleHistoryItem = (itemId: string) => {
    const newExpanded = new Set(expandedHistoryItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedHistoryItems(newExpanded)
  }

  const copyToClipboard = async (text: string) => {
    return await copySQLQuery(text)
  }

  const handleSuggestionClick = (suggestion: string) => {
    // Set the suggestion in the input and trigger message sending
    if (inputRef.current) {
      inputRef.current.textContent = suggestion
      inputRef.current.focus()
      handleSendMessage()
    }
  }

  const runQueryFromHistory = async (sql: string) => {
    if (!selectedConnection) return
    
    // Set the SQL in the SQL tab
    setCurrentSql(sql)
    onQueryUpdate(sql)
    
    // Execute the query
    setIsLoading(true)
    
    try {
      const results = await databaseService.executeQuery(selectedConnection, sql)

      if (results.error) {
        throw new Error(results.error)
      }

      onQueryExecute(results)
      
      // Close table overview/preview when query is executed
      if (onTableClose) {
        onTableClose()
      }
      
      const successMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Query executed successfully! Found ${results.rowCount} records. Check the analysis panel for detailed results and insights.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '❌ Failed to execute query. Please check your SQL syntax and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
    
    // NOTE: Intentionally NOT saving to history when running from history to avoid duplicates
    setIsLoading(false)
  }

  // Group history by date
  const groupHistoryByDate = (history: QueryHistoryItem[]) => {
    const groups: { [key: string]: QueryHistoryItem[] } = {}
    
    history.forEach(item => {
      const dateKey = item.timestamp.toDateString()
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(item)
    })
    
    return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
  }

  const formatDateGroup = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
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
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="h-4 w-4" />
            History
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
                    {message.suggestions && (
                      <div className="mt-3 space-y-1">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="block w-full text-left px-2 py-1 text-xs bg-card border border-border rounded hover:bg-muted/50 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
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
              <div className="flex-1">
                <div
                  ref={inputRef}
                  contentEditable
                  onKeyDown={handleKeyDown}
                  className="w-full min-h-[36px] max-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 text-xs overflow-y-auto scrollbar-thin resize-none"
                  style={{ 
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                  data-placeholder={
                    selectedConnection
                      ? "Ask a question about your data..."
                      : "Select a database connection first"
                  }
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!getInputText().trim() || !selectedConnection || isLoading}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Drag tables or columns from the schema into the chat
            </p>
          </div>
        </>
      )}

      {/* SQL Tab */}
      {activeTab === 'sql' && (
        <div className="flex-1 flex flex-col">
          {/* SQL Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="font-medium text-foreground text-sm">SQL Editor</h3>
            {currentSql.trim() && (
              <button
                onClick={handleSqlCopy}
                className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                title="Copy SQL query"
                type="button"
              >
                {sqlCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          
          <div className="flex-1 p-4 pt-0">
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

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-auto scrollbar-thin p-4">
          {queryHistory.length === 0 ? (
            <p className="text-muted-foreground">No query history yet for this connection.</p>
          ) : (
            <div className="space-y-2">
              {groupHistoryByDate(queryHistory).map(([dateKey, items]) => (
                <div key={dateKey} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground px-2">
                    {formatDateGroup(dateKey)}
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-muted p-3 rounded-lg flex flex-col"
                      onClick={() => toggleHistoryItem(item.id)}
                    >
                      <div className="flex justify-between items-center cursor-pointer">
                        <div className="flex items-center gap-2">
                          {expandedHistoryItems.has(item.id) ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs font-medium text-muted-foreground">
                            {item.summarizedTitle || item.naturalLanguage}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div 
                            className={`w-2 h-2 rounded-full ${item.wasSuccessful ? 'bg-green-500' : 'bg-red-500'}`}
                            title={item.wasSuccessful ? 'Query executed successfully' : 'Query execution failed'}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleHistoryCopy(item.naturalLanguage, item.id, 'nl')
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                            title="Copy natural language query"
                            type="button"
                          >
                            {historyCopyStates[item.id]?.nl ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFromHistory(selectedConnection || '', item.id)
                              const updatedHistory = getQueryHistory(selectedConnection || '')
                              setQueryHistory(updatedHistory)
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {expandedHistoryItems.has(item.id) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <pre className="whitespace-pre-wrap break-words bg-background p-2 rounded-md">
                            <code>{item.sql}</code>
                          </pre>
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleHistoryCopy(item.sql, item.id, 'sql')
                              }}
                              className="px-2 py-1 bg-muted/10 text-muted-foreground rounded text-xs flex items-center gap-1 hover:bg-muted/20 transition-colors"
                              title="Copy SQL"
                              type="button"
                            >
                              {historyCopyStates[item.id]?.sql ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              {historyCopyStates[item.id]?.sql ? 'Copied!' : 'Copy SQL'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                runQueryFromHistory(item.sql)
                              }}
                              className="px-2 py-1 bg-primary/10 text-primary rounded text-xs flex items-center gap-1 hover:bg-primary/20"
                            >
                              <Play className="h-3 w-3" />
                              Run Query
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 