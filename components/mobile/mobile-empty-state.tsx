'use client'

import { type ElementType } from 'react'
import { cn } from '@/lib/utils'

interface MobileEmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function MobileEmptyState({ icon: Icon, title, description, action, className }: MobileEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-muted-foreground', className)}>
      <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 opacity-30" />
      </div>
      <p className="text-sm font-medium text-foreground/60">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-[200px] text-center">{description}</p>}
      {action && (
        <button
          className="mt-4 h-9 px-5 rounded-full bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-transform"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
