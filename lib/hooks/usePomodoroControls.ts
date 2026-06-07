'use client'

import { useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'

type TimerMode = 'work' | 'short-break' | 'long-break'

const MODE_CONFIG = {
  work: { label: '专注' },
  'short-break': { label: '短休息' },
  'long-break': { label: '长休息' },
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function usePomodoroControls() {
  const {
    pomodoroTimerState,
    pomodoroSettings,
    updatePomodoroTimerState,
    tasks,
    pomodoroSessions,
  } = useAppStore(useShallow((state) => ({
    pomodoroTimerState: state.pomodoroTimerState,
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroTimerState: state.updatePomodoroTimerState,
    tasks: state.tasks,
    pomodoroSessions: state.pomodoroSessions,
  })))

  const mode = pomodoroTimerState.mode
  const timeLeft = pomodoroTimerState.timeLeft
  const isRunning = pomodoroTimerState.isRunning
  const completedSessions = pomodoroTimerState.completedSessions
  const selectedTaskId = pomodoroTimerState.selectedTaskId

  const totalDuration = useMemo(() => {
    if (mode === 'work') return pomodoroSettings.workDuration
    if (mode === 'short-break') return pomodoroSettings.shortBreakDuration
    return pomodoroSettings.longBreakDuration
  }, [mode, pomodoroSettings])

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100
  const selectedTask = tasks.find((t) => t.id === selectedTaskId)
  const label = MODE_CONFIG[mode].label

  const todaySessions = useMemo(() => {
    const todayStr = new Date().toDateString()
    return pomodoroSessions.filter(
      (s) => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    ).length
  }, [pomodoroSessions])

  const handleReset = useCallback(() => {
    updatePomodoroTimerState({
      isRunning: false,
      timeLeft: totalDuration,
    })
  }, [totalDuration, updatePomodoroTimerState])

  const handleSkip = useCallback(() => {
    if (mode === 'work') {
      const nextBreak = (completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0
      updatePomodoroTimerState({
        isRunning: false,
        mode: nextBreak ? 'long-break' : 'short-break',
        timeLeft: nextBreak ? pomodoroSettings.longBreakDuration : pomodoroSettings.shortBreakDuration,
      })
    } else {
      updatePomodoroTimerState({
        isRunning: false,
        mode: 'work',
        timeLeft: pomodoroSettings.workDuration,
      })
    }
  }, [mode, completedSessions, pomodoroSettings, updatePomodoroTimerState])

  const handleToggle = useCallback(() => {
    updatePomodoroTimerState({ isRunning: !isRunning })
  }, [isRunning, updatePomodoroTimerState])

  return {
    mode,
    timeLeft,
    isRunning,
    completedSessions,
    selectedTaskId,
    selectedTask,
    totalDuration,
    progress,
    label,
    todaySessions,
    handleReset,
    handleSkip,
    handleToggle,
    formatTime,
  }
}
