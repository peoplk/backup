import { createSyncStore } from './sync-store-factory'
import {
  ensureWebDAVAuth,
  syncToWebDAV,
  syncFromWebDAV,
  subscribeToWebDAV,
  signOutWebDAV,
  mergeLocalAndWebDAV,
  getIsWebDAVConfigured,
  saveWebDAVConfig,
  getWebDAVConfig,
  reinitializeWebDAV,
  testWebDAVConnection,
  setWebDAVSyncStatusCallback,
  getCurrentWebDAVUser,
  type WebDAVConfigInput,
  type SyncState,
} from './webdav'

export interface WebDAVSyncState extends SyncState {
  enableSync: () => Promise<void>
  disableSync: () => void
  forceSync: () => Promise<void>
  setSyncEnabled: (enabled: boolean) => void
  logout: () => Promise<void>
  saveConfig: (config: WebDAVConfigInput) => Promise<boolean>
  testConnection: (config: WebDAVConfigInput) => Promise<{ success: boolean; message: string }>
  provider: 'webdav' | null
  username: string | null
}

const {
  useStore: _useWebDAVSyncStore,
  setCallback: setWebDAVDataCallback,
  setProvider: setWebDAVDataProvider,
  pushData: pushDataToWebDAV,
  pullData: pullDataFromWebDAV,
  resolveConflict: resolveWebDAVConflict,
} = createSyncStore(
  {
    name: 'WebDAV',
    isConfigured: getIsWebDAVConfigured,
    notConfiguredErrorMessage: 'WebDAV 未配置，请在下方填写服务器地址与账号',
    ensureAuth: ensureWebDAVAuth,
    syncToRemote: syncToWebDAV,
    syncFromRemote: syncFromWebDAV,
    subscribeToRemote: subscribeToWebDAV,
    signOutRemote: signOutWebDAV,
    mergeLocalAndRemote: mergeLocalAndWebDAV,
    getEnableSyncInitialExtraState: () => ({ provider: 'webdav' as const }),
    getEnableSyncExtraState: () => {
      const cfg = getWebDAVConfig()
      return {
        provider: 'webdav' as const,
        username: cfg?.username ?? getCurrentWebDAVUser() ?? null,
      }
    },
    getResetState: () => ({
      provider: null,
      username: null,
    }),
    setRemoteSyncStatusCallback: setWebDAVSyncStatusCallback,
  },
  (set, get, helpers, cfg) => ({
    provider: null as 'webdav' | null,
    username: null as string | null,

    saveConfig: async (config: WebDAVConfigInput) => {
      const success = saveWebDAVConfig(config)
      if (success) {
        reinitializeWebDAV()
        set({ status: 'idle', error: null })
      }
      return success
    },

    testConnection: async (config: WebDAVConfigInput) => {
      return testWebDAVConnection(config)
    },
  }),
)

export const useWebDAVSyncStore = _useWebDAVSyncStore as unknown as {
  (): WebDAVSyncState
  getState: () => WebDAVSyncState
  setState: (partial: Partial<WebDAVSyncState> | ((state: WebDAVSyncState) => Partial<WebDAVSyncState>)) => void
  subscribe: (listener: (state: WebDAVSyncState, prevState: WebDAVSyncState) => void) => () => void
}

export { setWebDAVDataCallback, setWebDAVDataProvider, pushDataToWebDAV, pullDataFromWebDAV, resolveWebDAVConflict }
