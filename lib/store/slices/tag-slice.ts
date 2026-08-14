import type { Tag } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createTagSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  tags: [] as Tag[],
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'usageCount'>) =>
    set((state) => ({
      tags: [
        ...state.tags,
        { ...tag, id: generateId(), createdAt: new Date(), usageCount: 0 },
      ],
    })),
  updateTag: (id: string, updates: Partial<Tag>) =>
    set((state) => ({
      tags: state.tags.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  deleteTag: (id: string) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
    })),
  // 增加标签使用次数，不存在则自动创建
  incrementTagUsage: (name: string) =>
    set((state) => {
      const existing = state.tags.find((t) => t.name === name)
      if (existing) {
        return {
          tags: state.tags.map((t) =>
            t.id === existing.id ? { ...t, usageCount: t.usageCount + 1 } : t
          ),
        }
      }
      return {
        tags: [
          ...state.tags,
          { id: generateId(), name, color: '', createdAt: new Date(), usageCount: 1 },
        ],
      }
    }),
})
