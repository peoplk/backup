import { useAppStore } from '@/lib/store'
import {
  completePomodoroSession,
  abandonPomodoroSession,
  type PomodoroMode,
} from '@/lib/pomodoro-completion'
import { dataLinkService } from '@/lib/data-link-service'
import { notifyPomodoroComplete, notifyBreakComplete } from '@/lib/browser-notifications'
import { playPresetSound, type SoundPresetId } from '@/lib/focus-sounds'
import { getNextTreeState } from '@/lib/forest-tree'

export interface PomodoroCompletionInfo {
  sessionId: string
  mode: PomodoroMode
  totalDuration: number
  taskEstimatedReached: boolean
  selectedTaskId: string | null
  nextMode: PomodoroMode
}

type CompletionListener = (info: PomodoroCompletionInfo) => void

let ticker: ReturnType<typeof setInterval> | null = null
let timerStartRef: { startedAt: number; timeLeftAtStart: number } | null = null
let prevMode: PomodoroMode | null = null
let reachedZero = false
let initialized = false
let audioContextRef: AudioContext | null = null

const completionListeners = new Set<CompletionListener>()

let sessionNoteProvider: (() => {
  focusNote: string
  sessionTags: string[]
}) | null = null

function isFocusCompleteNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('focusflow-notif-focus') !== 'false'
}

function getTotalDuration(
  p: { mode: PomodoroMode },
  s: { workDuration: number; shortBreakDuration: number; longBreakDuration: number }
): number {
  return p.mode === 'work'
    ? s.workDuration
    : p.mode === 'short-break'
    ? s.shortBreakDuration
    : s.longBreakDuration
}

function countTodayWorkSessions(sessions: { completedAt: string | Date; type: string }[]): number {
  const todayStr = new Date().toDateString()
  return sessions.filter(
    (s) => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
  ).length
}

function getCurrentNote(): { focusNote: string; sessionTags: string[] } {
  return sessionNoteProvider?.() ?? { focusNote: '', sessionTags: [] }
}

function playNotificationSound(): void {
  const soundEnabled = useAppStore.getState().pomodoroSettings.soundEnabled ?? true
  if (!soundEnabled) return
  try {
    if (!audioContextRef) {
      audioContextRef = new (window.AudioContext || window.webkitAudioContext!)()
    }
    const preset = (
      useAppStore.getState().pomodoroSettings.notificationSound || 'classic'
    ) as SoundPresetId
    playPresetSound(audioContextRef, preset)
  } catch {
    // 忽略音频播放失败
  }
}

function handleComplete(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState
  const s = state.pomodoroSettings
  const mode = p.mode
  const totalDuration = getTotalDuration(p, s)
  const { focusNote, sessionTags } = getCurrentNote()

  const result = completePomodoroSession({
    mode,
    duration: totalDuration,
    selectedTaskId: p.selectedTaskId,
    focusNote,
    sessionTags,
  })

  if (result.sessionId) {
    dataLinkService.handlePomodoroCompletion(
      result.sessionId,
      totalDuration,
      mode,
      p.selectedTaskId || undefined
    )
  }

  playNotificationSound()

  let nextMode: PomodoroMode
  if (mode === 'work') {
    if (isFocusCompleteNotificationEnabled()) {
      notifyPomodoroComplete(
        Math.round(totalDuration / 60),
        p.selectedTaskId ? state.tasks.find((t) => t.id === p.selectedTaskId)?.title : undefined
      )
    }

    const newCompletedSessions = p.completedSessions + 1
    const newTreeGrowth = Math.min(p.treeGrowth + 25, 100)
    const newTreeState = getNextTreeState(p.treeState, newTreeGrowth)

    const breakEvery = s.sessionsBeforeLongBreak || 4
    const nextBreak = newCompletedSessions % breakEvery === 0
    nextMode = nextBreak ? 'long-break' : 'short-break'
    const nextDuration = nextBreak ? s.longBreakDuration : s.shortBreakDuration

    state.updatePomodoroTimerState({
      completedSessions: newCompletedSessions,
      treeGrowth: newTreeGrowth,
      treeState: newTreeState,
      mode: nextMode,
      timeLeft: nextDuration,
      isRunning: s.autoStartBreak ?? true,
    })
  } else {
    notifyBreakComplete('work')
    nextMode = 'work'
    state.updatePomodoroTimerState({
      mode: 'work',
      timeLeft: s.workDuration,
      isRunning: s.autoStartWork ?? false,
    })
  }

  for (const listener of completionListeners) {
    listener({
      sessionId: result.sessionId,
      mode,
      totalDuration,
      taskEstimatedReached: !!result.taskEstimatedReached,
      selectedTaskId: p.selectedTaskId || null,
      nextMode,
    })
  }
}

function tick(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState

  if (!p.isRunning) {
    timerStartRef = null
    return
  }

  // 上一棵树已枯萎时，重新种植一棵新种子
  if (p.mode === 'work' && p.treeState === 'withered') {
    state.updatePomodoroTimerState({ treeGrowth: 0, treeState: 'seed' })
  }

  if (prevMode !== p.mode || !timerStartRef) {
    timerStartRef = { startedAt: Date.now(), timeLeftAtStart: p.timeLeft }
    prevMode = p.mode
  }

  const elapsed = Math.floor((Date.now() - timerStartRef.startedAt) / 1000)
  const newTimeLeft = Math.max(0, timerStartRef.timeLeftAtStart - elapsed)

  if (newTimeLeft <= 0) {
    timerStartRef = null
    if (!reachedZero) {
      reachedZero = true
      state.updatePomodoroTimerState({ timeLeft: 0 })
    }
  } else if (newTimeLeft !== p.timeLeft) {
    reachedZero = false
    // 仅在秒级变化时更新，避免每 250ms 触发一次状态写入与持久化
    state.updatePomodoroTimerState({ timeLeft: newTimeLeft })
  } else {
    reachedZero = false
  }

  if (reachedZero && p.isRunning) {
    reachedZero = false
    handleComplete()
  }
}

function dispatchStrictBlocked(): void {
  if (typeof window === 'undefined') return
  const state = useAppStore.getState()
  window.dispatchEvent(
    new CustomEvent('focusflow:strict-limit-blocked', {
      detail: {
        todaySessions: countTodayWorkSessions(state.pomodoroSessions),
        max: state.pomodoroStrictMode.maxSessionsPerDay,
      },
    })
  )
}

function handleToggle(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState
  const strict = state.pomodoroStrictMode
  const s = state.pomodoroSettings

  if (
    strict.enabled &&
    p.mode === 'work' &&
    p.timeLeft < getTotalDuration(p, s) &&
    strict.lockUntilSessionEnd
  ) {
    return
  }

  if (
    !p.isRunning &&
    p.mode === 'work' &&
    strict.enabled &&
    strict.maxSessionsPerDay > 0 &&
    countTodayWorkSessions(state.pomodoroSessions) >= strict.maxSessionsPerDay
  ) {
    dispatchStrictBlocked()
    return
  }

  state.updatePomodoroTimerState({ isRunning: !p.isRunning })
}

function handleReset(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState
  const strict = state.pomodoroStrictMode
  const s = state.pomodoroSettings

  if (
    strict.enabled &&
    strict.lockUntilSessionEnd &&
    p.mode === 'work' &&
    p.timeLeft < getTotalDuration(p, s)
  ) {
    return
  }

  state.updatePomodoroTimerState({
    timeLeft: getTotalDuration(p, s),
    isRunning: false,
  })
}

function handleSkip(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState
  const strict = state.pomodoroStrictMode
  const s = state.pomodoroSettings

  if (
    strict.enabled &&
    strict.lockUntilSessionEnd &&
    p.mode === 'work' &&
    p.timeLeft < getTotalDuration(p, s)
  ) {
    return
  }

  if (p.mode === 'work') {
    const nextBreak = (p.completedSessions + 1) % (s.sessionsBeforeLongBreak || 4) === 0
    state.updatePomodoroTimerState({
      isRunning: false,
      mode: nextBreak ? 'long-break' : 'short-break',
      timeLeft: nextBreak ? s.longBreakDuration : s.shortBreakDuration,
    })
  } else {
    state.updatePomodoroTimerState({
      isRunning: false,
      mode: 'work',
      timeLeft: s.workDuration,
    })
  }
}

function handleBeforeUnload(): void {
  const state = useAppStore.getState()
  const p = state.pomodoroTimerState
  if (!p.isRunning || p.mode !== 'work') return
  const totalDuration = getTotalDuration(p, state.pomodoroSettings)
  const { focusNote, sessionTags } = getCurrentNote()
  abandonPomodoroSession({
    duration: totalDuration - p.timeLeft,
    selectedTaskId: p.selectedTaskId,
    focusNote,
    sessionTags,
  })
  state.updatePomodoroTimerState({ treeState: 'withered', isRunning: false })
}

/**
 * 全局番茄钟引擎：独立于任何视图/组件挂载，运行在主窗口。
 * 负责计时 tick、会话完成、外部控制（小组件/托盘/漂浮钟/系统挂起）与关闭时的放弃记录。
 * 多个窗口共享 localStorage 存储，但引擎只在主窗口初始化一次，避免重复计时。
 */
export function ensurePomodoroEngine(): void {
  if (initialized) return
  initialized = true

  useAppStore.getState().checkAndResetDailyPomodoro()

  window.addEventListener('beforeunload', handleBeforeUnload)

  window.electronAPI?.onSystemSuspend?.(() => {
    const p = useAppStore.getState().pomodoroTimerState
    if (p.isRunning) {
      useAppStore.getState().updatePomodoroTimerState({ isRunning: false })
    }
  })

  window.electronAPI?.onFloatControl?.((action: string) => {
    if (action === 'reset') {
      handleReset()
    } else if (action === 'skip') {
      handleSkip()
    } else if (action === 'toggle') {
      handleToggle()
    }
  })

  window.addEventListener('focusflow:toggle-pomodoro', handleToggle)

  ticker = setInterval(tick, 250)

  if (typeof window !== 'undefined') {
    ;(window as unknown as { __pomodoroEngine: object }).__pomodoroEngine = {
      getState: () => ({ initialized, timerStartRef, prevMode, reachedZero }),
    }
  }
}

export function subscribePomodoroCompletion(listener: CompletionListener): () => void {
  completionListeners.add(listener)
  return () => {
    completionListeners.delete(listener)
  }
}

/**
 * 会话进行中（专注页挂载时）由 PomodoroTimer 注册当前备注/标签的读取器，
 * 使引擎完成/放弃会话时能带上用户填写的备注与标签。
 */
export function setPomodoroSessionNoteProvider(
  provider: (() => { focusNote: string; sessionTags: string[] }) | null
): void {
  sessionNoteProvider = provider
}
