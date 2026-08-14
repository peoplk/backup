import type { TimeBlock } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createTimeBlockSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  timeBlocks: [] as TimeBlock[],
  addTimeBlock: (block: Omit<TimeBlock, 'id' | 'createdAt'>) =>
    set((state) => ({
      timeBlocks: [
        ...state.timeBlocks,
        { ...block, id: generateId(), createdAt: new Date() },
      ],
    })),
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) =>
    set((state) => ({
      timeBlocks: state.timeBlocks.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    })),
  deleteTimeBlock: (id: string) =>
    set((state) => ({
      timeBlocks: state.timeBlocks.filter((b) => b.id !== id),
    })),
  getTimeBlocksForDate: (date: Date) => {
    const state = get()
    const dateStr = date.toDateString()
    return state.timeBlocks.filter(b => new Date(b.date).toDateString() === dateStr)
  },
})
