import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import DataToken, { DataTokenData } from '../DataToken'

describe('DataToken', () => {
  const mockTokenData: DataTokenData = {
    dataframeId: 'test-df-1',
    dataframeName: 'test_data',
    columnName: 'age',
    columnType: 'int64'
  }

  it('renders token with correct information', () => {
    render(<DataToken data={mockTokenData} />)
    
    expect(screen.getByText('test_data.age')).toBeInTheDocument()
    expect(screen.getByTitle('test_data.age (int64)')).toBeInTheDocument()
  })

  it('renders token without column type', () => {
    const tokenWithoutType = { ...mockTokenData, columnType: undefined }
    render(<DataToken data={tokenWithoutType} />)
    
    expect(screen.getByText('test_data.age')).toBeInTheDocument()
    expect(screen.getByTitle('test_data.age')).toBeInTheDocument()
  })

  it('calls onRemove when clicked', () => {
    const onRemove = vi.fn()
    render(<DataToken data={mockTokenData} onRemove={onRemove} />)
    
    const token = screen.getByText('test_data.age').closest('span')
    token?.click()
    
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    render(<DataToken data={mockTokenData} className="custom-class" />)
    
    const token = screen.getByText('test_data.age').closest('span')
    expect(token).toHaveClass('custom-class')
  })
})
