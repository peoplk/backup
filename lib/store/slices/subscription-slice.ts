import type { ExternalCalendarEvent, SubscribedCalendar } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'
import { isValidSubscriptionUrl } from '@/lib/ics-parse'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

const CALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export const createSubscriptionSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  subscribedCalendars: [] as SubscribedCalendar[],
  externalEvents: [] as ExternalCalendarEvent[],

  addSubscribedCalendar: ({ name, url, color }: { name: string; url: string; color?: string }) => {
    const trimmedUrl = (url || '').trim()
    if (!isValidSubscriptionUrl(trimmedUrl)) return null
    if (!name?.trim()) return null

    const cal: SubscribedCalendar = {
      id: generateId(),
      name: name.trim().slice(0, 60),
      url: trimmedUrl,
      color: color || CALETTE[Math.floor(Math.random() * CALETTE.length)],
      enabled: true,
      lastFetchedAt: null,
      lastError: null,
      status: 'idle',
    }
    set((state) => ({ subscribedCalendars: [...state.subscribedCalendars, cal] }))
    return cal
  },

  updateSubscribedCalendar: (id: string, updates: Partial<SubscribedCalendar>) =>
    set((state) => ({
      subscribedCalendars: state.subscribedCalendars.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeSubscribedCalendar: (id: string) =>
    set((state) => ({
      subscribedCalendars: state.subscribedCalendars.filter((c) => c.id !== id),
      // 同步清除该日历的事件缓存，避免悬空引用
      externalEvents: state.externalEvents.filter((e) => e.calendarId !== id),
    })),

  toggleSubscribedCalendar: (id: string) =>
    set((state) => {
      const target = state.subscribedCalendars.find((c) => c.id === id)
      if (!target) return state
      const nextEnabled = !target.enabled
      return {
        subscribedCalendars: state.subscribedCalendars.map((c) =>
          c.id === id ? { ...c, enabled: nextEnabled } : c
        ),
        // 禁用时隐藏其事件；重新启用后由刷新流程恢复
        externalEvents: nextEnabled
          ? state.externalEvents
          : state.externalEvents.filter((e) => e.calendarId !== id),
      }
    }),

  setExternalEvents: (calendarId: string, events: ExternalCalendarEvent[]) =>
    set((state) => ({
      externalEvents: [
        ...state.externalEvents.filter((e) => e.calendarId !== calendarId),
        ...events,
      ],
    })),
})
