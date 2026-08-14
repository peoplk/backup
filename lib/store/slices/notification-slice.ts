import type { Notification } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createNotificationSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  notifications: [] as Notification[],
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: generateId(),
          timestamp: new Date(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50),
    })),
  markNotificationRead: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),
  /** 移除单条通知（如点击已失效的实体通知时自动清理） */
  removeNotification: (id: string) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  /** 删除实体时级联清理：移除与该实体关联的所有通知 */
  removeNotificationsByEntity: (relatedType: string, relatedId: string) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (n) => !(n.relatedType === relatedType && n.relatedId === relatedId)
      ),
    })),
  /** 清空回收站时调用：批量移除实体通知 */
  removeNotificationsForEntities: (entities: { type: string; id: string }[]) => {
    if (entities.length === 0) return
    const keys = new Set(entities.map((e) => `${e.type}::${e.id}`))
    set((state) => ({
      notifications: state.notifications.filter(
        (n) => !(n.relatedId && keys.has(`${n.relatedType}::${n.relatedId}`))
      ),
    }))
  },
  /** 清理已不存在实体（如已删除任务/习惯等）残留的通知，避免删除了仍提示 */
  purgeOrphanedNotifications: () =>
    set((state) => {
      const validIds = new Map<string, Set<string>>()
      for (const t of state.tasks) {
        const s = validIds.get('task') ?? new Set()
        s.add(t.id)
        validIds.set('task', s)
      }
      for (const h of state.habits) {
        const s = validIds.get('habit') ?? new Set()
        s.add(h.id)
        validIds.set('habit', s)
      }
      for (const g of state.goals) {
        const s = validIds.get('goal') ?? new Set()
        s.add(g.id)
        validIds.set('goal', s)
      }
      for (const a of state.anniversaries) {
        const s = validIds.get('anniversary') ?? new Set()
        s.add(a.id)
        validIds.set('anniversary', s)
      }
      const orphans = state.notifications.filter(
        (n) =>
          n.relatedType &&
          n.relatedId &&
          validIds.has(n.relatedType) &&
          !(validIds.get(n.relatedType) as Set<string>).has(n.relatedId)
      )
      if (orphans.length === 0) return state
      const orphanIds = new Set(orphans.map((n) => n.id))
      return {
        notifications: state.notifications.filter((n) => !orphanIds.has(n.id)),
      }
    }),
})
