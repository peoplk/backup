import { create } from 'zustand'
import {
  ensureSupabaseAuth,
  syncToSupabase,
  syncFromSupabase,
  subscribeToSupabase,
  mergeLocalAndSupabase,
  signInWithSupabaseEmail,
  signUpWithSupabaseEmail,
  signOutSupabase,
  getIsSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  reinitializeSupabase,
  setSupabaseSyncStatusCallback,
  type SupabaseConfigInput,
  type SyncState,
} from './supabase'

export interface SupabaseSyncState extends SyncState {
  enableSync: () => Promise<void>
  disableSync: () => void
  forceSync: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => void
  loginWithEmail: (email: string, password: string) => Promise<boolean>
  signUpWithEmail: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  saveConfig: (config: SupabaseConfigInput) => boolean
  userEmail: string | null
}

let unsubscribeChannel: (() => void) | null = null
let currentUserId: string | null = null
let syncDataCallback: ((data: Record<string, unknown>) => void) | null = null
let syncDataProvider: (() => Record<string, unknown>) | null = null

export function setSupabaseDataCallback(callback: (data: Record<string, unknown>) => void) {
  syncDataCallback = callback
}

export function setSupabaseDataProvider(provider: () => Record<string, unknown>) {
  syncDataProvider = provider
}

export const useSupabaseSyncStore = create<SupabaseSyncState>((set, get) => ({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  userId: null,
  isEnabled: false,
  provider: null,
  userEmail: null,

  enableSync: async () => {
    if (get().isEnabled) return
    if (!getIsSupabaseConfigured()) {
      set({ status: 'error', error: 'Supabase 未配置，请在下方填写 URL 与 anon key', isEnabled: false })
      return
    }
    set({ isEnabled: true, status: 'syncing', provider: 'supabase' })

    try {
      const userId = await ensureSupabaseAuth()
      if (!userId) {
        set({ status: 'error', error: '认证失败', isEnabled: false })
        return
      }
      currentUserId = userId
      set({ userId, status: 'syncing' })

      unsubscribeChannel = subscribeToSupabase(userId, (data) => {
        syncDataCallback?.(data)
        set({ status: 'synced', lastSyncAt: new Date(), error: null })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '启用 Supabase 同步失败'
      set({ status: 'error', error: message, isEnabled: false })
    }
  },

  disableSync: () => {
    if (unsubscribeChannel) {
      unsubscribeChannel()
      unsubscribeChannel = null
    }
    currentUserId = null
    set({
      isEnabled: false,
      status: 'idle',
      userId: null,
      lastSyncAt: null,
      provider: null,
      userEmail: null,
    })
  },

  forceSync: async () => {
    const userId = currentUserId || get().userId
    if (!userId || !get().isEnabled) return
    set({ status: 'syncing' })
    try {
      const localData = syncDataProvider?.() ?? (window as any).__SYNC_DATA__ as Record<string, unknown>
      if (localData) {
        await syncToSupabase(userId, localData)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '强制同步失败'
      set({ status: 'error', error: message })
    }
  },

  setSyncEnabled: (enabled) => {
    if (enabled) {
      get().enableSync()
    } else {
      get().disableSync()
    }
  },

  loginWithEmail: async (email, password) => {
    if (!getIsSupabaseConfigured()) {
      set({ status: 'error', error: 'Supabase 未配置' })
      return false
    }
    set({ status: 'syncing' })
    try {
      const userId = await signInWithSupabaseEmail(email, password)
      if (!userId) {
        set({ status: 'error', error: '登录失败' })
        return false
      }
      currentUserId = userId
      if (unsubscribeChannel) {
        unsubscribeChannel()
        unsubscribeChannel = null
      }
      set({
        userId,
        isEnabled: true,
        status: 'syncing',
        provider: 'supabase',
        userEmail: email,
      })
      unsubscribeChannel = subscribeToSupabase(userId, (data) => {
        syncDataCallback?.(data)
        set({ status: 'synced', lastSyncAt: new Date(), error: null })
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'
      set({ status: 'error', error: message })
      return false
    }
  },

  signUpWithEmail: async (email, password) => {
    if (!getIsSupabaseConfigured()) {
      set({ status: 'error', error: 'Supabase 未配置' })
      return false
    }
    set({ status: 'syncing' })
    try {
      const userId = await signUpWithSupabaseEmail(email, password)
      if (!userId) {
        set({ status: 'error', error: '注册失败' })
        return false
      }
      currentUserId = userId
      if (unsubscribeChannel) {
        unsubscribeChannel()
        unsubscribeChannel = null
      }
      set({
        userId,
        isEnabled: true,
        status: 'syncing',
        provider: 'supabase',
        userEmail: email,
      })
      unsubscribeChannel = subscribeToSupabase(userId, (data) => {
        syncDataCallback?.(data)
        set({ status: 'synced', lastSyncAt: new Date(), error: null })
      })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败'
      set({ status: 'error', error: message })
      return false
    }
  },

  logout: async () => {
    try {
      await signOutSupabase()
    } catch {
      /* ignore */
    }
    if (unsubscribeChannel) {
      unsubscribeChannel()
      unsubscribeChannel = null
    }
    currentUserId = null
    set({
      isEnabled: false,
      status: 'idle',
      userId: null,
      lastSyncAt: null,
      provider: null,
      userEmail: null,
    })
  },

  saveConfig: (config) => {
    const success = saveSupabaseConfig(config)
    if (success) {
      reinitializeSupabase()
      set({ status: 'idle', error: null })
    }
    return success
  },
}))

setSupabaseSyncStatusCallback((status) => {
  useSupabaseSyncStore.setState(status)
})

export async function pushDataToSupabase(data: Record<string, unknown>) {
  const userId = currentUserId || useSupabaseSyncStore.getState().userId
  if (!userId || !useSupabaseSyncStore.getState().isEnabled) return
  try {
    await syncToSupabase(userId, data)
  } catch {
    // 静默失败，避免阻塞用户操作
  }
}

export async function pullDataFromSupabase(): Promise<Record<string, unknown> | null> {
  const userId = currentUserId || useSupabaseSyncStore.getState().userId
  if (!userId || !useSupabaseSyncStore.getState().isEnabled) return null
  try {
    return await syncFromSupabase(userId)
  } catch {
    return null
  }
}

export async function resolveSupabaseConflict(
  localData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const userId = currentUserId || useSupabaseSyncStore.getState().userId
  if (!userId || !useSupabaseSyncStore.getState().isEnabled) return localData
  try {
    return await mergeLocalAndSupabase(userId, localData)
  } catch {
    return localData
  }
}
