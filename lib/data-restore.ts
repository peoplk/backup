import { useAppStore } from '@/lib/store'

export interface RestoreCounts {
  tasks: number
  habits: number
  habitCheckIns: number
  anniversaries: number
  projects: number
  goals: number
  tags: number
  reminders: number
  timeEntries: number
  pomodoroSessions: number
  [key: string]: number
}

function toDate(value: unknown): Date | undefined {
  if (value == null) return undefined
  const d = new Date(value as string)
  return isNaN(d.getTime()) ? undefined : d
}

function asArray(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const arr = data[key]
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

function isISODateString(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)
}

function deepRestoreDates<T>(value: T, depth = 0): T {
  if (value == null || depth > 8) return value
  if (value instanceof Date) return value as T
  if (Array.isArray(value)) {
    return value.map((v) => deepRestoreDates(v, depth + 1)) as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isISODateString(v)) {
        const d = new Date(v)
        out[k] = isNaN(d.getTime()) ? v : d
      } else {
        out[k] = deepRestoreDates(v, depth + 1)
      }
    }
    return out as T
  }
  return value
}

const EXTRA_KEYS = [
  'notifications',
  'achievements',
  'userLevel',
  'sidebarCollapsed',
  'activeSmartList',
  'focusGoals',
  'repeatCompletions',
  'trashedItems',
  'taskOrder',
  'timeBlocks',
  'distractions',
  'journals',
  'taskTemplates',
  'pomodoroStrictMode',
  'dashboardWidgets',
  'darkModeSchedule',
  'workingHours',
  'focusSoundSettings',
  'focusPresets',
  'dailyReviewSettings',
  'savedFilters',
  'activeSavedFilterId',
  'abandonedPomodoroSessions',
]

export function restoreDataToStore(data: Record<string, unknown>): RestoreCounts {
  const counts: RestoreCounts = {
    tasks: 0,
    habits: 0,
    habitCheckIns: 0,
    anniversaries: 0,
    projects: 0,
    goals: 0,
    tags: 0,
    reminders: 0,
    timeEntries: 0,
    pomodoroSessions: 0,
  }

  // 整体替换数组（保留原始 id，避免 habitCheckIns/goals/reminders 关联断裂）
  const patch: Record<string, any> = {}

  const tasks = asArray(data, 'tasks')
  if (tasks.length > 0) {
    patch.tasks = tasks.map((t) => ({
      ...t,
      title: (t.title as string) || '未命名任务',
      type: (t.type as string) || 'task',
      priority: (t.priority as string) || 'medium',
      status: (t.status as string) || 'todo',
      tags: Array.isArray(t.tags) ? t.tags : [],
      completedPomodoros: typeof t.completedPomodoros === 'number' ? t.completedPomodoros : 0,
      timeSpent: typeof t.timeSpent === 'number' ? t.timeSpent : 0,
      dueDate: toDate(t.dueDate),
      createdAt: toDate(t.createdAt) || new Date(),
      completedAt: toDate(t.completedAt),
      reminders: Array.isArray(t.reminders)
        ? (t.reminders as Record<string, unknown>[]).map((r) => ({
            ...r,
            triggerAt: toDate(r.triggerAt),
          }))
        : undefined,
    }))
    counts.tasks = patch.tasks.length
  }

  const habits = asArray(data, 'habits')
  if (habits.length > 0) {
    patch.habits = habits.map((h) => ({
      ...h,
      name: (h.name as string) || '未命名习惯',
      icon: (h.icon as string) || '⭐',
      color: (h.color as string) || '#4F46E5',
      frequency: (h.frequency as string) || 'daily',
      trackingType: (h.trackingType as string) || 'boolean',
      targetValue: typeof h.targetValue === 'number' ? h.targetValue : undefined,
      unit: typeof h.unit === 'string' ? h.unit : undefined,
      streakFreezes: typeof h.streakFreezes === 'number' ? h.streakFreezes : 0,
      maxStreakFreezes: typeof h.maxStreakFreezes === 'number' ? h.maxStreakFreezes : 3,
      createdAt: toDate(h.createdAt) || new Date(),
      archived: h.archived as boolean,
    }))
    counts.habits = patch.habits.length
  }

  const habitCheckIns = asArray(data, 'habitCheckIns')
  if (habitCheckIns.length > 0) {
    patch.habitCheckIns = habitCheckIns.map((c) => ({
      ...c,
      habitId: c.habitId as string,
      date: toDate(c.date) || new Date(),
      completed: c.completed as boolean,
      note: typeof c.note === 'string' ? c.note : undefined,
      value: typeof c.value === 'number' ? c.value : undefined,
    }))
    counts.habitCheckIns = patch.habitCheckIns.length
  }

  const anniversaries = asArray(data, 'anniversaries')
  if (anniversaries.length > 0) {
    patch.anniversaries = anniversaries.map((a) => ({
      ...a,
      title: (a.title as string) || '未命名纪念日',
      date: toDate(a.date) || new Date(),
      type: (a.type as string) || 'custom',
      repeat: a.repeat as boolean,
      remindDays: typeof a.remindDays === 'number' ? a.remindDays : 1,
      createdAt: toDate(a.createdAt) || new Date(),
    }))
    counts.anniversaries = patch.anniversaries.length
  }

  const projects = asArray(data, 'projects')
  if (projects.length > 0) {
    patch.projects = projects.map((p) => ({
      ...p,
      name: (p.name as string) || '未命名项目',
      color: (p.color as string) || '#4F46E5',
      totalTime: typeof p.totalTime === 'number' ? p.totalTime : 0,
    }))
    counts.projects = patch.projects.length
  }

  const goals = asArray(data, 'goals')
  if (goals.length > 0) {
    patch.goals = goals.map((g) => ({
      ...g,
      title: (g.title as string) || '未命名目标',
      type: (g.type as string) || 'monthly',
      category: (g.category as string) || 'other',
      status: (g.status as string) || 'not-started',
      progress: typeof g.progress === 'number' ? g.progress : 0,
      startDate: toDate(g.startDate) || new Date(),
      endDate: toDate(g.endDate) || new Date(),
      createdAt: toDate(g.createdAt) || new Date(),
      completedAt: toDate(g.completedAt),
      linkedTasks: Array.isArray(g.linkedTasks) ? g.linkedTasks : [],
      linkedHabits: Array.isArray(g.linkedHabits) ? g.linkedHabits : undefined,
      milestones: Array.isArray(g.milestones)
        ? (g.milestones as Record<string, unknown>[]).map((m) => ({
            ...m,
            dueDate: toDate(m.dueDate),
            completedAt: toDate(m.completedAt),
          }))
        : [],
    }))
    counts.goals = patch.goals.length
  }

  const tags = asArray(data, 'tags')
  if (tags.length > 0) {
    patch.tags = tags.map((t) => ({
      ...t,
      name: (t.name as string) || '未命名标签',
      color: (t.color as string) || '#4F46E5',
      usageCount: typeof t.usageCount === 'number' ? t.usageCount : 0,
      createdAt: toDate(t.createdAt) || new Date(),
    }))
    counts.tags = patch.tags.length
  }

  const reminders = asArray(data, 'reminders')
  if (reminders.length > 0) {
    patch.reminders = reminders.map((r) => ({
      ...r,
      type: (r.type as string) || 'custom',
      title: (r.title as string) || '提醒',
      message: typeof r.message === 'string' ? r.message : '',
      scheduledTime: toDate(r.scheduledTime) || new Date(),
      repeat: (r.repeat as string) || 'none',
      enabled: r.enabled as boolean,
      createdAt: toDate(r.createdAt) || new Date(),
    }))
    counts.reminders = patch.reminders.length
  }

  const timeEntries = asArray(data, 'timeEntries')
  if (timeEntries.length > 0) {
    patch.timeEntries = timeEntries.map((e) => ({
      ...e,
      project: (e.project as string) || '未分类',
      duration: typeof e.duration === 'number' ? e.duration : 0,
      startTime: toDate(e.startTime) || new Date(),
      endTime: toDate(e.endTime),
      tags: Array.isArray(e.tags) ? e.tags : undefined,
      taskId: typeof e.taskId === 'string' ? e.taskId : undefined,
      projectId: typeof e.projectId === 'string' ? e.projectId : undefined,
    }))
    counts.timeEntries = patch.timeEntries.length
  }

  const pomodoroSessions = asArray(data, 'pomodoroSessions')
  if (pomodoroSessions.length > 0) {
    patch.pomodoroSessions = pomodoroSessions.map((s) => ({
      ...s,
      type: (s.type as string) || 'work',
      duration: typeof s.duration === 'number' ? s.duration : 0,
      completedAt: toDate(s.completedAt) || new Date(),
      taskId: typeof s.taskId === 'string' ? s.taskId : undefined,
      note: typeof s.note === 'string' ? s.note : undefined,
      tags: Array.isArray(s.tags) ? s.tags : undefined,
    }))
    counts.pomodoroSessions = patch.pomodoroSessions.length
  }

  if (data.pomodoroSettings && typeof data.pomodoroSettings === 'object') {
    patch.pomodoroSettings = data.pomodoroSettings
  }

  for (const key of EXTRA_KEYS) {
    if (data[key] !== undefined) {
      patch[key] = deepRestoreDates(data[key])
    }
  }

  if (data.pomodoroTimerState && typeof data.pomodoroTimerState === 'object') {
    patch.pomodoroTimerState = { ...(deepRestoreDates(data.pomodoroTimerState) as object), isRunning: false }
  }

  if (Object.keys(patch).length > 0) {
    ;(useAppStore.setState as (partial: unknown) => void)(patch)
  }

  return counts
}
