import type { Task, Habit, Goal, Anniversary } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createTrashSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  trashedItems: [] as AppState['trashedItems'],
  moveToTrash: (id: string, type: 'task' | 'habit' | 'goal' | 'anniversary', data: unknown) =>
    set((state) => ({
      trashedItems: [
        { id, type, data, deletedAt: new Date() },
        ...state.trashedItems,
      ],
    })),
  restoreFromTrash: (id: string) =>
    set((state) => {
      const item = state.trashedItems.find((t) => t.id === id)
      if (!item) return state

      const newTrashedItems = state.trashedItems.filter((t) => t.id !== id)
      const restoredData = item.data as Record<string, unknown>

      switch (item.type) {
        case 'task':
          return {
            trashedItems: newTrashedItems,
            tasks: [...state.tasks, restoredData as unknown as Task],
          }
        case 'habit':
          return {
            trashedItems: newTrashedItems,
            habits: [...state.habits, restoredData as unknown as Habit],
          }
        case 'goal':
          return {
            trashedItems: newTrashedItems,
            goals: [...state.goals, restoredData as unknown as Goal],
          }
        case 'anniversary':
          return {
            trashedItems: newTrashedItems,
            anniversaries: [...state.anniversaries, restoredData as unknown as Anniversary],
          }
        default:
          return { trashedItems: newTrashedItems }
      }
    }),
  emptyTrash: () =>
    set((state) => {
      for (const item of state.trashedItems) {
        clearNotifiedKeysWithPrefix(`${item.type}-${item.id}`)
      }
      return {
        trashedItems: [],
        notifications: state.notifications.filter(
          (n) =>
            !state.trashedItems.some(
              (t) => t.type === n.relatedType && t.id === n.relatedId
            )
        ),
      }
    }),
  undoLastDelete: () =>
    set((state) => {
      if (state.trashedItems.length === 0) return state
      const lastItem = state.trashedItems[0]
      const newTrashedItems = state.trashedItems.slice(1)
      const restoredData = lastItem.data as Record<string, unknown>
      switch (lastItem.type) {
        case 'task':
          return { trashedItems: newTrashedItems, tasks: [...state.tasks, restoredData as unknown as Task] }
        case 'habit':
          return { trashedItems: newTrashedItems, habits: [...state.habits, restoredData as unknown as Habit] }
        case 'goal':
          return { trashedItems: newTrashedItems, goals: [...state.goals, restoredData as unknown as Goal] }
        case 'anniversary':
          return { trashedItems: newTrashedItems, anniversaries: [...state.anniversaries, restoredData as unknown as Anniversary] }
        default:
          return { trashedItems: newTrashedItems }
      }
    }),
  clearExpiredTrash: () =>
    set((state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return {
        trashedItems: state.trashedItems.filter(
          (t) => new Date(t.deletedAt) > thirtyDaysAgo
        ),
      }
    }),

  clearOldSessions: () =>
    set((state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return {
        pomodoroSessions: state.pomodoroSessions.filter(
          (s) => new Date(s.completedAt) > thirtyDaysAgo
        ),
      }
    }),

  clearOldTimeEntries: () =>
    set((state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return {
        timeEntries: state.timeEntries.filter(
          (e) => new Date(e.startTime) > thirtyDaysAgo
        ),
      }
    }),

  clearOldHabitCheckIns: () =>
    set((state) => {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      return {
        habitCheckIns: state.habitCheckIns.filter(
          (c) => new Date(c.date) > ninetyDaysAgo
        ),
      }
    }),

  clearOldRepeatCompletions: () =>
    set((state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return {
        repeatCompletions: state.repeatCompletions.filter(
          (c) => new Date(c.completedAt) > thirtyDaysAgo
        ),
      }
    }),

  clearOldNotifications: () =>
    set((state) => {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return {
        notifications: state.notifications.filter(
          (n) => new Date(n.timestamp) > sevenDaysAgo
        ),
      }
    }),

  clearAllOldData: () =>
    set((state) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      return {
        pomodoroSessions: state.pomodoroSessions.filter(
          (s) => new Date(s.completedAt) > thirtyDaysAgo
        ),
        timeEntries: state.timeEntries.filter(
          (e) => new Date(e.startTime) > thirtyDaysAgo
        ),
        habitCheckIns: state.habitCheckIns.filter(
          (c) => new Date(c.date) > ninetyDaysAgo
        ),
        repeatCompletions: state.repeatCompletions.filter(
          (c) => new Date(c.completedAt) > thirtyDaysAgo
        ),
        notifications: state.notifications.filter(
          (n) => new Date(n.timestamp) > sevenDaysAgo
        ),
        trashedItems: state.trashedItems.filter(
          (t) => new Date(t.deletedAt) > thirtyDaysAgo
        ),
        // 扩展覆盖：干扰记录、历史时间块、过期日记（避免无上限增长）
        distractions: state.distractions.filter(
          (d) => new Date(d.timestamp) > ninetyDaysAgo
        ),
        timeBlocks: state.timeBlocks.filter(
          (b) => {
            const blockDate = new Date(b.date)
            blockDate.setHours(0, 0, 0, 0)
            return blockDate > ninetyDaysAgo
          }
        ),
        journals: state.journals.filter(
          (j) => new Date(j.date) > oneYearAgo
        ),
      }
    }),

  refreshRepeatTasksStatus: () => get().refreshRepeatTasks(),
})
