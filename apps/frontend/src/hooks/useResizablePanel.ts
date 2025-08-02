/**
 * Custom React hook for resizable panel functionality.
 * 
 * Provides drag-to-resize behavior for UI panels with configurable constraints.
 * Handles mouse events, boundary enforcement, and text selection prevention
 * during drag operations. Supports both left and right panel configurations
 * with automatic cleanup of event listeners. Returns panel width, drag state,
 * and mouse event handlers for integration with panel components.
 */

import { useState, useEffect, useCallback } from 'react';

interface UseResizablePanelOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  direction?: 'left' | 'right';
}

export function useResizablePanel({
  initialWidth,
  minWidth,
  maxWidth,
  direction = 'left'
}: UseResizablePanelOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
    e.stopPropagation();
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    let newWidth: number;
    if (direction === 'left') {
      newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
    } else {
      const windowWidth = window.innerWidth;
      newWidth = Math.max(minWidth, Math.min(maxWidth, windowWidth - e.clientX));
    }
    
    setWidth(newWidth);
  }, [isDragging, minWidth, maxWidth, direction]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Restore text selection
    document.body.style.userSelect = '';
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    width,
    isDragging,
    handleMouseDown,
    setWidth
  };
}