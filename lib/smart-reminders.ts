import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task, Habit } from '@/lib/types'

export interface SmartReminder {
  id: string
  type: 'task-due' | 'task-overdue' | 'habit-reminder' | 'focus-time' | 'break-time' | 'achievement'
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  icon: string
  action?: {
    label: string
    handler: () => void
  }
  dismissible: boolean
  timestamp: Date
}

const REMINDER_CONFIG = {
  taskDue: {
    advanceHours: [24, 2, 1, 0.5],
    priorities: {
      urgent: { enabled: true, advanceHours: [48, 24, 12, 2, 1] },
      high: { enabled: true, advanceHours: [24, 4, 1] },
      medium: { enabled: true, advanceHours: [12, 2] },
      low: { enabled: false, advanceHours: [2] },
    },
  },
  habit: {
    preferredTimes: ['09:00', '12:00', '18:00', '21:00'],
    snoozeMinutes: 30,
  },
  focus: {
    bestHours: [9, 10, 14, 15, 19, 20],
    minInterval: 2,
  },
}

export function useSmartReminders() {
  const { tasks, habits, habitCheckIns, pomodoroSessions, addNotification } = useAppStore()
  const lastReminderTime = useRef<Record<string, Date>>({})

  const checkTaskDueReminders = useCallback((): SmartReminder[] => {
    const reminders: SmartReminder[] = []
    const now = new Date()

    tasks.forEach(task => {
      if (task.status === 'done' || !task.dueDate) return

      const dueDate = new Date(task.dueDate)
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      const reminderKey = `task-${task.id}`

      // 检查是否已经提醒过
      if (lastReminderTime.current[reminderKey]) {
        const lastReminder = lastReminderTime.current[reminderKey]
        const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastReminder < 1) return
      }

      // 已逾期
      if (hoursUntilDue < 0) {
        reminders.push({
          id: `overdue-${task.id}`,
          type: 'task-overdue',
          title: '任务已逾期',
          message: `"${task.title}" 已逾期 ${Math.abs(Math.floor(hoursUntilDue))} 小时`,
          priority: 'urgent',
          icon: '🚨',
          action: {
            label: '查看任务',
            handler: () => { useAppStore.getState().setActiveView('tasks') },
          },
          dismissible: true,
          timestamp: now,
        })
        lastReminderTime.current[reminderKey] = now
      }
      // 即将到期
      else if (hoursUntilDue <= 2) {
        reminders.push({
          id: `due-soon-${task.id}`,
          type: 'task-due',
          title: '任务即将到期',
          message: `"${task.title}" 将在 ${Math.floor(hoursUntilDue * 60)} 分钟后到期`,
          priority: 'high',
          icon: '⏰',
          action: {
            label: '查看任务',
            handler: () => { useAppStore.getState().setActiveView('tasks') },
          },
          dismissible: true,
          timestamp: now,
        })
        lastReminderTime.current[reminderKey] = now
      }
      // 今天到期
      else if (hoursUntilDue <= 24 && task.priority === 'urgent') {
        reminders.push({
          id: `due-today-${task.id}`,
          type: 'task-due',
          title: '紧急任务提醒',
          message: `"${task.title}" 将在今天到期`,
          priority: 'medium',
          icon: '⚠️',
          action: {
            label: '查看任务',
            handler: () => { useAppStore.getState().setActiveView('tasks') },
          },
          dismissible: true,
          timestamp: now,
        })
        lastReminderTime.current[reminderKey] = now
      }
    })

    return reminders
  }, [tasks])

  const checkHabitReminders = useCallback((): SmartReminder[] => {
    const reminders: SmartReminder[] = []
    const now = new Date()
    const today = now.toDateString()
    const currentHour = now.getHours()
    const currentTime = `${currentHour.toString().padStart(2, '0')}:00`

    habits.forEach(habit => {
      if (habit.archived || !habit.reminderEnabled) return

      const checkIn = habitCheckIns.find(
        c => c.habitId === habit.id && new Date(c.date).toDateString() === today
      )

      if (checkIn?.completed) return

      const reminderKey = `habit-${habit.id}`
      if (lastReminderTime.current[reminderKey]) {
        const lastReminder = lastReminderTime.current[reminderKey]
        const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastReminder < 2) return
      }

      // 检查是否在提醒时间
      if (habit.reminderTime && habit.reminderTime === currentTime) {
        reminders.push({
          id: `habit-reminder-${habit.id}`,
          type: 'habit-reminder',
          title: '习惯打卡提醒',
          message: `别忘了完成今天的习惯: ${habit.name} ${habit.icon}`,
          priority: 'medium',
          icon: habit.icon,
          action: {
            label: '去打卡',
            handler: () => { useAppStore.getState().setActiveView('habits') },
          },
          dismissible: true,
          timestamp: now,
        })
        lastReminderTime.current[reminderKey] = now
      }
      // 如果没有设置提醒时间，在最佳时间提醒
      else if (!habit.reminderTime && REMINDER_CONFIG.habit.preferredTimes.includes(currentTime)) {
        reminders.push({
          id: `habit-suggest-${habit.id}`,
          type: 'habit-reminder',
          title: '习惯提醒',
          message: `现在是完成习惯的好时机: ${habit.name} ${habit.icon}`,
          priority: 'low',
          icon: habit.icon,
          dismissible: true,
          timestamp: now,
        })
        lastReminderTime.current[reminderKey] = now
      }
    })

    return reminders
  }, [habits, habitCheckIns])

  const checkBestFocusTime = useCallback((): SmartReminder | null => {
    const now = new Date()
    const currentHour = now.getHours()
    const today = now.toDateString()

    // 检查今天是否已经专注过
    const todaySessions = pomodoroSessions.filter(
      s => new Date(s.completedAt).toDateString() === today && s.type === 'work'
    )

    // 如果今天还没开始专注，且现在是最佳专注时间
    if (todaySessions.length === 0 && REMINDER_CONFIG.focus.bestHours.includes(currentHour)) {
      const reminderKey = 'focus-suggest'
      if (lastReminderTime.current[reminderKey]) {
        const lastReminder = lastReminderTime.current[reminderKey]
        const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastReminder < 2) return null
      }

      lastReminderTime.current[reminderKey] = now
      return {
        id: 'focus-suggest',
        type: 'focus-time',
        title: '黄金专注时间',
        message: '现在是你的黄金专注时间，开始今天的第一个番茄钟吧！🍅',
        priority: 'low',
        icon: '🎯',
        action: {
          label: '开始专注',
          handler: () => { useAppStore.getState().setActiveView('focus') },
        },
        dismissible: true,
        timestamp: now,
      }
    }

    return null
  }, [pomodoroSessions])

  const checkBreakReminder = useCallback((): SmartReminder | null => {
    const now = new Date()
    const today = now.toDateString()

    // 获取今天的工作会话
    const todayWorkSessions = pomodoroSessions.filter(
      s => new Date(s.completedAt).toDateString() === today && s.type === 'work'
    )

    if (todayWorkSessions.length >= 3) {
      const lastSession = todayWorkSessions[todayWorkSessions.length - 1]
      const lastSessionTime = new Date(lastSession.completedAt)
      const hoursSinceLastSession = (now.getTime() - lastSessionTime.getTime()) / (1000 * 60 * 60)

      // 如果已经专注了3个番茄钟，且距离上一个已经过了30分钟，提醒休息
      if (hoursSinceLastSession >= 0.5) {
        const reminderKey = 'break-reminder'
        if (lastReminderTime.current[reminderKey]) {
          const lastReminder = lastReminderTime.current[reminderKey]
          const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60)
          if (hoursSinceLastReminder < 1) return null
        }

        lastReminderTime.current[reminderKey] = now
        return {
          id: 'break-reminder',
          type: 'break-time',
          title: '休息提醒',
          message: '你已经专注了3个番茄钟，该休息一下了！喝杯水，活动活动 ☕',
          priority: 'low',
          icon: '☕',
          dismissible: true,
          timestamp: now,
        }
      }
    }

    return null
  }, [pomodoroSessions])

  const analyzeFocusPatterns = useCallback(() => {
    const hourCounts: Record<number, number> = {}
    
    pomodoroSessions.forEach(session => {
      if (session.type !== 'work') return
      const hour = new Date(session.completedAt).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([hour]) => parseInt(hour))

    return {
      bestHours: sortedHours.slice(0, 3),
      worstHours: sortedHours.slice(-3),
      averageSessionsPerDay: Object.values(hourCounts).reduce((a, b) => a + b, 0) / 7,
    }
  }, [pomodoroSessions])

  const getAllReminders = useCallback((): SmartReminder[] => {
    const reminders: SmartReminder[] = []

    reminders.push(...checkTaskDueReminders())
    reminders.push(...checkHabitReminders())

    const focusReminder = checkBestFocusTime()
    if (focusReminder) reminders.push(focusReminder)

    const breakReminder = checkBreakReminder()
    if (breakReminder) reminders.push(breakReminder)

    return reminders.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }, [checkTaskDueReminders, checkHabitReminders, checkBestFocusTime, checkBreakReminder])

  const dismissReminder = useCallback((reminderId: string) => {
    const key = reminderId.replace(/^(overdue|due-soon|due-today|habit-reminder|habit-suggest|focus-suggest|break-reminder)-/, '')
    delete lastReminderTime.current[key]
  }, [])

  return {
    checkTaskDueReminders,
    checkHabitReminders,
    checkBestFocusTime,
    checkBreakReminder,
    analyzeFocusPatterns,
    getAllReminders,
    dismissReminder,
  }
}

// @deprecated 建议使用 useAutoNotifications 替代，该 hook 功能更完整
export function useReminderScheduler() {
  const { getAllReminders, dismissReminder } = useSmartReminders()
  const { addNotification } = useAppStore()

  useEffect(() => {
    const checkReminders = () => {
      const reminders = getAllReminders()
      
      reminders.forEach(reminder => {
        addNotification({
          type: reminder.type === 'task-overdue' ? 'task-overdue' : 
                reminder.type === 'task-due' ? 'task-due' :
                reminder.type === 'habit-reminder' ? 'habit-reminder' : 'pomodoro',
          title: reminder.title,
          message: reminder.message,
        })

        if (Notification.permission === 'granted') {
          new Notification(reminder.title, {
            body: reminder.message,
            icon: reminder.icon,
            tag: reminder.id,
          })
        }
      })
    }

    const interval = setInterval(checkReminders, 60000)
    checkReminders()

    return () => clearInterval(interval)
  }, [getAllReminders, addNotification])

  return {
    dismissReminder,
  }
}
