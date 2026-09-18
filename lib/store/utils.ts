import type { Habit, Anniversary, Task, TimeEntry, PomodoroSession, Project } from '@/lib/types'
import type { StoreApi } from 'zustand'
import { 
  DEFAULT_HABITS, 
  DEFAULT_ANNIVERSARIES, 
  DEFAULT_TASKS, 
  DEFAULT_PROJECTS,
} from '@/lib/config'
import { pushDataToS3 } from '@/lib/s3-store'
import { offlineQueue, setOfflineQueuePush, startAutoFlush } from '@/lib/sync/offline-queue'
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
 * 参与同步元数据（updatedAt / 墓碑）管理的实体集合。
 * 盖章与删除捕获都在 cloudSyncMiddleware 的 set 包装层做，
 * 无论业务代码从哪个入口改数据，同步元数据都不会遗漏。
 */
const SYNCED_COLLECTIONS = ['tasks', 'projects', 'habits', 'anniversaries', 'goals', 'tags'] as const

interface SyncedEntity {
  id: string
  updatedAt?: number
}

/** 内容级比较（忽略 updatedAt）：只有真实内容变化才盖章，避免引用抖动引发盖章风暴 */
function sameExceptUpdatedAt(a: SyncedEntity, b: SyncedEntity): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (k === 'updatedAt') continue
    if (!Object.is((a as unknown as Record<string, unknown>)[k], (b as unknown as Record<string, unknown>)[k])) return false
  }
  return true
}

function stampCollection<T extends SyncedEntity>(prevArr: T[], nextArr: T[], now: number): T[] {
  const prevById = new Map(prevArr.map(item => [item.id, item]))
  let changed = false
  const stamped = nextArr.map(item => {
    const prev = prevById.get(item.id)
    if (prev === item) return item
    if (prev && sameExceptUpdatedAt(prev, item)) return prev
    changed = true
    return { ...item, updatedAt: now }
  })
  return changed ? stamped : nextArr
}

function findRemovedIds(prevArr: SyncedEntity[], nextArr: SyncedEntity[]): string[] {
  const nextIds = new Set(nextArr.map(item => item.id))
  return prevArr.filter(item => !nextIds.has(item.id)).map(item => item.id)
}

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
      'focusShield',
      'focusShieldSchedule',
      'subscribedCalendars',
      'tombstones',
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

    // 推送失败不再静默丢弃：同步进离线队列，恢复后自动补推
    const pushWithQueue = (pusher: () => unknown) => {
      try {
        const result = pusher()
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => offlineQueue.enqueue(snapshot))
        }
      } catch {
        offlineQueue.enqueue(snapshot)
      }
    }
    pushWithQueue(() => pushDataToS3(syncData))
  }, 2000)
}

// 离线队列的重试推送：解析暂存快照并重推
setOfflineQueuePush(async (snapshot) => {
  const data = JSON.parse(snapshot) as Record<string, unknown>
  const toPromise = (r: unknown) => (r && typeof (r as Promise<unknown>).then === 'function' ? (r as Promise<unknown>) : Promise.resolve())
  await toPromise(pushDataToS3(data))
})
startAutoFlush(offlineQueue)

export const cloudSyncMiddleware = <T extends object>(
  config: (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: StoreApi<T>) => T
) => {
  return (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: StoreApi<T>): T => {
    const syncSet = (fn: ((state: T) => Partial<T>) | Partial<T>) => {
      const prev = get()
      set(fn)
      const next = get()
      // 同步元数据：updatedAt 盖章 + 删除墓碑（用原始 set 直写，避免再次进入本包装造成递归）
      stampSyncMetadata(prev as Record<string, unknown>, next as Record<string, unknown>, set as unknown as (p: object) => void)
      scheduleCloudSync()
    }
    return config(syncSet, get, api)
  }
}

/** 实体增改 → 盖 updatedAt；实体消失 → 记删除墓碑 */
function stampSyncMetadata(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  rawSet: (p: object) => void
): void {
  const now = Date.now()
  const updates: Record<string, unknown> = {}
  const removed: Array<{ id: string; collection: string }> = []

  for (const key of SYNCED_COLLECTIONS) {
    const prevArr = prev[key]
    const nextArr = next[key]
    if (!Array.isArray(prevArr) || !Array.isArray(nextArr)) continue
    if (prevArr === nextArr) continue
    const stamped = stampCollection(prevArr as SyncedEntity[], nextArr as SyncedEntity[], now)
    if (stamped !== (nextArr as SyncedEntity[])) updates[key] = stamped
    for (const id of findRemovedIds(prevArr as SyncedEntity[], stamped)) {
      removed.push({ id, collection: key })
    }
  }

  if (removed.length > 0) {
    try {
      storeModule.useAppStore.getState().recordTombstones(removed)
    } catch {
      // store 尚未就绪时跳过（首次初始化期间不会有业务删除）
    }
  }
  if (Object.keys(updates).length > 0) {
    rawSet(updates)
  }
}
