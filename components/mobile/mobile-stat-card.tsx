'use client'

import { type ElementType } from 'react'
import { cn } from '@/lib/utils'

interface MobileStatCardProps {
  icon: ElementType
  iconBg?: string
  iconColor?: string
  label: string
  value: string | number
  suffix?: string
  sublabel?: string
  progress?: number
  className?: string
  onClick?: () => void
}

export function MobileStatCard({
  icon: Icon,
  iconBg = 'bg-primary/15',
  iconColor = 'text-primary',
  label,
  value,
  suffix,
  sublabel,
  progress,
  className,
  onClick,
}: MobileStatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl glass-card p-4 space-y-2 transition-all',
        onClick && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className={cn('rounded-xl p-1.5', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      {progress !== undefined && (
        <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
      {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
    </div>
  )
}
