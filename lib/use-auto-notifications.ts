'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { sendBrowserNotification } from '@/lib/browser-notifications'

export function useAutoNotifications() {
  const {
    tasks,
    habits,
    anniversaries,
    addNotification,
    notifications,
    repeatCompletions,
    markReminderTriggered,
  } = useAppStore()
  const notifiedRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const existingKeys = new Set(
        notifications.map(n => `${n.type}-${n.message}`)
      )

      tasks.forEach(task => {
        if (task.status === 'done') return
        if (!task.dueDate) return

        // 多提醒系统
        if (task.reminders && task.reminders.length > 0) {
          task.reminders.forEach(reminder => {
            if (!reminder.enabled || reminder.triggered) return
            const reminderKey = `task-reminder-${task.id}-${reminder.id}-${today.toDateString()}`
            if (notifiedRef.current.has(reminderKey)) return

            let shouldTrigger = false
            let displayText = ''

            if (reminder.type === 'absolute' && reminder.triggerAt) {
              const triggerTime = new Date(reminder.triggerAt)
              const diff = triggerTime.getTime() - now.getTime()
              if (diff <= 0 && diff > -300000) {
                shouldTrigger = true
                displayText = triggerTime.toLocaleString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }
            } else if (reminder.type === 'before-due' && reminder.minutesBefore != null) {
              const dueDate = new Date(task.dueDate!)
              const trigger = new Date(dueDate.getTime() - reminder.minutesBefore * 60 * 1000)
              const diff = trigger.getTime() - now.getTime()
              if (diff <= 0 && diff > -300000) {
                shouldTrigger = true
                const mins = reminder.minutesBefore
                if (mins >= 60) {
                  const h = Math.floor(mins / 60)
                  const m = mins % 60
                  displayText = `截止前 ${h} 小时${m ? ` ${m} 分钟` : ''}`
                } else {
                  displayText = `截止前 ${mins} 分钟`
                }
              }
            } else if (reminder.type === 'on-due') {
              const dueDate = new Date(task.dueDate!)
              dueDate.setHours(9, 0, 0, 0)
              const diff = dueDate.getTime() - now.getTime()
              if (diff <= 0 && diff > -300000) {
                shouldTrigger = true
                displayText = '到时'
              }
            }

            if (shouldTrigger) {
              notifiedRef.current.add(reminderKey)
              markReminderTriggered(task.id, reminder.id)
              addNotification({
                type: 'task-due',
                title: '⏰ 任务提醒',
                message: `"${task.title}" · ${displayText}`,
                actionUrl: 'tasks',
              })
              sendBrowserNotification(`⏰ ${task.title}`, {
                body: displayText,
                tag: reminderKey,
                data: { taskId: task.id },
              })
            }
          })
        }

        const dueDate = new Date(task.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        const diffMs = dueDate.getTime() - today.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        const overdueKey = `task-overdue-${task.id}-${today.toDateString()}`
        const dueSoonKey = `task-due-soon-${task.id}-${today.toDateString()}`
        const dueTomorrowKey = `task-due-tomorrow-${task.id}-${today.toDateString()}`
        const dueWeekKey = `task-due-week-${task.id}-${today.toDateString()}`

        if (diffDays < 0 && !existingKeys.has(overdueKey) && !notifiedRef.current.has(overdueKey)) {
          notifiedRef.current.add(overdueKey)
          addNotification({
            type: 'task-overdue',
            title: '任务已逾期',
            message: `"${task.title}" 已逾期 ${Math.abs(diffDays)} 天`,
            actionUrl: 'tasks',
          })
        } else if (diffDays === 0 && !existingKeys.has(dueSoonKey) && !notifiedRef.current.has(dueSoonKey)) {
          notifiedRef.current.add(dueSoonKey)
          addNotification({
            type: 'task-due',
            title: '任务今日到期',
            message: `"${task.title}" 今天到期，请尽快完成`,
            actionUrl: 'tasks',
          })
        } else if (diffDays === 1 && !existingKeys.has(dueTomorrowKey) && !notifiedRef.current.has(dueTomorrowKey)) {
          const lastCompletion = repeatCompletions
            ?.filter((c) => c.taskId === task.id)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]

          const wasCompletedToday = lastCompletion &&
            new Date(lastCompletion.completedAt).toDateString() === today.toDateString()

          if (!wasCompletedToday) {
            notifiedRef.current.add(dueTomorrowKey)
            addNotification({
              type: 'task-due',
              title: '任务明日到期',
              message: `"${task.title}" 明天到期，提前准备`,
              actionUrl: 'tasks',
            })
          }
        } else if (diffDays === 7 && !existingKeys.has(dueWeekKey) && !notifiedRef.current.has(dueWeekKey)) {
          notifiedRef.current.add(dueWeekKey)
          addNotification({
            type: 'task-due',
            title: '任务一周后到期',
            message: `"${task.title}" 还有一周时间`,
            actionUrl: 'tasks',
          })
        }
      })

      habits.forEach(habit => {
        if (habit.archived) return
        if (!habit.reminderEnabled || !habit.reminderTime) return

        const [reminderHour, reminderMinute] = habit.reminderTime.split(':').map(Number)
        const reminderTimeToday = new Date(today)
        reminderTimeToday.setHours(reminderHour, reminderMinute, 0, 0)

        const timeDiff = Math.abs(now.getTime() - reminderTimeToday.getTime())
        const habitKey = `habit-reminder-${habit.id}-${today.toDateString()}`

        if (timeDiff < 60000 && !existingKeys.has(habitKey) && !notifiedRef.current.has(habitKey)) {
          notifiedRef.current.add(habitKey)
          addNotification({
            type: 'habit-reminder',
            title: '习惯提醒',
            message: `该打卡 "${habit.name}" 了`,
            actionUrl: 'habits',
          })
        }
      })

      anniversaries.forEach(anniversary => {
        const annivDate = new Date(anniversary.date)
        const thisYearDate = new Date(today.getFullYear(), annivDate.getMonth(), annivDate.getDate())
        const diffMs = thisYearDate.getTime() - today.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays >= 0 && diffDays <= anniversary.remindDays) {
          const anniversaryKey = `anniversary-${anniversary.id}-${today.toDateString()}`
          if (!existingKeys.has(anniversaryKey) && !notifiedRef.current.has(anniversaryKey)) {
            notifiedRef.current.add(anniversaryKey)
            const dayText = diffDays === 0 ? '今天' : diffDays === 1 ? '明天' : `${diffDays}天后`
            addNotification({
              type: 'anniversary',
              title: anniversary.title,
              message: `${dayText} 是 "${anniversary.title}"`,
              actionUrl: 'anniversaries',
            })
          }
        }
      })
    }

    checkNotifications()

    intervalRef.current = setInterval(checkNotifications, 60000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [tasks, habits, anniversaries, addNotification, notifications, repeatCompletions, markReminderTriggered])
}
