import { create } from 'zustand'
import type { SyncConflict } from '@/lib/types'

export type RemoteSyncStatus = {
  status?: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  lastSyncAt?: Date | null
  error?: string | null
  conflicts?: SyncConflict[]
  userId?: string | null
  isEnabled?: boolean
  userEmail?: string | null
}

export interface SyncStoreBaseState {
  status: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncAt: Date | null
  error: string | null
  conflicts: SyncConflict[]
  userId: string | null
  isEnabled: boolean
  userEmail: string | null
  enableSync: () => Promise<void>
  disableSync: () => void
  forceSync: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => void
  logout: () => Promise<void>
  setConflicts: (conflicts: SyncConflict[]) => void
  clearConflicts: () => void
  detectConflicts: (localData: Record<string, unknown>, remoteData: Record<string, unknown>) => SyncConflict[]
  resolveConflictItem: (conflictId: string) => void
}

/**
 * Strategy configuration for creating a sync store.
 * Each sync provider (Firebase, Supabase, etc.) provides its own implementation.
 */
export interface SyncStoreConfig {
  name: string
  isConfigured: () => boolean
  notConfiguredErrorMessage: string
  ensureAuth: () => Promise<string | null>
  syncToRemote: (userId: string, data: Record<string, unknown>) => Promise<void>
  syncFromRemote: (userId: string) => Promise<Record<string, unknown> | null>
  subscribeToRemote: (userId: string, callback: (data: Record<string, unknown>) => void) => () => void
  signOutRemote: () => Promise<void>
  mergeLocalAndRemote: (userId: string, localData: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Extra state to merge during enableSync after auth succeeds */
  getEnableSyncExtraState: (userId: string) => Record<string, unknown>
  /** Extra state to merge during the initial enableSync set (before auth) */
  getEnableSyncInitialExtraState?: () => Record<string, unknown>
  /** Extra state to reset on disableSync / logout (besides the common fields) */
  getResetState: () => Record<string, unknown>
  /** Register a callback that the remote layer calls on status changes */
  setRemoteSyncStatusCallback: (callback: (status: RemoteSyncStatus) => void) => void
}

/**
 * Helpers exposed to the extend function for accessing module-level mutable state.
 */
export interface SyncStoreHelpers {
  getCurrentUserId: () => string | null
  setCurrentUserId: (id: string | null) => void
  getUnsubscribe: () => (() => void) | null
  setUnsubscribe: (fn: (() => void) | null) => void
  getSyncDataCallback: () => ((data: Record<string, unknown>) => void) | null
}

const SYNC_ARRAY_KEYS = ['tasks', 'habits', 'goals', 'anniversaries', 'projects', 'tags']

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeForCompare)
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    Object.keys(value as Record<string, unknown>)
      .sort()
      .forEach(k => { sorted[k] = normalizeForCompare((value as Record<string, unknown>)[k]) })
    return sorted
  }
  return value
}

function detectDataConflicts(
  localData: Record<string, unknown>,
  remoteData: Record<string, unknown>,
): SyncConflict[] {
  const conflicts: SyncConflict[] = []
  SYNC_ARRAY_KEYS.forEach(key => {
    const localArr = Array.isArray(localData[key]) ? localData[key] as Array<{ id: string; title?: string; name?: string; [k: string]: unknown }> : []
    const remoteArr = Array.isArray(remoteData[key]) ? remoteData[key] as Array<{ id: string; title?: string; name?: string; [k: string]: unknown }> : []
    const remoteById = new Map(remoteArr.map(item => [item.id, item]))
    localArr.forEach(localItem => {
      const remoteItem = remoteById.get(localItem.id)
      if (!remoteItem) return
      if (JSON.stringify(normalizeForCompare(localItem)) !== JSON.stringify(normalizeForCompare(remoteItem))) {
        conflicts.push({
          id: `${key}-${localItem.id}`,
          type: key === 'anniversaries' ? 'anniversary' : key === 'tasks' ? 'task' : key === 'habits' ? 'habit' : key === 'goals' ? 'goal' : key === 'projects' ? 'project' : key === 'tags' ? 'tag' : 'other',
          name: localItem.title || localItem.name || `${key}-${localItem.id}`,
          localData: localItem,
          remoteData: remoteItem,
        })
      }
    })
  })
  return conflicts
}

/**
 * Factory function to create a sync store with common logic.
 *
 * @param config  Strategy configuration for the specific sync provider
 * @param extend  Optional function to add extra state and methods to the store
 * @returns An object containing the store, callback setters, and standalone functions
 */
export function createSyncStore<TExtra extends Record<string, unknown> = {}>(
  config: SyncStoreConfig,
  extend?: (
    set: (partial: any) => void,
    get: () => any,
    helpers: SyncStoreHelpers,
    cfg: SyncStoreConfig,
  ) => TExtra,
) {
  let unsubscribe: (() => void) | null = null
  let currentUserId: string | null = null
  let syncDataCallback: ((data: Record<string, unknown>) => void) | null = null
  let syncDataProvider: (() => Record<string, unknown>) | null = null

  const helpers: SyncStoreHelpers = {
    getCurrentUserId: () => currentUserId,
    setCurrentUserId: (id) => { currentUserId = id },
    getUnsubscribe: () => unsubscribe,
    setUnsubscribe: (fn) => { unsubscribe = fn },
    getSyncDataCallback: () => syncDataCallback,
  }

  const useStore = create<SyncStoreBaseState>((set, get) => ({
    status: 'idle',
    lastSyncAt: null,
    error: null,
    conflicts: [] as SyncConflict[],
    userId: null,
    isEnabled: false,
    userEmail: null,

    enableSync: async () => {
      if (get().isEnabled) return
      if (!config.isConfigured()) {
        set({ status: 'error', error: config.notConfiguredErrorMessage, isEnabled: false })
        return
      }
      set({ isEnabled: true, status: 'syncing', ...config.getEnableSyncInitialExtraState?.() })

      try {
        const userId = await config.ensureAuth()
        if (!userId) {
          set({ status: 'error', error: '认证失败', isEnabled: false })
          return
        }
        currentUserId = userId
        set({ userId, status: 'syncing', ...config.getEnableSyncExtraState(userId) })

        unsubscribe = config.subscribeToRemote(userId, async (data) => {
          let finalData = data
          try {
            const localData = syncDataProvider?.()
            if (localData && Object.keys(localData).length > 0) {
              finalData = await config.mergeLocalAndRemote(userId, localData)
            }
          } catch {
            finalData = data
          }
          syncDataCallback?.(finalData)
          set({ status: 'synced', lastSyncAt: new Date(), error: null })
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : `启用${config.name ? ' ' + config.name + ' ' : ''}同步失败`
        set({ status: 'error', error: message, isEnabled: false })
      }
    },

    disableSync: () => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      currentUserId = null
      set({ isEnabled: false, status: 'idle', userId: null, lastSyncAt: null, userEmail: null, ...config.getResetState() })
    },

    forceSync: async () => {
      const userId = currentUserId || get().userId
      if (!userId || !get().isEnabled) return
      set({ status: 'syncing' })
      try {
        const localData =
          syncDataProvider?.() ??
          (typeof window !== 'undefined' ? (window.__SYNC_DATA__ as Record<string, unknown> | undefined) : undefined)
        if (localData) {
          await config.syncToRemote(userId, localData)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '强制同步失败'
        set({ status: 'error', error: message })
      }
    },

    setSyncEnabled: (enabled: boolean) => {
      if (enabled) {
        get().enableSync()
      } else {
        get().disableSync()
      }
    },

    logout: async () => {
      let signOutError: string | null = null
      try {
        await config.signOutRemote()
      } catch (err) {
        signOutError = err instanceof Error ? err.message : '退出登录失败'
      }
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      currentUserId = null
      set({
        isEnabled: false,
        status: 'idle',
        userId: null,
        lastSyncAt: null,
        userEmail: null,
        conflicts: [],
        error: signOutError,
        ...config.getResetState(),
      })
    },

    setConflicts: (conflicts: SyncConflict[]) => set({ conflicts }),

    clearConflicts: () => set({ conflicts: [] }),

    detectConflicts: (localData: Record<string, unknown>, remoteData: Record<string, unknown>) => {
      const conflicts = detectDataConflicts(localData, remoteData)
      set({ conflicts })
      return conflicts
    },

    resolveConflictItem: (conflictId: string) => {
      set((state) => ({
        conflicts: state.conflicts.filter((c: SyncConflict) => c.id !== conflictId),
      }))
    },

    ...(extend ? extend(set, get, helpers, config) : {}),
  }))

  config.setRemoteSyncStatusCallback((status: RemoteSyncStatus) => {
    useStore.setState(status as Partial<SyncStoreBaseState>)
  })

  function setCallback(cb: (data: Record<string, unknown>) => void) {
    syncDataCallback = cb
  }

  function setProvider(p: () => Record<string, unknown>) {
    syncDataProvider = p
  }

  async function pushData(data: Record<string, unknown>) {
    const userId = currentUserId || useStore.getState().userId
    if (!userId || !useStore.getState().isEnabled) return
    try {
      await config.syncToRemote(userId, data)
    } catch {
      // 静默失败，避免阻塞用户操作
    }
  }

  async function pullData(): Promise<Record<string, unknown> | null> {
    const userId = currentUserId || useStore.getState().userId
    if (!userId || !useStore.getState().isEnabled) return null
    try {
      return await config.syncFromRemote(userId)
    } catch {
      return null
    }
  }

  async function resolveConflict(localData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const userId = currentUserId || useStore.getState().userId
    if (!userId || !useStore.getState().isEnabled) return localData
    try {
      return await config.mergeLocalAndRemote(userId, localData)
    } catch {
      return localData
    }
  }

  return { useStore, setCallback, setProvider, pushData, pullData, resolveConflict }
}
