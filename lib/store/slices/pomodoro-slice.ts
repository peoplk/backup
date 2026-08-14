import type { PomodoroSession, PomodoroSettings, FocusPreset, PomodoroStrictMode } from '@/lib/types'
import { POMODORO_CONFIG } from '@/lib/config'
import { COLOR_PALETTE } from '@/lib/palette'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultPomodoroSessions } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createPomodoroSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  pomodoroSessions: defaultPomodoroSessions,
  addPomodoroSession: (session: Omit<PomodoroSession, 'id' | 'completedAt'>) =>
    set((state) => ({
      pomodoroSessions: [
        ...state.pomodoroSessions,
        { ...session, id: generateId(), completedAt: new Date() },
      ],
    })),
  abandonedPomodoroSessions: [] as PomodoroSession[],
  addAbandonedPomodoroSession: (session: Omit<PomodoroSession, 'id' | 'completedAt'>) =>
    set((state) => ({
      abandonedPomodoroSessions: [
        ...state.abandonedPomodoroSessions,
        { ...session, id: generateId(), completedAt: new Date() },
      ],
    })),
  pomodoroSettings: {
    ...POMODORO_CONFIG,
    autoStartBreak: true,
    autoStartWork: false,
    soundEnabled: true,
    notificationSound: 'classic',
  } as PomodoroSettings,
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) =>
    set((state) => ({
      pomodoroSettings: { ...state.pomodoroSettings, ...settings },
    })),
  
  pomodoroTimerState: {
    mode: 'work' as const,
    timeLeft: POMODORO_CONFIG.workDuration,
    isRunning: false,
    completedSessions: 0,
    selectedTaskId: null,
    treeGrowth: 0,
    treeState: 'seed' as AppState['pomodoroTimerState']['treeState'],
    lastSessionDate: new Date().toDateString(),
  },
  updatePomodoroTimerState: (updates: Partial<AppState['pomodoroTimerState']>) =>
    set((state) => {
      const today = new Date().toDateString()
      const currentState = state.pomodoroTimerState

      if (currentState.lastSessionDate !== today) {
        // 跨天：只重置每日完成数（供长休息周期/每日统计使用），
        // 不打断正在运行的会话（不重置 timeLeft/isRunning/tree）
        return {
          pomodoroTimerState: {
            ...currentState,
            ...updates,
            completedSessions: updates.completedSessions !== undefined
              ? updates.completedSessions
              : 0,
            lastSessionDate: today,
          },
        }
      }

      return {
        pomodoroTimerState: { ...currentState, ...updates },
      }
    }),
  resetPomodoroTimer: () =>
    set((state) => ({
      pomodoroTimerState: {
        mode: 'work',
        timeLeft: state.pomodoroSettings.workDuration,
        isRunning: false,
        completedSessions: 0,
        selectedTaskId: null,
        treeGrowth: 0,
        treeState: 'seed',
        lastSessionDate: state.pomodoroTimerState.lastSessionDate,
      },
    })),
  checkAndResetDailyPomodoro: () =>
    set((state) => {
      const today = new Date().toDateString()
      if (state.pomodoroTimerState.lastSessionDate !== today) {
        return {
          pomodoroTimerState: {
            ...state.pomodoroTimerState,
            mode: 'work',
            timeLeft: state.pomodoroSettings.workDuration,
            isRunning: false,
            completedSessions: 0,
            selectedTaskId: null,
            treeGrowth: 0,
            treeState: 'seed',
            lastSessionDate: today,
          },
        }
      }
      return state
    }),

  focusGoals: { dailyMinutes: 120, weeklyMinutes: 600, dailyPomodoros: 8 },
  updateFocusGoals: (goals: Partial<AppState['focusGoals']>) =>
    set((state) => ({
      focusGoals: { ...state.focusGoals, ...goals },
    })),

  distractions: [] as AppState['distractions'],
  addDistraction: (distraction: Omit<AppState['distractions'][number], 'id'>) =>
    set((state) => ({
      distractions: [
        ...state.distractions,
        { ...distraction, id: generateId() },
      ],
    })),
  deleteDistraction: (id: string) =>
    set((state) => ({
      distractions: state.distractions.filter((d) => d.id !== id),
    })),
  getDistractionsForDate: (date: Date) => {
    const state = get()
    const dateStr = date.toDateString()
    return state.distractions.filter(d => new Date(d.timestamp).toDateString() === dateStr)
  },
  getDistractionCount: (taskId?: string) => {
    const state = get()
    if (taskId) return state.distractions.filter(d => d.taskId === taskId).length
    return state.distractions.length
  },

  pomodoroStrictMode: {
    enabled: false,
    autoStartNext: false,
    skipBreaks: false,
    maxSessionsPerDay: 12,
    lockUntilSessionEnd: false,
  } as PomodoroStrictMode,
  updatePomodoroStrictMode: (updates: Partial<PomodoroStrictMode>) =>
    set((state) => ({
      pomodoroStrictMode: { ...state.pomodoroStrictMode, ...updates },
    })),

  focusPresets: [
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
      createdAt: new Date(),
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
      createdAt: new Date(),
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
      createdAt: new Date(),
    },
  ] as FocusPreset[],
  addFocusPreset: (preset: Omit<FocusPreset, 'id' | 'createdAt'>) =>
    set((state) => ({
      focusPresets: [
        ...state.focusPresets,
        { ...preset, id: generateId(), createdAt: new Date() },
      ],
    })),
  updateFocusPreset: (id: string, updates: Partial<FocusPreset>) =>
    set((state) => ({
      focusPresets: state.focusPresets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  deleteFocusPreset: (id: string) =>
    set((state) => ({
      focusPresets: state.focusPresets.filter((p) => p.id !== id),
    })),
  applyFocusPreset: (id: string) =>
    set((state) => {
      const preset = state.focusPresets.find((p) => p.id === id)
      if (!preset) return state
      return {
        pomodoroSettings: {
          workDuration: preset.workDuration,
          shortBreakDuration: preset.shortBreakDuration,
          longBreakDuration: preset.longBreakDuration,
          sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
          autoStartBreak: preset.autoStartBreak,
          autoStartWork: preset.autoStartWork,
          soundEnabled: preset.soundEnabled,
        },
        pomodoroTimerState: {
          ...state.pomodoroTimerState,
          mode: 'work',
          timeLeft: preset.workDuration,
          isRunning: false,
        },
      }
    }),
})
