import type { AppState } from '../types'
import type { Tombstone } from '@/lib/types'
import { tombstoneStore } from '@/lib/sync/tombstones'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

/**
 * 同步元数据切片：删除墓碑随全量快照持久化并同步到云端，
 * 其他设备合并时据此删除对应本地项（防旧数据复活）。
 */
export const createSyncSlice = (set: SetState, _get: () => AppState) => ({
  tombstones: [] as Tombstone[],

  recordTombstones: (entries: Array<{ id: string; collection: string }>) => {
    if (!entries || entries.length === 0) return
    const now = Date.now()
    const next = tombstoneStore.record(entries, now)
    set({ tombstones: next })
  },

  /** 合并远端墓碑（并集、去过期），随后由调用方用 applyTombstonesToData 清理集合 */
  mergeTombstones: (remote: Tombstone[]) => {
    if (!Array.isArray(remote) || remote.length === 0) return
    const next = tombstoneStore.merge(remote, Date.now())
    set({ tombstones: next })
  },
})
