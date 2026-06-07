'use client'

import { cn } from '@/lib/utils'

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  urgent: { label: '紧急', color: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  high: { label: '高', color: 'text-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  medium: { label: '中', color: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  low: { label: '低', color: 'text-gray-400', bg: 'bg-gray-400/10', dot: 'bg-gray-400' },
}

interface MobilePriorityDotProps {
  priority: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  onClick?: () => void
}

export function MobilePriorityDot({ priority, size = 'md', showLabel = false, onClick }: MobilePriorityDotProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }

  if (showLabel) {
    return (
      <button
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95',
          config.bg, config.color,
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
      >
        <span className={cn('rounded-full', sizeClasses.sm, config.dot)} />
        {config.label}
      </button>
    )
  }

  return (
    <button
      className={cn(
        'rounded-full transition-all',
        sizeClasses[size],
        config.dot,
        onClick && 'cursor-pointer active:scale-90'
      )}
      onClick={onClick}
    />
  )
}

export { PRIORITY_CONFIG }
