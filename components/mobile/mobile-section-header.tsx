'use client'

import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface MobileSectionHeaderProps {
  title: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function MobileSectionHeader({ title, action, className }: MobileSectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {action && (
        <button
          className="text-xs text-primary font-medium flex items-center gap-0.5 active:opacity-70 transition-opacity"
          onClick={action.onClick}
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
