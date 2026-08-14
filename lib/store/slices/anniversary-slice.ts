import type { Anniversary } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultAnniversaries } from '../utils'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createAnniversarySlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  anniversaries: defaultAnniversaries,
  addAnniversary: (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) =>
    set((state) => ({
      anniversaries: [
        ...state.anniversaries,
        { ...anniversary, id: generateId(), createdAt: new Date() },
      ],
    })),
  updateAnniversary: (id: string, updates: Partial<Anniversary>) =>
    set((state) => ({
      anniversaries: state.anniversaries.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  deleteAnniversary: (id: string) =>
    set((state) => {
      const anniversary = state.anniversaries.find((a) => a.id === id)
      if (!anniversary) return state
      clearNotifiedKeysWithPrefix(`anniversary-${id}`)
      return {
        anniversaries: state.anniversaries.filter((a) => a.id !== id),
        notifications: state.notifications.filter(
          (n) => !(n.relatedType === 'anniversary' && n.relatedId === id && n.type === 'anniversary')
        ),
        trashedItems: [
          { id, type: 'anniversary' as const, data: anniversary, deletedAt: new Date() },
          ...state.trashedItems,
        ],
      }
    }),
})
