'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { sendBrowserNotification } from '@/lib/browser-notifications'
import { markNotified, hasNotified } from '@/lib/notified-registry'
import { isHabitScheduledOn } from '@/lib/habit-frequency'

function getMobileNotifSetting(key: 'task' | 'habit' | 'focus' | 'review' | 'goal'): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(`focusflow-notif-${key}`) !== 'false'
}

export function useAutoNotifications() {
  const {
    tasks,
    habits,
    anniversaries,
    goals,
    addNotification,
    notifications,
    repeatCompletions,
    markReminderTriggered,
    pomodoroSessions,
    dailyReviewSettings,
    purgeOrphanedNotifications,
  } = useAppStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const checkNotifications = () => {
      // 全屏严格模式锁定期间静默全部到期提醒，解锁后自然恢复（不补发历史提醒）
      if ((window as unknown as { __strictLockMuted?: boolean }).__strictLockMuted) return
      const now = new Date()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 清理已删除实体（任务/习惯等）残留的通知，避免删除了仍提示
      purgeOrphanedNotifications()

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
            const reminderKey = `task-reminder-${task.id}-${reminder.id}`
            if (hasNotified(reminderKey)) return

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
              // 到时提醒使用任务到期真实时分；仅日期（00:00）的任务回落到
              // 工作时段开始时刻（未配置则 09:00），不再硬编码
              if (dueDate.getHours() === 0 && dueDate.getMinutes() === 0) {
                const workStart = useAppStore.getState().workingHours?.workStartTime || '09:00'
                const [h, m] = workStart.split(':').map(Number)
                dueDate.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0)
              }
              const diff = dueDate.getTime() - now.getTime()
              if (diff <= 0 && diff > -300000) {
                shouldTrigger = true
                displayText = '到时'
              }
            }

            if (shouldTrigger) {
              markNotified(reminderKey)
              markReminderTriggered(task.id, reminder.id)
              addNotification({
                type: 'task-due',
                title: '⏰ 任务提醒',
                message: `"${task.title}" · ${displayText}`,
                actionUrl: 'tasks',
                relatedType: 'task',
                relatedId: task.id,
              })
              if (getMobileNotifSetting('task')) {
                sendBrowserNotification(`⏰ ${task.title}`, {
                  body: displayText,
                  tag: reminderKey,
                  data: { taskId: task.id },
                })
              }
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

        if (diffDays < 0 && !existingKeys.has(overdueKey) && !hasNotified(overdueKey)) {
          markNotified(overdueKey)
          addNotification({
            type: 'task-overdue',
            title: '任务已逾期',
            message: `"${task.title}" 已逾期 ${Math.abs(diffDays)} 天`,
            actionUrl: 'tasks',
            relatedType: 'task',
            relatedId: task.id,
          })
        } else if (diffDays === 0 && !existingKeys.has(dueSoonKey) && !hasNotified(dueSoonKey)) {
          markNotified(dueSoonKey)
          addNotification({
            type: 'task-due',
            title: '任务今日到期',
            message: `"${task.title}" 今天到期，请尽快完成`,
            actionUrl: 'tasks',
            relatedType: 'task',
            relatedId: task.id,
          })
        } else if (diffDays === 1 && !existingKeys.has(dueTomorrowKey) && !hasNotified(dueTomorrowKey)) {
          const lastCompletion = repeatCompletions
            ?.filter((c) => c.taskId === task.id)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]

          const wasCompletedToday = lastCompletion &&
            new Date(lastCompletion.completedAt).toDateString() === today.toDateString()

          if (!wasCompletedToday) {
            markNotified(dueTomorrowKey)
            addNotification({
              type: 'task-due',
              title: '任务明日到期',
              message: `"${task.title}" 明天到期，提前准备`,
              actionUrl: 'tasks',
              relatedType: 'task',
              relatedId: task.id,
            })
          }
        } else if (diffDays === 7 && !existingKeys.has(dueWeekKey) && !hasNotified(dueWeekKey)) {
          markNotified(dueWeekKey)
          addNotification({
            type: 'task-due',
            title: '任务一周后到期',
            message: `"${task.title}" 还有一周时间`,
            actionUrl: 'tasks',
            relatedType: 'task',
            relatedId: task.id,
          })
        }
      })

      habits.forEach(habit => {
        if (habit.archived) return
        if (!habit.reminderEnabled || !habit.reminderTime) return
        // 非排班日不提醒（如「每周一三五」习惯在周二不打扰）
        if (!isHabitScheduledOn(habit, now)) return

        const [reminderHour, reminderMinute] = habit.reminderTime.split(':').map(Number)
        const reminderTimeToday = new Date(today)
        reminderTimeToday.setHours(reminderHour, reminderMinute, 0, 0)

        const timeDiff = Math.abs(now.getTime() - reminderTimeToday.getTime())
        const habitKey = `habit-reminder-${habit.id}-${today.toDateString()}`

        if (timeDiff < 60000 && !existingKeys.has(habitKey) && !hasNotified(habitKey)) {
          markNotified(habitKey)
          addNotification({
            type: 'habit-reminder',
            title: '习惯提醒',
            message: `该打卡 "${habit.name}" 了`,
            actionUrl: 'habits',
            relatedType: 'habit',
            relatedId: habit.id,
          })
          if (getMobileNotifSetting('habit')) {
            sendBrowserNotification('习惯提醒', {
              body: `该打卡 "${habit.name}" 了`,
              tag: habitKey,
              data: { habitId: habit.id },
            })
          }
        }
      })

      // 黄金专注时间建议
      const currentHour = now.getHours()
      const bestFocusHours = [9, 10, 14, 15, 19, 20]
      const todayWorkSessions = pomodoroSessions
        ? pomodoroSessions.filter(
            (s: { completedAt: string | number | Date; type: string }) =>
              new Date(s.completedAt).toDateString() === today.toDateString() && s.type === 'work'
          )
        : []

      if (todayWorkSessions.length === 0 && bestFocusHours.includes(currentHour)) {
        const focusKey = `focus-suggest-${today.toDateString()}-${currentHour}`
        if (!existingKeys.has(focusKey) && !hasNotified(focusKey)) {
          markNotified(focusKey)
          addNotification({
            type: 'pomodoro',
            title: '🎯 黄金专注时间',
            message: '现在是你的黄金专注时间，开始今天的第一个番茄钟吧！🍅',
            actionUrl: 'focus',
          })
        }
      }

      // 3个番茄钟后休息提醒
      if (todayWorkSessions.length >= 3) {
        const lastSession = todayWorkSessions[todayWorkSessions.length - 1]
        const lastSessionTime = new Date(lastSession.completedAt)
        const hoursSinceLastSession = (now.getTime() - lastSessionTime.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastSession >= 0.5) {
          const breakKey = `break-reminder-${today.toDateString()}`
          if (!existingKeys.has(breakKey) && !hasNotified(breakKey)) {
            markNotified(breakKey)
            addNotification({
              type: 'pomodoro',
              title: '☕ 休息提醒',
              message: '你已经专注了3个番茄钟，该休息一下了！喝杯水，活动活动',
              actionUrl: 'focus',
            })
          }
        }
      }

      anniversaries.forEach(anniversary => {
        const annivDate = new Date(anniversary.date)
        const thisYearDate = new Date(today.getFullYear(), annivDate.getMonth(), annivDate.getDate())
        const diffMs = thisYearDate.getTime() - today.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays >= 0 && diffDays <= anniversary.remindDays) {
          const anniversaryKey = `anniversary-${anniversary.id}-${today.toDateString()}`
          if (!existingKeys.has(anniversaryKey) && !hasNotified(anniversaryKey)) {
            markNotified(anniversaryKey)
            const dayText = diffDays === 0 ? '今天' : diffDays === 1 ? '明天' : `${diffDays}天后`
            addNotification({
              type: 'anniversary',
              title: anniversary.title,
              message: `${dayText} 是 "${anniversary.title}"`,
              actionUrl: 'anniversaries',
              relatedType: 'anniversary',
              relatedId: anniversary.id,
            })
            sendBrowserNotification(`🎂 ${anniversary.title}`, {
              body: `${dayText} 是 "${anniversary.title}"`,
              tag: anniversaryKey,
              data: { anniversaryId: anniversary.id },
            })
          }
        }
      })

      // 目标截止与里程碑到期提醒
      goals.forEach(goal => {
        if (goal.status === 'completed' || goal.status === 'paused') return
        const dayKey = today.toDateString()
        const endDate = new Date(goal.endDate)
        endDate.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((endDate.getTime() - today.getTime()) / 86400000)

        const notifyGoal = (key: string, title: string, message: string) => {
          if (existingKeys.has(`${title}-${message}`) || hasNotified(key)) return
          markNotified(key)
          addNotification({
            type: 'goal-due',
            title,
            message,
            actionUrl: 'goals',
            relatedType: 'goal',
            relatedId: goal.id,
          })
        }

        if (diffDays < 0) {
          notifyGoal(`goal-overdue-${goal.id}-${dayKey}`, '目标已逾期', `"${goal.title}" 已超过截止日期 ${Math.abs(diffDays)} 天`)
        } else if (diffDays === 0) {
          notifyGoal(`goal-due-${goal.id}-${dayKey}`, '目标今日截止', `"${goal.title}" 今天是最后期限`)
          if (getMobileNotifSetting('goal')) {
            sendBrowserNotification('🎯 目标今日截止', {
              body: `"${goal.title}" 今天是最后期限`,
              tag: `goal-due-push-${goal.id}-${dayKey}`,
              data: { view: 'goals' },
            })
          }
        } else if (diffDays === 3 || diffDays === 7) {
          notifyGoal(`goal-due-soon-${goal.id}-${diffDays}-${dayKey}`, '目标即将截止', `"${goal.title}" 还有 ${diffDays} 天到期`)
        }

        goal.milestones.forEach(m => {
          if (m.completed || !m.dueDate) return
          const due = new Date(m.dueDate)
          due.setHours(0, 0, 0, 0)
          const mDiff = Math.floor((due.getTime() - today.getTime()) / 86400000)
          if (mDiff === 0) {
            notifyGoal(`milestone-due-${goal.id}-${m.id}-${dayKey}`, '里程碑今日到期', `"${goal.title}" 的里程碑 "${m.title}" 今天到期`)
          } else if (mDiff < 0 && mDiff >= -7) {
            notifyGoal(`milestone-overdue-${goal.id}-${m.id}-${dayKey}`, '里程碑已逾期', `"${goal.title}" 的里程碑 "${m.title}" 已逾期 ${Math.abs(mDiff)} 天`)
          }
        })
      })

      // 每日回顾提醒
      if (dailyReviewSettings?.enabled && getMobileNotifSetting('review')) {
        const reviewTime = dailyReviewSettings.reviewTime || '21:00'
        const [rh, rm] = reviewTime.split(':').map(Number)
        const reviewDateTime = new Date(now)
        reviewDateTime.setHours(rh, rm, 0, 0)
        const todayStr = now.toISOString().slice(0, 10)
        const alreadyReviewed = dailyReviewSettings.lastReviewDate === todayStr
        const reviewKey = `daily-review-${todayStr}`
        const diffMs = now.getTime() - reviewDateTime.getTime()
        if (diffMs >= 0 && diffMs < 60000 && !alreadyReviewed && !hasNotified(reviewKey)) {
          markNotified(reviewKey)
          sendBrowserNotification('🌙 每日回顾', {
            body: '今天过得怎么样？来记录一下今日回顾吧',
            tag: reviewKey,
            data: { view: 'dashboard' },
          })
        }
      }
    }

    checkNotifications()

    intervalRef.current = setInterval(checkNotifications, 60000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [tasks, habits, anniversaries, goals, addNotification, notifications, repeatCompletions, markReminderTriggered, pomodoroSessions, dailyReviewSettings, purgeOrphanedNotifications])
}
