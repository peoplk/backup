import type { DailyJournal } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createJournalSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  journals: [] as DailyJournal[],
  addJournal: (journal: Omit<DailyJournal, 'id' | 'createdAt' | 'updatedAt'>) =>
    set((state) => {
      const dateStr = new Date(journal.date).toDateString()
      const existing = state.journals.find(j => new Date(j.date).toDateString() === dateStr)
      if (existing) {
        return {
          journals: state.journals.map(j =>
            j.id === existing.id
              ? { ...j, ...journal, updatedAt: new Date() }
              : j
          ),
        }
      }
      return {
        journals: [
          ...state.journals,
          { ...journal, id: generateId(), createdAt: new Date(), updatedAt: new Date() },
        ],
      }
    }),
  updateJournal: (id: string, updates: Partial<DailyJournal>) =>
    set((state) => ({
      journals: state.journals.map((j) =>
        j.id === id ? { ...j, ...updates, updatedAt: new Date() } : j
      ),
    })),
  deleteJournal: (id: string) =>
    set((state) => ({
      journals: state.journals.filter((j) => j.id !== id),
    })),
  getJournalForDate: (date: Date) => {
    const state = get()
    const dateStr = date.toDateString()
    return state.journals.find(j => new Date(j.date).toDateString() === dateStr)
  },
})
