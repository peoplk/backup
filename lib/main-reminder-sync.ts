'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { markNotified, hasNotified } from '@/lib/notified-registry'
import { isHabitScheduledOn } from '@/lib/habit-frequency'
import type { ReminderJobPayload } from '@/lib/types/electron'

const SYNC_INTERVAL_MS = 60 * 1000

function onDueTime(taskDueDate: Date): Date {
  const d = new Date(taskDueDate)
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    const workStart = useAppStore.getState().workingHours?.workStartTime || '09:00'
    const [h, m] = workStart.split(':').map(Number)
    d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0)
  }
  return d
}

function buildReminderJobs(): ReminderJobPayload[] {
  const st = useAppStore.getState()
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const jobs: ReminderJobPayload[] = []

  st.tasks.forEach(task => {
    if (task.status === 'done' || !task.dueDate) return
    if (!task.reminders?.length) return
    task.reminders.forEach(reminder => {
      if (!reminder.enabled || reminder.triggered) return
      const key = `task-reminder-${task.id}-${reminder.id}`
      if (hasNotified(key)) return

      let fireAt: number | null = null
      if (reminder.type === 'absolute' && reminder.triggerAt) {
        fireAt = new Date(reminder.triggerAt).getTime()
      } else if (reminder.type === 'before-due' && reminder.minutesBefore != null) {
        fireAt = new Date(task.dueDate!).getTime() - reminder.minutesBefore * 60 * 1000
      } else if (reminder.type === 'on-due') {
        fireAt = onDueTime(new Date(task.dueDate!)).getTime()
      }
      if (fireAt === null || fireAt <= now.getTime()) return
      jobs.push({
        key,
        fireAt,
        title: `⏰ ${task.title}`,
        body: `任务提醒 · ${new Date(fireAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        meta: { kind: 'task', taskId: task.id, reminderId: reminder.id },
      })
    })
  })

  st.habits.forEach(habit => {
    if (habit.archived || !habit.reminderEnabled || !habit.reminderTime) return
    if (!isHabitScheduledOn(habit, now)) return
    const key = `habit-reminder-${habit.id}-${today.toDateString()}`
    if (hasNotified(key)) return
    const [rh, rm] = habit.reminderTime.split(':').map(Number)
    const fire = new Date(today)
    fire.setHours(rh, rm, 0, 0)
    if (fire.getTime() <= now.getTime()) return
    jobs.push({
      key,
      fireAt: fire.getTime(),
      title: '习惯提醒',
      body: `该打卡 "${habit.name}" 了`,
      meta: { kind: 'habit', habitId: habit.id },
    })
  })

  st.goals.forEach(goal => {
    if (goal.status === 'completed' || goal.status === 'paused') return
    const end = new Date(goal.endDate)
    end.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((end.getTime() - today.getTime()) / 86400000)
    const dayKey = today.toDateString()

    const addGoalJob = (key: string, fireAt: number, title: string, body: string) => {
      if (fireAt <= now.getTime() || hasNotified(key)) return
      jobs.push({ key, fireAt, title, body, meta: { kind: 'goal', goalId: goal.id } })
    }

    if (diffDays === 0) {
      addGoalJob(`goal-due-${goal.id}-${dayKey}`, onDueTime(end).getTime(), '🎯 目标今日截止', `"${goal.title}" 今天是最后期限`)
    } else if (diffDays === 3 || diffDays === 7) {
      addGoalJob(`goal-due-soon-${goal.id}-${diffDays}-${dayKey}`, onDueTime(end).getTime(), '🎯 目标即将截止', `"${goal.title}" 还有 ${diffDays} 天到期`)
    }

    goal.milestones.forEach(m => {
      if (m.completed || !m.dueDate) return
      const due = new Date(m.dueDate)
      due.setHours(0, 0, 0, 0)
      const mDiff = Math.floor((due.getTime() - today.getTime()) / 86400000)
      if (mDiff === 0) {
        addGoalJob(`milestone-due-${goal.id}-${m.id}-${dayKey}`, onDueTime(due).getTime(), '🎯 里程碑今日到期', `"${goal.title}" 的里程碑 "${m.title}" 今天到期`)
      }
    })
  })

  const review = st.dailyReviewSettings
  if (review?.enabled) {
    const todayStr = now.toISOString().slice(0, 10)
    const key = `daily-review-${todayStr}`
    if (review.lastReviewDate !== todayStr && !hasNotified(key)) {
      const [rh, rm] = (review.reviewTime || '21:00').split(':').map(Number)
      const fire = new Date(now)
      fire.setHours(rh, rm, 0, 0)
      if (fire.getTime() > now.getTime()) {
        jobs.push({ key, fireAt: fire.getTime(), title: '🌙 每日回顾', body: '今天过得怎么样？来记录一下今日回顾吧', meta: { kind: 'review' } })
      }
    }
  }

  return jobs
}

function pushJobsToMain() {
  const api = typeof window !== 'undefined'
    ? (window as unknown as { electronAPI?: { remindersSync?: (jobs: ReminderJobPayload[]) => void } }).electronAPI
    : undefined
  if (!api?.remindersSync) return
  try {
    api.remindersSync(buildReminderJobs())
  } catch {
    // IPC 未就绪时静默，下一轮心跳会补同步
  }
}

/**
 * 桌面端把未来提醒点同步给主进程调度器，窗口关闭后也能弹系统通知；
 * 主进程触发后回写 notified 注册表与任务提醒 triggered 标记，避免渲染层重复提醒。
 */
export function useMainReminderSync() {
  const tasks = useAppStore((s) => s.tasks)
  const habits = useAppStore((s) => s.habits)
  const goals = useAppStore((s) => s.goals)
  const dailyReviewSettings = useAppStore((s) => s.dailyReviewSettings)

  useEffect(() => {
    pushJobsToMain()
    const interval = setInterval(pushJobsToMain, SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tasks, habits, goals, dailyReviewSettings])

  useEffect(() => {
    const api = typeof window !== 'undefined'
      ? (window as unknown as {
          electronAPI?: {
            onReminderFired?: (cb: (job: ReminderJobPayload) => void) => (() => void) | undefined
          }
        }).electronAPI
      : undefined
    if (!api?.onReminderFired) return
    return api.onReminderFired((job) => {
      if (!job?.key) return
      markNotified(job.key)
      const st = useAppStore.getState()
      if (job.meta?.kind === 'task' && job.meta.taskId && job.meta.reminderId) {
        st.markReminderTriggered(job.meta.taskId, job.meta.reminderId)
        st.addNotification({
          type: 'task-due',
          title: '⏰ 任务提醒',
          message: job.body || job.title,
          actionUrl: 'tasks',
          relatedType: 'task',
          relatedId: job.meta.taskId,
        })
      } else if (job.meta?.kind === 'habit' && job.meta.habitId) {
        st.addNotification({
          type: 'habit-reminder',
          title: '习惯提醒',
          message: job.body || '',
          actionUrl: 'habits',
          relatedType: 'habit',
          relatedId: job.meta.habitId,
        })
      } else if (job.meta?.kind === 'goal' && job.meta.goalId) {
        st.addNotification({
          type: 'goal-due',
          title: job.title || '🎯 目标提醒',
          message: job.body || '',
          actionUrl: 'goals',
          relatedType: 'goal',
          relatedId: job.meta.goalId,
        })
      }
    })
  }, [])
}
