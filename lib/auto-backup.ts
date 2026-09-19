'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export interface BackupEntry {
  id: string
  name: string
  timestamp: number
  auto?: boolean
  data: string
}

export interface AutoBackupSettings {
  enabled: boolean
  intervalHours: number
  keep: number
}

const BACKUP_STORAGE_KEY = 'focusflow-backups'
const SETTINGS_KEY = 'focusflow-auto-backup'
const LAST_RUN_KEY = 'focusflow-auto-backup-last'

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  enabled: false,
  intervalHours: 24,
  keep: 10,
}

/** 需要备份的核心数据切片（与持久化 store 对齐） */
const BACKUP_SLICES = [
  'tasks', 'habits', 'habitCheckIns', 'timeEntries', 'pomodoroSessions',
  'abandonedPomodoroSessions', 'pomodoroSettings', 'projects', 'anniversaries',
  'goals', 'tags', 'reminders', 'notifications', 'achievements', 'userLevel',
  'focusGoals', 'repeatCompletions', 'trashedItems', 'taskOrder', 'timeBlocks',
  'distractions', 'journals', 'taskTemplates', 'pomodoroStrictMode',
  'dashboardWidgets', 'darkModeSchedule', 'workingHours', 'focusSoundSettings',
  'focusPresets', 'focusShield', 'dailyReviewSettings', 'savedFilters',
  'externalEvents', 'subscribedCalendars',
  'activitySettings', 'activityDays',
] as const

export function loadBackups(): BackupEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(BACKUP_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as BackupEntry[]) : []
  } catch {
    return []
  }
}

export function saveBackups(backups: BackupEntry[]): void {
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups))
}

export function getAutoBackupSettings(): AutoBackupSettings {
  if (typeof window === 'undefined') return DEFAULT_AUTO_BACKUP_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_AUTO_BACKUP_SETTINGS
    return { ...DEFAULT_AUTO_BACKUP_SETTINGS, ...(JSON.parse(raw) as Partial<AutoBackupSettings>) }
  } catch {
    return DEFAULT_AUTO_BACKUP_SETTINGS
  }
}

export function saveAutoBackupSettings(settings: AutoBackupSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/** 采集当前 store 快照并写入一条备份，返回更新后的备份列表 */
export function createBackupEntry(auto: boolean): BackupEntry[] {
  const store = useAppStore.getState()
  const snapshot: Record<string, unknown> = {}
  for (const key of BACKUP_SLICES) {
    if (store[key] !== undefined) snapshot[key] = store[key]
  }
  snapshot.pomodoroTimerState = { ...store.pomodoroTimerState, isRunning: false }
  snapshot.sidebarCollapsed = store.sidebarCollapsed
  snapshot.activeSmartList = store.activeSmartList
  snapshot.activeSavedFilterId = store.activeSavedFilterId

  const entry: BackupEntry = {
    id: `backup-${Date.now()}`,
    name: `${auto ? '自动备份' : '备份'} ${new Date().toLocaleString('zh-CN')}`,
    timestamp: Date.now(),
    auto,
    data: JSON.stringify(snapshot),
  }
  const settings = getAutoBackupSettings()
  const keep = auto ? Math.max(settings.keep, 1) : 10
  const backups = [entry, ...loadBackups()]
  // 手动备份槽位与自动备份分开计：保留最近 keep 份自动 + 全部手动，总量封顶 30
  const autos = backups.filter((b) => b.auto).slice(0, keep)
  const manuals = backups.filter((b) => !b.auto).slice(0, 20)
  const next = [...autos, ...manuals].sort((a, b) => b.timestamp - a.timestamp)
  saveBackups(next)
  return next
}

/** 若自动备份已启用且超过间隔，则创建一个自动备份 */
export function runAutoBackupIfDue(): boolean {
  const settings = getAutoBackupSettings()
  if (!settings.enabled) return false
  const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0)
  if (Date.now() - last < settings.intervalHours * 3600_000) return false
  localStorage.setItem(LAST_RUN_KEY, String(Date.now()))
  createBackupEntry(true)
  return true
}

/** 挂到桌面外壳：启动后补一次 + 每 30 分钟检查 */
export function useAutoBackup(): void {
  useEffect(() => {
    const t = setTimeout(() => runAutoBackupIfDue(), 5000)
    const interval = setInterval(() => runAutoBackupIfDue(), 30 * 60_000)
    return () => {
      clearTimeout(t)
      clearInterval(interval)
    }
  }, [])
}
