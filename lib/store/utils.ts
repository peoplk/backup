import type { Habit, Anniversary, Task, TimeEntry, PomodoroSession, Project } from '@/lib/types'
import type { StoreApi } from 'zustand'
import { 
  DEFAULT_HABITS, 
  DEFAULT_ANNIVERSARIES, 
  DEFAULT_TASKS, 
  DEFAULT_PROJECTS,
} from '@/lib/config'
import { pushDataToCloud } from '@/lib/sync-store'
import { pushDataToS3 } from '@/lib/s3-store'
import * as storeModule from '@/lib/store'

export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).substring(2, 15)
}

export const DATA_CLEARED_FLAG = 'focusflow-data-cleared'

export const wasDataClearedByUser = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(DATA_CLEARED_FLAG) === 'true'
  } catch {
    return false
  }
}

export const defaultHabits: Habit[] = wasDataClearedByUser() ? [] : DEFAULT_HABITS.map((h, i) => ({
  ...h,
  id: String(i + 1),
  createdAt: new Date(),
  archived: false,
}))

export const defaultAnniversaries: Anniversary[] = wasDataClearedByUser() ? [] : DEFAULT_ANNIVERSARIES.map((a, i) => ({
  ...a,
  id: String(i + 1),
  createdAt: new Date(),
}))

export const defaultTasks: Task[] = wasDataClearedByUser() ? [] : DEFAULT_TASKS.map((t, i) => ({
  ...t,
  id: String(i + 1),
  createdAt: new Date(),
  completedPomodoros: 0,
  completedAt: t.status === 'done' ? new Date() : undefined,
  type: t.type || 'task',
}))

export const defaultTimeEntries: TimeEntry[] = []

export const defaultProjects: Project[] = wasDataClearedByUser() ? [] : DEFAULT_PROJECTS.map((p, i) => ({
  ...p,
  id: String(i + 1),
  totalTime: 0,
}))

export const defaultPomodoroSessions: PomodoroSession[] = []

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastPushedSnapshot: string | null = null

/**
 * 被排除在高频云同步之外的状态键：
 * pomodoroTimerState 每 250ms 变化一次，全量上传只会产生无意义的流量与写入。
 * 该状态仅用于本地计时，persist 时已将 isRunning 置为 false，无需云端恢复。
 */
const CLOUD_SYNC_EXCLUDED_KEYS: ReadonlySet<string> = new Set(['pomodoroTimerState'])

export function scheduleCloudSync() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const store = storeModule.useAppStore.getState()
    const syncData: Record<string, unknown> = {}
    for (const key of [
      'tasks',
      'timeEntries',
      'pomodoroSessions',
      'abandonedPomodoroSessions',
      'pomodoroSettings',
      'projects',
      'habits',
      'habitCheckIns',
      'anniversaries',
      'notifications',
      'sidebarCollapsed',
      'activeSmartList',
      'goals',
      'achievements',
      'userLevel',
      'tags',
      'reminders',
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
    ]) {
      if (CLOUD_SYNC_EXCLUDED_KEYS.has(key)) continue
      ;(syncData as Record<string, unknown>)[key] = (store as unknown as Record<string, unknown>)[key]
    }

    // 内容无变化时跳过推送，避免计时器 tick 等高频 set 触发无意义的网络请求
    const snapshot = JSON.stringify(syncData, (k, v) => (v instanceof Date ? v.toISOString() : v))
    if (snapshot === lastPushedSnapshot) return
    lastPushedSnapshot = snapshot

    pushDataToCloud(syncData)
    pushDataToS3(syncData)
  }, 2000)
}

export const cloudSyncMiddleware = <T extends object>(
  config: (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: StoreApi<T>) => T
) => {
  return (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: StoreApi<T>): T => {
    const syncSet = (fn: ((state: T) => Partial<T>) | Partial<T>) => {
      set(fn)
      scheduleCloudSync()
    }
    return config(syncSet, get, api)
  }
}
