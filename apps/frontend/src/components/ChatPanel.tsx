import { useState, useRef, useEffect } from 'react'
import { Send, Play, Bot, User, Code, MessageCircle, Loader2 } from 'lucide-react'
import { dataframeService, DataFrameQueryResult } from '../services/dataframe'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import DataToken, { DataTokenData } from './DataToken'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'error'
  content: string
  code?: string
  timestamp: Date
  dataTokens?: DataTokenData[]
}

interface ChatPanelProps {
  selectedDataFrame: string | null
  onCodeUpdate: (code: string) => void
  onQueryExecute: (results: DataFrameQueryResult) => void
}

export default function ChatPanel({
  selectedDataFrame,
  onCodeUpdate,
  onQueryExecute
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [inputTokens, setInputTokens] = useState<DataTokenData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentDataFrameInfo, setCurrentDataFrameInfo] = useState<any>(null)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [runningCodeId, setRunningCodeId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-resize textarea hook
  const { textareaRef, handleChange: handleTextareaChange, adjustHeight } = useAutoResizeTextarea({
    minHeight: 44, // Match button height
    maxHeight: 120, // Limit to 6 lines
  })

  // Load DataFrame info when selection changes
  useEffect(() => {
    if (selectedDataFrame) {
      loadDataFrameInfo()
    } else {
      setCurrentDataFrameInfo(null)
      setMessages([])
    }
  }, [selectedDataFrame])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (input === '') {
      adjustHeight()
    }
  }, [input, adjustHeight])

  const loadDataFrameInfo = async () => {
    if (!selectedDataFrame) return
    
    try {
      const { info } = await dataframeService.getDataFrameInfo(selectedDataFrame)
      setCurrentDataFrameInfo(info)
      
      // Add welcome message
      setMessages([{
        id: Date.now().toString(),
        type: 'assistant',
        content: `I'm ready to help you analyze "${info.name}". This dataset has ${info.shape[0].toLocaleString()} rows and ${info.shape[1]} columns. What would you like to explore?`,
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('Failed to load DataFrame info:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !selectedDataFrame || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
      dataTokens: inputTokens.length > 0 ? [...inputTokens] : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setInputTokens([])
    setIsLoading(true)

    try {
      // Generate pandas code
      const { code, explanation } = await dataframeService.generatePandasCode(
        userMessage.content,
        {
          columns: currentDataFrameInfo.columns,
          dtypes: currentDataFrameInfo.dtypes,
          shape: currentDataFrameInfo.shape
        }
      )

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: explanation,
        code: code,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      onCodeUpdate(code)

      // Execute the code automatically
      await executeCode(code)
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: `Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const executeCode = async (code: string) => {
    if (!selectedDataFrame) return

    try {
      const result = await dataframeService.executePandasCode(selectedDataFrame, code)
      onQueryExecute(result)
    } catch (error) {
      console.error('Failed to execute code:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'error',
        content: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    handleTextareaChange(e)
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const data = e.dataTransfer.getData('application/json')
      const tokenData: DataTokenData = JSON.parse(data)
      setInputTokens(prev => [...prev, tokenData])
    } catch (error) {
      console.error('Failed to parse dropped data token:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    setIsDragOver(false)
  }

  const removeInputToken = (index: number) => {
    setInputTokens(prev => prev.filter((_, i) => i !== index))
  }

  const copyCode = (code: string, messageId: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeId(messageId)
    setTimeout(() => setCopiedCodeId(null), 2000) // Reset after 2 seconds
  }

  const executeCodeWithFeedback = async (code: string, messageId: string) => {
    setRunningCodeId(messageId)
    try {
      await executeCode(code)
    } finally {
      setTimeout(() => setRunningCodeId(null), 2000) // Reset after 2 seconds
    }
  }

  if (!selectedDataFrame) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Selected</h3>
          <p className="text-sm text-gray-500 mb-3">Upload a CSV or Excel file to start analyzing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] min-w-0 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === 'user' ? 'bg-blue-600 ml-2' : 
                message.type === 'error' ? 'bg-red-100 mr-2' : 'bg-gray-100 mr-2'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className={`w-4 h-4 ${message.type === 'error' ? 'text-red-600' : 'text-gray-600'}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`rounded-lg px-4 py-2 break-words ${
                  message.type === 'user' ? 'bg-blue-600 text-white' : 
                  message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.dataTokens && message.dataTokens.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.dataTokens.map((token, index) => (
                        <DataToken
                          key={`${token.dataframeId}-${token.columnName}-${index}`}
                          data={token}
                          className="text-xs"
                        />
                      ))}
                    </div>
                  )}
                </div>
                {message.code && (
                  <div className="mt-2">
                    <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-3 font-mono text-sm overflow-x-auto">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-600 font-medium">Generated Code</span>
                        <button
                          onClick={() => copyCode(message.code!, message.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          {copiedCodeId === message.id ? null : <Code className="w-3 h-3 mr-1" />}
                          {copiedCodeId === message.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-blue-800">{message.code}</pre>
                    </div>
                    <button
                      onClick={() => executeCodeWithFeedback(message.code!, message.id)}
                      className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      {runningCodeId === message.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 mr-1" />
                      )}
                      {runningCodeId === message.id ? 'Running...' : 'Run Code'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              <span className="text-gray-600">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 flex-shrink-0">
        <div className="relative min-w-0">
          {/* Input Tokens */}
          {inputTokens.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {inputTokens.map((token, index) => (
                <DataToken
                  key={`input-${token.dataframeId}-${token.columnName}-${index}`}
                  data={token}
                  onRemove={() => removeInputToken(index)}
                  className="text-xs"
                />
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            placeholder={currentDataFrameInfo ? "Ask a question about your data... (drag columns here)" : "Select a data file first"}
            disabled={!currentDataFrameInfo || isLoading}
            className={`w-full px-5 py-4 pr-14 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-w-0 break-words overflow-y-auto ${
              isDragOver 
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200' 
                : 'border-gray-300'
            }`}
            style={{ 
              wordWrap: 'break-word', 
              overflowWrap: 'break-word',
              minHeight: '44px',
              maxHeight: '120px'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !currentDataFrameInfo || isLoading}
            className="absolute bottom-3 right-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
} 