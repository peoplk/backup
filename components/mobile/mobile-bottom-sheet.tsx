'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  action?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
  maxHeight?: string
}

export function MobileBottomSheet({ open, onClose, title, children, action, maxHeight = '85vh' }: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef(0)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setDragY(0)
    }
  }, [open])

  useEffect(() => {
    if (!open && visible) {
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open, visible])

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0) {
      setDragY(diff)
    }
  }

  const handleTouchEnd = () => {
    if (dragY > 100) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  if (!visible) return null

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl safe-area-bottom glass-sheet transition-transform duration-300 ease-out',
          open && dragY === 0 ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight, transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sticky top-0 z-10 glass-sheet rounded-t-3xl">
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              {title && <h3 className="text-sm font-semibold">{title}</h3>}
            </div>
            <div className="flex items-center gap-2">
              {action && (
                <button
                  className={cn(
                    'h-8 px-4 rounded-full text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-transform',
                    action.disabled
                      ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground'
                  )}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              )}
              <button
                className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center active:scale-90 transition-transform"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="h-1 w-10 mx-auto rounded-full bg-muted/30 mb-1" />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
          {children}
        </div>
      </div>
    </>
  )
}
