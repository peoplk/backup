'use client'

import { useState, useEffect } from 'react'
import { X, Clock, Target, Coffee, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { useDataLink } from '@/lib/data-link-service'
import { completePomodoroSession } from '@/lib/pomodoro-completion'
import { recommendTasksForFocus } from '@/lib/smart-recommendation'
import { cn } from '@/lib/utils'

interface Reminder {
  id: string
  type: 'overdue' | 'due-soon' | 'habit' | 'focus' | 'break' | 'achievement'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  icon: string
  dismissible: boolean
  action?: () => void
  actionLabel?: string
}

export function SmartRemindersPanel() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState<Reminder[]>([])
  const { tasks, habits, habitCheckIns, pomodoroSessions, setActiveView } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    habits: s.habits,
    habitCheckIns: s.habitCheckIns,
    pomodoroSessions: s.pomodoroSessions,
    setActiveView: s.setActiveView,
  })))
  const dataLink = useDataLink()

  useEffect(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const newReminders: Reminder[] = []

    tasks.forEach(task => {
      if (task.status === 'done' || !task.dueDate) return
      if (dismissed.has(`task-${task.id}`)) return

      const dueDate = new Date(task.dueDate)
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilDue < 0) {
        newReminders.push({
          id: `overdue-${task.id}`,
          type: 'overdue',
          title: '🚨 任务已逾期',
          message: `「${task.title}」已逾期 ${Math.abs(Math.floor(hoursUntilDue))} 小时`,
          priority: 'urgent',
          icon: '🚨',
          dismissible: true,
          action: () => setActiveView('tasks'),
          actionLabel: '查看任务',
        })
      } else if (hoursUntilDue <= 2 && task.priority !== 'low') {
        newReminders.push({
          id: `due-soon-${task.id}`,
          type: 'due-soon',
          title: '⏰ 任务即将到期',
          message: `「${task.title}」将在 ${Math.floor(hoursUntilDue * 60)} 分钟后到期`,
          priority: 'high',
          icon: '⏰',
          dismissible: true,
          action: () => setActiveView('tasks'),
          actionLabel: '查看任务',
        })
      }
    })

    habits.forEach(habit => {
      if (habit.archived) return
      if (dismissed.has(`habit-${habit.id}`)) return
      const todayCheckIn = habitCheckIns.find(
        ci => ci.habitId === habit.id && new Date(ci.date).toDateString() === today.toDateString()
      )
      if (!todayCheckIn) {
        const todayCompleted = pomodoroSessions.filter(
          s => new Date(s.completedAt).toDateString() === today.toDateString() && s.type === 'work'
        ).length
        if (todayCompleted > 0) {
          newReminders.push({
            id: `habit-${habit.id}`,
            type: 'habit',
            title: `📋 习惯待打卡`,
            message: `今天还没有打卡「${habit.name}」`,
            priority: 'medium',
            icon: '📋',
            dismissible: true,
            action: () => setActiveView('habits'),
            actionLabel: '去打卡',
          })
        }
      }
    })

    const recommended = recommendTasksForFocus(1)
    const todaySessions = pomodoroSessions.filter(
      s => new Date(s.completedAt).toDateString() === today.toDateString() && s.type === 'work'
    )
    const hour = now.getHours()
    if ([9, 10, 14, 15, 19, 20].includes(hour) && todaySessions.length === 0 && recommended.length > 0) {
      newReminders.push({
        id: 'focus-suggest',
        type: 'focus',
        title: '🎯 黄金专注时间',
        message: `推荐专注「${recommended[0].title}」`,
        priority: 'low',
        icon: '🎯',
        dismissible: true,
        action: () => setActiveView('focus'),
        actionLabel: '开始专注',
      })
    }

    if (todaySessions.length >= 3) {
      const lastSession = todaySessions[todaySessions.length - 1]
      const hoursSinceLast = (now.getTime() - new Date(lastSession.completedAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLast >= 0.5 && !dismissed.has('break-reminder')) {
        newReminders.push({
          id: 'break-reminder',
          type: 'break',
          title: '☕ 该休息了',
          message: `已完成 ${todaySessions.length} 个番茄钟，记得休息一下`,
          priority: 'low',
          icon: '☕',
          dismissible: true,
        })
      }
    }

    setReminders(newReminders)
  }, [tasks, habits, habitCheckIns, pomodoroSessions, dismissed, setActiveView])

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]))
  }

  if (reminders.length === 0) return null

  return (
    <div className="space-y-2">
      {reminders.slice(0, 3).map(reminder => (
        <div
          key={reminder.id}
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border-l-4 bg-white dark:bg-zinc-900 shadow-sm',
            reminder.priority === 'urgent' && 'border-red-500',
            reminder.priority === 'high' && 'border-orange-500',
            reminder.priority === 'medium' && 'border-yellow-500',
            reminder.priority === 'low' && 'border-blue-500'
          )}
        >
          <div className="text-2xl flex-shrink-0">{reminder.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{reminder.title}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              {reminder.message}
            </div>
            {reminder.action && reminder.actionLabel && (
              <button
                onClick={reminder.action}
                className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {reminder.actionLabel} →
              </button>
            )}
          </div>
          {reminder.dismissible && (
            <button
              onClick={() => handleDismiss(reminder.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
              aria-label="关闭提醒"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
