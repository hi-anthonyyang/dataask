// Universal copy service with button-based feedback
// Provides elegant copy functionality across all DataAsk components

export interface CopyResult {
  success: boolean
  message: string
}

// Core copy functionality
export const copyToClipboard = async (text: string, successMessage?: string): Promise<CopyResult> => {
  if (!text) {
    return { success: false, message: 'Nothing to copy' }
  }

  try {
    await navigator.clipboard.writeText(text)
    const message = successMessage || 'Copied to clipboard!'
    return { success: true, message }
  } catch (error) {
    console.error('Copy failed:', error)
    return { success: false, message: 'Failed to copy to clipboard' }
  }
}

// Specialized copy functions with formatted output

export const copyTableAsCSV = async (data: Record<string, unknown>[], fields: Array<{name: string}>): Promise<CopyResult> => {
  if (!data || data.length === 0) {
    return copyToClipboard('', 'No data to copy')
  }

  try {
    // Create CSV header
    const headers = fields.map(field => field.name || field).join(',')
    
    // Create CSV rows with proper escaping
    const rows = data.map(row => 
      fields.map(field => {
        const value = row[field.name || field]
        if (value === null || value === undefined) return ''
        
        // Escape CSV values that contain commas, quotes, or newlines
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
    
    const csvContent = [headers, ...rows].join('\n')
    return await copyToClipboard(csvContent, `Copied ${data.length} rows as CSV`)
  } catch (error) {
    console.error('CSV generation failed:', error)
    return { success: false, message: 'Failed to generate CSV' }
  }
}

export const copyTableAsTSV = async (data: Record<string, unknown>[], fields: Array<{name: string}>): Promise<CopyResult> => {
  if (!data || data.length === 0) {
    return copyToClipboard('', 'No data to copy')
  }

  try {
    // Create TSV header
    const headers = fields.map(field => field.name || field).join('\t')
    
    // Create TSV rows
    const rows = data.map(row => 
      fields.map(field => {
        const value = row[field.name || field]
        if (value === null || value === undefined) return ''
        
        // Replace tabs and newlines in TSV
        return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ')
      }).join('\t')
    )
    
    const tsvContent = [headers, ...rows].join('\n')
    return await copyToClipboard(tsvContent, `Copied ${data.length} rows as TSV`)
  } catch (error) {
    console.error('TSV generation failed:', error)
    return { success: false, message: 'Failed to generate TSV' }
  }
}

export const copyInsightsText = async (insights: string): Promise<CopyResult> => {
  if (!insights || insights.trim() === '') {
    return copyToClipboard('', 'No insights to copy')
  }

  // Clean up insights text for copying
  const cleanInsights = insights
    .replace(/\n\s*\n/g, '\n\n') // Normalize double line breaks
    .trim()

  return await copyToClipboard(cleanInsights, 'Insights copied!')
}

export const copySQLQuery = async (sql: string): Promise<CopyResult> => {
  if (!sql || sql.trim() === '') {
    return copyToClipboard('', 'No SQL to copy')
  }

  // Format SQL for copying
  const formattedSQL = sql.trim()
  return await copyToClipboard(formattedSQL, 'SQL query copied!')
}

// Chart image copying (requires html2canvas)
export const copyChartAsImage = async (chartElement: HTMLElement): Promise<CopyResult> => {
  try {
    // Dynamic import html2canvas
    const html2canvas = await import('html2canvas')
    
    const canvas = await html2canvas.default(chartElement, {
      logging: false,
      allowTaint: true,
      useCORS: true
    })
    
    // Convert canvas to blob
    return new Promise((resolve) => {
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          resolve({ success: false, message: 'Failed to generate chart image' })
          return
        }
        
        try {
          // Use ClipboardItem for image copying
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          
          resolve({ success: true, message: 'Chart copied as image!' })
        } catch (error) {
          console.error('Image copy failed:', error)
          resolve({ success: false, message: 'Failed to copy chart image' })
        }
      }, 'image/png')
    })
  } catch (error) {
    console.error('Chart capture failed:', error)
    return { success: false, message: 'Failed to capture chart' }
  }
}

 