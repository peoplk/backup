import type { Goal, Milestone } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createGoalSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  goals: [] as Goal[],
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) =>
    set((state) => ({
      goals: [
        ...state.goals,
        { ...goal, id: generateId(), createdAt: new Date() },
      ],
    })),
  updateGoal: (id: string, updates: Partial<Goal>) =>
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    })),
  deleteGoal: (id: string) =>
    set((state) => {
      const goal = state.goals.find((g) => g.id === id)
      if (!goal) return state
      clearNotifiedKeysWithPrefix(`goal-${id}`)
      return {
        goals: state.goals.filter((g) => g.id !== id),
        notifications: state.notifications.filter(
          (n) => !(n.relatedType === 'goal' && n.relatedId === id)
        ),
        // 清理关联习惯的 goalId 反向引用，避免孤儿引用
        habits: state.habits.map((h) =>
          h.linkedGoalId === id ? { ...h, linkedGoalId: undefined } : h
        ),
        reminders: state.reminders.filter(
          (r) => !(r.type === 'goal' && r.referenceId === id)
        ),
        trashedItems: [
          { id, type: 'goal' as const, data: goal, deletedAt: new Date() },
          ...state.trashedItems,
        ],
      }
    }),
  addMilestone: (goalId: string, milestone: Omit<Milestone, 'id'>) => {
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId
          ? { ...g, milestones: [...g.milestones, { ...milestone, id: generateId() }] }
          : g
      ),
    }))
    // 里程碑增删/勾选影响目标进度，统一触发 data-link-service 单一公式重算
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      dataLinkService.updateGoalProgressAfterLink(goalId)
    })
  },
  toggleMilestone: (goalId: string, milestoneId: string) => {
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              milestones: g.milestones.map((m) =>
                m.id === milestoneId
                  ? { ...m, completed: !m.completed, completedAt: !m.completed ? new Date() : undefined }
                  : m
              ),
            }
          : g
      ),
    }))
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      dataLinkService.updateGoalProgressAfterLink(goalId)
    })
  },
  updateMilestone: (goalId: string, milestoneId: string, updates: Partial<Omit<Milestone, 'id'>>) =>
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              milestones: g.milestones.map((m) =>
                m.id === milestoneId ? { ...m, ...updates } : m
              ),
            }
          : g
      ),
    })),
  deleteMilestone: (goalId: string, milestoneId: string) => {
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === goalId
          ? { ...g, milestones: g.milestones.filter((m) => m.id !== milestoneId) }
          : g
      ),
    }))
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      dataLinkService.updateGoalProgressAfterLink(goalId)
    })
  },
  reorderMilestones: (goalId: string, milestoneIds: string[]) =>
    set((state) => ({
      goals: state.goals.map((g) => {
        if (g.id !== goalId) return g
        const milestoneMap = new Map(g.milestones.map((m) => [m.id, m]))
        const reordered = milestoneIds
          .map((id) => milestoneMap.get(id))
          .filter((m): m is Milestone => m !== undefined)
        return { ...g, milestones: reordered }
      }),
    })),
})
