import type { RepeatTaskCompletion } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createRepeatCompletionSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  repeatCompletions: [] as RepeatTaskCompletion[],
  addRepeatCompletion: (completion: Omit<RepeatTaskCompletion, 'id'>) =>
    set((state) => ({
      repeatCompletions: [...state.repeatCompletions, { ...completion, id: generateId() }],
    })),
  deleteRepeatCompletion: (id: string) =>
    set((state) => ({
      repeatCompletions: state.repeatCompletions.filter((c) => c.id !== id),
    })),
  getRepeatCompletionsForTask: (taskId: string) => {
    const state = get()
    return state.repeatCompletions.filter((c) => c.taskId === taskId)
  },
  getRepeatCompletionsForDate: (date: Date) => {
    const state = get()
    const dateStr = date.toDateString()
    return state.repeatCompletions.filter((c) => new Date(c.completedAt).toDateString() === dateStr)
  },
})
