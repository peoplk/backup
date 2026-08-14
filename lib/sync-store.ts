import { createSyncStore } from './sync-store-factory'
import {
  ensureAuth,
  syncToCloud,
  syncFromCloud,
  subscribeToCloud,
  mergeLocalAndCloud,
  signInWithGoogle,
  signOutAuth,
  getCurrentUser,
  isGoogleUser,
  getIsFirebaseConfigured,
  saveFirebaseConfig,
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
  syncProvider: 'firebase' | 'supabase' | null
  setSyncProvider: (provider: 'firebase' | 'supabase' | null) => void
  setConflicts: (conflicts: import('@/lib/types').SyncConflict[]) => void
  clearConflicts: () => void
  detectConflicts: (localData: Record<string, unknown>, remoteData: Record<string, unknown>) => import('@/lib/types').SyncConflict[]
  resolveConflictItem: (conflictId: string) => void
}

const {
  useStore: _useSyncStore,
  setCallback: setSyncDataCallback,
  setProvider: setSyncDataProvider,
  pushData: pushDataToCloud,
  pullData: pullDataFromCloud,
  resolveConflict,
} = createSyncStore(
  {
    name: '',
    isConfigured: getIsFirebaseConfigured,
    notConfiguredErrorMessage: 'Firebase 未配置，请在下方填写配置信息',
    ensureAuth,
    syncToRemote: syncToCloud,
    syncFromRemote: syncFromCloud,
    subscribeToRemote: subscribeToCloud,
    signOutRemote: signOutAuth,
    mergeLocalAndRemote: mergeLocalAndCloud,
    getEnableSyncExtraState: () => {
      const user = getCurrentUser()
      return {
        authProvider: isGoogleUser() ? 'google' : 'anonymous',
        userEmail: user?.email ?? null,
        userName: user?.displayName ?? null,
      }
    },
    getResetState: () => ({
      authProvider: null,
      userName: null,
    }),
    setRemoteSyncStatusCallback: setSyncStatusCallback,
  },
  (set, get, helpers, cfg) => ({
    authProvider: null as 'anonymous' | 'google' | null,
    userName: null as string | null,
    syncProvider: null as 'firebase' | 'supabase' | null,

    setSyncProvider: (provider: 'firebase' | 'supabase' | null) => {
      // 切换提供方时关闭旧同步
      if (get().isEnabled) {
        get().disableSync()
      }
      set({ syncProvider: provider })
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
        helpers.setCurrentUserId(user.uid)
        if (helpers.getUnsubscribe()) {
          helpers.getUnsubscribe()!()
          helpers.setUnsubscribe(null)
        }
        set({
          userId: user.uid,
          isEnabled: true,
          status: 'syncing',
          authProvider: 'google',
          userEmail: user.email ?? null,
          userName: user.displayName ?? null,
        })
        helpers.setUnsubscribe(cfg.subscribeToRemote(user.uid, (data) => {
          helpers.getSyncDataCallback()?.(data)
          set({ status: 'synced', lastSyncAt: new Date(), error: null })
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Google 登录失败'
        set({ status: 'error', error: message })
      }
    },

    saveConfig: async (config: FirebaseConfigInput) => {
      const success = saveFirebaseConfig(config)
      if (success) {
        set({ status: 'idle', error: null })
      }
      return success
    },
  }),
)

export const useSyncStore = _useSyncStore as unknown as {
  (): SyncStoreState
  getState: () => SyncStoreState
  setState: (partial: Partial<SyncStoreState> | ((state: SyncStoreState) => Partial<SyncStoreState>)) => void
  subscribe: (listener: (state: SyncStoreState, prevState: SyncStoreState) => void) => () => void
}

export { setSyncDataCallback, setSyncDataProvider, pushDataToCloud, pullDataFromCloud, resolveConflict }
