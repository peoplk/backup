'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
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
  ListTodo,
  BarChart3,
  Circle,
  CircleCheck,
  Zap,
  CalendarDays,
  PartyPopper,
  Gift,
  Heart,
  Sparkles,
  ArrowUpRight,
  Minus,
  Pin,
  PinOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type WidgetTab = 'timer' | 'tasks' | 'habits' | 'stats'

const modeConfig = {
  work: { label: '专注', color: 'text-chart-1', bg: 'bg-chart-1/10', ring: 'stroke-chart-1', icon: Target, btn: 'bg-chart-1' },
  'short-break': { label: '短休息', color: 'text-chart-2', bg: 'bg-chart-2/10', ring: 'stroke-chart-2', icon: Coffee, btn: 'bg-chart-2' },
  'long-break': { label: '长休息', color: 'text-chart-3', bg: 'bg-chart-3/10', ring: 'stroke-chart-3', icon: Sun, btn: 'bg-chart-3' },
}

const anniversaryIcons: Record<string, typeof PartyPopper> = {
  birthday: Gift,
  anniversary: Heart,
  countdown: CalendarDays,
  festival: Sparkles,
  custom: PartyPopper,
}

function CircularTimer({
  progress,
  timeLeft,
  mode,
  isRunning,
  onToggle,
  onReset,
  onSkip,
  completedSessions,
  sessionsBeforeLongBreak,
}: {
  progress: number
  timeLeft: number
  mode: string
  isRunning: boolean
  onToggle: () => void
  onReset: () => void
  onSkip: () => void
  completedSessions: number
  sessionsBeforeLongBreak: number
}) {
  const config = modeConfig[mode as keyof typeof modeConfig]
  const IconComponent = config.icon
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-muted/10"
          />
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(config.ring, 'transition-all duration-700 ease-out')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <IconComponent className={cn('w-4 h-4 mb-1.5', config.color)} />
          <div
            className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
            style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{config.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {Array.from({ length: sessionsBeforeLongBreak }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              i < completedSessions ? 'bg-chart-1 scale-110' : 'bg-muted/25'
            )}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={onReset}
          className="w-9 h-9 rounded-xl bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-xl',
            config.btn,
            mode === 'work' && 'shadow-chart-1/25',
            mode === 'short-break' && 'shadow-chart-2/25',
            mode === 'long-break' && 'shadow-chart-3/25',
          )}
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
        </button>

        <button
          onClick={onSkip}
          className="w-9 h-9 rounded-xl bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function TimerView() {
  const { tasks, pomodoroTimerState, updatePomodoroTimerState, pomodoroSettings } = useAppStore()
  const mode = pomodoroTimerState.mode
  const timeLeft = pomodoroTimerState.timeLeft
  const isRunning = pomodoroTimerState.isRunning
  const completedSessions = pomodoroTimerState.completedSessions
  const selectedTaskId = pomodoroTimerState.selectedTaskId
  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  const totalDuration =
    mode === 'work' ? pomodoroSettings.workDuration :
    mode === 'short-break' ? pomodoroSettings.shortBreakDuration :
    pomodoroSettings.longBreakDuration

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100

  const handleToggle = useCallback(() => {
    updatePomodoroTimerState({ isRunning: !isRunning })
  }, [isRunning, updatePomodoroTimerState])

  const handleReset = useCallback(() => {
    updatePomodoroTimerState({ isRunning: false, timeLeft: totalDuration })
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
      updatePomodoroTimerState({ isRunning: false, mode: 'work', timeLeft: pomodoroSettings.workDuration })
    }
  }, [mode, completedSessions, pomodoroSettings, updatePomodoroTimerState])

  const handleSelectTask = useCallback((taskId: string | null) => {
    updatePomodoroTimerState({ selectedTaskId: taskId })
  }, [updatePomodoroTimerState])

  const activeTasks = tasks.filter(t => t.status !== 'done' && !t.archived).slice(0, 5)

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-chart-1',
    low: 'bg-muted-foreground/40',
  }

  return (
    <div className="flex flex-col items-center px-4 pt-3 pb-4">
      <CircularTimer
        progress={progress}
        timeLeft={timeLeft}
        mode={mode}
        isRunning={isRunning}
        onToggle={handleToggle}
        onReset={handleReset}
        onSkip={handleSkip}
        completedSessions={completedSessions}
        sessionsBeforeLongBreak={pomodoroSettings.sessionsBeforeLongBreak}
      />

      {selectedTask && (
        <div className="w-full mt-5 px-3 py-2.5 rounded-xl bg-muted/15 border border-border/20">
          <div className="text-[9px] text-muted-foreground mb-0.5">当前任务</div>
          <div className="text-xs text-foreground truncate font-medium">{selectedTask.title}</div>
        </div>
      )}

      {!selectedTask && activeTasks.length > 0 && (
        <div className="w-full mt-5 space-y-1">
          <div className="text-[9px] text-muted-foreground px-1 mb-1.5">选择任务专注</div>
          {activeTasks.map(task => (
            <button
              key={task.id}
              onClick={() => handleSelectTask(task.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted/20 transition-colors text-left"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityColors[task.priority] || priorityColors.low)} />
              <span className="text-[11px] text-foreground/80 truncate flex-1">{task.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TasksView() {
  const { tasks, pomodoroTimerState, updatePomodoroTimerState, completeTask, repeatCompletions } = useAppStore()
  const selectedTaskId = pomodoroTimerState.selectedTaskId

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const todayTasks = useMemo(() => {
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

  const otherTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.archived || t.status === 'done') return false
      if (t.repeatRule) return false
      if (t.dueDate) {
        const dueDate = new Date(t.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate.getTime() > today.getTime()
      }
      return false
    })
  }, [tasks, today])

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-chart-1',
    low: 'bg-muted-foreground/40',
  }

  const handleSelectTask = useCallback((taskId: string) => {
    updatePomodoroTimerState({ selectedTaskId: taskId === selectedTaskId ? null : taskId })
  }, [selectedTaskId, updatePomodoroTimerState])

  const handleCompleteTask = useCallback((taskId: string) => {
    completeTask(taskId)
  }, [completeTask])

  const renderTaskItem = (task: typeof tasks[0] & { completedToday?: boolean }) => (
    <div
      key={task.id}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors',
        task.completedToday
          ? 'bg-green-500/5 border border-green-500/15'
          : task.id === selectedTaskId
            ? 'bg-chart-1/8 border border-chart-1/15'
            : 'hover:bg-muted/15 border border-transparent'
      )}
    >
      <button
        onClick={() => { if (!task.completedToday) handleCompleteTask(task.id) }}
        className="shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {task.completedToday ? (
          <CircleCheck className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/30 hover:text-chart-2 transition-colors" />
        )}
      </button>
      <button
        onClick={() => handleSelectTask(task.id)}
        className="flex-1 min-w-0 text-left"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <div className="flex items-center gap-1.5">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', task.completedToday ? 'bg-green-500' : (priorityColors[task.priority] || priorityColors.low))} />
          <span className={cn('text-xs truncate', task.completedToday ? 'text-muted-foreground line-through' : 'text-foreground/90')}>{task.title}</span>
        </div>
      </button>
      {task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
        <span className="text-[9px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-md shrink-0">
          {task.completedPomodoros}/{task.estimatedPomodoros}
        </span>
      )}
    </div>
  )

  return (
    <div className="px-3 py-3 space-y-4 h-full overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
      {todayTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <Zap className="w-3.5 h-3.5 text-chart-1" />
            <span className="text-[10px] text-foreground font-medium">今日待办</span>
            <span className="text-[9px] text-muted-foreground/60 ml-auto">{todayTasks.length}</span>
          </div>
          <div className="space-y-1">{todayTasks.slice(0, 8).map(renderTaskItem)}</div>
        </div>
      )}

      {otherTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">其他任务</span>
            <span className="text-[9px] text-muted-foreground/60 ml-auto">{otherTasks.length}</span>
          </div>
          <div className="space-y-1">{otherTasks.slice(0, 5).map(renderTaskItem)}</div>
        </div>
      )}

      {todayTasks.length === 0 && otherTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mb-3 opacity-20" />
          <span className="text-xs">暂无待办任务</span>
        </div>
      )}
    </div>
  )
}

function HabitsView() {
  const { habits, habitCheckIns, checkInHabit } = useAppStore()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayStr = today.toDateString()

  const todayHabits = habits.filter(h => !h.archived)
  const completedCount = todayHabits.filter(h =>
    habitCheckIns.some(c => c.habitId === h.id && new Date(c.date).toDateString() === todayStr && c.completed)
  ).length

  const completionRate = todayHabits.length > 0 ? Math.round((completedCount / todayHabits.length) * 100) : 0

  const handleCheckIn = useCallback((habitId: string, isCompleted: boolean) => {
    if (!isCompleted) checkInHabit(habitId, new Date(), true)
  }, [checkInHabit])

  return (
    <div className="px-3 py-3 space-y-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <div className="rounded-xl bg-muted/10 border border-border/15 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground font-medium">今日习惯</span>
          <span className="text-[10px] text-muted-foreground">{completedCount}/{todayHabits.length}</span>
        </div>
        <div className="h-2 rounded-full bg-muted/25 overflow-hidden">
          <div className="h-full rounded-full bg-chart-2 transition-all duration-700" style={{ width: `${completionRate}%` }} />
        </div>
        <div className="text-[9px] text-muted-foreground mt-1 text-right">{completionRate}%</div>
      </div>

      <div className="space-y-1">
        {todayHabits.map(habit => {
          const isCompleted = habitCheckIns.some(
            c => c.habitId === habit.id && new Date(c.date).toDateString() === todayStr && c.completed
          )
          return (
            <button
              key={habit.id}
              onClick={() => handleCheckIn(habit.id, isCompleted)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                isCompleted ? 'bg-chart-2/5' : 'hover:bg-muted/15'
              )}
            >
              <span className="text-base shrink-0">{habit.icon}</span>
              <span className={cn('text-xs flex-1 truncate', isCompleted && 'line-through text-muted-foreground')}>
                {habit.name}
              </span>
              {isCompleted ? (
                <CircleCheck className="w-4 h-4 text-chart-2 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/25 shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {todayHabits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="w-10 h-10 mb-3 opacity-20" />
          <span className="text-xs">暂无习惯</span>
        </div>
      )}
    </div>
  )
}

function StatsView() {
  const { tasks, pomodoroSessions, habits, habitCheckIns, anniversaries } = useAppStore()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayStr = today.toDateString()

  const todayPomodoros = pomodoroSessions.filter(
    s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
  ).length

  const todayFocusMinutes = pomodoroSessions
    .filter(s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work')
    .reduce((sum, s) => sum + s.duration, 0)

  const completedTasks = tasks.filter(t => t.status === 'done').length
  const todayCompletedTasks = tasks.filter(t =>
    t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === todayStr
  ).length

  const todayHabits = habits.filter(h => !h.archived)
  const completedHabits = todayHabits.filter(h =>
    habitCheckIns.some(c => c.habitId === h.id && new Date(c.date).toDateString() === todayStr && c.completed)
  ).length
  const habitRate = todayHabits.length > 0 ? Math.round((completedHabits / todayHabits.length) * 100) : 0

  const totalTasks = tasks.filter(t => !t.archived).length
  const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const upcomingAnniversaries = useMemo(() => {
    return anniversaries
      .filter(a => {
        const target = new Date(a.date)
        const currentYear = today.getFullYear()
        target.setFullYear(currentYear)
        if (target.getTime() < today.getTime()) target.setFullYear(currentYear + 1)
        const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diff <= 30
      })
      .slice(0, 3)
      .map(a => {
        const target = new Date(a.date)
        const currentYear = today.getFullYear()
        target.setFullYear(currentYear)
        if (target.getTime() < today.getTime()) target.setFullYear(currentYear + 1)
        const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { ...a, daysLeft: diff }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [anniversaries, today])

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}分钟`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className="px-3 py-3 space-y-4 h-full overflow-y-auto">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-muted/10 border border-border/15 p-3 text-center">
          <Flame className="w-4 h-4 mx-auto mb-1.5 text-chart-1" />
          <div className="text-lg font-bold text-foreground">{todayPomodoros}</div>
          <div className="text-[9px] text-muted-foreground">番茄</div>
        </div>
        <div className="rounded-xl bg-muted/10 border border-border/15 p-3 text-center">
          <Timer className="w-4 h-4 mx-auto mb-1.5 text-chart-3" />
          <div className="text-lg font-bold text-foreground">{formatMinutes(todayFocusMinutes)}</div>
          <div className="text-[9px] text-muted-foreground">专注</div>
        </div>
        <div className="rounded-xl bg-muted/10 border border-border/15 p-3 text-center">
          <CheckCircle2 className="w-4 h-4 mx-auto mb-1.5 text-chart-2" />
          <div className="text-lg font-bold text-foreground">{todayCompletedTasks}</div>
          <div className="text-[9px] text-muted-foreground">完成</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-muted/10 border border-border/15 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-chart-1" />
              <span className="text-[11px] text-foreground font-medium">任务进度</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{completedTasks}/{totalTasks}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/25 overflow-hidden">
            <div className="h-full rounded-full bg-chart-1 transition-all" style={{ width: `${taskRate}%` }} />
          </div>
          <div className="text-[9px] text-muted-foreground mt-1 text-right">{taskRate}%</div>
        </div>

        <div className="rounded-xl bg-muted/10 border border-border/15 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-chart-2" />
              <span className="text-[11px] text-foreground font-medium">习惯完成</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{completedHabits}/{todayHabits.length}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/25 overflow-hidden">
            <div className="h-full rounded-full bg-chart-2 transition-all" style={{ width: `${habitRate}%` }} />
          </div>
          <div className="text-[9px] text-muted-foreground mt-1 text-right">{habitRate}%</div>
        </div>
      </div>

      {upcomingAnniversaries.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <CalendarDays className="w-3.5 h-3.5 text-chart-4" />
            <span className="text-[10px] text-foreground font-medium">即将到来</span>
          </div>
          <div className="space-y-1">
            {upcomingAnniversaries.map(a => {
              const Icon = anniversaryIcons[a.type] || PartyPopper
              return (
                <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/10 border border-border/15">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${a.color}20` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">{a.title}</div>
                    <div className="text-[9px] text-muted-foreground">{new Date(a.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div className="text-[10px] font-medium text-chart-4 shrink-0">
                    {a.daysLeft === 0 ? '今天' : `${a.daysLeft}天后`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function DesktopWidget() {
  const [activeTab, setActiveTab] = useState<WidgetTab>('timer')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWidget()
  }, [])

  const handleTogglePin = useCallback(() => {
    setIsPinned(prev => !prev)
  }, [])

  const formatHour = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
  }

  const tabConfig: Record<WidgetTab, { icon: typeof Timer; label: string }> = {
    timer: { icon: Timer, label: '计时' },
    tasks: { icon: ListTodo, label: '任务' },
    habits: { icon: Target, label: '习惯' },
    stats: { icon: BarChart3, label: '统计' },
  }

  return (
    <div
      className="h-screen select-none overflow-hidden bg-background text-foreground flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-2.5"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-chart-1/15 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-chart-1" />
          </div>
          <div>
            <div
              className="text-base font-bold tracking-tight text-foreground tabular-nums"
              style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}
            >
              {formatHour(currentTime)}
            </div>
            <div className="text-[9px] text-muted-foreground -mt-0.5">{formatDate(currentTime)}</div>
          </div>
        </div>

        <div className={cn('flex items-center gap-1 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}>
          <button
            onClick={handleTogglePin}
            className="w-7 h-7 rounded-lg bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            title={isPinned ? '取消置顶' : '置顶'}
          >
            {isPinned ? (
              <Pin className="w-3 h-3 text-muted-foreground" />
            ) : (
              <PinOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg bg-muted/40 hover:bg-destructive/80 flex items-center justify-center transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'timer' && <TimerView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'habits' && <HabitsView />}
        {activeTab === 'stats' && <StatsView />}
      </div>

      <div
        className="shrink-0 grid grid-cols-4 px-2 py-2 border-t border-border/15"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {(Object.keys(tabConfig) as WidgetTab[]).map(key => {
          const { icon: Icon, label } = tabConfig[key]
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all',
                isActive
                  ? 'text-chart-1 bg-chart-1/8'
                  : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[8px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
