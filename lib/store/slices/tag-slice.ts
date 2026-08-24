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
    set((state) => {
      const tag = state.tags.find((t) => t.id === id)
      if (!tag) return state
      // 同时从所有任务/时间记录中移除该标签，避免悬空引用
      return {
        tags: state.tags.filter((t) => t.id !== id),
        tasks: state.tasks.map((t) =>
          t.tags.includes(tag.name)
            ? { ...t, tags: t.tags.filter((name) => name !== tag.name) }
            : t
        ),
        timeEntries: state.timeEntries.map((e) =>
          e.tags?.includes(tag.name)
            ? { ...e, tags: e.tags.filter((name) => name !== tag.name) }
            : e
        ),
      }
    }),
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
