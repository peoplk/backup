import type { SavedFilter, FilterCriteria } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createDashboardSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  dashboardWidgets: ['greeting', 'focus-goal', 'today-tasks', 'quick-add', 'streak', 'weekly-chart'],
  updateDashboardWidgets: (widgets: string[]) => set({ dashboardWidgets: widgets }),

  darkModeSchedule: { enabled: false, lightStart: '07:00', darkStart: '19:00' },
  updateDarkModeSchedule: (updates: Partial<AppState['darkModeSchedule']>) =>
    set((state) => ({
      darkModeSchedule: { ...state.darkModeSchedule, ...updates },
    })),

  workingHours: { enabled: false, workStartTime: '09:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
  updateWorkingHours: (updates: Partial<AppState['workingHours']>) =>
    set((state) => ({
      workingHours: { ...state.workingHours, ...updates },
    })),

  focusSoundSettings: {
    isPlaying: false,
    volume: 50,
    soundLevels: {},
    currentMusic: null,
    autoPlay: false,
    sleepTimerEndsAt: null,
  },
  updateFocusSoundSettings: (updates: Partial<AppState['focusSoundSettings']>) =>
    set((state) => ({
      focusSoundSettings: { ...state.focusSoundSettings, ...updates },
    })),

  dailyReviewSettings: {
    enabled: true,
    reviewTime: '21:00',
    lastReviewDate: null,
    showNotification: true,
  },
  updateDailyReviewSettings: (updates: Partial<AppState['dailyReviewSettings']>) =>
    set((state) => ({
      dailyReviewSettings: { ...state.dailyReviewSettings, ...updates },
    })),
  markDailyReviewShown: (dateKey: string) =>
    set((state) => ({
      dailyReviewSettings: {
        ...state.dailyReviewSettings,
        lastReviewDate: dateKey,
      },
    })),

  savedFilters: [] as SavedFilter[],
  addSavedFilter: (name: string, criteria: FilterCriteria) =>
    set((state) => {
      const trimmed = name.trim() || '未命名筛选'
      const newFilter: SavedFilter = {
        id: generateId(),
        name: trimmed,
        criteria: { ...criteria },
        createdAt: new Date(),
      }
      return {
        savedFilters: [...state.savedFilters, newFilter],
        activeSavedFilterId: newFilter.id,
      }
    }),
  renameSavedFilter: (id: string, name: string) =>
    set((state) => ({
      savedFilters: state.savedFilters.map((f) =>
        f.id === id ? { ...f, name: name.trim() || f.name } : f
      ),
    })),
  deleteSavedFilter: (id: string) =>
    set((state) => ({
      savedFilters: state.savedFilters.filter((f) => f.id !== id),
      activeSavedFilterId: state.activeSavedFilterId === id ? null : state.activeSavedFilterId,
    })),
  reorderSavedFilters: (orderedIds: string[]) =>
    set((state) => {
      const map = new Map(state.savedFilters.map((f) => [f.id, f]))
      const reordered = orderedIds
        .map((id) => map.get(id))
        .filter((f): f is SavedFilter => f !== undefined)
      const remaining = state.savedFilters.filter((f) => !orderedIds.includes(f.id))
      return { savedFilters: [...reordered, ...remaining] }
    }),

  activeSavedFilterId: null as string | null,
  setActiveSavedFilterId: (id: string | null) => set({ activeSavedFilterId: id }),
})
