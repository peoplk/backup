import type { FocusShieldConfig, FocusShieldItem, FocusShieldMode, FocusShieldScheduleState, FocusShieldWindow } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'
import { DEFAULT_BLACKLIST_ITEMS, DEFAULT_WHITELIST_ITEMS } from '@/lib/focus-shield-defaults'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createFocusShieldSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  focusShield: {
    mode: 'blacklist' as FocusShieldMode,
    items: DEFAULT_BLACKLIST_ITEMS,
  } as FocusShieldConfig,

  updateFocusShield: (updates: Partial<FocusShieldConfig>) =>
    set((state) => ({
      focusShield: { ...state.focusShield, ...updates },
    })),

  addFocusShieldItem: (item: Omit<FocusShieldItem, 'id'>) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: [
          ...state.focusShield.items,
          { ...item, id: generateId() },
        ],
      },
    })),

  deleteFocusShieldItem: (id: string) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: state.focusShield.items.filter((i) => i.id !== id),
      },
    })),

  toggleFocusShieldItem: (id: string) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: state.focusShield.items.map((i) =>
          i.id === id ? { ...i, enabled: !i.enabled } : i
        ),
      },
    })),

  setFocusShieldMode: (mode: FocusShieldMode) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        mode,
        // 切换模式时保留用户已有条目，仅在列表为空时播种默认项，避免静默丢弃用户数据
        items:
          !mode || state.focusShield.items.length > 0
            ? state.focusShield.items
            : mode === 'blacklist'
            ? DEFAULT_BLACKLIST_ITEMS
            : DEFAULT_WHITELIST_ITEMS,
      },
    })),

  // ─── 定时封锁会话（Freedom 式时间窗调度） ───

  focusShieldSchedule: { enabled: false, windows: [] } as FocusShieldScheduleState,

  updateFocusShieldSchedule: (updates: Partial<FocusShieldScheduleState>) =>
    set((state) => ({
      focusShieldSchedule: { ...state.focusShieldSchedule, ...updates },
    })),

  upsertShieldWindow: (win: Omit<FocusShieldWindow, 'id'> & { id?: string }) =>
    set((state) => {
      if (win.id && state.focusShieldSchedule.windows.some((w) => w.id === win.id)) {
        return {
          focusShieldSchedule: {
            ...state.focusShieldSchedule,
            windows: state.focusShieldSchedule.windows.map((w) =>
              w.id === win.id ? ({ ...w, ...win } as FocusShieldWindow) : w
            ),
          },
        }
      }
      const next = { ...win, id: win.id || generateId() } as FocusShieldWindow
      return {
        focusShieldSchedule: {
          ...state.focusShieldSchedule,
          windows: [...state.focusShieldSchedule.windows, next],
        },
      }
    }),

  removeShieldWindow: (id: string) =>
    set((state) => ({
      focusShieldSchedule: {
        ...state.focusShieldSchedule,
        windows: state.focusShieldSchedule.windows.filter((w) => w.id !== id),
      },
    })),
})
