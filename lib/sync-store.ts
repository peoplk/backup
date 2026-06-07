import { create } from 'zustand'
import {
  ensureAuth,
  syncToCloud,
  syncFromCloud,
  subscribeToCloud,
  mergeLocalAndCloud,
  setOfflineMode,
  signInWithGoogle,
  signOutAuth,
  getCurrentUser,
  isGoogleUser,
  getIsFirebaseConfigured,
  saveFirebaseConfig,
  reinitializeFirebase,
  type FirebaseConfigInput,
  type SyncState,
  setSyncStatusCallback,
} from './firebase'

export interface SyncStoreState extends SyncState {
  enableSync: () => Promise<void>
  disableSync: () => void
  forceSync: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => void
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  saveConfig: (config: FirebaseConfigInput) => Promise<boolean>
  authProvider: 'anonymous' | 'google' | null
  userEmail: string | null
  userName: string | null
  /** 同步提供方：firebase 或 supabase */
  syncProvider: 'firebase' | 'supabase' | null
  setSyncProvider: (provider: 'firebase' | 'supabase' | null) => void
}

let unsubscribeSnapshot: (() => void) | null = null
let currentUserId: string | null = null
let syncDataCallback: ((data: Record<string, unknown>) => void) | null = null
let syncDataProvider: (() => Record<string, unknown>) | null = null

export function setSyncDataCallback(callback: (data: Record<string, unknown>) => void) {
  syncDataCallback = callback
}

export function setSyncDataProvider(provider: () => Record<string, unknown>) {
  syncDataProvider = provider
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  userId: null,
  isEnabled: false,
  authProvider: null,
  userEmail: null,
  userName: null,
  syncProvider: null,
  setSyncProvider: (provider) => {
    // 切换提供方时关闭旧同步
    if (get().isEnabled) {
      get().disableSync()
    }
    set({ syncProvider: provider })
  },

  enableSync: async () => {
    if (get().isEnabled) return
    if (!getIsFirebaseConfigured()) {
      set({ status: 'error', error: 'Firebase 未配置，请在下方填写配置信息', isEnabled: false })
      return
    }
    set({ isEnabled: true, status: 'syncing' })

    try {
      const userId = await ensureAuth()
      if (!userId) {
        set({ status: 'error', error: '认证失败', isEnabled: false })
        return
      }
      currentUserId = userId
      const user = getCurrentUser()
      set({
        userId,
        status: 'syncing',
        authProvider: isGoogleUser() ? 'google' : 'anonymous',
        userEmail: user?.email ?? null,
        userName: user?.displayName ?? null,
      })

      unsubscribeSnapshot = subscribeToCloud(userId, (data) => {
        syncDataCallback?.(data)
        set({ status: 'synced', lastSyncAt: new Date(), error: null })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '启用同步失败'
      set({ status: 'error', error: message, isEnabled: false })
    }
  },

  disableSync: () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }
    currentUserId = null
    set({ isEnabled: false, status: 'idle', userId: null, lastSyncAt: null, authProvider: null, userEmail: null, userName: null })
  },

  forceSync: async () => {
    const userId = currentUserId || get().userId
    if (!userId || !get().isEnabled) return
    set({ status: 'syncing' })
    try {
      const localData = syncDataProvider?.() ?? (window as any).__SYNC_DATA__ as Record<string, unknown>
      if (localData) {
        await syncToCloud(userId, localData)
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

  loginWithGoogle: async () => {
    if (!getIsFirebaseConfigured()) {
      set({ status: 'error', error: 'Firebase 未配置，请在下方填写配置信息' })
      return
    }
    set({ status: 'syncing' })
    try {
      const user = await signInWithGoogle()
      if (!user) {
        set({ status: 'error', error: 'Google 登录失败' })
        return
      }
      currentUserId = user.uid
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot()
        unsubscribeSnapshot = null
      }
      set({
        userId: user.uid,
        isEnabled: true,
        status: 'syncing',
        authProvider: 'google',
        userEmail: user.email ?? null,
        userName: user.displayName ?? null,
      })
      unsubscribeSnapshot = subscribeToCloud(user.uid, (data) => {
        syncDataCallback?.(data)
        set({ status: 'synced', lastSyncAt: new Date(), error: null })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google 登录失败'
      set({ status: 'error', error: message })
    }
  },

  logout: async () => {
    try {
      await signOutAuth()
    } catch {}
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }
    currentUserId = null
    set({ isEnabled: false, status: 'idle', userId: null, lastSyncAt: null, authProvider: null, userEmail: null, userName: null })
  },

  saveConfig: async (config) => {
    const success = saveFirebaseConfig(config)
    if (success) {
      set({ status: 'idle', error: null })
    }
    return success
  },
}))

setSyncStatusCallback((status) => {
  useSyncStore.setState(status)
})

export async function pushDataToCloud(data: Record<string, unknown>) {
  const userId = currentUserId || useSyncStore.getState().userId
  if (!userId || !useSyncStore.getState().isEnabled) return
  try {
    await syncToCloud(userId, data)
  } catch {
    // 静默失败，避免阻塞用户操作
  }
}

export async function pullDataFromCloud(): Promise<Record<string, unknown> | null> {
  const userId = currentUserId || useSyncStore.getState().userId
  if (!userId || !useSyncStore.getState().isEnabled) return null
  try {
    return await syncFromCloud(userId)
  } catch {
    return null
  }
}

export async function resolveConflict(localData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const userId = currentUserId || useSyncStore.getState().userId
  if (!userId || !useSyncStore.getState().isEnabled) return localData
  try {
    return await mergeLocalAndCloud(userId, localData)
  } catch {
    return localData
  }
}
