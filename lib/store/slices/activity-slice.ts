import type { ActivityAppUsage, ActivityDay, ActivityCategory, ActivitySettings, ActivityRuntimeStatus } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { categorizeApp } from '@/lib/activity-categories'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

/** 保留期与每日应用数的默认值/边界（设置项可覆盖，超界回默认） */
const DEFAULT_RETENTION_DAYS = 14
const DEFAULT_MAX_APPS_PER_DAY = 64
const MIN_RETENTION_DAYS = 7
const MAX_RETENTION_DAYS = 90

function retentionOf(s: ActivitySettings): number {
  const v = s.retentionDays
  return typeof v === 'number' && v >= MIN_RETENTION_DAYS && v <= MAX_RETENTION_DAYS ? v : DEFAULT_RETENTION_DAYS
}

function maxAppsOf(s: ActivitySettings): number {
  const v = s.maxAppsPerDay
  return typeof v === 'number' && v >= 8 && v <= 256 ? v : DEFAULT_MAX_APPS_PER_DAY
}

function pruneDays(days: ActivityDay[], retentionDays: number): ActivityDay[] {
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(-retentionDays)
}

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
  activitySettings: {
    enabled: false,
    retentionDays: DEFAULT_RETENTION_DAYS,
    maxAppsPerDay: DEFAULT_MAX_APPS_PER_DAY,
  } as ActivitySettings,
  activityDays: [] as ActivityDay[],
  // 运行时状态不回传持久化（不在 partialize 白名单），重启后由主进程重新播报
  activityStatus: { state: 'idle' } as ActivityRuntimeStatus,

  setActivityEnabled: (enabled: boolean) =>
    set((state) => ({
      activitySettings: { ...state.activitySettings, enabled },
      activityStatus: enabled ? state.activityStatus : { state: 'idle' },
    })),

  updateActivitySettings: (patch: Partial<ActivitySettings>) =>
    set((state) => {
      const activitySettings = { ...state.activitySettings, ...patch }
      return {
        activitySettings,
        // 缩短保留期时立即裁剪存量数据，而不是等下一次采样
        activityDays: patch.retentionDays !== undefined
          ? pruneDays(state.activityDays, retentionOf(activitySettings))
          : state.activityDays,
      }
    }),

  setActivityStatus: (status: ActivityRuntimeStatus) => set(() => ({ activityStatus: status })),

  /** 记录一次前台应用采样（由 Electron 主进程每 30s 推送） */
  recordActivitySample: (sample: { app: string; title?: string; seconds: number }) =>
    set((state) => {
      const app = (sample.app || '').toLowerCase().slice(0, 64)
      if (!app || !(sample.seconds > 0)) return state
      const seconds = Math.min(300, Math.round(sample.seconds))
      // 用户手动归类优先于内置分类，保证改过一次后不会被采样覆盖回去
      const category: ActivityCategory =
        state.activitySettings.categoryRules?.[app] ?? categorizeApp(app, sample.title)
      const maxApps = maxAppsOf(state.activitySettings)
      const now = Date.now()

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
          firstAt: prev.firstAt ?? now,
          lastAt: now,
        }
      } else if (apps.length < maxApps) {
        apps.push({ name: app, title: sample.title?.slice(0, 80), seconds, category, firstAt: now, lastAt: now })
      } else {
        return state
      }
      apps.sort((a, b) => b.seconds - a.seconds)

      days[dayIndex] = { ...day, apps }
      // 按日期升序保留最近 retentionDays 天
      return { activityDays: pruneDays(days, retentionOf(state.activitySettings)) }
    }),

  /** 手动修改某应用的归类：写入规则并对存量数据即时生效 */
  setAppCategoryRule: (appName: string, category: ActivityCategory) =>
    set((state) => {
      const app = (appName || '').toLowerCase().slice(0, 64)
      if (!app) return state
      const activitySettings: ActivitySettings = {
        ...state.activitySettings,
        categoryRules: { ...(state.activitySettings.categoryRules || {}), [app]: category },
      }
      const activityDays = state.activityDays.map((d) => ({
        ...d,
        apps: d.apps.map((a) => (a.name === app ? { ...a, category } : a)),
      }))
      return { activitySettings, activityDays }
    }),

  clearActivityData: () => set(() => ({ activityDays: [] })),
})
