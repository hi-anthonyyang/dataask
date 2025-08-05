import { useState, useRef, useEffect } from 'react'
import { Send, Play, Bot, User, Code, MessageCircle, Loader2 } from 'lucide-react'
import { dataframeService, DataFrameQueryResult } from '../services/dataframe'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'error'
  content: string
  code?: string
  timestamp: Date
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
  const [isLoading, setIsLoading] = useState(false)
  const [currentDataFrameInfo, setCurrentDataFrameInfo] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
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
        content: `Failed to generate code: ${error.message}`,
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
        content: `Execution error: ${error.message}`,
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
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
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
              <div>
                <div className={`rounded-lg px-4 py-2 ${
                  message.type === 'user' ? 'bg-blue-600 text-white' : 
                  message.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.content}
                </div>
                {message.code && (
                  <div className="mt-2">
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">Generated Code</span>
                        <button
                          onClick={() => copyCode(message.code!)}
                          className="text-xs text-gray-400 hover:text-white flex items-center"
                        >
                          <Code className="w-3 h-3 mr-1" />
                          Copy
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap">{message.code}</pre>
                    </div>
                    <button
                      onClick={() => executeCode(message.code!)}
                      className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run Code
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
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentDataFrameInfo ? "Ask a question about your data..." : "Select a data file first"}
            disabled={!currentDataFrameInfo || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || !currentDataFrameInfo || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
} 