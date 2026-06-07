'use client'

import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'
import {
  CheckCircle2, Circle, Star, Calendar, Tag, RotateCcw,
  ListChecks, Clock, Flag
} from 'lucide-react'

const PRIORITY_STYLES: Record<string, { dot: string; text: string; flag: string }> = {
  urgent: { dot: 'bg-red-500', text: 'text-red-500', flag: 'text-red-500' },
  high: { dot: 'bg-orange-500', text: 'text-orange-500', flag: 'text-orange-500' },
  medium: { dot: 'bg-blue-500', text: 'text-blue-500', flag: 'text-blue-500' },
  low: { dot: 'bg-gray-300 dark:bg-gray-600', text: 'text-gray-400', flag: 'text-gray-400' },
}

interface MobileTaskCardProps {
  task: Task
  projectColor?: string
  projectName?: string
  isOverdue?: boolean
  formatDate: (date: Date | string | undefined) => string
  onToggleComplete: () => void
  onToggleStar: () => void
  onClick: () => void
  onMore?: () => void
}

export function MobileTaskCard({
  task,
  projectColor,
  projectName,
  isOverdue,
  formatDate,
  onToggleComplete,
  onToggleStar,
  onClick,
}: MobileTaskCardProps) {
  const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.low
  const isDone = task.status === 'done'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 active:bg-muted/20 transition-colors',
        isDone && 'opacity-50'
      )}
      onClick={onClick}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <button
        className="shrink-0 mt-0.5 active:scale-90 transition-transform"
        onClick={(e) => { e.stopPropagation(); onToggleComplete() }}
      >
        {isDone ? (
          <CheckCircle2 className="h-[20px] w-[20px] text-primary animate-checkmark-pop" />
        ) : (
          <Circle className={cn('h-[20px] w-[20px]', priorityStyle.text)} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] leading-snug',
          isDone && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.dueDate && (
            <span className={cn(
              'text-[10px] flex items-center gap-0.5',
              isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
            )}>
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.startTime && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {task.startTime}
            </span>
          )}
          {projectName && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: projectColor || '#6b7280' }} />
              {projectName}
            </span>
          )}
          {task.tags && task.tags.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Tag className="h-3 w-3" />{task.tags.join(', ')}
            </span>
          )}
          {task.repeatRule && (
            <RotateCcw className="h-3 w-3 text-muted-foreground" />
          )}
          {task.subTasks && task.subTasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <ListChecks className="h-3 w-3" />
              {task.subTasks.filter(s => s.completed).length}/{task.subTasks.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {task.priority && task.priority !== 'low' && (
          <Flag className={cn('h-3.5 w-3.5', priorityStyle.flag)} />
        )}
        <button
          className="p-0.5 active:scale-90 transition-transform"
          onClick={(e) => { e.stopPropagation(); onToggleStar() }}
        >
          <Star className={cn(
            'h-[16px] w-[16px] transition-colors',
            task.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'
          )} />
        </button>
      </div>
    </div>
  )
}
