/**
 * 删除墓碑（多端同步正确性地基）：
 * 实体被删除后记录墓碑并随全量同步扩散，其他设备拉取时据此删除本地对应项，
 * 防止"设备 A 删除 → 设备 B 的旧数据在合并时复活"。
 * - 本地持久化在 localStorage（focusflow-tombstones）
 * - 云端通过主 store 的 tombstones 数组随快照同步（见 sync-slice）
 * - 30 天过期、上限 500 条，防止无限膨胀
 */

export interface Tombstone {
  id: string
  collection: string
  deletedAt: number
}

export const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const TOMBSTONE_CAP = 500
const STORAGE_KEY = 'focusflow-tombstones'

/** 参与墓碑管理的实体集合（与 store/utils 的 SYNCED_COLLECTIONS 保持一致） */
export const SYNCED_COLLECTION_KEYS = ['tasks', 'projects', 'habits', 'anniversaries', 'goals', 'tags'] as const

/** 纯函数：合并两份墓碑列表（并集，同键取较新，裁剪过期与容量） */
export function mergeTombstoneLists(local: Tombstone[], remote: Tombstone[], now: number): Tombstone[] {
  const byKey = new Map<string, Tombstone>()
  for (const t of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
    if (!t || typeof t.id !== 'string' || typeof t.collection !== 'string' || typeof t.deletedAt !== 'number') continue
    const prev = byKey.get(`${t.collection}:${t.id}`)
    if (!prev || prev.deletedAt < t.deletedAt) byKey.set(`${t.collection}:${t.id}`, t)
  }
  return pruneList(Array.from(byKey.values()), now)
}

/** 可注入存储的墓碑仓库（便于单测与主 store 双写） */
export function createTombstoneStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  function load(): Tombstone[] {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Tombstone[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function save(list: Tombstone[]): void {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
      // 存储满等异常不阻塞业务
    }
  }

  return {
    load,
    /** 记录删除；同 id 重复删除取较新的 deletedAt */
    record(entries: Array<{ id: string; collection: string }>, now: number): Tombstone[] {
      if (entries.length === 0) return load()
      const list = load()
      const byKey = new Map(list.map(t => [`${t.collection}:${t.id}`, t]))
      for (const e of entries) {
        const prev = byKey.get(`${e.collection}:${e.id}`)
        if (!prev || prev.deletedAt < now) {
          byKey.set(`${e.collection}:${e.id}`, { id: e.id, collection: e.collection, deletedAt: now })
        }
      }
      const next = pruneList(Array.from(byKey.values()), now)
      save(next)
      return next
    },
    /** 与远端墓碑合并（并集，同键取较新） */
    merge(remote: Tombstone[], now: number): Tombstone[] {
      if (!Array.isArray(remote) || remote.length === 0) return load()
      const byKey = new Map(load().map(t => [`${t.collection}:${t.id}`, t]))
      for (const t of remote) {
        if (!t || typeof t.id !== 'string' || typeof t.collection !== 'string') continue
        const prev = byKey.get(`${t.collection}:${t.id}`)
        if (!prev || prev.deletedAt < t.deletedAt) {
          byKey.set(`${t.collection}:${t.id}`, t)
        }
      }
      const next = pruneList(Array.from(byKey.values()), now)
      save(next)
      return next
    },
    clear(): void {
      try { storage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    },
  }
}

/** 过期裁剪 + 容量上限（保留最近的） */
export function pruneList(list: Tombstone[], now: number): Tombstone[] {
  const fresh = list.filter(t => t && typeof t.deletedAt === 'number' && now - t.deletedAt < TOMBSTONE_MAX_AGE_MS)
  if (fresh.length <= TOMBSTONE_CAP) return fresh
  return fresh.sort((a, b) => b.deletedAt - a.deletedAt).slice(0, TOMBSTONE_CAP)
}

/**
 * 把墓碑应用到合并前的数据：删除集合中已被墓碑标记、且自删除后没有再次修改的项。
 * updatedAt 晚于 deletedAt 的视为"删除后又在别处编辑/复活"，保留。
 */
export function applyTombstonesToData(
  data: Record<string, unknown>,
  tombstones: Tombstone[],
  collectionKeys: readonly string[],
): Record<string, unknown> {
  if (!Array.isArray(tombstones) || tombstones.length === 0) return data
  const byCollection = new Map<string, Map<string, number>>()
  for (const t of tombstones) {
    if (!byCollection.has(t.collection)) byCollection.set(t.collection, new Map())
    byCollection.get(t.collection)!.set(t.id, t.deletedAt)
  }
  const out: Record<string, unknown> = { ...data }
  for (const key of collectionKeys) {
    const marks = byCollection.get(key)
    if (!marks || !Array.isArray(out[key])) continue
    out[key] = (out[key] as Array<{ id: string; updatedAt?: number | Date | string }>).filter(item => {
      const deletedAt = marks.get(item.id)
      if (deletedAt === undefined) return true
      const updatedAt = item.updatedAt
        ? (item.updatedAt instanceof Date ? item.updatedAt.getTime() : Number(item.updatedAt))
        : 0
      return updatedAt > deletedAt
    })
  }
  return out
}

const browserStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null =
  typeof window !== 'undefined' ? window.localStorage : null

/** 浏览器端单例（SSR 安全） */
export const tombstoneStore = browserStorage
  ? createTombstoneStore(browserStorage as Storage)
  : createTombstoneStore({
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    })
