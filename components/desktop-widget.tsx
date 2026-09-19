'use client'

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { isRepeatTaskCompletedToday } from '@/lib/hooks'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  CheckCircle2,
  Target,
  Flame,
  X,
  Coffee,
  Sun,
  Circle,
  CircleCheck,
  ListTodo,
  Pin,
  PinOff,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const modeConfig = {
  work: {
    label: '专注',
    text: 'text-chart-1',
    ring: 'stroke-chart-1',
    icon: Target,
    btn: 'bg-chart-1 shadow-chart-1/30',
    dot: 'bg-chart-1',
    bar: 'from-chart-1/60 to-chart-1',
  },
  'short-break': {
    label: '短休息',
    text: 'text-chart-2',
    ring: 'stroke-chart-2',
    icon: Coffee,
    btn: 'bg-chart-2 shadow-chart-2/30',
    dot: 'bg-chart-2',
    bar: 'from-chart-2/60 to-chart-2',
  },
  'long-break': {
    label: '长休息',
    text: 'text-chart-3',
    ring: 'stroke-chart-3',
    icon: Sun,
    btn: 'bg-chart-3 shadow-chart-3/30',
    dot: 'bg-chart-3',
    bar: 'from-chart-3/60 to-chart-3',
  },
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-chart-1/20 blur-3xl animate-glow-pulse" />
      <div className="absolute top-1/3 -right-24 w-56 h-56 rounded-full bg-chart-3/15 blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute -bottom-24 left-1/4 w-64 h-64 rounded-full bg-chart-2/15 blur-3xl animate-glow-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
    </div>
  )
}

function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'widget-card widget-glow rounded-2xl bg-white/[0.05] border border-white/[0.08]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
        className
      )}
    >
      {children}
    </div>
  )
}

function CardHeader({ icon: Icon, label, right }: { icon: typeof Flame; label: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5 text-foreground/60" />
      <span className="text-2xs text-foreground/80 font-medium tracking-wide">{label}</span>
      <div className="ml-auto">{right}</div>
    </div>
  )
}

function WidgetSkeleton() {
  return (
    <div className="h-screen select-none overflow-hidden bg-background text-foreground relative flex flex-col">
      <BackgroundGlow />
      <header className="relative z-10 shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <div className="w-14 h-3 rounded bg-white/10 animate-pulse" />
          <div className="w-10 h-4 rounded bg-white/10 animate-pulse mt-1.5" />
        </div>
        <div className="w-24 h-9 rounded-lg bg-white/10 animate-pulse" />
      </header>
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden px-3 pb-3 flex flex-col gap-2.5">
        <GlassCard className="p-3.5 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-1">
            <div className="w-12 h-3 rounded bg-white/10 animate-pulse" />
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/15" />
              ))}
            </div>
          </div>
          <div className="w-36 h-36 rounded-full bg-white/[0.04] border border-white/[0.06] my-2 flex items-center justify-center">
            <div className="w-24 h-9 rounded-lg bg-white/10 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5 mt-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
            <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse" />
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
          </div>
        </GlassCard>
        <GlassCard className="p-3 flex-1 min-h-0">
          <div className="w-16 h-3 rounded bg-white/10 animate-pulse mb-2.5" />
          <div className="space-y-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-8 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </GlassCard>
        <GlassCard className="p-3">
          <div className="w-16 h-3 rounded bg-white/10 animate-pulse mb-2.5" />
          <div className="h-1.5 rounded-full bg-white/[0.08] mb-2" />
          {[0, 1].map(i => (
            <div key={i} className="h-6 rounded-xl bg-white/[0.03] animate-pulse mb-1" />
          ))}
        </GlassCard>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}

type SyncState = {
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  mode: 'work' | 'short-break' | 'long-break'
}

export function DesktopWidget() {
  const {
    tasks,
    pomodoroTimerState,
    updatePomodoroTimerState,
    completeTask,
    repeatCompletions,
    pomodoroSettings,
    pomodoroSessions,
    habits,
    habitCheckIns,
    checkInHabit,
  } = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    pomodoroTimerState: s.pomodoroTimerState,
    updatePomodoroTimerState: s.updatePomodoroTimerState,
    completeTask: s.completeTask,
    repeatCompletions: s.repeatCompletions,
    pomodoroSettings: s.pomodoroSettings,
    pomodoroSessions: s.pomodoroSessions,
    habits: s.habits,
    habitCheckIns: s.habitCheckIns,
    checkInHabit: s.checkInHabit,
  })))

  const [currentTime, setCurrentTime] = useState(new Date())
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('focusflow-widget-pinned') !== 'false'
    } catch {
      return true
    }
  })
  const [mounted, setMounted] = useState(false)

  const initialPomodoro = useAppStore.getState().pomodoroTimerState
  const initialSettings = useAppStore.getState().pomodoroSettings
  const [syncState, setSyncState] = useState<SyncState>({
    timeLeft: initialPomodoro.timeLeft,
    totalDuration:
      initialPomodoro.mode === 'work' ? initialSettings.workDuration :
      initialPomodoro.mode === 'short-break' ? initialSettings.shortBreakDuration :
      initialSettings.longBreakDuration,
    isRunning: initialPomodoro.isRunning,
    mode: initialPomodoro.mode,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const off = window.electronAPI?.onPomodoroSync?.((next: SyncState) => {
      setSyncState(next)
    })
    // 主窗口每秒广播番茄钟状态，这里仅作兜底拉取，降频避免重复 IPC
    const interval = setInterval(() => {
      window.electronAPI?.sendPomodoroState?.()
    }, 5000)
    return () => {
      clearInterval(interval)
      if (typeof off === 'function') off()
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayStr = today.toDateString()

  /* ---------- pomodoro (synced via IPC with main window) ---------- */

  const mode = syncState.mode
  const config = modeConfig[mode]
  const ModeIcon = config.icon
  const timeLeft = syncState.timeLeft
  const isRunning = syncState.isRunning
  const totalDuration = syncState.totalDuration
  const completedSessions = pomodoroTimerState.completedSessions
  const selectedTask = tasks.find(t => t.id === pomodoroTimerState.selectedTaskId)

  const progress = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100))
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const handleToggle = useCallback(() => {
    window.electronAPI?.sendFloatControl?.('toggle')
  }, [])

  const handleReset = useCallback(() => {
    window.electronAPI?.sendFloatControl?.('reset')
  }, [])

  const handleSkip = useCallback(() => {
    window.electronAPI?.sendFloatControl?.('skip')
  }, [])

  const handleSelectTask = useCallback((taskId: string | null) => {
    updatePomodoroTimerState({ selectedTaskId: taskId })
  }, [updatePomodoroTimerState])

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /* ---------- tasks ---------- */

  const dueTasks = useMemo(() => {
    const result: (typeof tasks[0] & { completedToday?: boolean })[] = []
    tasks.forEach(t => {
      if (t.archived) return
      if (t.repeatRule) {
        const completedToday = isRepeatTaskCompletedToday(t, repeatCompletions)
        if (completedToday) {
          result.push({ ...t, completedToday: true })
          return
        }
        if (t.repeatRule.paused) return
        if (t.dueDate) {
          const dueDate = new Date(t.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          if (dueDate <= today) result.push(t)
        } else {
          result.push(t)
        }
        return
      }
      if (t.status === 'done') return
      if (t.dueDate) {
        const dueDate = new Date(t.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate.getTime() <= today.getTime()) result.push(t)
      } else {
        result.push(t)
      }
    })
    return result.sort((a, b) => {
      if (a.completedToday && !b.completedToday) return 1
      if (!a.completedToday && b.completedToday) return -1
      return 0
    })
  }, [tasks, repeatCompletions, today])

  const visibleTasks = dueTasks.slice(0, 3)
  const hiddenTaskCount = Math.max(0, dueTasks.length - visibleTasks.length)

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-chart-1',
    low: 'bg-muted-foreground/40',
  }

  const handleCompleteTask = useCallback((taskId: string) => {
    completeTask(taskId)
  }, [completeTask])

  /* ---------- habits ---------- */

  const activeHabits = habits.filter(h => !h.archived)
  const completedHabits = activeHabits.filter(h =>
    habitCheckIns.some(c => c.habitId === h.id && new Date(c.date).toDateString() === todayStr && c.completed)
  ).length
  const habitRate = activeHabits.length > 0 ? Math.round((completedHabits / activeHabits.length) * 100) : 0
  const visibleHabits = activeHabits.slice(0, 2)
  const hiddenHabitCount = Math.max(0, activeHabits.length - visibleHabits.length)

  const handleCheckIn = useCallback((habitId: string, isCompleted: boolean) => {
    if (!isCompleted) {
      // checkInHabit 内部已统一委托 data-link-service 处理连胜/积分/目标进度
      checkInHabit(habitId, new Date(), true)
    }
  }, [checkInHabit])

  /* ---------- stats ---------- */

  const todayPomodoros = pomodoroSessions.filter(
    s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
  ).length
  const todayFocusMinutes = pomodoroSessions
    .filter(s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work')
    .reduce((sum, s) => sum + Math.round(s.duration / 60), 0)
  const todayCompletedTasks = tasks.filter(t =>
    t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === todayStr
  ).length

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }

  /* ---------- header ---------- */

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWidget()
  }, [])

  const handleQuit = useCallback(() => {
    window.electronAPI?.quitApp()
  }, [])

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev
      window.electronAPI?.setWidgetPinned?.(next)
      try {
        localStorage.setItem('focusflow-widget-pinned', String(next))
      } catch {
        // 存储不可用时仅本次生效
      }
      return next
    })
  }, [])

  // 挂载即同步一次：小组件窗口默认置顶，取消置顶需重启后仍生效
  useEffect(() => {
    window.electronAPI?.setWidgetPinned?.(isPinned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!mounted) return <WidgetSkeleton />

  return (
    <div
      className="h-screen select-none overflow-hidden bg-background text-foreground relative flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <BackgroundGlow />

      <header
        className="relative z-10 shrink-0 flex items-center justify-between px-4 pt-3 pb-2.5"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div>
          <div className="text-2xs text-foreground/50 font-medium tracking-wide leading-tight">
            {currentTime.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            <span className="ml-1.5 text-foreground/80 font-semibold">
              {currentTime.toLocaleDateString('zh-CN', { weekday: 'long' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="text-3xl font-bold tracking-tight text-foreground tabular-nums leading-none"
            style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}
          >
            {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className={cn('flex flex-col gap-1 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}>
            <button
              onClick={handleTogglePin}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
              title={isPinned ? '取消置顶' : '置顶'}
            >
              {isPinned ? <Pin className="w-3 h-3 text-foreground/60" /> : <PinOff className="w-3 h-3 text-foreground/60" />}
            </button>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
              title="关闭小组件"
            >
              <X className="w-3 h-3 text-foreground/60" />
            </button>
            <button
              onClick={handleQuit}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-red-500/80 flex items-center justify-center transition-colors"
              style={{ WebkitAppRegion: 'no-drag' }}
              title="退出 FocusFlow"
            >
              <LogOut className="w-3 h-3 text-foreground/60" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 pb-3 flex flex-col gap-2">
        {/* pomodoro */}
        <GlassCard className="p-3 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-1.5">
              <ModeIcon className={cn('w-3.5 h-3.5', config.text)} />
              <span className={cn('text-2xs font-medium', config.text)}>{config.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: pomodoroSettings.sessionsBeforeLongBreak }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all duration-300',
                    i < completedSessions ? cn('scale-110', config.dot) : 'bg-white/15'
                  )}
                />
              ))}
            </div>
          </div>

          <div className="relative w-24 h-24 mt-0.5">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="64" cy="64" r={radius}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(config.ring, 'transition-all duration-700 ease-out drop-shadow-lg')}
              />
            </svg>
            <button
              onClick={handleToggle}
              className="absolute inset-0 m-auto w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center"
              style={{ WebkitAppRegion: 'no-drag' }}
              title={isRunning ? '暂停' : '开始'}
            >
              <div
                className="text-[19px] font-bold tracking-tight text-foreground tabular-nums leading-none drop-shadow"
                style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}
              >
                {formatClock(timeLeft)}
              </div>
              <div className={cn('text-3xs mt-1 flex items-center gap-1', config.text)}>
                {isRunning ? <Pause className="w-2 h-2" /> : <Play className="w-2 h-2" />}
                {isRunning ? '进行中' : '点击开始'}
              </div>
            </button>
          </div>

          {selectedTask && (
            <div className="w-full mt-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 flex items-center gap-2">
              <Flame className={cn('w-3 h-3 shrink-0', config.text)} />
              <span className="text-2xs text-foreground/80 truncate flex-1">{selectedTask.title}</span>
              <button
                onClick={() => handleSelectTask(null)}
                className="text-3xs text-foreground/40 hover:text-foreground/80 shrink-0"
                style={{ WebkitAppRegion: 'no-drag' }}
              >
                取消
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-2">
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors text-foreground/50 hover:text-foreground"
              style={{ WebkitAppRegion: 'no-drag' }}
              title="重置"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggle}
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-lg',
                config.btn
              )}
              style={{ WebkitAppRegion: 'no-drag' }}
              title={isRunning ? '暂停' : '开始'}
            >
              {isRunning ? <Pause className="w-[18px] h-[18px]" /> : <Play className="w-[18px] h-[18px] ml-0.5" />}
            </button>
            <button
              onClick={handleSkip}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors text-foreground/50 hover:text-foreground"
              style={{ WebkitAppRegion: 'no-drag' }}
              title="跳过"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </GlassCard>

        {/* tasks */}
        <GlassCard className="p-3">
          <CardHeader
            icon={ListTodo}
            label="今日待办"
            right={
              <span className="text-3xs text-foreground/40">
                {dueTasks.length > 0 ? `${dueTasks.filter(t => !t.completedToday).length} 项待处理` : '已清空'}
              </span>
            }
          />
          {visibleTasks.length > 0 ? (
            <div className="space-y-1">
              {visibleTasks.map(task => (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all border',
                    task.completedToday
                      ? 'bg-green-500/[0.07] border-green-500/15'
                      : task.id === pomodoroTimerState.selectedTaskId
                        ? cn('bg-white/[0.07] border-white/15 shadow-inner')
                        : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06]'
                  )}
                >
                  <button
                    onClick={() => { if (!task.completedToday) handleCompleteTask(task.id) }}
                    className="shrink-0"
                    style={{ WebkitAppRegion: 'no-drag' }}
                    title={task.completedToday ? '已完成' : '完成'}
                  >
                    {task.completedToday ? (
                      <CircleCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-foreground/20 hover:text-chart-2 transition-colors" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSelectTask(task.id === pomodoroTimerState.selectedTaskId ? null : task.id)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                    style={{ WebkitAppRegion: 'no-drag' }}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', task.completedToday ? 'bg-green-500' : (priorityColors[task.priority] || priorityColors.low))} />
                    <span className={cn('text-2xs truncate', task.completedToday ? 'text-foreground/40 line-through' : 'text-foreground/90')}>
                      {task.title}
                    </span>
                  </button>
                  {task.estimatedPomodoros && task.estimatedPomodoros > 0 && !task.completedToday && (
                    <span className="text-3xs text-foreground/40 bg-white/[0.06] px-1.5 py-0.5 rounded-md shrink-0">
                      {task.completedPomodoros}/{task.estimatedPomodoros}
                    </span>
                  )}
                </div>
              ))}
              {hiddenTaskCount > 0 && (
                <div className="px-2.5 py-1 text-3xs text-foreground/35">
                  还有 {hiddenTaskCount} 项待办，去主窗口查看
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-1.5 text-foreground/30">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-2xs">今日任务已全部完成</span>
            </div>
          )}
        </GlassCard>

        {/* habits */}
        <GlassCard className="p-3">
          <CardHeader
            icon={Target}
            label="今日习惯"
            right={
              <span className="text-3xs text-foreground/40">
                {completedHabits}/{activeHabits.length} · {habitRate}%
              </span>
            }
          />
          {activeHabits.length > 0 ? (
            <>
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-chart-2/70 to-chart-2 transition-all duration-700"
                  style={{ width: `${habitRate}%` }}
                />
              </div>
              <div className="space-y-1">
                {visibleHabits.map(habit => {
                  const isCompleted = habitCheckIns.some(
                    c => c.habitId === habit.id && new Date(c.date).toDateString() === todayStr && c.completed
                  )
                  return (
                    <button
                      key={habit.id}
                      onClick={() => handleCheckIn(habit.id, isCompleted)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all text-left',
                        isCompleted ? 'bg-green-500/[0.07]' : 'bg-white/[0.02] hover:bg-white/[0.06]'
                      )}
                      style={{ WebkitAppRegion: 'no-drag' }}
                    >
                      <span className={cn('text-sm shrink-0', isCompleted && 'opacity-60')}>{habit.icon}</span>
                      <span className={cn('text-2xs flex-1 truncate', isCompleted && 'line-through text-foreground/40')}>
                        {habit.name}
                      </span>
                      {isCompleted ? (
                        <CircleCheck className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-foreground/20 shrink-0" />
                      )}
                    </button>
                  )
                })}
                {hiddenHabitCount > 0 && (
                  <div className="px-2.5 text-3xs text-foreground/35">还有 {hiddenHabitCount} 项习惯</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-foreground/30 py-1">
              <Target className="w-3.5 h-3.5" />
              <span className="text-2xs">暂无习惯，去主窗口添加</span>
            </div>
          )}
        </GlassCard>

        {/* stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Flame, value: String(todayPomodoros), label: '今日番茄', tint: 'text-chart-1' },
            { icon: Timer, value: formatDuration(todayFocusMinutes), label: '专注时长', tint: 'text-chart-3' },
            { icon: CheckCircle2, value: String(todayCompletedTasks), label: '完成任务', tint: 'text-chart-2' },
          ].map(({ icon: Icon, value, label, tint }) => (
            <div
              key={label}
              className="rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/[0.06] px-2 py-1.5 flex items-center gap-2"
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', tint)} />
              <div className="min-w-0">
                <div className="text-2xs font-semibold text-foreground leading-tight truncate">{value}</div>
                <div className="text-3xs text-foreground/40 leading-tight">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
