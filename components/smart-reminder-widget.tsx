'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useSmartReminders, type SmartReminder } from '@/lib/smart-reminders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle2, AlertCircle, Clock, Target, Coffee, Trophy, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReminderContextValue {
  reminders: SmartReminder[]
  dismissReminder: (id: string) => void
  clearAll: () => void
}

const ReminderContext = createContext<ReminderContextValue | null>(null)

function useReminderContext() {
  const context = useContext(ReminderContext)
  if (!context) {
    throw new Error('useReminderContext must be used within ReminderProvider')
  }
  return context
}

interface ReminderProviderProps {
  children: ReactNode
}

function ReminderProvider({ children }: ReminderProviderProps) {
  const { getAllReminders, dismissReminder: dismissReminderBase } = useSmartReminders()
  const [reminders, setReminders] = useState<SmartReminder[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      const allReminders = getAllReminders()
      setReminders(allReminders)
    }, 60000)

    const initialReminders = getAllReminders()
    setReminders(initialReminders)

    return () => clearInterval(interval)
  }, [getAllReminders])

  const dismissReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id))
    dismissReminderBase(id)
  }

  const clearAll = () => {
    reminders.forEach(r => dismissReminderBase(r.id))
    setReminders([])
  }

  return (
    <ReminderContext.Provider value={{ reminders, dismissReminder, clearAll }}>
      {children}
    </ReminderContext.Provider>
  )
}

function ReminderBadge() {
  const { reminders } = useReminderContext()
  const urgentCount = reminders.filter(r => r.priority === 'urgent' || r.priority === 'high').length

  if (urgentCount === 0) return null

  return (
    <Badge variant="destructive" className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
      {urgentCount}
    </Badge>
  )
}

function ReminderList() {
  const { reminders, dismissReminder } = useReminderContext()

  if (reminders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BellOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">暂无提醒</p>
        <p className="text-xs mt-1">所有任务都在掌控中！</p>
      </div>
    )
  }

  const getIcon = (type: SmartReminder['type']) => {
    switch (type) {
      case 'task-due':
      case 'task-overdue':
        return AlertCircle
      case 'habit-reminder':
        return Target
      case 'focus-time':
        return Clock
      case 'break-time':
        return Coffee
      case 'achievement':
        return Trophy
      default:
        return Bell
    }
  }

  const getPriorityColor = (priority: SmartReminder['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-destructive/50 bg-destructive/5'
      case 'high':
        return 'border-orange-500/50 bg-orange-500/5'
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/5'
      case 'low':
        return 'border-border/50 bg-muted/30'
    }
  }

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => {
        const Icon = getIcon(reminder.type)
        return (
          <div
            key={reminder.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 transition-all',
              getPriorityColor(reminder.priority)
            )}
          >
            <div className="text-xl">{reminder.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium">{reminder.title}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] h-5',
                    reminder.priority === 'urgent' && 'border-destructive/50 text-destructive',
                    reminder.priority === 'high' && 'border-orange-500/50 text-orange-600',
                    reminder.priority === 'medium' && 'border-yellow-500/50 text-yellow-600'
                  )}
                >
                  {reminder.priority === 'urgent' && '紧急'}
                  {reminder.priority === 'high' && '高'}
                  {reminder.priority === 'medium' && '中'}
                  {reminder.priority === 'low' && '低'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{reminder.message}</p>
              {reminder.action && (
                <button
                  onClick={reminder.action.handler}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {reminder.action.label}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
            {reminder.dismissible && (
              <button
                onClick={() => dismissReminder(reminder.id)}
                className="shrink-0 rounded-full p-1 hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReminderSummary() {
  const { reminders, clearAll } = useReminderContext()

  const groupedReminders = {
    urgent: reminders.filter(r => r.priority === 'urgent'),
    high: reminders.filter(r => r.priority === 'high'),
    medium: reminders.filter(r => r.priority === 'medium'),
    low: reminders.filter(r => r.priority === 'low'),
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" />
            智能提醒
            {reminders.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {reminders.length}
              </Badge>
            )}
          </CardTitle>
          {reminders.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
              全部清除
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-50" />
            <p className="text-sm">一切正常</p>
            <p className="text-xs mt-1">没有需要关注的提醒</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedReminders.urgent.length > 0 && (
              <div>
                <p className="text-xs font-medium text-destructive mb-1.5">
                  紧急 ({groupedReminders.urgent.length})
                </p>
                <div className="space-y-1.5">
                  {groupedReminders.urgent.slice(0, 2).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <span>{r.icon}</span>
                      <span className="truncate flex-1">{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {groupedReminders.high.length > 0 && (
              <div>
                <p className="text-xs font-medium text-orange-600 mb-1.5">
                  高优先级 ({groupedReminders.high.length})
                </p>
                <div className="space-y-1.5">
                  {groupedReminders.high.slice(0, 2).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.icon}</span>
                      <span className="truncate flex-1">{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(groupedReminders.medium.length + groupedReminders.low.length) > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  其他提醒 ({groupedReminders.medium.length + groupedReminders.low.length})
                </p>
                <div className="space-y-1.5">
                  {[...groupedReminders.medium, ...groupedReminders.low].slice(0, 2).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.icon}</span>
                      <span className="truncate flex-1">{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface SmartReminderWidgetProps {
  className?: string
  variant?: 'summary' | 'list' | 'badge'
}

export function SmartReminderWidget({ className, variant = 'summary' }: SmartReminderWidgetProps) {
  return (
    <ReminderProvider>
      <div className={cn('', className)}>
        {variant === 'summary' && <ReminderSummary />}
        {variant === 'list' && <ReminderList />}
        {variant === 'badge' && <ReminderBadge />}
      </div>
    </ReminderProvider>
  )
}

export function SmartReminderPanel({ className }: { className?: string }) {
  return (
    <ReminderProvider>
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              所有提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderList />
          </CardContent>
        </Card>
      </div>
    </ReminderProvider>
  )
}

export { ReminderProvider, ReminderBadge, ReminderList, ReminderSummary, useReminderContext }
