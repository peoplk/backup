import type { Reminder } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createReminderSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  reminders: [] as Reminder[],
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt'>) =>
    set((state) => ({
      reminders: [
        ...state.reminders,
        { ...reminder, id: generateId(), createdAt: new Date() },
      ],
    })),
  updateReminder: (id: string, updates: Partial<Reminder>) =>
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
  deleteReminder: (id: string) =>
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    })),
})
