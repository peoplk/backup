import { createSyncStore } from './sync-store-factory'
import {
  ensureS3Auth,
  syncToS3,
  syncFromS3,
  subscribeToS3,
  signOutS3,
  mergeLocalAndS3,
  getIsS3Configured,
  saveS3Config,
  getS3Config,
  reinitializeS3,
  testS3Connection,
  setS3SyncStatusCallback,
  getCurrentS3User,
  type S3ConfigInput,
  type SyncState,
} from './s3-sync'

export interface S3SyncState extends SyncState {
  enableSync: () => Promise<void>
  disableSync: () => void
  forceSync: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => void
  logout: () => Promise<void>
  saveConfig: (config: S3ConfigInput) => Promise<boolean>
  testConnection: (config: S3ConfigInput) => Promise<{ success: boolean; message: string }>
  provider: 's3' | null
  accessKeyId: string | null
  setConflicts: (conflicts: import('@/lib/types').SyncConflict[]) => void
  clearConflicts: () => void
  detectConflicts: (localData: Record<string, unknown>, remoteData: Record<string, unknown>) => import('@/lib/types').SyncConflict[]
  resolveConflictItem: (conflictId: string) => void
}

const {
  useStore: _useS3SyncStore,
  setCallback: setS3DataCallback,
  setProvider: setS3DataProvider,
  pushData: pushDataToS3,
  pullData: pullDataFromS3,
  resolveConflict: resolveS3Conflict,
} = createSyncStore(
  {
    name: 'S3',
    isConfigured: getIsS3Configured,
    notConfiguredErrorMessage: 'S3 未配置，请在下方填写 Endpoint、Bucket 与 AccessKey',
    ensureAuth: ensureS3Auth,
    syncToRemote: syncToS3,
    syncFromRemote: syncFromS3,
    subscribeToRemote: subscribeToS3,
    signOutRemote: signOutS3,
    mergeLocalAndRemote: mergeLocalAndS3,
    getEnableSyncInitialExtraState: () => ({ provider: 's3' as const }),
    getEnableSyncExtraState: () => {
      const cfg = getS3Config()
      return {
        provider: 's3' as const,
        accessKeyId: cfg?.accessKeyId ?? getCurrentS3User() ?? null,
      }
    },
    getResetState: () => ({
      provider: null,
      accessKeyId: null,
    }),
    setRemoteSyncStatusCallback: setS3SyncStatusCallback,
  },
  (set, _get, _helpers, _cfg) => ({
    provider: null as 's3' | null,
    accessKeyId: null as string | null,

    saveConfig: async (config: S3ConfigInput) => {
      const success = saveS3Config(config)
      if (success) {
        reinitializeS3()
        set({ status: 'idle', error: null })
      }
      return success
    },

    testConnection: async (config: S3ConfigInput) => {
      return testS3Connection(config)
    },
  }),
)

export const useS3SyncStore = _useS3SyncStore as unknown as {
  (): S3SyncState
  getState: () => S3SyncState
  setState: (partial: Partial<S3SyncState> | ((state: S3SyncState) => Partial<S3SyncState>)) => void
  subscribe: (listener: (state: S3SyncState, prevState: S3SyncState) => void) => () => void
}

export { setS3DataCallback, setS3DataProvider, pushDataToS3, pullDataFromS3, resolveS3Conflict }
