/**
 * 已通知事件注册表（localStorage 持久化 + 内存 Set 缓存）。
 *
 * 用于：
 * - 去重：同一事件（如"任务X今日到期"）一天内只通知一次，应用重启也不重复
 * - 级联清理：删除实体时，通过 clearNotifiedKeysWithPrefix 同步清除
 *   该实体的已通知状态，避免实体恢复后（从回收站）无法重新提醒
 */
const STORAGE_KEY = 'focusflow-notified-registry'
const MAX_KEYS = 2000

function load(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const keys = JSON.parse(raw) as string[]
    return new Set(keys.filter(isNotTooOld))
  } catch {
    return new Set()
  }
}

/** 丢弃超过 14 天的日期型键（如 task-overdue-x-2026-07-20），防止无限膨胀 */
function isNotTooOld(key: string): boolean {
  const match = key.match(/\d{4}-\d{2}-\d{2}/)
  if (!match) return true
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  return new Date(match[0]).getTime() > fourteenDaysAgo.getTime()
}

const notifiedKeys = load()

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...notifiedKeys]))
  } catch {
    // 存储不可用/已满时仅保留内存记录
  }
}

export function markNotified(key: string): void {
  if (notifiedKeys.size >= MAX_KEYS) notifiedKeys.clear()
  notifiedKeys.add(key)
  persist()
}

export function hasNotified(key: string): boolean {
  return notifiedKeys.has(key)
}

/** 删除实体时调用：清除该实体相关的已通知状态 */
export function clearNotifiedKeysWithPrefix(prefix: string): void {
  for (const key of notifiedKeys) {
    if (key.startsWith(prefix)) {
      notifiedKeys.delete(key)
    }
  }
  persist()
}
