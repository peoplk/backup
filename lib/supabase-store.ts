import { createSyncStore } from './sync-store-factory'
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

const {
  useStore: _useSupabaseSyncStore,
  setCallback: setSupabaseDataCallback,
  setProvider: setSupabaseDataProvider,
  pushData: pushDataToSupabase,
  pullData: pullDataFromSupabase,
  resolveConflict: resolveSupabaseConflict,
} = createSyncStore(
  {
    name: 'Supabase',
    isConfigured: getIsSupabaseConfigured,
    notConfiguredErrorMessage: 'Supabase 未配置，请在下方填写 URL 与 anon key',
    ensureAuth: ensureSupabaseAuth,
    syncToRemote: syncToSupabase,
    syncFromRemote: syncFromSupabase,
    subscribeToRemote: subscribeToSupabase,
    signOutRemote: signOutSupabase,
    mergeLocalAndRemote: mergeLocalAndSupabase,
    getEnableSyncInitialExtraState: () => ({ provider: 'supabase' as const }),
    getEnableSyncExtraState: () => ({}),
    getResetState: () => ({
      provider: null,
    }),
    setRemoteSyncStatusCallback: setSupabaseSyncStatusCallback,
  },
  (set, get, helpers, cfg) => ({
    provider: null as 'supabase' | null,

    loginWithEmail: async (email: string, password: string) => {
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
        helpers.setCurrentUserId(userId)
        if (helpers.getUnsubscribe()) {
          helpers.getUnsubscribe()!()
          helpers.setUnsubscribe(null)
        }
        set({
          userId,
          isEnabled: true,
          status: 'syncing',
          provider: 'supabase' as const,
          userEmail: email,
        })
        helpers.setUnsubscribe(cfg.subscribeToRemote(userId, (data) => {
          helpers.getSyncDataCallback()?.(data)
          set({ status: 'synced', lastSyncAt: new Date(), error: null })
        }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : '登录失败'
        set({ status: 'error', error: message })
        return false
      }
    },

    signUpWithEmail: async (email: string, password: string) => {
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
        helpers.setCurrentUserId(userId)
        if (helpers.getUnsubscribe()) {
          helpers.getUnsubscribe()!()
          helpers.setUnsubscribe(null)
        }
        set({
          userId,
          isEnabled: true,
          status: 'syncing',
          provider: 'supabase' as const,
          userEmail: email,
        })
        helpers.setUnsubscribe(cfg.subscribeToRemote(userId, (data) => {
          helpers.getSyncDataCallback()?.(data)
          set({ status: 'synced', lastSyncAt: new Date(), error: null })
        }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : '注册失败'
        set({ status: 'error', error: message })
        return false
      }
    },

    saveConfig: (config: SupabaseConfigInput) => {
      const success = saveSupabaseConfig(config)
      if (success) {
        reinitializeSupabase()
        set({ status: 'idle', error: null })
      }
      return success
    },
  }),
)

export const useSupabaseSyncStore = _useSupabaseSyncStore as unknown as {
  (): SupabaseSyncState
  getState: () => SupabaseSyncState
  setState: (partial: Partial<SupabaseSyncState> | ((state: SupabaseSyncState) => Partial<SupabaseSyncState>)) => void
  subscribe: (listener: (state: SupabaseSyncState, prevState: SupabaseSyncState) => void) => () => void
}

export { setSupabaseDataCallback, setSupabaseDataProvider, pushDataToSupabase, pullDataFromSupabase, resolveSupabaseConflict }
