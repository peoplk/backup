import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState } from './types'
import type { TaskReminder } from '@/lib/types'
import { cloudSyncMiddleware, generateId } from './utils'
import { POMODORO_CONFIG } from '@/lib/config'
import { COLOR_PALETTE } from '@/lib/palette'

interface LegacyHabit {
  trackingType?: unknown
  targetValue?: unknown
  unit?: unknown
  streakFreezes?: number
  maxStreakFreezes?: number
}

interface LegacyCheckIn {
  value?: unknown
}

interface LegacyProject {
  name: string
  id: string
}

interface LegacyTimeEntry {
  projectId?: string
  project?: string
}

interface LegacyTask {
  reminders?: unknown
  reminder?: unknown
  reminderTime?: string
  timeSpent?: number
}

interface LegacyState {
  pomodoroTimerState?: { lastSessionDate?: string }
  habits?: LegacyHabit[]
  habitCheckIns?: LegacyCheckIn[]
  projects?: LegacyProject[]
  timeEntries?: LegacyTimeEntry[]
  tasks?: LegacyTask[]
  focusGoals?: { dailyMinutes?: number; weeklyMinutes?: number; dailyPomodoros?: number }
  repeatCompletions?: unknown
  distractions?: unknown
  journals?: unknown
  taskTemplates?: unknown
  pomodoroStrictMode?: unknown
  dashboardWidgets?: unknown
  darkModeSchedule?: unknown
  workingHours?: unknown
  focusPresets?: unknown
  savedFilters?: unknown
  activeSavedFilterId?: unknown
  [key: string]: unknown
}
import { setSyncDataCallback, setSyncDataProvider } from '@/lib/sync-store'
import { setS3DataCallback, setS3DataProvider } from '@/lib/s3-store'
import { createTaskSlice } from './slices/task-slice'
import { createTimeEntrySlice } from './slices/time-entry-slice'
import { createPomodoroSlice } from './slices/pomodoro-slice'
import { createProjectSlice } from './slices/project-slice'
import { createHabitSlice } from './slices/habit-slice'
import { createAnniversarySlice } from './slices/anniversary-slice'
import { createNotificationSlice } from './slices/notification-slice'
import { createUISlice } from './slices/ui-slice'
import { createGoalSlice } from './slices/goal-slice'
import { createAchievementSlice } from './slices/achievement-slice'
import { createTagSlice } from './slices/tag-slice'
import { createReminderSlice } from './slices/reminder-slice'
import { createTimeBlockSlice } from './slices/time-block-slice'
import { createDashboardSlice } from './slices/dashboard-slice'
import { createRepeatCompletionSlice } from './slices/repeat-completion-slice'
import { createTrashSlice } from './slices/trash-slice'
import { createFocusShieldSlice } from './slices/focus-shield-slice'
import { createTemplateSlice } from './slices/template-slice'
import { createJournalSlice } from './slices/journal-slice'

export * from './types'

// 跨窗口同步：主窗口与桌面小组件是独立 React 实例，
// 任一窗口写入 localStorage 后，其他窗口通过 storage 事件合并更新，避免旧 state 覆盖新数据
const STORAGE_KEY = 'productivity-app-storage'

function syncFromStorageEvent(ev: StorageEvent) {
  if (ev.key !== STORAGE_KEY) return
  if (typeof ev.newValue !== 'string' || !ev.newValue) return
  try {
    const parsed = JSON.parse(ev.newValue) as { state?: Record<string, unknown> }
    const incoming = parsed?.state
    if (!incoming || typeof incoming !== 'object') return
    const current = useAppStore.getState() as unknown as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(incoming)) {
      if (key === 'pomodoroTimerState') continue
      if (key in current && JSON.stringify(current[key]) === JSON.stringify(incoming[key])) {
        continue
      }
      patch[key] = incoming[key]
    }
    // 仅在内容真正变化时 setState，避免 setState -> persist 回写 -> storage 事件 -> 另一窗口 setState 的无限 ping-pong 循环
    if (Object.keys(patch).length > 0) {
      useAppStore.setState(patch as Partial<AppState>)
    }
  } catch {
    // 忽略损坏数据
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', syncFromStorageEvent)
}

export const useAppStore = create<AppState>()(
  persist(    cloudSyncMiddleware((set, get, api) => ({
      ...createTaskSlice(set, get, api),
      ...createTimeEntrySlice(set, get, api),
      ...createPomodoroSlice(set, get, api),
      ...createProjectSlice(set, get, api),
      ...createHabitSlice(set, get, api),
      ...createAnniversarySlice(set, get, api),
      ...createNotificationSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createGoalSlice(set, get, api),
      ...createAchievementSlice(set, get, api),
      ...createTagSlice(set, get, api),
      ...createReminderSlice(set, get, api),
      ...createTimeBlockSlice(set, get, api),
      ...createDashboardSlice(set, get, api),
      ...createRepeatCompletionSlice(set, get, api),
      ...createTrashSlice(set, get, api),
      ...createFocusShieldSlice(set, get, api),
      ...createTemplateSlice(set, get, api),
      ...createJournalSlice(set, get, api),
    })),
{
  name: 'productivity-app-storage',  version: 8,
  migrate: (persistedState: unknown, version: number) => {
    if (version < 2) {
      return {
        tasks: [],
        timeEntries: [],
        pomodoroSessions: [],
        pomodoroSettings: POMODORO_CONFIG,
        projects: [],
        habits: [],
        habitCheckIns: [],
        anniversaries: [],
        sidebarCollapsed: false,
      }
    }
    
    if (version < 3) {
      const state = persistedState as LegacyState
      if (state.pomodoroTimerState && !state.pomodoroTimerState.lastSessionDate) {
        state.pomodoroTimerState.lastSessionDate = new Date().toDateString()
      }
      return state
    }
    
    if (version < 4) {
      const state = persistedState as LegacyState
      state.repeatCompletions = []
      return state
    }

    if (version < 5) {
      const state = persistedState as LegacyState
      state.distractions = []
      state.journals = []
      state.taskTemplates = []
      state.pomodoroStrictMode = {
        enabled: false,
        autoStartNext: false,
        skipBreaks: false,
        maxSessionsPerDay: 12,
        lockUntilSessionEnd: false,
      }
      state.dashboardWidgets = ['greeting', 'focus-goal', 'today-tasks', 'quick-add', 'streak', 'weekly-chart']
      state.darkModeSchedule = { enabled: false, lightStart: '07:00', darkStart: '19:00' }
      state.workingHours = { enabled: false, workStartTime: '09:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] }
      return state
    }

    if (version < 6) {
      const state = persistedState as LegacyState
      if (state.habits) {
        state.habits = state.habits.map((h) => ({
          ...h,
          trackingType: h.trackingType || 'boolean',
          targetValue: h.targetValue || undefined,
          unit: h.unit || undefined,
          streakFreezes: h.streakFreezes || 0,
          maxStreakFreezes: h.maxStreakFreezes || 3,
        }))
      }
      if (state.habitCheckIns) {
        state.habitCheckIns = state.habitCheckIns.map((c) => ({
          ...c,
          value: c.value || undefined,
        }))
      }
      state.focusPresets = [
        {
          id: 'preset-deep-work',
          name: '深度工作',
          icon: '🧠',
          workDuration: 50 * 60,
          shortBreakDuration: 10 * 60,
          longBreakDuration: 30 * 60,
          sessionsBeforeLongBreak: 3,
          autoStartBreak: false,
          autoStartWork: false,
          soundEnabled: true,
          color: COLOR_PALETTE[0],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'preset-quick-focus',
          name: '快速专注',
          icon: '⚡',
          workDuration: 25 * 60,
          shortBreakDuration: 5 * 60,
          longBreakDuration: 15 * 60,
          sessionsBeforeLongBreak: 4,
          autoStartBreak: true,
          autoStartWork: false,
          soundEnabled: true,
          color: COLOR_PALETTE[1],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'preset-marathon',
          name: '马拉松模式',
          icon: '🏃',
          workDuration: 60 * 60,
          shortBreakDuration: 15 * 60,
          longBreakDuration: 30 * 60,
          sessionsBeforeLongBreak: 2,
          autoStartBreak: false,
          autoStartWork: false,
          soundEnabled: true,
          color: COLOR_PALETTE[2],
          createdAt: new Date().toISOString(),
        },
      ]
      return state
    }

    if (version < 7) {
      const state = persistedState as LegacyState
      if (Array.isArray(state.projects) && Array.isArray(state.timeEntries)) {
        const projectByName = new Map(
          state.projects.map((p) => [p.name, p.id])
        )
        state.timeEntries = state.timeEntries.map((e) => {
          if (e.projectId) return e
          const projectId = e.project ? projectByName.get(e.project) : undefined
          return { ...e, projectId: projectId ?? '' }
        })
      }
      // 将旧的 reminder/reminderTime 转换为 reminders 数组
      if (Array.isArray(state.tasks)) {
        state.tasks = state.tasks.map((t) => {
          if (t.reminders !== undefined) return t
          const reminders: TaskReminder[] = []
          if (t.reminder && t.reminderTime) {
            reminders.push({
              id: generateId(),
              type: 'absolute',
              triggerAt: new Date(t.reminderTime),
              enabled: true,
              triggered: false,
            })
          } else if (t.reminder) {
            reminders.push({
              id: generateId(),
              type: 'on-due',
              enabled: true,
              triggered: false,
            })
          }
          const { reminder, reminderTime, ...rest } = t
          return { ...rest, reminders }
        })
      }
      // 初始化 savedFilters
      if (!Array.isArray(state.savedFilters)) {
        state.savedFilters = []
      }
      if (state.activeSavedFilterId === undefined) {
        state.activeSavedFilterId = null
      }
      return state
    }

    if (version < 8) {
      const state = persistedState as LegacyState
      // 升级 focusGoals：旧版只有 dailyMinutes/weeklyMinutes
      if (state.focusGoals && typeof state.focusGoals.dailyPomodoros !== 'number') {
        state.focusGoals = {
          dailyMinutes: state.focusGoals.dailyMinutes ?? 120,
          weeklyMinutes: state.focusGoals.weeklyMinutes ?? 600,
          dailyPomodoros: state.focusGoals.dailyPomodoros ?? 8,
        }
      }
      // 给任务加 timeSpent 字段（默认 0）
      if (Array.isArray(state.tasks)) {
        state.tasks = state.tasks.map((t) => ({
          ...t,
          timeSpent: typeof t.timeSpent === 'number' ? t.timeSpent : 0,
        }))
      }
      return state
    }

    return persistedState
  },
  partialize: (state) => ({
    tasks: state.tasks,
    timeEntries: state.timeEntries,
    pomodoroSessions: state.pomodoroSessions,
    abandonedPomodoroSessions: state.abandonedPomodoroSessions,
    pomodoroSettings: state.pomodoroSettings,
    pomodoroTimerState: {
      ...state.pomodoroTimerState,
      isRunning: false,
    },
    projects: state.projects,
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
    anniversaries: state.anniversaries,
    notifications: state.notifications,
    sidebarCollapsed: state.sidebarCollapsed,
    activeSmartList: state.activeSmartList,
    goals: state.goals,
    achievements: state.achievements,
    userLevel: state.userLevel,
    tags: state.tags,
    reminders: state.reminders,
    focusGoals: state.focusGoals,
    repeatCompletions: state.repeatCompletions,
    trashedItems: state.trashedItems,
    taskOrder: state.taskOrder,
    timeBlocks: state.timeBlocks,
    distractions: state.distractions,
    journals: state.journals,
    taskTemplates: state.taskTemplates,
    pomodoroStrictMode: state.pomodoroStrictMode,
    dashboardWidgets: state.dashboardWidgets,
    darkModeSchedule: state.darkModeSchedule,
    workingHours: state.workingHours,
    focusSoundSettings: state.focusSoundSettings,
    focusPresets: state.focusPresets,
    dailyReviewSettings: state.dailyReviewSettings,
    savedFilters: state.savedFilters,
    activeSavedFilterId: state.activeSavedFilterId,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      const applyCloudData = (cloudData: Record<string, unknown>) => {
        const store = useAppStore.getState()
        const keys = Object.keys(cloudData) as Array<keyof AppState>
        keys.forEach((key) => {
          if (key in store && typeof store[key] !== 'function') {
            if (key === 'pomodoroTimerState' && cloudData[key] && typeof cloudData[key] === 'object') {
              useAppStore.setState({ [key]: { ...(cloudData[key] as object), isRunning: false } } as Partial<AppState>)
              return
            }
            useAppStore.setState({ [key]: cloudData[key] } as Partial<AppState>)
          }
        })
      }
      setSyncDataCallback(applyCloudData)
      setS3DataCallback(applyCloudData)
      setSyncDataProvider(() => {
        const store = useAppStore.getState()
        return {
          tasks: store.tasks,
          timeEntries: store.timeEntries,
          pomodoroSessions: store.pomodoroSessions,
          abandonedPomodoroSessions: store.abandonedPomodoroSessions,
          pomodoroSettings: store.pomodoroSettings,
          pomodoroTimerState: store.pomodoroTimerState,
          projects: store.projects,
          habits: store.habits,
          habitCheckIns: store.habitCheckIns,
          anniversaries: store.anniversaries,
          notifications: store.notifications,
          sidebarCollapsed: store.sidebarCollapsed,
          activeSmartList: store.activeSmartList,
          goals: store.goals,
          achievements: store.achievements,
          userLevel: store.userLevel,
          tags: store.tags,
          reminders: store.reminders,
          focusGoals: store.focusGoals,
          repeatCompletions: store.repeatCompletions,
          trashedItems: store.trashedItems,
          taskOrder: store.taskOrder,
          timeBlocks: store.timeBlocks,
          distractions: store.distractions,
          journals: store.journals,
          taskTemplates: store.taskTemplates,
          pomodoroStrictMode: store.pomodoroStrictMode,
          dashboardWidgets: store.dashboardWidgets,
          darkModeSchedule: store.darkModeSchedule,
          workingHours: store.workingHours,
          focusSoundSettings: store.focusSoundSettings,
          focusPresets: store.focusPresets,
          dailyReviewSettings: store.dailyReviewSettings,
          savedFilters: store.savedFilters,
          activeSavedFilterId: store.activeSavedFilterId,
        }
      })
      setS3DataProvider(() => {
        const store = useAppStore.getState()
        return {
          tasks: store.tasks,
          timeEntries: store.timeEntries,
          pomodoroSessions: store.pomodoroSessions,
          abandonedPomodoroSessions: store.abandonedPomodoroSessions,
          pomodoroSettings: store.pomodoroSettings,
          pomodoroTimerState: store.pomodoroTimerState,
          projects: store.projects,
          habits: store.habits,
          habitCheckIns: store.habitCheckIns,
          anniversaries: store.anniversaries,
          notifications: store.notifications,
          sidebarCollapsed: store.sidebarCollapsed,
          activeSmartList: store.activeSmartList,
          goals: store.goals,
          achievements: store.achievements,
          userLevel: store.userLevel,
          tags: store.tags,
          reminders: store.reminders,
          focusGoals: store.focusGoals,
          repeatCompletions: store.repeatCompletions,
          trashedItems: store.trashedItems,
          taskOrder: store.taskOrder,
          timeBlocks: store.timeBlocks,
          distractions: store.distractions,
          journals: store.journals,
          taskTemplates: store.taskTemplates,
          pomodoroStrictMode: store.pomodoroStrictMode,
          dashboardWidgets: store.dashboardWidgets,
          darkModeSchedule: store.darkModeSchedule,
          workingHours: store.workingHours,
          focusSoundSettings: store.focusSoundSettings,
          focusPresets: store.focusPresets,
          dailyReviewSettings: store.dailyReviewSettings,
          savedFilters: store.savedFilters,
          activeSavedFilterId: store.activeSavedFilterId,
        }
      })
    }
  },
    }
  )
)

if (typeof window !== 'undefined') {
  ;(window as unknown as { __appStore: typeof useAppStore }).__appStore = useAppStore
}
