import { useMemo, useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task, RepeatRule, RepeatTaskCompletion } from '@/lib/types'
import { computeDailyScore, computeScoreTrend } from '@/lib/productivity-score'

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000
const LAST_CLEANUP_KEY = 'last-cleanup-time'

export function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString()
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function isOverdue(date: Date): boolean {
  const today = getTodayStart()
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  return compareDate < today
}

export function isRepeatTaskDue(task: Task, today: Date = new Date()): boolean {
  if (!task.repeatRule) return false
  if (task.repeatRule.paused) return false
  if (task.repeatRule.endDate && new Date(task.repeatRule.endDate) < today) return false
  if (!task.dueDate) return true
  const dueDate = new Date(task.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  return dueDate <= todayStart
}

export function isRepeatTaskCompletedToday(task: Task, repeatCompletions: RepeatTaskCompletion[]): boolean {
  if (!task.repeatRule) return false
  if (!repeatCompletions || !Array.isArray(repeatCompletions)) return false
  const todayStr = new Date().toDateString()
  return repeatCompletions.some(
    c => c && c.taskId === task.id && c.completedAt && new Date(c.completedAt).toDateString() === todayStr
  )
}

export type TodayTask = Task & { isOverdue?: boolean; completedToday?: boolean }

export function useTodayTasks() {
  const tasks = useAppStore((state) => state.tasks)
  const repeatCompletions = useAppStore((state) => state.repeatCompletions)
  
  return useMemo(() => {
    const today = getTodayStart()
    const urgentTaskIds = new Set(
      tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').map(t => t.id)
    )
    
    const todayTasks: TodayTask[] = []
    
    tasks.forEach(t => {
      if (urgentTaskIds.has(t.id)) return
      
      if (t.repeatRule) {
        const completedToday = isRepeatTaskCompletedToday(t, repeatCompletions)
        if (completedToday) {
          todayTasks.push({ ...t, completedToday: true })
          return
        }
        if (isRepeatTaskDue(t, today)) {
          const dueDate = t.dueDate ? new Date(t.dueDate) : null
          const isOverdue = dueDate ? dueDate < today : false
          todayTasks.push(isOverdue ? { ...t, isOverdue: true } : t)
        }
        return
      }

      if (t.status === 'done') return
      
      if (t.dueDate) {
        const dueDate = new Date(t.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        
        if (dueDate.getTime() === today.getTime()) {
          todayTasks.push(t)
        } else if (dueDate < today) {
          todayTasks.push({ ...t, isOverdue: true })
        }
      }
    })
    
    return todayTasks.sort((a, b) => {
      if (a.completedToday && !b.completedToday) return 1
      if (!a.completedToday && b.completedToday) return -1
      if (a.isOverdue) return -1
      if (b.isOverdue) return 1
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0
      return aTime - bTime
    })
  }, [tasks, repeatCompletions])
}

export function useUrgentTasks() {
  const tasks = useAppStore((state) => state.tasks)
  
  return useMemo(() => {
    return tasks.filter(t => t.priority === 'urgent' && t.status !== 'done')
  }, [tasks])
}

export function useAutoCleanup() {
  const clearAllOldData = useAppStore((state) => state.clearAllOldData)
  const refreshRepeatTasksStatus = useAppStore((state) => state.refreshRepeatTasksStatus)
  const hasCleanedUp = useRef(false)

  useEffect(() => {
    if (hasCleanedUp.current) return
    hasCleanedUp.current = true

    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY)
    const now = Date.now()

    if (!lastCleanup || now - parseInt(lastCleanup) > CLEANUP_INTERVAL) {
      clearAllOldData()
      refreshRepeatTasksStatus()
      localStorage.setItem(LAST_CLEANUP_KEY, now.toString())
    }
  }, [clearAllOldData])
}

export function useStats() {
const tasks = useAppStore((s) => s.tasks)
const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)
const timeEntries = useAppStore((s) => s.timeEntries)
const habits = useAppStore((s) => s.habits)
const habitCheckIns = useAppStore((s) => s.habitCheckIns)
const timeBlocks = useAppStore((s) => s.timeBlocks)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayStr = today.toDateString()

  const todayPomodoros = useMemo(() => {
    return pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    )
  }, [pomodoroSessions, todayStr])

  const todayFocusSeconds = useMemo(() => {
    return todayPomodoros.reduce((acc, s) => acc + s.duration, 0)
  }, [todayPomodoros])

  const completedToday = useMemo(() => {
    return tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt).toDateString() === todayStr
    ).length
  }, [tasks, todayStr])

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done')
  }, [tasks])

  const urgentTasks = useMemo(() => {
    return tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done')
  }, [tasks])

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'done')
  }, [tasks])

  const efficiencyScore = useMemo(() => {
    return computeDailyScore(new Date(), {
      tasks,
      pomodoroSessions,
      timeBlocks,
      habits,
      habitCheckIns,
    }).score
  }, [tasks, pomodoroSessions, timeBlocks, habits, habitCheckIns])

  const productivityTrend = useMemo(() => {
    return computeScoreTrend(7, {
      tasks,
      pomodoroSessions,
      timeBlocks,
      habits,
      habitCheckIns,
    })
  }, [tasks, pomodoroSessions, timeBlocks, habits, habitCheckIns])

  return {
    today,
    todayStr,
    todayPomodoros,
    todayFocusSeconds,
    completedToday,
    activeTasks,
    urgentTasks,
    completedTasks,
    efficiencyScore,
    productivityTrend,
  }
}

export function useWeekStats() {
  const tasks = useAppStore((s) => s.tasks)
  const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)
  const timeEntries = useAppStore((s) => s.timeEntries)

  const weekStats = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const weekPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt) >= startOfWeek && s.type === 'work'
    ).length

    const weekFocusSeconds = pomodoroSessions
      .filter((s) => new Date(s.completedAt) >= startOfWeek && s.type === 'work')
      .reduce((acc, s) => acc + s.duration, 0)
    const weekHours = weekFocusSeconds / 3600

    const weekEntries = timeEntries.filter(
      (e) => new Date(e.startTime) >= startOfWeek
    )
    const weekTimeHours = weekEntries.reduce((acc, e) => acc + e.duration, 0) / 3600

    const weekTasks = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= startOfWeek
    ).length

    return { weekPomodoros, weekHours, weekTimeHours, weekTasks, startOfWeek }
  }, [tasks, pomodoroSessions, timeEntries])

  return weekStats
}

export function useStreak() {
  const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)

  const streak = useMemo(() => {
    const allWorkSessions = pomodoroSessions.filter((s) => s.type === 'work')
    const dates = [...new Set(allWorkSessions.map((s) => new Date(s.completedAt).toDateString()))]
    dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    const dateSet = new Set(dates)

    let count = 0
    const checkDate = new Date()
    for (let i = 0; i < dates.length; i++) {
      const dateStr = checkDate.toDateString()
      if (dateSet.has(dateStr)) {
        count++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
        i--
      } else {
        break
      }
    }
    return count
  }, [pomodoroSessions])

  return streak
}

export function useHabitStats() {
  const habits = useAppStore((s) => s.habits)
  const habitCheckIns = useAppStore((s) => s.habitCheckIns)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayStr = today.toDateString()

  const activeHabits = useMemo(() => {
    return habits.filter((h) => !h.archived)
  }, [habits])

  const todayCheckIns = useMemo(() => {
    return habitCheckIns.filter(
      (c) => new Date(c.date).toDateString() === todayStr
    )
  }, [habitCheckIns, todayStr])

  const completedToday = todayCheckIns.filter((c) => c.completed).length
  const totalHabits = activeHabits.length
  const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0

  const getHabitStreak = (habitId: string) => {
    let streak = 0
    const checkDate = new Date()
    while (true) {
      const dateStr = checkDate.toDateString()
      const checkIn = habitCheckIns.find(
        (c) => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
      )
      if (checkIn?.completed) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  }

  const getHabitCompletionRate = (habitId: string, days: number = 30) => {
    let completed = 0
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toDateString()
      const checkIn = habitCheckIns.find(
        (c) => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
      )
      if (checkIn?.completed) completed++
    }
    return Math.round((completed / days) * 100)
  }

  const maxStreak = Math.max(...activeHabits.map((h) => getHabitStreak(h.id)), 0)

  const avgCompletionRate = activeHabits.length > 0
    ? Math.round(activeHabits.reduce((acc, h) => acc + getHabitCompletionRate(h.id), 0) / activeHabits.length)
    : 0

  return {
    activeHabits,
    todayCheckIns,
    completedToday,
    totalHabits,
    completionRate,
    maxStreak,
    avgCompletionRate,
    getHabitStreak,
    getHabitCompletionRate,
  }
}

export function useWeeklyData() {
  const tasks = useAppStore((s) => s.tasks)
  const timeEntries = useAppStore((s) => s.timeEntries)

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  const weeklyData = useMemo(() => {
    const result = []
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toDateString()

      const dayEntries = timeEntries.filter(
        (e) => new Date(e.startTime).toDateString() === dateStr
      )
      const hours = dayEntries.reduce((acc, e) => acc + e.duration, 0) / 3600

      const dayTasks = tasks.filter(
        (t) => t.completedAt && new Date(t.completedAt).toDateString() === dateStr
      ).length

      result.push({
        name: weekDays[i],
        hours: Math.round(hours * 10) / 10,
        tasks: dayTasks,
      })
    }
    return result
  }, [timeEntries, tasks])

  return weeklyData
}

export function useProjectData() {
  const projects = useAppStore((s) => s.projects)

  const projectData = useMemo(() => {
    const totalTime = projects.reduce((acc, p) => acc + p.totalTime, 0)
    if (totalTime === 0) {
      return projects.map((p) => ({ name: p.name, value: 0, color: p.color }))
    }
    return projects.map((p) => ({
      name: p.name,
      value: Math.round((p.totalTime / totalTime) * 100),
      color: p.color,
    }))
  }, [projects])

  return projectData
}

export function useFocusData() {
  const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)

  const focusData = useMemo(() => {
    const hourBuckets: Record<string, number> = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toDateString()

    const todayPomodoros = pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    )

    for (let h = 0; h < 24; h += 2) {
      const key = `${h.toString().padStart(2, '0')}:00`
      hourBuckets[key] = 0
    }

    todayPomodoros.forEach((s) => {
      const hour = new Date(s.completedAt).getHours()
      const bucketHour = Math.floor(hour / 2) * 2
      const key = `${bucketHour.toString().padStart(2, '0')}:00`
      if (hourBuckets[key] !== undefined) {
        hourBuckets[key]++
      }
    })

    return Object.entries(hourBuckets).map(([name, sessions]) => ({
      name,
      sessions,
    }))
  }, [pomodoroSessions])

  return focusData
}

export function useLast30Days() {
  return useMemo(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date)
    }
    return days
  }, [])
}

export { formatDuration, formatDurationShort, formatDurationCompact, formatTimeRemaining, formatRelativeTime } from './format'
