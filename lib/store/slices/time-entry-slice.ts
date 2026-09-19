import type { TimeEntry } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultTimeEntries } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createTimeEntrySlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  timeEntries: defaultTimeEntries,
  activeTimeEntry: null as TimeEntry | null,
  startTimeEntry: (entry: Omit<TimeEntry, 'id' | 'startTime' | 'duration'>) => {
    const id = generateId()
    set({
      activeTimeEntry: {
        ...entry,
        id,
        startTime: new Date(),
        duration: 0,
      },
    })
    return id
  },
  stopTimeEntry: () => {
    const state = get()
    if (state.activeTimeEntry) {
      const endTime = new Date()
      const duration = Math.floor(
        (endTime.getTime() - state.activeTimeEntry.startTime.getTime()) / 1000
      )
      set({
        timeEntries: [
          ...state.timeEntries,
          { ...state.activeTimeEntry, endTime, duration },
        ],
        activeTimeEntry: null,
      })
    }
  },
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => {
    const id = generateId()
    set((state) => ({
      timeEntries: [...state.timeEntries, { ...entry, id }],
    }))
    return id
  },
  updateTimeEntry: (id: string, patch: Partial<Omit<TimeEntry, 'id'>>) => {
    set((state) => ({
      timeEntries: state.timeEntries.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    }))
  },
  deleteTimeEntry: (id: string) => {
    set((state) => ({
      timeEntries: state.timeEntries.filter((e) => e.id !== id),
    }))
  },
})
