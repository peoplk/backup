import type { AppState, AppStoreApi } from '../types'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createUISlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  activeView: 'dashboard' as AppState['activeView'],
  setActiveView: (view: AppState['activeView']) => set({ activeView: view }),
  
  activeSmartList: null as string | null,
  setActiveSmartList: (listId: string | null) => set({ activeSmartList: listId }),
  
  isFullscreen: false,
  setIsFullscreen: (isFullscreen: boolean) => set({ isFullscreen }),
})
