import { useRef, useEffect, useCallback } from 'react'

interface UseAutoResizeTextareaOptions {
  minHeight?: number
  maxHeight?: number
  lineHeight?: number
}

export function useAutoResizeTextarea({
  minHeight = 40,
  maxHeight = 200,
  lineHeight = 20
}: UseAutoResizeTextareaOptions = {}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    
    // Calculate the new height based on content
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight))
    
    // Set the new height
    textarea.style.height = `${newHeight}px`
  }, [minHeight, maxHeight])

  // Adjust height when value changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight()
  }, [adjustHeight])

  // Initial height adjustment
  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  return {
    textareaRef,
    handleChange,
    adjustHeight
  }
} 