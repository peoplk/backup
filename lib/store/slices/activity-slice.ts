import type { ActivityAppUsage, ActivityDay, ActivityCategory, ActivitySettings } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { categorizeApp } from '@/lib/activity-categories'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

/** 本地仅保留最近 N 天聚合数据，控制体积 */
const MAX_DAYS = 14
const MAX_APPS_PER_DAY = 64

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const createActivitySlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  activitySettings: { enabled: false } as ActivitySettings,
  activityDays: [] as ActivityDay[],

  setActivityEnabled: (enabled: boolean) =>
    set(() => ({ activitySettings: { enabled } })),

  /** 记录一次前台应用采样（由 Electron 主进程每 30s 推送） */
  recordActivitySample: (sample: { app: string; title?: string; seconds: number }) =>
    set((state) => {
      const app = (sample.app || '').toLowerCase().slice(0, 64)
      if (!app || !(sample.seconds > 0)) return state
      const seconds = Math.min(300, Math.round(sample.seconds))
      const category: ActivityCategory = categorizeApp(app, sample.title)

      const key = dateKey(new Date())
      const days = [...state.activityDays]
      let dayIndex = days.findIndex((d) => d.date === key)
      let day: ActivityDay
      if (dayIndex === -1) {
        day = { date: key, apps: [] }
        days.push(day)
        dayIndex = days.length - 1
      } else {
        day = days[dayIndex]
      }

      let apps: ActivityAppUsage[] = [...day.apps]
      const idx = apps.findIndex((a) => a.name === app)
      if (idx >= 0) {
        const prev = apps[idx]
        apps[idx] = {
          ...prev,
          seconds: prev.seconds + seconds,
          category,
          title: sample.title?.slice(0, 80) || prev.title,
        }
      } else if (apps.length < MAX_APPS_PER_DAY) {
        apps.push({ name: app, title: sample.title?.slice(0, 80), seconds, category })
      } else {
        return state
      }
      apps.sort((a, b) => b.seconds - a.seconds)

      days[dayIndex] = { ...day, apps }
      // 按日期升序保留最近 MAX_DAYS 天
      const pruned = days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-MAX_DAYS)
      return { activityDays: pruned }
    }),

  clearActivityData: () => set(() => ({ activityDays: [] })),
})
