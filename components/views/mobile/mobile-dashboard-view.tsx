'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useStats, useStreak, useTodayTasks, useUrgentTasks } from '@/lib/hooks'
import { CheckCircle2, Clock, Flame, Target, ChevronRight, Timer, Plus, Brain, Sparkles, Calendar, ListChecks, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileStatCard } from '@/components/mobile/mobile-stat-card'
import { MobileSectionHeader } from '@/components/mobile/mobile-section-header'
import { MobileEmptyState } from '@/components/mobile/mobile-empty-state'

export function MobileDashboardView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { tasks, habits, habitCheckIns, completeTask, pomodoroTimerState, focusGoals, pomodoroSessions } = useAppStore()
  const stats = useStats()
  const streak = useStreak()
  const todayTasks = useTodayTasks()
  const urgentTasks = useUrgentTasks()

  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  const focusMinutes = Math.round(stats.todayFocusSeconds / 60)
  const focusPercent = focusGoals.dailyMinutes > 0 ? Math.min(100, Math.round((focusMinutes / focusGoals.dailyMinutes) * 100)) : 0

  const todayCheckIns = useMemo(() => {
    const todayStr = new Date().toDateString()
    return habitCheckIns.filter(h => new Date(h.date).toDateString() === todayStr)
  }, [habitCheckIns])

  const activeHabits = habits.filter(h => !h.archived)
  const pendingTasks = tasks.filter(t => t.status !== 'done')
  const completedToday = tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === today.toDateString())
  const timeLeft = pomodoroTimerState.timeLeft
  const minutesLeft = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const secondsLeft = (timeLeft % 60).toString().padStart(2, '0')

  const todayPomodoroCount = pomodoroSessions.filter(
    s => new Date(s.completedAt).toDateString() === today.toDateString() && s.type === 'work'
  ).length

  const circumference = 2 * Math.PI * 44
  const focusStrokeDashoffset = circumference - (focusPercent / 100) * circumference

  const QUICK_ACTIONS = [
    { id: 'add-task', label: '新建任务', icon: Plus, color: 'text-blue-500', bg: 'bg-blue-500/10', action: () => onNavigate?.('tasks') },
    { id: 'focus', label: '开始专注', icon: Brain, color: 'text-violet-500', bg: 'bg-violet-500/10', action: () => onNavigate?.('focus') },
    { id: 'calendar', label: '日历', icon: Calendar, color: 'text-green-500', bg: 'bg-green-500/10', action: () => onNavigate?.('calendar') },
    { id: 'stats', label: '统计', icon: BarChart3, color: 'text-orange-500', bg: 'bg-orange-500/10', action: () => onNavigate?.('stats') },
  ]

  return (
    <div className="space-y-5 px-4 pt-4 pb-24">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">{greeting} 👋</h2>
        <p className="text-sm text-muted-foreground">{dateStr}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <svg width="56" height="56" className="transform -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                className="stroke-primary"
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={2 * Math.PI * 22 - (focusPercent / 100) * 2 * Math.PI * 22}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Timer className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-lg font-bold">{focusMinutes}<span className="text-xs font-normal text-muted-foreground">分钟</span></p>
            <p className="text-[10px] text-muted-foreground">目标 {focusGoals.dailyMinutes}分 · {focusPercent}%</p>
          </div>
        </div>

        <MobileStatCard
          icon={CheckCircle2}
          iconBg="bg-green-500/15"
          iconColor="text-green-500"
          label="已完成"
          value={stats.completedToday}
          suffix="任务"
          sublabel={`待办 ${pendingTasks.length} 项`}
          onClick={() => onNavigate?.('tasks')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MobileStatCard
          icon={Flame}
          iconBg="bg-orange-500/15"
          iconColor="text-orange-500"
          label="连续专注"
          value={streak}
          suffix="天"
          onClick={() => onNavigate?.('focus')}
        />
        <MobileStatCard
          icon={Target}
          iconBg="bg-violet-500/15"
          iconColor="text-violet-500"
          label="今日番茄"
          value={todayPomodoroCount}
          suffix="个"
          onClick={() => onNavigate?.('focus')}
        />
      </div>

      <div className="flex gap-2">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            className={cn('flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl glass-card active:scale-95 transition-all')}
            onClick={action.action}
          >
            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', action.bg)}>
              <action.icon className={cn('h-4 w-4', action.color)} />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{action.label}</span>
          </button>
        ))}
      </div>

      {pomodoroTimerState.isRunning && (
        <button
          className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 text-white p-4 flex items-center justify-between active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
          onClick={() => onNavigate?.('focus')}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Timer className="h-5 w-5 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">专注进行中</p>
              <p className="text-xs opacity-80 font-[var(--font-timer)] tabular-nums">{minutesLeft}:{secondsLeft} 剩余</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-60" />
        </button>
      )}

      <div className="space-y-3">
        <MobileSectionHeader
          title="今日待办"
          action={{ label: '查看全部', onClick: () => onNavigate?.('tasks') }}
        />

        {urgentTasks.length > 0 && (
          <div className="space-y-2">
            {urgentTasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <button
                  className="shrink-0 h-5 w-5 rounded-full border-2 border-red-400 flex items-center justify-center active:scale-90 transition-transform"
                  onClick={() => completeTask(task.id)}
                >
                  {task.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-[10px] text-red-500">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {new Date(task.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">紧急</span>
              </div>
            ))}
          </div>
        )}

        {todayTasks.length > 0 ? (
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <button
                  className="shrink-0 h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center active:scale-90 transition-transform"
                  onClick={() => completeTask(task.id)}
                >
                  {task.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</p>
                  {task.dueDate && (
                    <p className="text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {new Date(task.dueDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                {task.priority === 'high' && (
                  <span className="text-[10px] font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">高</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <MobileEmptyState
            icon={CheckCircle2}
            title="今天没有待办任务"
            description="享受轻松的一天吧"
            action={{ label: '添加任务', onClick: () => onNavigate?.('tasks') }}
          />
        )}
      </div>

      {activeHabits.length > 0 && (
        <div className="space-y-3">
          <MobileSectionHeader
            title="今日习惯"
            action={{ label: '查看全部', onClick: () => onNavigate?.('habits') }}
          />
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {activeHabits.slice(0, 6).map(habit => {
              const checkedToday = todayCheckIns.some(c => c.habitId === habit.id)
              return (
                <button
                  key={habit.id}
                  className={cn(
                    'shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 min-w-[80px]',
                    checkedToday
                      ? 'bg-primary/10 border-primary/20'
                      : 'bg-muted/30 border-transparent'
                  )}
                  onClick={() => {
                    if (!checkedToday) {
                      useAppStore.getState().checkInHabit(habit.id, new Date(), true)
                    }
                  }}
                >
                  <span className="text-2xl">{habit.icon || '📋'}</span>
                  <span className="text-[11px] font-medium truncate max-w-[64px]">{habit.name}</span>
                  {checkedToday && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {completedToday.length > 0 && (
        <div className="space-y-3">
          <MobileSectionHeader title="今日完成" />
          <div className="space-y-2">
            {completedToday.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-sm text-muted-foreground line-through truncate">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
