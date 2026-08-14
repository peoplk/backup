'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Play, Pause, RotateCcw, X } from 'lucide-react'

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type SyncState = {
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  mode: 'work' | 'short-break' | 'long-break'
}

const MODE_LABEL: Record<string, string> = {
  work: '专注',
  'short-break': '短休息',
  'long-break': '长休息',
}

const MODE_COLOR: Record<string, string> = {
  work: '#22c55e',
  'short-break': '#3b82f6',
  'long-break': '#8b5cf6',
}

export function TimerFloat() {
  const initial = useAppStore.getState().pomodoroTimerState
  const initialSettings = useAppStore.getState().pomodoroSettings
  const initialTotal =
    initial.mode === 'work'
      ? initialSettings.workDuration
      : initial.mode === 'short-break'
      ? initialSettings.shortBreakDuration
      : initialSettings.longBreakDuration
  const [state, setState] = useState<SyncState>({
    timeLeft: initial.timeLeft,
    totalDuration: initialTotal,
    isRunning: initial.isRunning,
    mode: initial.mode,
  })

  useEffect(() => {
    window.electronAPI?.onPomodoroSync?.((next: SyncState) => {
      setState(next)
    })
    // 主窗口每秒广播番茄钟状态，这里仅作兜底拉取，降频避免重复 IPC
    const interval = setInterval(() => {
      window.electronAPI?.sendPomodoroState?.()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const { timeLeft, totalDuration, isRunning, mode } = state
  const progress = totalDuration > 0 ? 1 - timeLeft / totalDuration : 0
  const accent = MODE_COLOR[mode] || '#22c55e'

  const radius = 26
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="flex h-screen w-screen items-center justify-between gap-3 px-4"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="relative" style={{ WebkitAppRegion: 'no-drag' }}>
        <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="5"
          />
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.3s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-white">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-0.5" style={{ WebkitAppRegion: 'no-drag' }}>
        <span className="text-[11px] font-medium text-white/80">{MODE_LABEL[mode]}</span>
        <span className="text-[10px] text-white/40">{isRunning ? '进行中' : '已暂停'}</span>
      </div>

      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI?.sendFloatControl?.('toggle')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          title={isRunning ? '暂停' : '开始'}
        >
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => window.electronAPI?.sendFloatControl?.('reset')}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          title="重置"
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={() => window.electronAPI?.closeTimerFloat?.()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-red-500/40 hover:text-white"
          title="关闭浮窗"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
